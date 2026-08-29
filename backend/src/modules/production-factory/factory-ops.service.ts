import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';

export interface CreateProductionLineInput {
  name: string;
  code: string;
  supervisorId?: string;
  targetHourlyOutput?: number;
  targetDailyOutput?: number;
  activeWorkerCount?: number;
}

export interface DailyProductionEntryInput {
  productionOrderId: string;
  productionLineId?: string;
  workerId?: string;
  stage: string; // CUTTING, STITCHING, FINISHING, QC, PACKING
  entryDate?: Date;
  targetQuantity?: number;
  completedQuantity: number;
  reworkQuantity?: number;
  rejectedQuantity?: number;
  notes?: string;
}

export interface QCInspectionInput {
  productionOrderId: string;
  bundleId?: string;
  stage: string;
  passedQuantity: number;
  reworkQuantity?: number;
  rejectedQuantity?: number;
  defectType?: string;
  defectNotes?: string;
  defectPhotoUrl?: string;
  severity?: string;
  assignedWorkerId?: string;
}

export class FactoryOpsService {
  // 1. Manage Production Lines
  static async createProductionLine(companyId: string, input: CreateProductionLineInput, userId?: string) {
    const line = await prisma.productionLine.create({
      data: {
        companyId,
        name: input.name,
        code: input.code,
        supervisorId: input.supervisorId,
        targetHourlyOutput: input.targetHourlyOutput || 20,
        targetDailyOutput: input.targetDailyOutput || 160,
        activeWorkerCount: input.activeWorkerCount || 10,
        status: 'ACTIVE'
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'PRODUCTION_LINE_CREATED',
      entityType: 'PRODUCTION_LINE',
      recordId: line.id,
      details: { name: input.name, code: input.code }
    });

    return line;
  }

  static async getProductionLines(companyId: string) {
    const lines = await prisma.productionLine.findMany({
      where: { companyId },
      include: {
        supervisor: { select: { id: true, name: true, phone: true } },
        _count: { select: { bundles: true, dailyProductions: true } }
      }
    });

    // Calculate real-time efficiency for each line based on today's daily productions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await Promise.all(
      lines.map(async (line) => {
        const todayLogs = await prisma.dailyProduction.findMany({
          where: {
            companyId,
            productionLineId: line.id,
            entryDate: { gte: today }
          }
        });

        const totalCompleted = todayLogs.reduce((sum, log) => sum + log.completedQuantity, 0);
        const totalTarget = todayLogs.reduce((sum, log) => sum + log.targetQuantity, 0) || line.targetDailyOutput;
        const efficiency = totalTarget > 0 ? Number(((totalCompleted / totalTarget) * 100).toFixed(1)) : 100.0;

        return {
          ...line,
          todayCompleted: totalCompleted,
          todayTarget: totalTarget,
          efficiencyPercentage: efficiency
        };
      })
    );
  }

  // 2. Record Bulk Daily Production Entries
  static async recordDailyProduction(companyId: string, entries: DailyProductionEntryInput[], userId?: string) {
    const createdLogs = [];

    for (const entry of entries) {
      const target = entry.targetQuantity || 100;
      const completed = entry.completedQuantity || 0;
      const efficiency = target > 0 ? Number(((completed / target) * 100).toFixed(1)) : 100.0;

      const log = await prisma.dailyProduction.create({
        data: {
          companyId,
          productionOrderId: entry.productionOrderId,
          productionLineId: entry.productionLineId,
          workerId: entry.workerId,
          stage: entry.stage,
          entryDate: entry.entryDate || new Date(),
          targetQuantity: target,
          completedQuantity: completed,
          reworkQuantity: entry.reworkQuantity || 0,
          rejectedQuantity: entry.rejectedQuantity || 0,
          efficiencyPercentage: efficiency,
          notes: entry.notes
        }
      });
      createdLogs.push(log);
    }

    await AuditService.log({
      companyId,
      userId,
      action: 'DAILY_PRODUCTION_LOGGED',
      entityType: 'DAILY_PRODUCTION',
      details: { entriesCount: createdLogs.length }
    });

    return createdLogs;
  }

