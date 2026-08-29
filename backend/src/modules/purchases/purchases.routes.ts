import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT, requireRoles } from '../../middleware/auth';

const router = Router();

const SupplierSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().optional().nullable(),
  phone: z.string().min(10),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  paymentTerms: z.string().default('Net 30')
});

const PurchaseOrderSchema = z.object({
  supplierId: z.string(),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    materialName: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    unitCost: z.number().min(0)
  })).min(1)
});

router.use(authenticateJWT);

// List Suppliers
router.get('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { companyId: req.companyId! },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { name: 'asc' }
    });
    return res.json({ data: suppliers });
  } catch (error) {
    next(error);
  }
});

// Create Supplier
router.post('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = SupplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({
      data: {
        companyId: req.companyId!,
        ...data
      }
    });
    return res.status(201).json({ message: 'Supplier created', supplier });
  } catch (error) {
    next(error);
  }
});

// List Purchase Orders
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const where: any = { companyId: req.companyId! };
    if (status) where.status = String(status);

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ data: pos });
  } catch (error) {
    next(error);
  }
});

// Create Purchase Order
router.post('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PurchaseOrderSchema.parse(req.body);
    const companyId = req.companyId!;
    const branchId = req.branchId || (await prisma.branch.findFirst({ where: { companyId } }))!.id;

    let subtotal = 0;
    const items = data.items.map(item => {
      const itemTotal = item.quantity * item.unitCost;
      subtotal += itemTotal;
      return {
        ...item,
        totalAmount: itemTotal
      };
    });

    const rand = Math.floor(1000 + Math.random() * 9000);
    const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${rand}`;

    const po = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          companyId,
          branchId,
          supplierId: data.supplierId,
          poNumber,
          status: 'ORDERED',
          totalAmount: subtotal,
          finalAmount: subtotal,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          notes: data.notes
        }
      });

      await tx.purchaseOrderItem.createMany({
        data: items.map(i => ({
          companyId,
          purchaseOrderId: created.id,
          materialName: i.materialName,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unitCost,
          totalAmount: i.totalAmount
        }))
      });

      return tx.purchaseOrder.findUnique({
        where: { id: created.id },
        include: { supplier: true, items: true }
      });
    });

    return res.status(201).json({ message: 'Purchase order created', purchaseOrder: po });
  } catch (error) {
    next(error);
  }
});

// Receive Goods (GRN) & Auto Update Inventory
router.post('/orders/:id/receive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, companyId },
      include: { items: true }
    });

    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark PO as RECEIVED
      const updatedPo = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date()
        }
      });

      // 2. Add each item to Inventory & create StockMovement log
      for (const item of po.items) {
        let invItem = await tx.inventoryItem.findFirst({
          where: { companyId, name: item.materialName }
        });

        if (invItem) {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: invItem.currentStock + item.quantity }
          });
        } else {
          invItem = await tx.inventoryItem.create({
            data: {
              companyId,
              branchId: po.branchId,
              name: item.materialName,
              category: 'FABRIC',
              unit: item.unit,
              currentStock: item.quantity,
              unitCost: item.unitCost
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            companyId,
            branchId: po.branchId,
            inventoryItemId: invItem.id,
            movementType: 'PURCHASE_IN',
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: 'PO',
            referenceId: po.poNumber,
            notes: `Received from PO ${po.poNumber}`
          }
        });
      }

      return updatedPo;
    });

    return res.json({ message: 'Goods received & inventory updated', purchaseOrder: result });
  } catch (error) {
    next(error);
  }
});

export const purchaseRoutes = router;
