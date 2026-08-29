import { prisma } from '../../config/db';

export interface GSTBreakdown {
  taxableAmount: number;
  taxRate: number;
  isInterState: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalWithTax: number;
}

export class GSTService {
  // 1. Calculate CGST/SGST/IGST breakdown given seller company state & buyer place of supply
  static calculateGST(
    taxableAmount: number,
    taxRate: number,
    companyStateCode: string = '07', // Default Delhi (07)
    placeOfSupply: string = '07' // e.g. "07-DELHI", "27-MAHARASHTRA"
  ): GSTBreakdown {
    const cleanCompanyState = companyStateCode.slice(0, 2);
    const cleanBuyerState = placeOfSupply.slice(0, 2);

    const isInterState = cleanCompanyState !== cleanBuyerState;
    const totalTax = Number(((taxableAmount * taxRate) / 100).toFixed(2));
    const totalWithTax = Number((taxableAmount + totalTax).toFixed(2));

    if (isInterState) {
      return {
        taxableAmount,
        taxRate,
        isInterState: true,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: taxRate,
        igstAmount: totalTax,
        totalTax,
        totalWithTax
      };
    } else {
      const halfRate = taxRate / 2;
      const halfTax = Number((totalTax / 2).toFixed(2));
      return {
        taxableAmount,
        taxRate,
        isInterState: false,
        cgstRate: halfRate,
        cgstAmount: halfTax,
        sgstRate: halfRate,
        sgstAmount: halfTax,
        igstRate: 0,
        igstAmount: 0,
        totalTax,
        totalWithTax
      };
    }
  }

  // 2. GSTR-1 Outward Supplies Summary
  static async getGSTR1Report(
    companyId: string,
    period: { startDate?: string; endDate?: string } = {}
  ) {
    const where: any = { companyId };
    if (period.startDate || period.endDate) {
      where.invoiceDate = {};
      if (period.startDate) where.invoiceDate.gte = new Date(period.startDate);
      if (period.endDate) where.invoiceDate.lte = new Date(period.endDate);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' }
    });

    const b2bInvoices: any[] = [];
    const b2cInvoices: any[] = [];
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    for (const inv of invoices) {
      const taxable = inv.subtotal - inv.discount;
      totalTaxable += taxable;
      totalCGST += inv.cgstAmount;
      totalSGST += inv.sgstAmount;
      totalIGST += inv.igstAmount;

      const record = {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
        customerName: inv.customerName,
        customerGst: inv.customerGst || 'URP (Unregistered)',
        placeOfSupply: inv.placeOfSupply || '07-DELHI',
        hsnSac: inv.hsnSacCode || '9988',
        taxableValue: taxable,
        taxRate: inv.taxRate,
        cgst: inv.cgstAmount,
        sgst: inv.sgstAmount,
        igst: inv.igstAmount,
        totalInvoiceValue: inv.totalAmount
      };

      if (inv.customerGst && inv.customerGst.trim().length >= 15) {
        b2bInvoices.push(record);
      } else {
        b2cInvoices.push(record);
      }
    }

    return {
      period: {
        startDate: period.startDate || 'All-Time',
        endDate: period.endDate || 'Present'
      },
      summary: {
        totalInvoices: invoices.length,
        totalTaxableValue: Number(totalTaxable.toFixed(2)),
        totalCGST: Number(totalCGST.toFixed(2)),
        totalSGST: Number(totalSGST.toFixed(2)),
        totalIGST: Number(totalIGST.toFixed(2)),
        totalOutputTax: Number((totalCGST + totalSGST + totalIGST).toFixed(2))
      },
      b2bCount: b2bInvoices.length,
      b2bInvoices,
      b2cCount: b2cInvoices.length,
      b2cInvoices
    };
  }

  // 3. GSTR-3B Monthly Tax & Input Tax Credit (ITC) Computation
  static async getGSTR3BReport(
    companyId: string,
    period: { startDate?: string; endDate?: string } = {}
  ) {
    const dateFilter: any = {};
    if (period.startDate) dateFilter.gte = new Date(period.startDate);
    if (period.endDate) dateFilter.lte = new Date(period.endDate);

    const invoiceWhere: any = { companyId };
    if (period.startDate || period.endDate) invoiceWhere.invoiceDate = dateFilter;

    const purchaseWhere: any = { companyId, status: { not: 'CANCELLED' } };
    if (period.startDate || period.endDate) purchaseWhere.orderDate = dateFilter;

    const expenseWhere: any = { companyId, status: { not: 'REJECTED' } };
    if (period.startDate || period.endDate) expenseWhere.expenseDate = dateFilter;

    // Fetch Outward Invoices, Inward Purchases, Inward Operating Expenses
    const [invoices, purchases, expenses] = await Promise.all([
      prisma.invoice.findMany({ where: invoiceWhere }),
      prisma.purchaseOrder.findMany({ where: purchaseWhere }),
      prisma.expense.findMany({ where: expenseWhere })
    ]);

    // Outward Supplies (Tax Liability)
    const outwardTaxable = invoices.reduce((s, i) => s + (i.subtotal - i.discount), 0);
    const outputCGST = invoices.reduce((s, i) => s + i.cgstAmount, 0);
    const outputSGST = invoices.reduce((s, i) => s + i.sgstAmount, 0);
    const outputIGST = invoices.reduce((s, i) => s + i.igstAmount, 0);
    const totalOutputTax = outputCGST + outputSGST + outputIGST;

    // Inward Eligible ITC (Raw Materials & Services)
    const itcFromPurchases = purchases.reduce((s, p) => s + (p.isItcEligible ? (p.gstPaid || p.taxAmount) : 0), 0);
    const itcFromExpenses = expenses.reduce((s, e) => s + (e.gstPaid || 0), 0);
    const totalEligibleITC = itcFromPurchases + itcFromExpenses;

    // Net GST Payable in Cash (Minimum 0)
    const netGstPayable = Math.max(0, totalOutputTax - totalEligibleITC);
    const itcCarriedForward = Math.max(0, totalEligibleITC - totalOutputTax);

    return {
      period: {
        startDate: period.startDate || 'All-Time',
        endDate: period.endDate || 'Present'
      },
      outwardSupplies: {
        taxableTurnover: Number(outwardTaxable.toFixed(2)),
        cgst: Number(outputCGST.toFixed(2)),
        sgst: Number(outputSGST.toFixed(2)),
        igst: Number(outputIGST.toFixed(2)),
        totalOutputTax: Number(totalOutputTax.toFixed(2))
      },
      eligibleITC: {
        itcFromRawMaterials: Number(itcFromPurchases.toFixed(2)),
        itcFromExpenses: Number(itcFromExpenses.toFixed(2)),
        totalEligibleITC: Number(totalEligibleITC.toFixed(2))
      },
      taxPaymentSettlement: {
        totalOutputTax: Number(totalOutputTax.toFixed(2)),
        itcUtilized: Number(Math.min(totalOutputTax, totalEligibleITC).toFixed(2)),
        netTaxPayableInCash: Number(netGstPayable.toFixed(2)),
        itcBalanceCarriedForward: Number(itcCarriedForward.toFixed(2))
      }
    };
  }
}
