import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { ExpenseService } from './expense.service';
import { GSTService } from './gst.service';
import { PnLService } from './pnl.service';
import { LedgerService } from './ledger.service';

const router = Router();
router.use(authenticateJWT);

// ==========================================
// 1. EXPENSE MANAGEMENT
// ==========================================
router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const expense = await ExpenseService.createExpense(req.companyId!, req.body, req.user?.id);
    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const expenses = await ExpenseService.getExpenses(req.companyId!, req.query as any);
    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/expenses/summary', async (req: Request, res: Response) => {
  try {
    const summary = await ExpenseService.getExpenseSummary(req.companyId!, req.query as any);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. GST COMPLIANCE (GSTR-1 & GSTR-3B)
// ==========================================
router.post('/gst/calculate', async (req: Request, res: Response) => {
  try {
    const { taxableAmount, taxRate, companyStateCode, placeOfSupply } = req.body;
    const result = GSTService.calculateGST(
      Number(taxableAmount) || 0,
      Number(taxRate) || 0,
      companyStateCode,
      placeOfSupply
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/gst/gstr-1', async (req: Request, res: Response) => {
  try {
    const report = await GSTService.getGSTR1Report(req.companyId!, req.query as any);
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gst/gstr-3b', async (req: Request, res: Response) => {
  try {
    const report = await GSTService.getGSTR3BReport(req.companyId!, req.query as any);
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. PROFIT & LOSS (P&L) STATEMENT
// ==========================================
router.get('/pnl', async (req: Request, res: Response) => {
  try {
    const pnl = await PnLService.getProfitAndLoss(req.companyId!, req.query as any);
    res.json({ success: true, data: pnl });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. LEDGERS & STATEMENTS OF ACCOUNT
// ==========================================
router.get('/ledger/customer/:id', async (req: Request, res: Response) => {
  try {
    const ledger = await LedgerService.getCustomerLedger(req.companyId!, req.params.id);
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/ledger/vendor/:id', async (req: Request, res: Response) => {
  try {
    const ledger = await LedgerService.getVendorLedger(req.companyId!, req.params.id);
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/journal', async (req: Request, res: Response) => {
  try {
    const entry = await LedgerService.recordJournalEntry(req.companyId!, req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
