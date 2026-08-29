import { prisma } from '../../config/db';

export interface PnLStatement {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    grossInvoicedSales: number;
    discounts: number;
    netRevenue: number;
    invoicesCount: number;
  };
  costOfGoodsSold: {
    rawMaterialConsumption: number;
    artisanPieceRateWages: number;
    manufacturingOutsourcing: number;
    totalCOGS: number;
  };
  grossProfit: {
    amount: number;
    marginPercentage: number;
  };
  operatingExpenses: {
    rent: number;
    electricityPower: number;
    machineMaintenance: number;
    packaging: number;
    logisticsFuel: number;
    staffSalary: number;
    teaRefreshments: number;
    marketing: number;
    otherExpenses: number;
    totalOPEX: number;
  };
  operatingProfitEBITDA: {
    amount: number;
    marginPercentage: number;
  };
  taxes: {
    netGstPaid: number;
  };
  netProfit: {
    amount: number;
    marginPercentage: number;
    isProfitable: boolean;
  };
}

export class PnLService {
  static async getProfitAndLoss(
    companyId: string,
    period: { startDate?: string; endDate?: string } = {}
  ): Promise<PnLStatement> {
    const dateFilter: any = {};
    if (period.startDate) dateFilter.gte = new Date(period.startDate);
    if (period.endDate) dateFilter.lte = new Date(period.endDate);

    const invoiceWhere: any = { companyId };
    if (period.startDate || period.endDate) invoiceWhere.invoiceDate = dateFilter;

    const pieceRateWhere: any = { companyId };
    if (period.startDate || period.endDate) pieceRateWhere.createdAt = dateFilter;

    const expenseWhere: any = { companyId, status: { not: 'REJECTED' } };
    if (period.startDate || period.endDate) expenseWhere.expenseDate = dateFilter;

    const stockMoveWhere: any = {
      companyId,
      movementType: { in: ['CONSUMED', 'OUT', 'PRODUCTION_USE', 'WASTAGE'] }
    };
    if (period.startDate || period.endDate) stockMoveWhere.createdAt = dateFilter;

    const mfgCostingWhere: any = { companyId };
    if (period.startDate || period.endDate) mfgCostingWhere.createdAt = dateFilter;

    // Parallel fetch
    const [invoices, pieceRates, expenses, stockMovements, mfgCostings] = await Promise.all([
      prisma.invoice.findMany({ where: invoiceWhere }),
      prisma.pieceRateLog.findMany({ where: pieceRateWhere }),
      prisma.expense.findMany({ where: expenseWhere }),
      prisma.stockMovement.findMany({ where: stockMoveWhere }),
      prisma.manufacturingCosting.findMany({ where: mfgCostingWhere })
    ]);

    // 1. Revenue
    const grossSales = invoices.reduce((s, i) => s + i.subtotal, 0);
    const totalDiscounts = invoices.reduce((s, i) => s + i.discount, 0);
    const netRevenue = Number((grossSales - totalDiscounts).toFixed(2));

    // 2. Cost of Goods Sold (COGS)
    // Direct Material Consumption
    let rawMaterialCost = stockMovements.reduce((s, sm) => s + ((sm.quantity || 0) * (sm.unitCost || 0)), 0);
    if (rawMaterialCost === 0 && mfgCostings.length > 0) {
      rawMaterialCost = mfgCostings.reduce((s, mc) => s + mc.fabricCost + mc.trimsCost, 0);
    }
    if (rawMaterialCost === 0 && netRevenue > 0) {
      // Benchmark 35% material cost estimate if stock movement was not individually costed
      rawMaterialCost = Number((netRevenue * 0.35).toFixed(2));
    }

    // Direct Artisan Wages
    let artisanWages = pieceRates.reduce((s, pr) => s + pr.totalPayout, 0);
    if (artisanWages === 0 && mfgCostings.length > 0) {
      artisanWages = mfgCostings.reduce((s, mc) => s + mc.labourCost, 0);
    }

    // Direct Outsourcing (Embroidery, Printing, Dyeing)
    const outsourceCost = mfgCostings.reduce((s, mc) => s + mc.embroideryCost + mc.printingCost, 0);

    const totalCOGS = Number((rawMaterialCost + artisanWages + outsourceCost).toFixed(2));

    // 3. Gross Profit
    const grossProfitAmt = Number((netRevenue - totalCOGS).toFixed(2));
    const grossMarginPct = netRevenue > 0 ? Number(((grossProfitAmt / netRevenue) * 100).toFixed(1)) : 0;

    // 4. Operating Expenses (OPEX)
    const rent = expenses.filter(e => e.category === 'RENT').reduce((s, e) => s + e.amount, 0);
    const electricityPower = expenses.filter(e => e.category === 'ELECTRICITY_POWER').reduce((s, e) => s + e.amount, 0);
    const machineMaintenance = expenses.filter(e => e.category === 'MACHINE_MAINTENANCE').reduce((s, e) => s + e.amount, 0);
    const packaging = expenses.filter(e => e.category === 'PACKAGING').reduce((s, e) => s + e.amount, 0);
    const logisticsFuel = expenses.filter(e => e.category === 'LOGISTICS_FUEL').reduce((s, e) => s + e.amount, 0);
    const staffSalary = expenses.filter(e => e.category === 'STAFF_SALARY').reduce((s, e) => s + e.amount, 0);
    const teaRefreshments = expenses.filter(e => e.category === 'TEA_REFRESHMENTS').reduce((s, e) => s + e.amount, 0);
    const marketing = expenses.filter(e => e.category === 'MARKETING').reduce((s, e) => s + e.amount, 0);
    const otherExpenses = expenses.filter(e => !['RENT', 'ELECTRICITY_POWER', 'MACHINE_MAINTENANCE', 'PACKAGING', 'LOGISTICS_FUEL', 'STAFF_SALARY', 'TEA_REFRESHMENTS', 'MARKETING'].includes(e.category)).reduce((s, e) => s + e.amount, 0);

    const totalOPEX = Number((rent + electricityPower + machineMaintenance + packaging + logisticsFuel + staffSalary + teaRefreshments + marketing + otherExpenses).toFixed(2));

    // 5. Operating Profit (EBITDA)
    const ebitda = Number((grossProfitAmt - totalOPEX).toFixed(2));
    const ebitdaMarginPct = netRevenue > 0 ? Number(((ebitda / netRevenue) * 100).toFixed(1)) : 0;

    // 6. Net Profit
    const netGstPaid = expenses.reduce((s, e) => s + e.gstPaid, 0);
    const netProfitAmt = Number((ebitda - netGstPaid).toFixed(2));
    const netProfitMarginPct = netRevenue > 0 ? Number(((netProfitAmt / netRevenue) * 100).toFixed(1)) : 0;

    return {
      period: {
        startDate: period.startDate || 'All-Time',
        endDate: period.endDate || 'Present'
      },
      revenue: {
        grossInvoicedSales: Number(grossSales.toFixed(2)),
        discounts: Number(totalDiscounts.toFixed(2)),
        netRevenue,
        invoicesCount: invoices.length
      },
      costOfGoodsSold: {
        rawMaterialConsumption: Number(rawMaterialCost.toFixed(2)),
        artisanPieceRateWages: Number(artisanWages.toFixed(2)),
        manufacturingOutsourcing: Number(outsourceCost.toFixed(2)),
        totalCOGS
      },
      grossProfit: {
        amount: grossProfitAmt,
        marginPercentage: grossMarginPct
      },
      operatingExpenses: {
        rent: Number(rent.toFixed(2)),
        electricityPower: Number(electricityPower.toFixed(2)),
        machineMaintenance: Number(machineMaintenance.toFixed(2)),
        packaging: Number(packaging.toFixed(2)),
        logisticsFuel: Number(logisticsFuel.toFixed(2)),
        staffSalary: Number(staffSalary.toFixed(2)),
        teaRefreshments: Number(teaRefreshments.toFixed(2)),
        marketing: Number(marketing.toFixed(2)),
        otherExpenses: Number(otherExpenses.toFixed(2)),
        totalOPEX
      },
      operatingProfitEBITDA: {
        amount: ebitda,
        marginPercentage: ebitdaMarginPct
      },
      taxes: {
        netGstPaid: Number(netGstPaid.toFixed(2))
      },
      netProfit: {
        amount: netProfitAmt,
        marginPercentage: netProfitMarginPct,
        isProfitable: netProfitAmt >= 0
      }
    };
  }
}
