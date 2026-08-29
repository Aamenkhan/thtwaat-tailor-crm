import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT, requireRoles } from '../../middleware/auth';

const router = Router();

const BOMItemSchema = z.object({
  materialName: z.string().min(1),
  inventoryItemId: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  wastagePercentage: z.number().min(0).default(0),
  costPerUnit: z.number().min(0).default(0)
});

const ProductStyleInputSchema = z.object({
  styleNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  fabricDetails: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  gender: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']).default('MEN'),
  sizeRange: z.array(z.string()).default([]),
  colorRange: z.array(z.string()).default([]),
  sellingPrice: z.number().min(0).default(0),
  standardProdMinutes: z.number().min(0).default(60),
  bom: z.array(BOMItemSchema).default([])
});

router.use(authenticateJWT);

// List Product Styles
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, gender } = req.query;
    const where: any = { companyId: req.companyId! };

    if (category) where.category = String(category);
    if (gender) where.gender = String(gender);
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q } },
        { styleNumber: { contains: q } },
        { category: { contains: q } }
      ];
    }

    const products = await prisma.productStyle.findMany({
      where,
      include: {
        bomItems: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = products.map(p => ({
      ...p,
      sizeRange: JSON.parse(p.sizeRangeJson || '[]'),
      colorRange: JSON.parse(p.colorRangeJson || '[]')
    }));

    return res.json({ data: parsed, total: parsed.length });
  } catch (error) {
    next(error);
  }
});

// Get Single Product Style with full BOM details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.productStyle.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId!
      },
      include: {
        bomItems: {
          include: {
            inventoryItem: true
          }
        }
      }
    });

    if (!product) return res.status(404).json({ error: 'Product style not found' });

    return res.json({
      product: {
        ...product,
        sizeRange: JSON.parse(product.sizeRangeJson || '[]'),
        colorRange: JSON.parse(product.colorRangeJson || '[]')
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create Product Style with BOM & Auto Costing
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = ProductStyleInputSchema.parse(req.body);

    // Calculate estimated material cost from BOM items with wastage factor
    let estimatedCost = 0;
    data.bom.forEach(b => {
      const wastageMultiplier = 1 + (b.wastagePercentage / 100);
      const itemCost = b.quantity * b.costPerUnit * wastageMultiplier;
      estimatedCost += itemCost;
    });

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.productStyle.create({
        data: {
          companyId: req.companyId!,
          styleNumber: data.styleNumber,
          name: data.name,
          category: data.category,
          description: data.description,
          photoUrl: data.photoUrl,
          fabricDetails: data.fabricDetails,
          brand: data.brand,
          gender: data.gender,
          sizeRangeJson: JSON.stringify(data.sizeRange),
          colorRangeJson: JSON.stringify(data.colorRange),
          sellingPrice: data.sellingPrice,
          estimatedCost: Math.round(estimatedCost * 100) / 100,
          standardProdMinutes: data.standardProdMinutes
        }
      });

      if (data.bom.length > 0) {
        await tx.bOMItem.createMany({
          data: data.bom.map(b => ({
            companyId: req.companyId!,
            productStyleId: created.id,
            inventoryItemId: b.inventoryItemId || null,
            materialName: b.materialName,
            quantity: b.quantity,
            unit: b.unit,
            wastagePercentage: b.wastagePercentage,
            costPerUnit: b.costPerUnit
          }))
        });
      }

      return tx.productStyle.findUnique({
        where: { id: created.id },
        include: { bomItems: true }
      });
    });

    return res.status(201).json({
      message: 'Product Style & BOM created successfully',
      product: {
        ...product,
        sizeRange: data.sizeRange,
        colorRange: data.colorRange
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete Product Style
router.delete('/:id', requireRoles(['OWNER', 'ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.productStyle.findFirst({
      where: { id: req.params.id, companyId: req.companyId! }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await prisma.productStyle.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
});

export const productRoutes = router;
