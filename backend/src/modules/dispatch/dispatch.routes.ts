import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

const ShipmentInputSchema = z.object({
  orderId: z.string(),
  courierName: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  packageWeightKg: z.number().positive().optional().nullable(),
  boxDimensions: z.string().optional().nullable(),
  expectedDelivery: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List Shipments
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const where: any = { companyId: req.companyId! };
    if (status) where.status = String(status);

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        order: {
          include: { customer: true, items: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ data: shipments });
  } catch (error) {
    next(error);
  }
});

// Create Packing & Dispatch
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ShipmentInputSchema.parse(req.body);
    const companyId = req.companyId!;
    const branchId = req.branchId || (await prisma.branch.findFirst({ where: { companyId } }))!.id;

    const shipment = await prisma.shipment.create({
      data: {
        companyId,
        branchId,
        orderId: data.orderId,
        courierName: data.courierName || 'In-House Delivery',
        trackingNumber: data.trackingNumber || `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'DISPATCHED',
        packageWeightKg: data.packageWeightKg,
        boxDimensions: data.boxDimensions,
        dispatchDate: new Date(),
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
        notes: data.notes
      }
    });

    // Update order status to DELIVERED / READY
    await prisma.order.update({
      where: { id: data.orderId },
      data: { status: 'READY_FOR_PICKUP' }
    });

    return res.status(201).json({ message: 'Shipment created and dispatched', shipment });
  } catch (error) {
    next(error);
  }
});

export const dispatchRoutes = router;