  // 3. Get Daily Production Logs with Filters
  static async getDailyProductionLogs(
    companyId: string,
    filters: { productionOrderId?: string; lineId?: string; stage?: string; startDate?: string; endDate?: string } = {}
  ) {
    const where: any = { companyId };
    if (filters.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters.lineId) where.productionLineId = filters.lineId;
    if (filters.stage && filters.stage !== 'ALL') where.stage = filters.stage;
    if (filters.startDate || filters.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.entryDate.lte = new Date(filters.endDate);
    }

    return await prisma.dailyProduction.findMany({
      where,
      include: {
        productionOrder: { select: { productionOrderNumber: true, productName: true, styleNumber: true } },
        productionLine: true,
        worker: { select: { id: true, name: true, role: true } }
      },
      orderBy: { entryDate: 'desc' }
    });
  }

  // 4. Advanced QC Inspection & Defect Logger
  static async inspectQC(companyId: string, input: QCInspectionInput, userId?: string) {
    const totalInspected = input.passedQuantity + (input.reworkQuantity || 0) + (input.rejectedQuantity || 0);

    let status = 'PASSED';
    if ((input.rejectedQuantity || 0) > 0) status = 'REJECTED';
    else if ((input.reworkQuantity || 0) > 0) status = 'REWORK_REQUIRED';

    const qcRecord = await prisma.qCRecord.create({
      data: {
        companyId,
        stage: input.stage,
        inspectedQuantity: totalInspected,
        passedQuantity: input.passedQuantity,
        reworkQuantity: input.reworkQuantity || 0,
        rejectedQuantity: input.rejectedQuantity || 0,
        status,
        defectType: input.defectType,
        defectNotes: input.defectNotes,
        defectPhotosJson: input.defectPhotoUrl ? JSON.stringify([input.defectPhotoUrl]) : '[]',
        reworkAssignedToId: input.assignedWorkerId,
        inspectorId: userId
      }
    });

    // If rework quantity > 0, create ReworkEntry to track through cycle
    let reworkEntry = null;
    if ((input.reworkQuantity || 0) > 0) {
      reworkEntry = await prisma.reworkEntry.create({
        data: {
          companyId,
          productionOrderId: input.productionOrderId,
          bundleId: input.bundleId,
          qcRecordId: qcRecord.id,
          defectType: input.defectType || 'STITCHING_DEFECT',
          defectNotes: input.defectNotes,
          defectPhotoUrl: input.defectPhotoUrl,
          severity: input.severity || 'MEDIUM',
          quantity: input.reworkQuantity || 1,
          assignedWorkerId: input.assignedWorkerId,
          status: 'PENDING_REWORK'
        }
      });
    }

    await AuditService.log({
      companyId,
      userId,
      action: 'QC_INSPECTION_RECORDED',
      entityType: 'QC_RECORD',
      recordId: qcRecord.id,
      details: {
        productionOrderId: input.productionOrderId,
        status,
        passed: input.passedQuantity,
        rework: input.reworkQuantity || 0,
        rejected: input.rejectedQuantity || 0
      }
    });

    return { qcRecord, reworkEntry };
  }

