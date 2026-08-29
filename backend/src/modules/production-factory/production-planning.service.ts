import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';

export interface CreateProductionOrderInput {
  orderId?: string;
  productStyleId?: string;
  styleNumber: string;
  productName: string;
  buyerId?: string;
  branchId?: string;
  totalQuantity: number;
  sizeBreakdown?: Record<string, number>;
  colorBreakdown?: Record<string, number>;
  matrix?: Record<string, Record<string, number>>; // Color -> Size -> Qty
  plannedStartDate?: Date;
  plannedCompletionDate: Date;
  priority?: string;
  productionUnit?: string;
  assignedManagerId?: string;
  notes?: string;
  wastagePercentage?: number;
}

export class ProductionPlanningService {
  // 1. Create Production Order with Size/Color Matrix and Auto Calculate BOM Requirements
  static async createProductionOrder(companyId: string, input: CreateProductionOrderInput, userId?: string) {
    const poNumber = `PROD-${Date.now().toString().slice(-6)}`;

    const sizeJson = JSON.stringify(input.sizeBreakdown || {});
    const colorJson = JSON.stringify(input.colorBreakdown || {});
    const matrixJson = JSON.stringify(input.matrix || {});

    // Create Production Order
    const prodOrder = await prisma.productionOrder.create({
      data: {
        companyId,
        branchId: input.branchId,
        orderId: input.orderId,
        productStyleId: input.productStyleId,
        buyerId: input.buyerId,
        productionOrderNumber: poNumber,
        styleNumber: input.styleNumber,
        productName: input.productName,
        totalQuantity: input.totalQuantity,
        sizeBreakdownJson: sizeJson,
        colorBreakdownJson: colorJson,
        matrixJson: matrixJson,
        plannedStartDate: input.plannedStartDate || new Date(),
        plannedCompletionDate: new Date(input.plannedCompletionDate),
        priority: input.priority || 'NORMAL',
        productionUnit: input.productionUnit || 'Main Production Unit',
        assignedManagerId: input.assignedManagerId,
        status: 'PLANNED',
        notes: input.notes
      }
    });

    // Auto Calculate Material Requirements from BOM
    await this.calculateMaterialRequirements(companyId, prodOrder.id, input.wastagePercentage || 5.0, userId);

    await AuditService.log({
      companyId,
      userId,
      action: 'PRODUCTION_PLAN_CREATED',
      entityType: 'PRODUCTION_ORDER',
      recordId: prodOrder.id,
      details: {
        poNumber,
        styleNumber: input.styleNumber,
        totalQuantity: input.totalQuantity,
        buyerId: input.buyerId
      }
    });

    return await this.getProductionOrderById(companyId, prodOrder.id);
  }

