import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT, requireRoles } from '../../middleware/auth';

const router = Router();

const WorkerInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional().nullable().or(z.literal('')),
  role: z.enum(['TAILOR', 'CUTTER', 'MASTER', 'FINISHER', 'QC_OPERATOR', 'OTHER']).default('TAILOR'),
  wageType: z.enum(['PIECE_RATE', 'MONTHLY_SALARY', 'DAILY_WAGE']).default('PIECE_RATE'),
  defaultPieceRate: z.number().min(0).default(0),
  monthlySalary: z.number().min(0).default(0)
});

const PieceRateInputSchema = z.object({
  workerId: z.string(),
  jobCardId: z.string().optional().nullable(),
  stage: z.enum(['CUTTING', 'STITCHING', 'FINISHING', 'IRONING_PACKING', 'ALTERATION']),
  quantity: z.number().int().positive(),
  ratePerPiece: z.number().min(0),
  notes: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List Workers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, activeOnly } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (role) where.role = String(role);
    if (activeOnly === 'true') where.isActive = true;

    const workers = await prisma.worker.findMany({
      where,
      include: {
        _count: {
          select: {
            pieceRateLogs: true,
            productionLogs: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.json({ data: workers, total: workers.length });
  } catch (error) {
    next(error);
  }
});

// Create Worker
router.post('/', requireRoles(['OWNER', 'ADMIN', 'MANAGER', 'PRODUCTION_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = WorkerInputSchema.parse(req.body);
    const companyId = req.companyId!;

    const worker = await prisma.worker.create({
      data: {
        companyId,
        branchId: req.branchId || null,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        role: data.role,
        wageType: data.wageType,
        defaultPieceRate: data.defaultPieceRate,
        monthlySalary: data.monthlySalary
      }
    });

    return res.status(201).json({ message: 'Worker added successfully', worker });
  } catch (error) {
    next(error);
  }
});

// Get Single Worker & Earnings Summary
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await prisma.worker.findFirst({
      where: { id: req.params.id, companyId: req.companyId! },
      include: {
        pieceRateLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            jobCard: true
          }
        },
        productionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 30
        }
      }
    });

    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    // Aggregate piece-rate earnings
    const totalEarned = worker.pieceRateLogs.reduce((sum, log) => sum + log.totalPayout, 0);
    const unpaidAmount = worker.pieceRateLogs.filter(l => !l.isPaid).reduce((sum, log) => sum + log.totalPayout, 0);

    return res.json({
      worker,
      stats: {
        totalEarned,
        unpaidAmount,
        totalCompletedTasks: worker.pieceRateLogs.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Log manual Piece Rate work
router.post('/piece-rate-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PieceRateInputSchema.parse(req.body);
    const companyId = req.companyId!;

    const worker = await prisma.worker.findFirst({
      where: { id: data.workerId, companyId }
    });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const totalPayout = data.quantity * data.ratePerPiece;

    const log = await prisma.pieceRateLog.create({
      data: {
        companyId,
        branchId: worker.branchId,
        workerId: data.workerId,
        jobCardId: data.jobCardId || null,
        stage: data.stage,
        quantity: data.quantity,
        ratePerPiece: data.ratePerPiece,
        totalPayout,
        isPaid: false,
        notes: data.notes
      }
    });

    return res.status(201).json({ message: 'Piece rate logged', log });
  } catch (error) {
    next(error);
  }
});

export const workerRoutes = router;
