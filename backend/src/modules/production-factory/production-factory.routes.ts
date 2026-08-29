import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { ProductionPlanningService } from './production-planning.service';
import { CuttingBundlingService } from './cutting-bundling.service';
import { FactoryOpsService } from './factory-ops.service';
import { CostingPayrollService } from './costing-payroll.service';
import { ManufacturingReportsService } from './manufacturing-reports.service';

const router = Router();
router.use(authenticateJWT);

// ==========================================
// 1. PRODUCTION PLANNING & AUTO BOM
// ==========================================
router.post('/planning/orders', async (req: Request, res: Response) => {
  try {
    const order = await ProductionPlanningService.createProductionOrder(
      req.companyId!,
      req.body,
      req.user?.id
    );
    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/planning/orders', async (req: Request, res: Response) => {
  try {
    const orders = await ProductionPlanningService.getProductionOrders(req.companyId!, req.query as any);
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/planning/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await ProductionPlanningService.getProductionOrderById(req.companyId!, req.params.id);
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/planning/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const order = await ProductionPlanningService.updateProductionStatus(
      req.companyId!,
      req.params.id,
      req.body.status,
      req.user?.id
    );
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/planning/orders/:id/recalculate-bom', async (req: Request, res: Response) => {
  try {
    const reqs = await ProductionPlanningService.calculateMaterialRequirements(
      req.companyId!,
      req.params.id,
      req.body.wastagePercentage,
      req.user?.id
    );
    res.json({ success: true, data: reqs });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/planning/create-purchase-requisition', async (req: Request, res: Response) => {
  try {
    const reqs = await ProductionPlanningService.createPurchaseRequisition(
      req.companyId!,
      req.body,
      req.user?.id
    );
    res.status(201).json({ success: true, data: reqs });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. FABRIC ROLLS, CUTTING & BUNDLING
// ==========================================
router.post('/rolls', async (req: Request, res: Response) => {
  try {
    const roll = await CuttingBundlingService.createFabricRoll(req.companyId!, req.body, req.user?.id);
    res.status(201).json({ success: true, data: roll });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/rolls', async (req: Request, res: Response) => {
  try {
    const rolls = await CuttingBundlingService.getFabricRolls(req.companyId!, req.query as any);
    res.json({ success: true, data: rolls });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cutting-plans', async (req: Request, res: Response) => {
  try {
    const result = await CuttingBundlingService.createCuttingPlan(req.companyId!, req.body, req.user?.id);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/cutting-plans', async (req: Request, res: Response) => {
  try {
    const plans = await CuttingBundlingService.getCuttingPlans(req.companyId!, req.query as any);
    res.json({ success: true, data: plans });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bundles', async (req: Request, res: Response) => {
  try {
    const bundles = await CuttingBundlingService.getBundles(req.companyId!, req.query as any);
    res.json({ success: true, data: bundles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bundles/scan/:code', async (req: Request, res: Response) => {
  try {
    const bundle = await CuttingBundlingService.scanBundle(req.companyId!, req.params.code);
    res.json({ success: true, data: bundle });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. FACTORY OPS, LINES, QC & REWORK
// ==========================================
router.post('/lines', async (req: Request, res: Response) => {
  try {
    const line = await FactoryOpsService.createProductionLine(req.companyId!, req.body, req.user?.id);
    res.status(201).json({ success: true, data: line });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/lines', async (req: Request, res: Response) => {
  try {
    const lines = await FactoryOpsService.getProductionLines(req.companyId!);
    res.json({ success: true, data: lines });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/daily-production', async (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    const logs = await FactoryOpsService.recordDailyProduction(req.companyId!, entries, req.user?.id);
    res.status(201).json({ success: true, data: logs });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/daily-production', async (req: Request, res: Response) => {
  try {
    const logs = await FactoryOpsService.getDailyProductionLogs(req.companyId!, req.query as any);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/qc/inspect', async (req: Request, res: Response) => {
  try {
    const result = await FactoryOpsService.inspectQC(req.companyId!, req.body, req.user?.id);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/qc/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboard = await FactoryOpsService.getQCDashboard(req.companyId!, req.query as any);
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rework/process', async (req: Request, res: Response) => {
  try {
    const rework = await FactoryOpsService.processRework(req.companyId!, req.body, req.user?.id);
    res.json({ success: true, data: rework });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:id/complete', async (req: Request, res: Response) => {
  try {
    const result = await FactoryOpsService.completeProductionOrder(
      req.companyId!,
      req.params.id,
      req.body,
      req.user?.id
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. COSTING & WORKER PAYROLL
// ==========================================
router.get('/costing/:id/variance', async (req: Request, res: Response) => {
  try {
    const variance = await CostingPayrollService.getMaterialConsumptionVariance(req.companyId!, req.params.id);
    res.json({ success: true, data: variance });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/costing/:id/calculate', async (req: Request, res: Response) => {
  try {
    const costing = await CostingPayrollService.computeManufacturingCosting(
      req.companyId!,
      { productionOrderId: req.params.id, ...req.body },
      req.user?.id
    );
    res.json({ success: true, data: costing });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/payroll/workers', async (req: Request, res: Response) => {
  try {
    const ledger = await CostingPayrollService.getWorkerPayoutLedger(req.companyId!, req.query as any);
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. ADVANCED MANUFACTURING REPORTS
// ==========================================
router.get('/reports/:type', async (req: Request, res: Response) => {
  try {
    const data = await ManufacturingReportsService.getReportData(req.companyId!, req.params.type, req.query);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/:type/export', async (req: Request, res: Response) => {
  try {
    const workbook = await ManufacturingReportsService.exportReportWorkbook(req.companyId!, req.params.type, req.query);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Manufacturing_${req.params.type}_Report_${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
