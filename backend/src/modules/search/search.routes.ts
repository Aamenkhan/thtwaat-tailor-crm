import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.json({ customers: [], orders: [], products: [], jobCards: [], invoices: [] });
    }

    const companyId = req.companyId!;
    const queryStr = String(q).trim();

    const [customers, orders, products, jobCards, invoices] = await Promise.all([
      prisma.customer.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: queryStr } },
            { phone: { contains: queryStr } },
            { businessName: { contains: queryStr } }
          ]
        },
        take: 5
      }),
      prisma.order.findMany({
        where: {
          companyId,
          OR: [
            { orderNumber: { contains: queryStr } },
            { customer: { name: { contains: queryStr } } }
          ]
        },
        include: { customer: true },
        take: 5
      }),
      prisma.productStyle.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: queryStr } },
            { styleNumber: { contains: queryStr } },
            { category: { contains: queryStr } }
          ]
        },
        take: 5
      }),
      prisma.productionJobCard.findMany({
        where: {
          companyId,
          OR: [
            { jobCardNumber: { contains: queryStr } }
          ]
        },
        include: { order: { include: { customer: true } } },
        take: 5
      }),
      prisma.invoice.findMany({
        where: {
          companyId,
          OR: [
            { invoiceNumber: { contains: queryStr } },
            { customerName: { contains: queryStr } }
          ]
        },
        take: 5
      })
    ]);

    return res.json({
      query: queryStr,
      results: {
        customers,
        orders,
        products,
        jobCards,
        invoices
      }
    });
  } catch (error) {
    next(error);
  }
});

export const searchRoutes = router;
