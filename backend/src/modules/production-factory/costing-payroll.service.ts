import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';

export interface ComputeManufacturingCostingInput {
  productionOrderId: string;
  fabricCost?: number;
  trimsCost?: number;
  labourCost?: number;
  embroideryCost?: number;
  printingCost?: number;
  packingCost?: number;
  wastageCost?: number;
  overheadCost?: number;
  otherCost?: number;
  unitSellingPrice?: number;
  costingItems?: Array<{ name: string; category: string; amount: number; notes?: string }>;
}

export class CostingPayrollService {
  // 1. Calculate Actual Material Consumption vs BOM Variance
  static async getMaterialConsumptionVariance(companyId: string, productionOrderId: string) {
    const prodOrder = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: {
        productStyle: {
          include: { bomItems: { include: { inventoryItem: true } } }
        },
        cuttingPlans: { include: { fabricRoll: true } },
        materialRequirements: true
      }
    });

    if (!prodOrder) throw new Error('Production Order not found');

    const totalGarments = prodOrder.totalQuantity || 1;
    const bomItems = prodOrder.productStyle?.bomItems || [];
    const cuttingPlans = prodOrder.cuttingPlans || [];

    // Calculate actual fabric consumed from cutting plans
    const actualFabricMeters = cuttingPlans.reduce((sum, cp) => {
      const layLength = cp.markerLengthMeters * cp.layQuantityPlies;
      return sum + layLength + cp.wastageMeters;
    }, 0);

    const variances = bomItems.map((bom) => {
      const estimatedPerGarment = bom.quantity;
      const estimatedTotal = Number((estimatedPerGarment * totalGarments).toFixed(2));

      let actualTotal = estimatedTotal;
      if (bom.unit === 'meter' || bom.materialName.toLowerCase().includes('fabric')) {
        actualTotal = actualFabricMeters > 0 ? actualFabricMeters : estimatedTotal;
      }

      const actualPerGarment = Number((actualTotal / totalGarments).toFixed(3));
      const variancePerGarment = Number((actualPerGarment - estimatedPerGarment).toFixed(3));
      const varianceTotal = Number((actualTotal - estimatedTotal).toFixed(2));
      const unitCost = bom.costPerUnit || (bom.inventoryItem?.unitCost || 0);
      const varianceCost = Number((varianceTotal * unitCost).toFixed(2));

      return {
        materialName: bom.materialName,
        category: bom.inventoryItem?.category || 'FABRIC',
        unit: bom.unit,
        unitCost,
        estimatedPerGarment,
        actualPerGarment,
        variancePerGarment,
        estimatedTotal,
        actualTotal,
        varianceTotal,
        varianceCost
      };
    });

    const totalVarianceCost = variances.reduce((sum, v) => sum + v.varianceCost, 0);

    return {
      productionOrderId,
      orderNumber: prodOrder.productionOrderNumber,
      styleNumber: prodOrder.styleNumber,
      totalGarments,
      variances,
      totalVarianceCost
    };
  }

  // 2. Compute Full Manufacturing Costing & Profit Margin
  static async computeManufacturingCosting(
    companyId: string,
    input: ComputeManufacturingCostingInput,
    userId?: string
  ) {
    const prodOrder = await prisma.productionOrder.findUnique({
      where: { id: input.productionOrderId },
      include: {
        productStyle: {
          include: { bomItems: true }
        },
        dailyProductions: true
      }
    });

    if (!prodOrder) throw new Error('Production Order not found');

    const totalGarments = prodOrder.totalQuantity || 1;

    // 1. Estimated BOM Cost
    const bomItems = prodOrder.productStyle?.bomItems || [];
    const estimatedBOMCost = bomItems.reduce((sum, b) => sum + (b.quantity * b.costPerUnit * totalGarments), 0) || (prodOrder.productStyle?.estimatedCost || 0) * totalGarments;

    // 2. Default Costs if not provided
    const fabricCost = input.fabricCost !== undefined ? input.fabricCost : Number((estimatedBOMCost * 0.65).toFixed(2));
    const trimsCost = input.trimsCost !== undefined ? input.trimsCost : Number((estimatedBOMCost * 0.15).toFixed(2));
    const labourCost = input.labourCost !== undefined ? input.labourCost : Number((totalGarments * 150).toFixed(2));
    const embroideryCost = input.embroideryCost || 0;
    const printingCost = input.printingCost || 0;
    const packingCost = input.packingCost !== undefined ? input.packingCost : Number((totalGarments * 25).toFixed(2));
    const wastageCost = input.wastageCost || 0;
    const overheadCost = input.overheadCost !== undefined ? input.overheadCost : Number((totalGarments * 30).toFixed(2));
    const otherCost = input.otherCost || 0;

    const totalActualCost = Number((
      fabricCost + trimsCost + labourCost + embroideryCost + printingCost + packingCost + wastageCost + overheadCost + otherCost
    ).toFixed(2));

    const varianceCost = Number((totalActualCost - estimatedBOMCost).toFixed(2));
    const unitActualCost = Number((totalActualCost / totalGarments).toFixed(2));
    const unitSellingPrice = input.unitSellingPrice || prodOrder.productStyle?.sellingPrice || Number((unitActualCost * 1.4).toFixed(2));
    const unitProfit = Number((unitSellingPrice - unitActualCost).toFixed(2));
    const profitMarginPercentage = unitSellingPrice > 0 ? Number(((unitProfit / unitSellingPrice) * 100).toFixed(1)) : 0.0;

    const costing = await prisma.manufacturingCosting.upsert({
      where: { productionOrderId: input.productionOrderId },
      create: {
        companyId,
        productionOrderId: input.productionOrderId,
        productStyleId: prodOrder.productStyleId,
        fabricCost,
        trimsCost,
        labourCost,
        embroideryCost,
        printingCost,
        packingCost,
        wastageCost,
        overheadCost,
        otherCost,
        totalActualCost,
        estimatedBOMCost,
        varianceCost,
        unitActualCost,
        unitSellingPrice,
        unitProfit,
        profitMarginPercentage,
        costingItemsJson: JSON.stringify(input.costingItems || [])
      },
      update: {
        fabricCost,
        trimsCost,
        labourCost,
        embroideryCost,
        printingCost,
        packingCost,
        wastageCost,
        overheadCost,
        otherCost,
        totalActualCost,
        estimatedBOMCost,
        varianceCost,
        unitActualCost,
        unitSellingPrice,
        unitProfit,
        profitMarginPercentage,
        costingItemsJson: JSON.stringify(input.costingItems || [])
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'MANUFACTURING_COSTING_CALCULATED',
      entityType: 'MANUFACTURING_COSTING',
      recordId: costing.id,
      details: {
        productionOrderId: input.productionOrderId,
        totalActualCost,
        unitActualCost,
        unitProfit,
        profitMarginPercentage
      }
    });

    return costing;
  }

  // 3. Worker Labour Cost & Payroll Ledger (Fixed, Per-piece, Per-operation, Daily wage)
  static async getWorkerPayoutLedger(companyId: string, filters: { workerId?: string; role?: string; isPaid?: boolean } = {}) {
    const workers = await prisma.worker.findMany({
      where: {
        companyId,
        isActive: true,
        ...(filters.workerId ? { id: filters.workerId } : {}),
        ...(filters.role && filters.role !== 'ALL' ? { role: filters.role } : {})
      },
      include: {
        pieceRateLogs: {
          where: filters.isPaid !== undefined ? { isPaid: filters.isPaid } : {},
          orderBy: { createdAt: 'desc' }
        },
        dailyProductions: {
          orderBy: { entryDate: 'desc' }
        }
      }
    });

    const report = workers.map((w) => {
      let totalPieces = 0;
      let grossPay = 0;

      if (w.wageType === 'PIECE_RATE') {
        const pieceLogs = w.pieceRateLogs || [];
        totalPieces = pieceLogs.reduce((sum, log) => sum + log.quantity, 0);
        grossPay = pieceLogs.reduce((sum, log) => sum + log.totalPayout, 0);
        if (grossPay === 0 && totalPieces > 0) {
          grossPay = totalPieces * w.defaultPieceRate;
        }
      } else if (w.wageType === 'MONTHLY_SALARY') {
        grossPay = w.monthlySalary;
        totalPieces = w.dailyProductions.reduce((sum, dp) => sum + dp.completedQuantity, 0);
      } else if (w.wageType === 'DAILY_WAGE') {
        const daysWorked = new Set(w.dailyProductions.map((dp) => dp.entryDate.toISOString().split('T')[0])).size || 25;
        grossPay = daysWorked * (w.monthlySalary / 30 || 500);
        totalPieces = w.dailyProductions.reduce((sum, dp) => sum + dp.completedQuantity, 0);
      }

      const adjustments = 0; // Deductions/Bonus
      const netPay = Math.max(0, grossPay - adjustments);
      const isPaid = w.pieceRateLogs.length > 0 ? w.pieceRateLogs.every((l) => l.isPaid) : false;

      return {
        workerId: w.id,
        workerName: w.name,
        phone: w.phone,
        department: w.role,
        wageType: w.wageType,
        totalPieces,
        defaultRate: w.defaultPieceRate,
        grossPay: Number(grossPay.toFixed(2)),
        adjustments,
        netPay: Number(netPay.toFixed(2)),
        status: isPaid ? 'PAID' : 'PENDING',
        recentLogs: w.pieceRateLogs.slice(0, 5)
      };
    });

    return report;
  }
}
