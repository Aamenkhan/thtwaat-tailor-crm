import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';

export interface CreateFabricRollInput {
  rollNumber?: string;
  fabricType: string;
  color: string;
  widthInches?: number;
  gsm?: number;
  initialLengthMeters: number;
  unitCost?: number;
  supplierName?: string;
  batchNumber?: string;
  warehouseLocation?: string;
}

export interface CreateCuttingPlanInput {
  productionOrderId: string;
  styleNumber: string;
  fabricName: string;
  fabricRollId?: string;
  rollLotNumber?: string;
  markerLengthMeters: number;
  layQuantityPlies: number;
  plannedCutQuantity: number;
  actualCutQuantity?: number;
  wastageMeters?: number;
  cutterId?: string;
  notes?: string;
  bundleSize?: number; // default bundle size, e.g., 20 or 50 pcs
}

export class CuttingBundlingService {
  // 1. Register Fabric Roll
  static async createFabricRoll(companyId: string, input: CreateFabricRollInput, userId?: string) {
    const rollNumber = input.rollNumber || `ROLL-${Date.now().toString().slice(-6)}`;

    const roll = await prisma.fabricRoll.create({
      data: {
        companyId,
        rollNumber,
        fabricType: input.fabricType,
        color: input.color,
        widthInches: input.widthInches || 58,
        gsm: input.gsm || 180,
        initialLengthMeters: input.initialLengthMeters,
        currentLengthMeters: input.initialLengthMeters,
        unitCost: input.unitCost || 0,
        supplierName: input.supplierName,
        batchNumber: input.batchNumber,
        warehouseLocation: input.warehouseLocation,
        status: 'AVAILABLE'
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'FABRIC_ROLL_REGISTERED',
      entityType: 'FABRIC_ROLL',
      recordId: roll.id,
      details: { rollNumber, fabricType: input.fabricType, length: input.initialLengthMeters }
    });

    return roll;
  }

  // 2. List Fabric Rolls
  static async getFabricRolls(companyId: string, filters: { status?: string; search?: string } = {}) {
    const where: any = { companyId };
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { rollNumber: { contains: filters.search } },
        { fabricType: { contains: filters.search } },
        { color: { contains: filters.search } },
        { batchNumber: { contains: filters.search } }
      ];
    }

