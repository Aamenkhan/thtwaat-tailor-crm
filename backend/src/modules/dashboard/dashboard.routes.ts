import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    // 1. Orders Stats
    const allOrders = await prisma.order.findMany({
      where: { companyId },
      include: {
        customer: true,
        items: true
      }
    });

    const todaysOrders = allOrders.filter(o => o.createdAt >= today);
    const pendingOrders = allOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
    
    // Financials
    const todaysSales = todaysOrders.reduce((sum, o) => sum + o.finalAmount, 0);
    const totalOutstandingDue = pendingOrders.reduce((sum, o) => sum + o.balanceDue, 0);

    // Deliveries
    const upcomingDeliveries = pendingOrders.filter(o => {
      const d = new Date(o.deliveryDate);
      return d >= today && d <= threeDaysLater;
    });

    const delayedOrders = pendingOrders.filter(o => {
      const d = new Date(o.deliveryDate);
      return d < today;
    });

    // 2. Production & Job Cards Stats
    const allJobCards = await prisma.productionJobCard.findMany({
      where: { companyId },
      include: {
        assignedWorker: true,
        order: { include: { customer: true } },
        orderItem: true
      }
    });

    const inProductionJobCards = allJobCards.filter(j => j.currentStage !== 'COMPLETED');
    const totalProductionQuantity = inProductionJobCards.reduce((sum, j) => sum + j.plannedQuantity, 0);
    const readyGarments = allJobCards.filter(j => j.currentStage === 'COMPLETED' || j.currentStage === 'IRONING_PACKING').length;
    const pendingQC = allJobCards.filter(j => j.qcStatus === 'PENDING' && j.currentStage === 'QC_INSPECTION').length;
    const totalRejectedQuantity = allJobCards.reduce((sum, j) => sum + j.rejectedQuantity, 0);

    // Stage breakdown for production kanban/pipeline
    const stageCounts = {
      CUTTING: allJobCards.filter(j => j.currentStage === 'CUTTING').length,
      STITCHING: allJobCards.filter(j => j.currentStage === 'STITCHING').length,
      FINISHING: allJobCards.filter(j => j.currentStage === 'FINISHING').length,
      QC_INSPECTION: allJobCards.filter(j => j.currentStage === 'QC_INSPECTION').length,
      IRONING_PACKING: allJobCards.filter(j => j.currentStage === 'IRONING_PACKING').length,
      COMPLETED: allJobCards.filter(j => j.currentStage === 'COMPLETED').length
    };

    // 3. Low-Stock Inventory Items
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { companyId }
    });
    const lowStockItems = inventoryItems.filter(i => i.currentStock <= i.minStockAlert);

    // 4. Factory specific metrics: Today's pieces produced
    const todaysLogs = await prisma.productionLog.findMany({
      where: {
        companyId,
        createdAt: { gte: today }
      }
    });
    const todaysPcsProduced = todaysLogs.reduce((sum, l) => sum + l.quantity, 0);

    return res.json({
      overview: {
        todaysOrdersCount: todaysOrders.length,
        todaysSales,
        pendingOrdersCount: pendingOrders.length,
        totalOutstandingDue,
        totalProductionQuantity,
        readyGarments,
        pendingQCCount: pendingQC,
        rejectedQuantity: totalRejectedQuantity,
        lowStockCount: lowStockItems.length,
        upcomingDeliveriesCount: upcomingDeliveries.length,
        delayedOrdersCount: delayedOrders.length
      },
      manufacturingKpi: {
        todaysProductionPcs: todaysPcsProduced,
        totalActiveJobCards: inProductionJobCards.length,
        qcPassRate: allJobCards.length > 0 
          ? Math.round(((allJobCards.filter(j => j.qcStatus === 'PASSED').length) / Math.max(1, allJobCards.length)) * 100)
          : 100
      },
      stageBreakdown: stageCounts,
      lowStockMaterials: lowStockItems.slice(0, 5),
      upcomingDeliveries: upcomingDeliveries.slice(0, 5),
      delayedOrders: delayedOrders.slice(0, 5),
      recentOrders: allOrders.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
});

export const dashboardRoutes = router;