  // 5. Rework Cycle Station: Re-Inspect and Pass
  static async processRework(
    companyId: string,
    data: { reworkEntryId: string; status: 'REWORK_IN_PROGRESS' | 'RE_INSPECTED_PASS' | 'SCRAPPED'; reworkCost?: number },
    userId?: string
  ) {
    const rework = await prisma.reworkEntry.update({
      where: { id: data.reworkEntryId },
      data: {
        status: data.status,
        reworkCost: data.reworkCost || 0,
        completedAt: data.status === 'RE_INSPECTED_PASS' ? new Date() : undefined
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'REWORK_PROCESSED',
      entityType: 'REWORK_ENTRY',
      recordId: rework.id,
      details: { status: data.status, reworkCost: data.reworkCost }
    });

    return rework;
  }

  // 6. QC & Rework Dashboard Metrics
  static async getQCDashboard(companyId: string, filters: { productionOrderId?: string } = {}) {
    const where: any = { companyId };
    const [qcRecords, reworkEntries] = await Promise.all([
      prisma.qCRecord.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.reworkEntry.findMany({
        where: filters.productionOrderId ? { companyId, productionOrderId: filters.productionOrderId } : { companyId },
        include: { assignedWorker: true, productionOrder: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const totalInspected = qcRecords.reduce((s: number, r: any) => s + r.inspectedQuantity, 0);
    const totalPassed = qcRecords.reduce((s: number, r: any) => s + r.passedQuantity, 0);
    const totalRework = qcRecords.reduce((s: number, r: any) => s + r.reworkQuantity, 0);
    const totalRejected = qcRecords.reduce((s: number, r: any) => s + r.rejectedQuantity, 0);

    const passRate = totalInspected > 0 ? Number(((totalPassed / totalInspected) * 100).toFixed(1)) : 100.0;
    const reworkRate = totalInspected > 0 ? Number(((totalRework / totalInspected) * 100).toFixed(1)) : 0.0;
    const rejectionRate = totalInspected > 0 ? Number(((totalRejected / totalInspected) * 100).toFixed(1)) : 0.0;

    return {
      totalInspected,
      totalPassed,
      totalRework,
      totalRejected,
      passRate,
      reworkRate,
      rejectionRate,
      reworkEntries,
      recentQC: qcRecords.slice(0, 20)
    };
  }

  // 7. Complete Production Order & Move to Finished Goods Inventory
  static async completeProductionOrder(
    companyId: string,
    productionOrderId: string,
    data: { warehouse?: string; location?: string; unitCost?: number; sellingPrice?: number },
    userId?: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const prodOrder = await tx.productionOrder.findUnique({
        where: { id: productionOrderId },
        include: { productStyle: true }
      });

      if (!prodOrder) throw new Error('Production Order not found');

      // Update Order Status to COMPLETED
      await tx.productionOrder.update({
        where: { id: productionOrderId },
        data: {
          status: 'COMPLETED',
          actualCompletionDate: new Date()
        }
      });

      // Update all Bundles to COMPLETED
      await tx.bundle.updateMany({
        where: { companyId, productionOrderId },
        data: { currentStage: 'COMPLETED', status: 'PACKED' }
      });

      // Create Finished Goods Record
      const batchNum = `BAT-${prodOrder.productionOrderNumber}-${Date.now().toString().slice(-4)}`;
      const fg = await tx.finishedGoods.create({
        data: {
          companyId,
          productionOrderId,
          branchId: prodOrder.branchId,
          sku: `${prodOrder.styleNumber}-FG`,
          styleNumber: prodOrder.styleNumber,
          productName: prodOrder.productName,
          size: 'Assorted (Size Grid)',
          color: 'Assorted (Color Grid)',
          batchNumber: batchNum,
          quantity: prodOrder.totalQuantity,
          warehouse: data.warehouse || 'Main FG Warehouse',
          location: data.location || 'Bin FG-01',
          unitCost: data.unitCost || prodOrder.productStyle?.estimatedCost || 0,
          sellingPrice: data.sellingPrice || prodOrder.productStyle?.sellingPrice || 0,
          status: 'IN_STOCK'
        }
      });

      return {
        productionOrderId,
        status: 'COMPLETED',
        finishedGoods: fg,
        batchNumber: batchNum,
        quantity: prodOrder.totalQuantity
      };
    }, { timeout: 30000 });

    await AuditService.log({
      companyId,
      userId,
      action: 'PRODUCTION_COMPLETED_FINISHED_GOODS_CREATED',
      entityType: 'FINISHED_GOODS',
      recordId: result.finishedGoods.id,
      details: {
        productionOrderId,
        batchNumber: result.batchNumber,
        quantity: result.quantity
      }
    });

    return {
      productionOrderId: result.productionOrderId,
      status: result.status,
      finishedGoods: result.finishedGoods
    };
  }
}
