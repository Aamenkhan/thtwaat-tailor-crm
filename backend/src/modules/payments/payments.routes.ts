import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

const PaymentInputSchema = z.object({
  orderId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  customerId: z.string(),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'RAZORPAY']).default('CASH'),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

router.use(authenticateJWT);

// List Payments
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, method } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (customerId) where.customerId = String(customerId);
    if (method) where.paymentMethod = String(method);

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: true,
        order: true,
        invoice: true,
        recordedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ data: payments, total: payments.length });
  } catch (error) {
    next(error);
  }
});

// Record Payment & Settle Balances
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = PaymentInputSchema.parse(req.body);
    const companyId = req.companyId!;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          companyId,
          branchId: req.branchId || req.user?.branchId || (await tx.branch.findFirst({ where: { companyId } }))!.id,
          orderId: data.orderId || null,
          invoiceId: data.invoiceId || null,
          customerId: data.customerId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          recordedById: req.user?.id
        }
      });

      // 2. Update Order balances if orderId provided
      if (data.orderId) {
        const order = await tx.order.findUnique({ where: { id: data.orderId } });
        if (order) {
          const newAdvance = order.advancePaid + data.amount;
          const newBalance = Math.max(0, order.finalAmount - newAdvance);
          const paymentStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

          await tx.order.update({
            where: { id: order.id },
            data: {
              advancePaid: newAdvance,
              balanceDue: newBalance,
              paymentStatus
            }
          });
        }
      }

      // 3. Update Invoice balances if invoiceId provided
      if (data.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
        if (invoice) {
          const newPaid = invoice.amountPaid + data.amount;
          const newBalance = Math.max(0, invoice.totalAmount - newPaid);
          const status = newBalance === 0 ? 'PAID' : 'PARTIAL';

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newPaid,
              balanceDue: newBalance,
              status
            }
          });
        }
      }

      return payment;
    });

    return res.status(201).json({ message: 'Payment recorded successfully', payment: result });
  } catch (error) {
    next(error);
  }
});

// Daily Cash Drawer Summary
router.get('/daily-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: {
        companyId,
        createdAt: { gte: today }
      }
    });

    const summary = {
      cash: 0,
      upi: 0,
      card: 0,
      bankTransfer: 0,
      totalCollected: 0,
      transactionCount: payments.length
    };

    payments.forEach(p => {
      summary.totalCollected += p.amount;
      if (p.paymentMethod === 'CASH') summary.cash += p.amount;
      else if (p.paymentMethod === 'UPI') summary.upi += p.amount;
      else if (p.paymentMethod === 'CREDIT_CARD' || p.paymentMethod === 'DEBIT_CARD') summary.card += p.amount;
      else summary.bankTransfer += p.amount;
    });

    return res.json({ date: today.toISOString().slice(0, 10), summary });
  } catch (error) {
    next(error);
  }
});

export const paymentRoutes = router;
