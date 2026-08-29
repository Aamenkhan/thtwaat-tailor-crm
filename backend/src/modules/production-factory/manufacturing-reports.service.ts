import ExcelJS from 'exceljs';
import { prisma } from '../../config/db';

export class ManufacturingReportsService {
  // 1. Generate Report JSON Data
  static async getReportData(companyId: string, reportType: string, filters: any = {}) {
    const whereBase: any = { companyId };

    switch (reportType) {
      case 'production': {
        const orders = await prisma.productionOrder.findMany({
          where: whereBase,
          include: { buyer: true, productStyle: true },
          orderBy: { createdAt: 'desc' }
        });
        return orders.map((o) => ({
          'Order #': o.productionOrderNumber,
          'Style': o.styleNumber,
          'Product Name': o.productName,
          'Buyer': o.buyer?.name || 'In-House',
          'Total Qty': o.totalQuantity,
          'Status': o.status,
          'Priority': o.priority,
          'Start Date': o.plannedStartDate.toISOString().split('T')[0],
          'Delivery Date': o.plannedCompletionDate.toISOString().split('T')[0]
        }));
      }

      case 'material-consumption': {
        const reqs = await prisma.materialRequirement.findMany({
          where: whereBase,
          include: { productionOrder: true },
          orderBy: { createdAt: 'desc' }
        });
        return reqs.map((r) => ({
          'Order #': r.productionOrder.productionOrderNumber,
          'Material': r.materialName,
          'Category': r.category,
          'BOM / Garment': r.bomPerGarment,
          'Gross Required': r.grossRequired,
          'Current Stock': r.currentStock,
          'Shortage': r.shortageQuantity,
          'Status': r.status
        }));
      }

      case 'wastage': {
        const cuttings = await prisma.cuttingPlan.findMany({
          where: whereBase,
          include: { productionOrder: true, cutter: true },
          orderBy: { createdAt: 'desc' }
        });
        return cuttings.map((c) => ({
          'Order #': c.productionOrder.productionOrderNumber,
          'Style': c.styleNumber,
          'Fabric': c.fabricName,
          'Lay Plies': c.layQuantityPlies,
          'Planned Cut': c.plannedCutQuantity,
          'Actual Cut': c.actualCutQuantity,
          'Wastage (m)': c.wastageMeters,
          'Cutter': c.cutter?.name || 'Unassigned',
          'Cut Date': c.cutDate.toISOString().split('T')[0]
        }));
      }

      case 'line-performance': {
        const lines = await prisma.productionLine.findMany({
          where: whereBase,
          include: { supervisor: true, dailyProductions: true }
        });
        return lines.map((l) => {
          const totalDone = l.dailyProductions.reduce((s, p) => s + p.completedQuantity, 0);
          const totalTarget = l.dailyProductions.reduce((s, p) => s + p.targetQuantity, 0) || l.targetDailyOutput;
          const eff = totalTarget > 0 ? Number(((totalDone / totalTarget) * 100).toFixed(1)) : 100.0;
          return {
            'Line Code': l.code,
            'Line Name': l.name,
            'Supervisor': l.supervisor?.name || 'None',
            'Workers Active': l.activeWorkerCount,
            'Daily Target': l.targetDailyOutput,
            'Total Produced': totalDone,
            'Efficiency %': `${eff}%`,
            'Status': l.status
          };
        });
      }

      case 'qc-defects': {
        const qcs = await prisma.qCRecord.findMany({
          where: whereBase,
          orderBy: { createdAt: 'desc' }
        });
        return qcs.map((q: any) => ({
          'QC ID': q.id.slice(0, 8),
          'Stage': q.stage,
          'Inspected Qty': q.inspectedQuantity,
          'Passed Qty': q.passedQuantity,
          'Rework Qty': q.reworkQuantity,
          'Rejected Qty': q.rejectedQuantity,
          'Status': q.status,
          'Defect Type': q.defectType || 'None',
          'Date': q.createdAt.toISOString().split('T')[0]
        }));
      }

      case 'rework': {
        const reworks = await prisma.reworkEntry.findMany({
          where: whereBase,
          include: { productionOrder: true, assignedWorker: true },
          orderBy: { createdAt: 'desc' }
        });
        return reworks.map((r) => ({
          'Order #': r.productionOrder.productionOrderNumber,
          'Defect Type': r.defectType,
          'Severity': r.severity,
          'Quantity': r.quantity,
          'Assigned Worker': r.assignedWorker?.name || 'Unassigned',
          'Status': r.status,
          'Rework Cost': `₹${r.reworkCost}`,
          'Reported Date': r.createdAt.toISOString().split('T')[0]
        }));
      }

      case 'style-costing': {
        const costings = await prisma.manufacturingCosting.findMany({
          where: whereBase,
          include: { productionOrder: true },
          orderBy: { createdAt: 'desc' }
        });
        return costings.map((c) => ({
          'Order #': c.productionOrder.productionOrderNumber,
          'Style': c.productionOrder.styleNumber,
          'Total Actual Cost': `₹${c.totalActualCost}`,
          'Estimated BOM Cost': `₹${c.estimatedBOMCost}`,
          'Variance Cost': `₹${c.varianceCost}`,
          'Unit Cost': `₹${c.unitActualCost}`,
          'Selling Price': `₹${c.unitSellingPrice}`,
          'Unit Profit': `₹${c.unitProfit}`,
          'Profit Margin %': `${c.profitMarginPercentage}%`
        }));
      }

      case 'finished-goods': {
        const fg = await prisma.finishedGoods.findMany({
          where: whereBase,
          orderBy: { createdAt: 'desc' }
        });
        return fg.map((f) => ({
          'SKU': f.sku,
          'Style': f.styleNumber,
          'Product Name': f.productName,
          'Batch #': f.batchNumber,
          'In-Stock Qty': f.quantity,
          'Warehouse': f.warehouse,
          'Location': f.location || 'N/A',
          'Unit Cost': `₹${f.unitCost}`,
          'Selling Price': `₹${f.sellingPrice}`,
          'Packed Date': f.packedDate.toISOString().split('T')[0],
          'Status': f.status
        }));
      }

      default:
        return [];
    }
  }

  // 2. Export Styled Excel Report
  static async exportReportWorkbook(companyId: string, reportType: string, filters: any = {}) {
    const data = await this.getReportData(companyId, reportType, filters);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tailor CRM Manufacturing Engine';
    workbook.created = new Date();

    const sheetName = reportType.replace(/-/g, ' ').toUpperCase().slice(0, 30);
    const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

    if (data.length === 0) {
      sheet.addRow(['No records found for this manufacturing report filter.']);
      return workbook;
    }

    const headers = Object.keys(data[0]);
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    data.forEach((row: any) => {
      sheet.addRow(Object.values(row));
    });

    sheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 4, 35);
    });

    return workbook;
  }
}