  // 2. Auto Calculate Material Requirement from BOM with Configurable Wastage %
  static async calculateMaterialRequirements(
    companyId: string,
    productionOrderId: string,
    wastagePercentage: number = 5.0,
    userId?: string
  ) {
    const prodOrder = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: { productStyle: { include: { bomItems: { include: { inventoryItem: true } } } } }
    });

    if (!prodOrder) throw new Error('Production Order not found');

    // Clean existing requirements for this order if re-calculating
    await prisma.materialRequirement.deleteMany({
      where: { companyId, productionOrderId }
    });

    const bomItems = prodOrder.productStyle?.bomItems || [];
    const totalQty = prodOrder.totalQuantity;

    const requirements = [];

    for (const bom of bomItems) {
      const netRequired = bom.quantity * totalQty;
      const wastagePct = bom.wastagePercentage > 0 ? bom.wastagePercentage : wastagePercentage;
      const grossRequired = Number((netRequired * (1 + wastagePct / 100)).toFixed(2));

      // Check current available stock
      const invItem = bom.inventoryItem;
      const currentStock = invItem ? invItem.currentStock : 0;
      const availableStock = currentStock;
      const shortageQuantity = Number(Math.max(0, grossRequired - availableStock).toFixed(2));
      const purchaseRequired = shortageQuantity > 0;

      let status = 'AVAILABLE';
      if (availableStock <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (shortageQuantity > 0) {
        status = 'PARTIALLY_AVAILABLE';
      }

      const req = await prisma.materialRequirement.create({
        data: {
          companyId,
          productionOrderId,
          inventoryItemId: bom.inventoryItemId,
          materialName: bom.materialName,
          category: invItem ? invItem.category : 'FABRIC',
          unit: bom.unit,
          bomPerGarment: bom.quantity,
          grossRequired,
          wastagePercentage: wastagePct,
          currentStock,
          availableStock,
          shortageQuantity,
          purchaseRequired,
          status
        }
      });

      requirements.push(req);
    }

    // Update Production Order status based on stock
    const hasShortage = requirements.some((r) => r.purchaseRequired);
    if (hasShortage && prodOrder.status === 'PLANNED') {
      await prisma.productionOrder.update({
        where: { id: productionOrderId },
        data: { status: 'MATERIAL_PENDING' }
      });
    }

    return requirements;
  }

  // 3. Convert Shortages to Purchase Requirement Requisition
  static async createPurchaseRequisition(
    companyId: string,
    data: {
      productionOrderId: string;
      requirements: Array<{
        materialName: string;
        inventoryItemId?: string;
        requiredQuantity: number;
        unit: string;
        estimatedUnitCost?: number;
      }>;
    },
    userId?: string
  ) {
    const createdReqs = [];

    for (const item of data.requirements) {
      const unitCost = item.estimatedUnitCost || 0;
      const totalCost = Number((item.requiredQuantity * unitCost).toFixed(2));

      const pr = await prisma.purchaseRequirement.create({
        data: {
          companyId,
          productionOrderId: data.productionOrderId,
          inventoryItemId: item.inventoryItemId,
          materialName: item.materialName,
          requiredQuantity: item.requiredQuantity,
          unit: item.unit,
          estimatedUnitCost: unitCost,
          estimatedTotalCost: totalCost,
          status: 'PENDING'
        }
      });
      createdReqs.push(pr);
    }

    await AuditService.log({
      companyId,
      userId,
      action: 'PURCHASE_REQUIREMENT_CREATED',
      entityType: 'PURCHASE_REQUIREMENT',
      details: {
        productionOrderId: data.productionOrderId,
        itemsCount: createdReqs.length
      }
    });

    return createdReqs;
  }

  // 4. List Production Orders with Filters
  static async getProductionOrders(
    companyId: string,
    filters: { status?: string; search?: string; buyerId?: string; priority?: string } = {}
  ) {
    const where: any = { companyId };
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.buyerId) where.buyerId = filters.buyerId;
    if (filters.priority && filters.priority !== 'ALL') where.priority = filters.priority;
    if (filters.search) {
      where.OR = [
        { productionOrderNumber: { contains: filters.search } },
        { styleNumber: { contains: filters.search } },
        { productName: { contains: filters.search } }
      ];
    }

    return await prisma.productionOrder.findMany({
      where,
      include: {
        buyer: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, orderNumber: true, finalAmount: true } },
        assignedManager: { select: { id: true, name: true } },
        _count: {
          select: {
            materialRequirements: true,
            cuttingPlans: true,
            bundles: true,
            dailyProductions: true,
            finishedGoods: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 5. Get Full Production Order Details
  static async getProductionOrderById(companyId: string, id: string) {
    const order = await prisma.productionOrder.findFirst({
      where: { id, companyId },
      include: {
        buyer: true,
        order: true,
        productStyle: {
          include: {
            bomItems: {
              include: { inventoryItem: true }
            }
          }
        },
        assignedManager: true,
        materialRequirements: {
          include: { inventoryItem: true }
        },
        purchaseRequirements: true,
        cuttingPlans: {
          include: { cutter: true, fabricRoll: true, bundles: true }
        },
        bundles: {
          include: { assignedLine: true }
        },
        dailyProductions: {
          include: { productionLine: true, worker: true },
          orderBy: { entryDate: 'desc' }
        },
        reworkEntries: {
          include: { assignedWorker: true }
        },
        finishedGoods: true,
        manufacturingCosting: true
      }
    });

    if (!order) throw new Error('Production order not found');

    return {
      ...order,
      sizeBreakdown: JSON.parse(order.sizeBreakdownJson || '{}'),
      colorBreakdown: JSON.parse(order.colorBreakdownJson || '{}'),
      matrix: JSON.parse(order.matrixJson || '{}')
    };
  }

  // 6. Update Status
  static async updateProductionStatus(companyId: string, id: string, status: string, userId?: string) {
    const updated = await prisma.productionOrder.update({
      where: { id },
      data: {
        status,
        actualStartDate: status === 'CUTTING' ? new Date() : undefined,
        actualCompletionDate: status === 'COMPLETED' ? new Date() : undefined
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'PRODUCTION_STATUS_UPDATED',
      entityType: 'PRODUCTION_ORDER',
      recordId: id,
      details: { newStatus: status }
    });

    return updated;
  }
}
