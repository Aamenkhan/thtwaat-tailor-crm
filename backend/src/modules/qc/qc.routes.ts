import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT, requireRoles } from '../../middleware/auth';

const router = Router();

const QCInspectSchema = z.object({
  jobCardId: z.string(),
  status: z.enum(['PASSED', 'REWORK_REQUIRED', 'REJECTED']),
  defectType: z.enum([
    'STITCHING_DEFECT',
    'MEASUREMENT_MISMATCH',
    'FABRIC_DAMAGE',
    'COLOR_MISMATCH',
    'STAIN',
    'TRIM_DEFECT',
    'OTHER'
  ]).optional().nullable(),
  defectNotes: z.string().optional().nullable(),
  defectPhotos: z.array(z.string()).default([]),
  reworkAssignedToId: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List QC records
router.get('/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const where: any = { companyId: req.companyId! };
    if (status) where.status = String(status);

    const records = await prisma.qCRecord.findMany({
      where,
      include: {
        jobCard: {
          include: {
            order: { include: { customer: true } },
            orderItem: true
          }
        },
        inspector: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = records.map(r => ({
      ...r,
      defectPhotos: JSON.parse(r.defectPhotosJson || '[]')
    }));

    return res.json({ data: parsed, total: parsed.length });
  } catch (error) {
    next(error);
  }
});

// Perform QC Inspection on Job Card
router.post('/inspect', requireRoles(['OWNER', 'ADMIN', 'MANAGER', 'QC', 'PRODUCTION_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = QCInspectSchema.parse(req.body);
    const companyId = req.companyId!;

    const jobCard = await prisma.productionJobCard.findFirst({
      where: { id: data.jobCardId, companyId }
    });

    if (!jobCard) return res.status(404).json({ error: 'Job Card not found' });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create QC Record
      const qcRecord = await tx.qCRecord.create({
        data: {
          companyId,
          jobCardId: jobCard.id,
          inspectorId: req.user?.id,
          status: data.status,
          defectType: data.defectType || null,
          defectNotes: data.defectNotes,
          defectPhotosJson: JSON.stringify(data.defectPhotos),
          reworkAssignedToId: data.reworkAssignedToId || null
        }
      });

      // 2. Update Job Card QC status and production stage
      let nextStage = jobCard.currentStage;
      let rejectedQty = jobCard.rejectedQuantity;

      if (data.status === 'PASSED') {
        nextStage = 'IRONING_PACKING';
      } else if (data.status === 'REWORK_REQUIRED') {
        nextStage = 'STITCHING'; // Send back to stitching for rework
      } else if (data.status === 'REJECTED') {
        rejectedQty += 1;
      }

      const updatedJobCard = await tx.productionJobCard.update({
        where: { id: jobCard.id },
        data: {
          qcStatus: data.status,
          currentStage: nextStage,
          rejectedQuantity: rejectedQty,
          assignedWorkerId: data.reworkAssignedToId || jobCard.assignedWorkerId
        }
      });

      return { qcRecord, updatedJobCard };
    });

    return res.status(201).json({
      message: `QC Inspection completed: ${data.status}`,
      qcRecord: result.qcRecord,
      jobCard: result.updatedJobCard
    });
  } catch (error) {
    next(error);
  }
});

export const qcRoutes = router;
