import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';
import { generateInvoicePDFBuffer } from './pdf.service';

const router = Router();

router.use(authenticateJWT);

// List Invoices
router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search } = req.query;
    const companyId = req.companyId!;

    const where: any = { companyId };
    if (status) where.status = String(status);
    if (search) {
      const q = String(search);
      where.OR = [
        { invoiceNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } }
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        order: {
          include: { items: true }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ data: invoices, total: invoices.length });
  } catch (error) {
    next(error);
  }
});

// Download / Stream Invoice PDF
router.get('/invoices/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        company: true,
        order: {
          include: { items: true }
        }
      }
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const items = invoice.order.items.map(item => ({
      name: `${item.customItemName} ${item.size ? `(Size: ${item.size})` : ''}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount
    }));

    const pdfBuffer = await generateInvoicePDFBuffer({
      company: invoice.company,
      invoice,
      items
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export const billingRoutes = router;