    return await prisma.fabricRoll.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  // 3. Create Cutting Plan with Roll Consumption and Automatic Bundle Generation
  static async createCuttingPlan(companyId: string, input: CreateCuttingPlanInput, userId?: string) {
    const actualCut = input.actualCutQuantity || input.plannedCutQuantity;
    const consumedFabricMeters = Number(((input.markerLengthMeters * input.layQuantityPlies) + (input.wastageMeters || 0)).toFixed(2));

    // Transaction to update fabric roll, create cutting plan, create bundles, and log stock movement
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from fabric roll if specified
      if (input.fabricRollId && consumedFabricMeters > 0) {
        const roll = await tx.fabricRoll.findUnique({ where: { id: input.fabricRollId } });
        if (roll) {
          const newLength = Math.max(0, roll.currentLengthMeters - consumedFabricMeters);
          await tx.fabricRoll.update({
            where: { id: input.fabricRollId },
            data: {
              currentLengthMeters: newLength,
              status: newLength <= 0.5 ? 'CONSUMED' : 'IN_USE'
            }
          });
        }
      }

      // Create Cutting Plan
      const cuttingPlan = await tx.cuttingPlan.create({
        data: {
          companyId,
          productionOrderId: input.productionOrderId,
          styleNumber: input.styleNumber,
          fabricName: input.fabricName,
          fabricRollId: input.fabricRollId,
          rollLotNumber: input.rollLotNumber,
          markerLengthMeters: input.markerLengthMeters,
          layQuantityPlies: input.layQuantityPlies,
          plannedCutQuantity: input.plannedCutQuantity,
          actualCutQuantity: actualCut,
          wastageMeters: input.wastageMeters || 0,
          cutterId: input.cutterId,
          status: 'COMPLETED',
          notes: input.notes
        }
      });

      // Update Production Order status to CUTTING
      await tx.productionOrder.update({
        where: { id: input.productionOrderId },
        data: { status: 'CUTTING' }
      });

      // Fetch order for size/color breakdown
      const prodOrder = await tx.productionOrder.findUnique({
        where: { id: input.productionOrderId }
      });

      const matrix = JSON.parse(prodOrder?.matrixJson || '{}');
      const bundleSize = input.bundleSize || 25;
      const bundlesToCreate = [];
      let bundleSeq = 1000 + Math.floor(Math.random() * 9000);

      // If matrix has color -> size mappings
      const colors = Object.keys(matrix);
      if (colors.length > 0) {
        for (const color of colors) {
          const sizeObj = matrix[color] || {};
          for (const [size, qty] of Object.entries(sizeObj)) {
            const numQty = Number(qty) || 0;
            let remaining = numQty;

            while (remaining > 0) {
              const curBatch = Math.min(remaining, bundleSize);
              bundleSeq++;
              const bNumber = `BND-${bundleSeq}`;

              bundlesToCreate.push({
                companyId,
                bundleNumber: bNumber,
                productionOrderId: input.productionOrderId,
                cuttingPlanId: cuttingPlan.id,
                styleNumber: input.styleNumber,
                size,
                color,
                quantity: curBatch,
                cuttingReference: `CUT-PLN-${cuttingPlan.id.slice(0, 6)}`,
                currentStage: 'CUTTING',
                qrCode: bNumber,
                barcode: bNumber,
                status: 'IN_TRANSIT'
              });
              remaining -= curBatch;
            }
          }
        }
      } else {
        // Fallback: Generate bundles based on actualCutQuantity
        let remaining = actualCut;
        while (remaining > 0) {
          const curBatch = Math.min(remaining, bundleSize);
          bundleSeq++;
          const bNumber = `BND-${bundleSeq}`;
          bundlesToCreate.push({
            companyId,
            bundleNumber: bNumber,
            productionOrderId: input.productionOrderId,
            cuttingPlanId: cuttingPlan.id,
            styleNumber: input.styleNumber,
            size: 'Standard',
            color: 'Standard',
            quantity: curBatch,
            cuttingReference: `CUT-PLN-${cuttingPlan.id.slice(0, 6)}`,
            currentStage: 'CUTTING',
            qrCode: bNumber,
            barcode: bNumber,
            status: 'IN_TRANSIT'
          });
          remaining -= curBatch;
        }
      }

      if (bundlesToCreate.length > 0) {
        await tx.bundle.createMany({ data: bundlesToCreate });
      }

      const bundles = await tx.bundle.findMany({
        where: { cuttingPlanId: cuttingPlan.id }
      });

      return {
        cuttingPlan,
        bundles,
        bundlesCount: bundlesToCreate.length
      };
    }, { timeout: 30000 });

    await AuditService.log({
      companyId,
      userId,
      action: 'CUTTING_PLAN_EXECUTED',
      entityType: 'CUTTING_PLAN',
      recordId: result.cuttingPlan.id,
      details: {
        productionOrderId: input.productionOrderId,
        actualCutQuantity: actualCut,
        bundlesCreated: result.bundlesCount,
        consumedFabricMeters
      }
    });

    return {
      cuttingPlan: result.cuttingPlan,
      bundles: result.bundles
    };
  }

  // 4. List Cutting Plans
  static async getCuttingPlans(companyId: string, filters: { productionOrderId?: string } = {}) {
    const where: any = { companyId };
    if (filters.productionOrderId) where.productionOrderId = filters.productionOrderId;

    return await prisma.cuttingPlan.findMany({
      where,
      include: {
        cutter: { select: { id: true, name: true } },
        fabricRoll: true,
        bundles: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 5. List Bundles with Stage/Line filters
  static async getBundles(
    companyId: string,
    filters: { productionOrderId?: string; currentStage?: string; assignedLineId?: string; search?: string } = {}
  ) {
    const where: any = { companyId };
    if (filters.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters.currentStage && filters.currentStage !== 'ALL') where.currentStage = filters.currentStage;
    if (filters.assignedLineId) where.assignedLineId = filters.assignedLineId;
    if (filters.search) {
      where.OR = [
        { bundleNumber: { contains: filters.search } },
        { styleNumber: { contains: filters.search } },
        { qrCode: { contains: filters.search } }
      ];
    }

    return await prisma.bundle.findMany({
      where,
      include: {
        productionOrder: { select: { productionOrderNumber: true, productName: true, buyer: true } },
        assignedLine: true,
        cuttingPlan: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 6. QR Code Scanner Lookup
  static async scanBundle(companyId: string, qrOrBarcode: string) {
    const cleanCode = qrOrBarcode.trim();

    const bundle = await prisma.bundle.findFirst({
      where: {
        companyId,
        OR: [{ bundleNumber: cleanCode }, { qrCode: cleanCode }, { barcode: cleanCode }]
      },
      include: {
        productionOrder: {
          include: {
            buyer: true,
            productStyle: true,
            cuttingPlans: true
          }
        },
        assignedLine: true,
        cuttingPlan: true
      }
    });

    if (!bundle) throw new Error(`No bundle found for code: ${qrOrBarcode}`);

    return bundle;
  }
}
