import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;

    const orders = await prisma.order.findMany({ where: { companyId } });
    const payments = await prisma.payment.findMany({ where: { companyId } });
    const jobCards = await prisma.productionJobCard.findMany({ where: { companyId } });
    const workers = await prisma.worker.findMany({
      where: { companyId },
      include: { pieceRateLogs: true }
    });
    const materials = await prisma.inventoryItem.findMany({ where: { companyId } });

    const totalSales = orders.reduce((sum, o) => sum + o.finalAmount, 0);
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalOutstanding = orders.reduce((sum, o) => sum + o.balanceDue, 0);

    const workerPerformance = workers.map(w => ({
      id: w.id,
      name: w.name,
      role: w.role,
      tasksCompleted: w.pieceRateLogs.length,
      totalEarned: w.pieceRateLogs.reduce((sum, l) => sum + l.totalPayout, 0)
    }));

    return res.json({
      financials: {
        totalSales,
        totalCollected,
        totalOutstanding,
        ordersCount: orders.length
      },
      production: {
        totalJobCards: jobCards.length,
        completedJobCards: jobCards.filter(j => j.currentStage === 'COMPLETED').length,
        qcPassed: jobCards.filter(j => j.qcStatus === 'PASSED').length,
        qcRejected: jobCards.reduce((sum, j) => sum + j.rejectedQuantity, 0)
      },
      inventory: {
        totalItems: materials.length,
        lowStockItems: materials.filter(m => m.currentStock <= m.minStockAlert).length
      },
      workers: workerPerformance
    });
  } catch (error) {
    next(error);
  }
});

export const reportRoutes = router;
