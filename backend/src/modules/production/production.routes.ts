import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

const AdvanceStageSchema = z.object({
  nextStage: z.enum(['CUTTING', 'STITCHING', 'FINISHING', 'QC_INSPECTION', 'IRONING_PACKING', 'COMPLETED']),
  workerId: z.string().optional().nullable(),
  completedQuantity: z.number().int().positive().default(1),
  pieceRateAmount: z.number().min(0).optional(),
  notes: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List Production Job Cards with filters
router.get('/job-cards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stage, priority, workerId, search } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (stage) where.currentStage = String(stage);
    if (priority) where.priority = String(priority);
    if (workerId) where.assignedWorkerId = String(workerId);
    if (search) {
      const q = String(search);
      where.OR = [
        { jobCardNumber: { contains: q } },
        { order: { orderNumber: { contains: q } } },
        { orderItem: { customItemName: { contains: q } } }
      ];
    }

    const jobCards = await prisma.productionJobCard.findMany({
      where,
      include: {
        order: {
          include: { customer: true }
        },
        orderItem: {
          include: {
            measurement: true,
            productStyle: true
          }
        },
        assignedWorker: true,
        productionLogs: {
          include: { worker: true },
          orderBy: { createdAt: 'desc' }
        },
        qcRecords: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ data: jobCards, total: jobCards.length });
  } catch (error) {
    next(error);
  }
});

// Get Single Job Card
router.get('/job-cards/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobCard = await prisma.productionJobCard.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId!
      },
      include: {
        order: {
          include: { customer: true }
        },
        orderItem: {
          include: {
            measurement: true,
            productStyle: true
          }
        },
        assignedWorker: true,
        productionLogs: {
          include: { worker: true },
          orderBy: { createdAt: 'desc' }
        },
        qcRecords: {
          include: { inspector: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!jobCard) return res.status(404).json({ error: 'Job Card not found' });

    return res.json({ jobCard });
  } catch (error) {
    next(error);
  }
});

// Advance Production Stage & Log Worker Piece-Rate
router.post('/job-cards/:id/advance-stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = AdvanceStageSchema.parse(req.body);
    const companyId = req.companyId!;

    const jobCard = await prisma.productionJobCard.findFirst({
      where: { id: req.params.id, companyId },
      include: { assignedWorker: true }
    });

    if (!jobCard) return res.status(404).json({ error: 'Job Card not found' });

    const prevStage = jobCard.currentStage;
    const workerId = data.workerId || jobCard.assignedWorkerId;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Log production step
      await tx.productionLog.create({
        data: {
          companyId,
          jobCardId: jobCard.id,
          stage: prevStage,
          workerId: workerId || null,
          quantity: data.completedQuantity,
          notes: data.notes || `Moved from ${prevStage} to ${data.nextStage}`
        }
      });

      // 2. If piece-rate applies, log worker piece-rate earning
      if (workerId && (data.pieceRateAmount || jobCard.assignedWorker?.defaultPieceRate)) {
        const rate = data.pieceRateAmount !== undefined 
          ? data.pieceRateAmount 
          : (jobCard.assignedWorker?.defaultPieceRate || 0);

        if (rate > 0) {
          await tx.pieceRateLog.create({
            data: {
              companyId,
              branchId: jobCard.branchId,
              workerId,
              jobCardId: jobCard.id,
              stage: prevStage,
              quantity: data.completedQuantity,
              ratePerPiece: rate,
              totalPayout: rate * data.completedQuantity,
              isPaid: false,
              notes: `Auto-logged from job card ${jobCard.jobCardNumber} (${prevStage})`
            }
          });
        }
      }

      // 3. Update Job Card stage
      const isCompleted = data.nextStage === 'COMPLETED';
      const updated = await tx.productionJobCard.update({
        where: { id: jobCard.id },
        data: {
          currentStage: data.nextStage,
          completedQuantity: isCompleted ? jobCard.plannedQuantity : jobCard.completedQuantity,
          completedAt: isCompleted ? new Date() : null,
          assignedWorkerId: workerId || jobCard.assignedWorkerId
        }
      });

      return updated;
    });

    return res.json({
      message: `Job Card progressed to ${data.nextStage}`,
      jobCard: result
    });
  } catch (error) {
    next(error);
  }
});

// Scan Barcode / QR Code Endpoint
router.post('/scan-qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrText } = req.body;
    if (!qrText) return res.status(400).json({ error: 'QR Code text is required' });

    let parsedQr: any = null;
    try {
      parsedQr = JSON.parse(qrText);
    } catch (e) {
      // If plain job card number or order number string
      parsedQr = { jobCardNumber: qrText };
    }

    const jobCardNumber = parsedQr.jobCardNumber || qrText;

    const jobCard = await prisma.productionJobCard.findFirst({
      where: {
        companyId: req.companyId!,
        OR: [
          { jobCardNumber },
          { id: jobCardNumber }
        ]
      },
      include: {
        order: { include: { customer: true } },
        orderItem: { include: { measurement: true } },
        assignedWorker: true,
        productionLogs: { include: { worker: true } }
      }
    });

    if (!jobCard) {
      return res.status(404).json({ error: 'No matching Job Card found for this QR code' });
    }

    return res.json({
      success: true,
      jobCard
    });
  } catch (error) {
    next(error);
  }
});

export const productionRoutes = router;
