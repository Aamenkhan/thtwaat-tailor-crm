import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT, requireRoles } from '../../middleware/auth';

const router = Router();

const CustomerInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessName: z.string().optional().nullable(),
  phone: z.string().min(10, 'Valid phone required'),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  customerType: z.enum(['INDIVIDUAL', 'TAILOR_CUSTOMER', 'BOUTIQUE', 'BRAND', 'WHOLESALE']).default('INDIVIDUAL'),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([])
});

router.use(authenticateJWT);

// List Customers with search & filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, type } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (type) {
      where.customerType = String(type);
    }
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { businessName: { contains: q } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: true,
            measurements: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = customers.map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]')
    }));

    return res.json({ data: parsed, total: parsed.length });
  } catch (error) {
    next(error);
  }
});

// Get Single Customer with measurements & orders
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId!
      },
      include: {
        measurements: {
          orderBy: { updatedAt: 'desc' }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Calculate total spend & pending balance
    const orders = await prisma.order.findMany({
      where: { customerId: customer.id, companyId: req.companyId! },
      select: { finalAmount: true, balanceDue: true }
    });

    const totalSpend = orders.reduce((sum, o) => sum + o.finalAmount, 0);
    const totalDue = orders.reduce((sum, o) => sum + o.balanceDue, 0);

    return res.json({
      customer: {
        ...customer,
        tags: JSON.parse(customer.tags || '[]'),
        measurements: customer.measurements.map(m => ({
          ...m,
          values: JSON.parse(m.valuesJson || '{}'),
          referenceImages: JSON.parse(m.referenceImagesJson || '[]')
        })),
        stats: {
          totalOrders: orders.length,
          totalSpend,
          totalDue
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create Customer
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CustomerInputSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        companyId: req.companyId!,
        name: data.name,
        businessName: data.businessName,
        phone: data.phone,
        whatsapp: data.whatsapp || data.phone,
        email: data.email,
        address: data.address,
        gstNumber: data.gstNumber,
        customerType: data.customerType,
        notes: data.notes,
        tags: JSON.stringify(data.tags)
      }
    });

    return res.status(201).json({
      message: 'Customer created successfully',
      customer: {
        ...customer,
        tags: data.tags
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update Customer
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CustomerInputSchema.partial().parse(req.body);

    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, companyId: req.companyId! }
    });

    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const updatePayload: any = { ...data };
    if (data.tags) {
      updatePayload.tags = JSON.stringify(data.tags);
    }

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: updatePayload
    });

    return res.json({
      message: 'Customer updated successfully',
      customer: {
        ...updated,
        tags: JSON.parse(updated.tags || '[]')
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete Customer
router.delete('/:id', requireRoles(['OWNER', 'ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, companyId: req.companyId! }
    });

    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    await prisma.customer.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export const customerRoutes = router;
