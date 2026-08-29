import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT, requireRoles } from '../../middleware/auth';

const router = Router();

const InventoryItemInputSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  category: z.enum([
    'FABRIC',
    'BUTTON',
    'ZIPPER',
    'THREAD',
    'LINING',
    'LABEL',
    'PACKING_MATERIAL',
    'ACCESSORY',
    'OTHER'
  ]),
  unit: z.string().min(1),
  currentStock: z.number().min(0).default(0),
  minStockAlert: z.number().min(0).default(10),
  unitCost: z.number().min(0).default(0),
  supplierName: z.string().optional().nullable(),
  location: z.string().optional().nullable()
});

const StockMovementInputSchema = z.object({
  movementType: z.enum(['PURCHASE_IN', 'PRODUCTION_CONSUMPTION', 'DAMAGE_WASTAGE', 'RETURN', 'ADJUSTMENT']),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).default(0),
  referenceType: z.string().optional().nullable(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List Inventory Items
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, lowStockOnly } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (category) where.category = String(category);
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { supplierName: { contains: q } }
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    let filtered = items;
    if (lowStockOnly === 'true') {
      filtered = items.filter(item => item.currentStock <= item.minStockAlert);
    }

    return res.json({ data: filtered, total: filtered.length });
  } catch (error) {
    next(error);
  }
});

// Low Stock Alerts endpoint
router.get('/alerts/low-stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { companyId: req.companyId! },
      orderBy: { currentStock: 'asc' }
    });

    const lowStockItems = items.filter(item => item.currentStock <= item.minStockAlert);
    return res.json({ data: lowStockItems, count: lowStockItems.length });
  } catch (error) {
    next(error);
  }
});

// Create Inventory Item
router.post('/', requireRoles(['OWNER', 'ADMIN', 'MANAGER', 'STORE_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = InventoryItemInputSchema.parse(req.body);
    const companyId = req.companyId!;

    const item = await prisma.inventoryItem.create({
      data: {
        companyId,
        branchId: req.branchId || null,
        name: data.name,
        sku: data.sku,
        category: data.category,
        unit: data.unit,
        currentStock: data.currentStock,
        minStockAlert: data.minStockAlert,
        unitCost: data.unitCost,
        supplierName: data.supplierName,
        location: data.location
      }
    });

    return res.status(201).json({ message: 'Inventory item created', item });
  } catch (error) {
    next(error);
  }
});

// Record Stock Movement (In / Out / Wastage)
router.post('/:id/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = StockMovementInputSchema.parse(req.body);
    const companyId = req.companyId!;

    const item = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, companyId }
    });

    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    let newStock = item.currentStock;
    if (data.movementType === 'PURCHASE_IN' || data.movementType === 'RETURN') {
      newStock += data.quantity;
    } else {
      if (item.currentStock < data.quantity) {
        return res.status(400).json({ error: `Insufficient stock! Current stock: ${item.currentStock} ${item.unit}` });
      }
      newStock -= data.quantity;
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          branchId: item.branchId,
          inventoryItemId: item.id,
          movementType: data.movementType,
          quantity: data.quantity,
          unitCost: data.unitCost || item.unitCost,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          notes: data.notes,
          performedById: req.user?.id
        }
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: newStock }
      });

      return { movement, updatedItem };
    });

    return res.status(201).json({
      message: 'Stock movement recorded successfully',
      movement: result.movement,
      item: result.updatedItem
    });
  } catch (error) {
    next(error);
  }
});

export const inventoryRoutes = router;
