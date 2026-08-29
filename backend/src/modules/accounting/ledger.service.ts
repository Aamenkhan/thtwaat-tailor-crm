import { prisma } from '../../config/db';

export class LedgerService {
  // 1. Customer Statement of Account (Debit Invoices vs Credit Payments)
  static async getCustomerLedger(companyId: string, customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) throw new Error('Customer not found');

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { companyId, order: { customerId } },
        orderBy: { invoiceDate: 'asc' }
      }),
      prisma.payment.findMany({
        where: { companyId, customerId },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    const transactions: any[] = [];

    // Map Invoices as Debits (Customer owes money)
    for (const inv of invoices) {
      transactions.push({
        id: inv.id,
        date: inv.invoiceDate,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Tax Invoice ${inv.invoiceNumber}`,
        debit: inv.totalAmount,
        credit: 0
      });
    }

    // Map Payments as Credits (Customer paid money)
    for (const pay of payments) {
      transactions.push({
        id: pay.id,
        date: pay.createdAt,
        type: 'PAYMENT',
        reference: pay.referenceNumber || 'PAY',
        description: `Payment received via ${pay.paymentMethod}`,
        debit: 0,
        credit: pay.amount
      });
    }

    // Sort chronologically
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate Running Balance
    let runningBalance = 0;
    const ledgerRows = transactions.map((tx) => {
      runningBalance = runningBalance + tx.debit - tx.credit;
      return {
        ...tx,
        date: new Date(tx.date).toISOString().split('T')[0],
        runningBalance: Number(runningBalance.toFixed(2))
      };
    });

    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const outstandingBalance = Number((totalInvoiced - totalPaid).toFixed(2));

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        businessName: customer.businessName,
        gstNumber: customer.gstNumber
      },
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        outstandingBalance
      },
      transactions: ledgerRows
    };
  }

  // 2. Vendor / Supplier Statement of Account
  static async getVendorLedger(companyId: string, supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) throw new Error('Supplier not found');

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { companyId, supplierId },
      orderBy: { orderDate: 'asc' }
    });

    const transactions = purchaseOrders.map((po) => ({
      id: po.id,
      date: po.orderDate.toISOString().split('T')[0],
      reference: po.poNumber,
      description: `Purchase Order for Raw Materials`,
      billAmount: po.finalAmount,
      status: po.paymentStatus
    }));

    const totalBilled = purchaseOrders.reduce((s, p) => s + p.finalAmount, 0);
    const totalPaid = purchaseOrders
      .filter((p) => p.paymentStatus === 'PAID')
      .reduce((s, p) => s + p.finalAmount, 0);
    const payableBalance = Number((totalBilled - totalPaid).toFixed(2));

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        companyName: supplier.companyName,
        phone: supplier.phone,
        gstNumber: supplier.gstNumber
      },
      summary: {
        totalBilled: Number(totalBilled.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        payableBalance
      },
      orders: transactions
    };
  }

  // 3. Double-entry Journal Entry logging
  static async recordJournalEntry(
    companyId: string,
    data: {
      narration: string;
      referenceType?: string;
      referenceId?: string;
      debitAccount: string;
      creditAccount: string;
      amount: number;
    }
  ) {
    const count = await prisma.journalEntry.count({ where: { companyId } });
    const entryNum = `JRN-${(count + 1).toString().padStart(6, '0')}`;

    return await prisma.journalEntry.create({
      data: {
        companyId,
        entryNumber: entryNum,
        narration: data.narration,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        debitAccount: data.debitAccount,
        creditAccount: data.creditAccount,
        amount: data.amount
      }
    });
  }
}
