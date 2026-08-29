import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

const OrderItemInputSchema = z.object({
  productStyleId: z.string().optional().nullable(),
  customItemName: z.string().min(1),
  itemType: z.enum(['BESPOKE_TAILORING', 'BULK_MANUFACTURING', 'ALTERATION', 'SAMPLE']).default('BESPOKE_TAILORING'),
  gender: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']).default('MEN'),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().min(0),
  measurementId: z.string().optional().nullable(),
  fabricProvidedByCustomer: z.boolean().default(false),
  fabricDetails: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  designNotes: z.string().optional().nullable(),
  referenceImages: z.array(z.string()).default([])
});

const CreateOrderInputSchema = z.object({
  customerId: z.string(),
  branchId: z.string().optional(),
  orderType: z.enum(['BESPOKE_TAILORING', 'BULK_MANUFACTURING', 'ALTERATION', 'SAMPLE']).default('BESPOKE_TAILORING'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  trialDate: z.string().optional().nullable(),
  deliveryDate: z.string().min(1),
  items: z.array(OrderItemInputSchema).min(1),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  advancePaid: z.number().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'RAZORPAY']).default('CASH'),
  notes: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List Orders
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, priority, customerId, search } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (status) where.status = String(status);
    if (type) where.orderType = String(type);
    if (priority) where.priority = String(priority);
    if (customerId) where.customerId = String(customerId);

    if (search) {
      const q = String(search);
      where.OR = [
        { orderNumber: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { phone: { contains: q } } }
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        branch: true,
        items: {
          include: {
            productStyle: true,
            measurement: true
          }
        },
        jobCards: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ data: orders, total: orders.length });
  } catch (error) {
    next(error);
  }
});

// Get Single Order Details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId!
      },
      include: {
        customer: true,
        branch: true,
        items: {
          include: {
            productStyle: {
              include: { bomItems: true }
            },
            measurement: true,
            jobCards: {
              include: {
                assignedWorker: true,
                productionLogs: true,
                qcRecords: true
              }
            }
          }
        },
        jobCards: {
          include: {
            assignedWorker: true,
            productionLogs: {
              include: { worker: true }
            },
            qcRecords: true
          }
        },
        invoices: true,
        payments: true
      }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    return res.json({ order });
  } catch (error) {
    next(error);
  }
});

// Create Order (Bespoke or Bulk) + Generate Job Cards + Invoices
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateOrderInputSchema.parse(req.body);
    const companyId = req.companyId!;
    const branchId = data.branchId || req.branchId;

    if (!branchId) {
      return res.status(400).json({ error: 'Branch ID is required' });
    }

    // Verify Customer
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Calculate totals
    let subtotal = 0;
    const computedItems = data.items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;
      return {
        ...item,
        totalAmount: itemTotal
      };
    });

    const discountedSubtotal = Math.max(0, subtotal - data.discount);
    const taxAmount = (discountedSubtotal * data.taxRate) / 100;
    const finalAmount = discountedSubtotal + taxAmount;
    const balanceDue = Math.max(0, finalAmount - data.advancePaid);

    let paymentStatus = 'PENDING';
    if (data.advancePaid >= finalAmount && finalAmount > 0) {
      paymentStatus = 'PAID';
    } else if (data.advancePaid > 0) {
      paymentStatus = 'PARTIAL';
    }

    // Generate Order Number: ORD-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randSuffix}`;

    const createdOrder = await prisma.$transaction(async (tx) => {
      // 1. Create Order
      const order = await tx.order.create({
        data: {
          companyId,
          branchId,
          customerId: data.customerId,
          orderNumber,
          orderType: data.orderType,
          status: 'CONFIRMED',
          priority: data.priority,
          trialDate: data.trialDate ? new Date(data.trialDate) : null,
          deliveryDate: new Date(data.deliveryDate),
          totalAmount: subtotal,
          discount: data.discount,
          taxRate: data.taxRate,
          taxAmount,
          finalAmount,
          advancePaid: data.advancePaid,
          balanceDue,
          paymentStatus,
          notes: data.notes,
          createdById: req.user?.id
        }
      });

      // 2. Create Order Items and Production Job Cards
      for (let i = 0; i < computedItems.length; i++) {
        const itm = computedItems[i];
        const orderItem = await tx.orderItem.create({
          data: {
            companyId,
            orderId: order.id,
            productStyleId: itm.productStyleId || null,
            measurementId: itm.measurementId || null,
            customItemName: itm.customItemName,
            itemType: itm.itemType,
            gender: itm.gender,
            quantity: itm.quantity,
            unitPrice: itm.unitPrice,
            totalAmount: itm.totalAmount,
            fabricProvidedByCustomer: itm.fabricProvidedByCustomer,
            fabricDetails: itm.fabricDetails,
            color: itm.color,
            size: itm.size,
            designNotes: itm.designNotes,
            referenceImagesJson: JSON.stringify(itm.referenceImages)
          }
        });

        // Create Job Card for this item
        const jobCardNumber = `JOB-${orderNumber.replace('ORD-', '')}-${i + 1}`;
        await tx.productionJobCard.create({
          data: {
            companyId,
            branchId,
            orderId: order.id,
            orderItemId: orderItem.id,
            jobCardNumber,
            currentStage: 'CUTTING',
            qcStatus: 'PENDING',
            qrCode: JSON.stringify({
              type: 'JOB_CARD',
              orderId: order.id,
              jobCardNumber,
              itemName: itm.customItemName,
              qty: itm.quantity
            }),
            priority: data.priority,
            plannedQuantity: itm.quantity
          }
        });
      }

      // 3. Auto Generate Invoice
      const invoiceNumber = `INV-${orderNumber.replace('ORD-', '')}`;
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          branchId,
          orderId: order.id,
          invoiceNumber,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          customerGst: customer.gstNumber,
          subtotal,
          discount: data.discount,
          taxRate: data.taxRate,
          taxAmount,
          totalAmount: finalAmount,
          amountPaid: data.advancePaid,
          balanceDue,
          dueDate: new Date(data.deliveryDate),
          status: paymentStatus
        }
      });

      // 4. Record advance payment if provided
      if (data.advancePaid > 0) {
        await tx.payment.create({
          data: {
            companyId,
            branchId,
            orderId: order.id,
            invoiceId: invoice.id,
            customerId: customer.id,
            amount: data.advancePaid,
            paymentMethod: data.paymentMethod,
            notes: 'Initial Order Advance Deposit',
            recordedById: req.user?.id
          }
        });
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          items: true,
          jobCards: true,
          invoices: true,
          payments: true
        }
      });
    });

    return res.status(201).json({
      message: 'Order created successfully',
      order: createdOrder
    });
  } catch (error) {
    next(error);
  }
});

// Update Order Status
router.put('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, companyId: req.companyId! }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status }
    });

    return res.json({ message: 'Order status updated', order: updated });
  } catch (error) {
    next(error);
  }
});

export const orderRoutes = router;
