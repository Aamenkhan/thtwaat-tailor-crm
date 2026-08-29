import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { GoogleSheetsService } from './google-sheets.service';

const router = Router();

// 1. Get Google Integration Status
router.get('/status', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const data = await GoogleSheetsService.getIntegration(req.companyId!);
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch Google status' });
  }
});

// 2. Connect Google Account / OAuth Tokens
router.post('/connect', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await GoogleSheetsService.connectAccount(req.companyId!, req.body, req.user?.id);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to connect Google account' });
  }
});

// 3. List Available Google Spreadsheets
router.get('/spreadsheets', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await GoogleSheetsService.listSpreadsheets(req.companyId!);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list spreadsheets' });
  }
});

// 4. Export Entity to Google Sheet
router.post('/export', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { entityType, spreadsheetId, createNew } = req.body;
    if (!entityType) {
      return res.status(400).json({ error: 'entityType is required (e.g. customers, products, orders)' });
    }
    const result = await GoogleSheetsService.exportToGoogle(
      req.companyId!,
      entityType,
      { spreadsheetId, createNew },
      req.user?.id
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export to Google Sheets' });
  }
});

// 5. Import Entity from Google Sheet
router.post('/import', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { entityType, rows, updateDuplicates } = req.body;
    if (!entityType || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'entityType and rows array are required' });
    }
    const result = await GoogleSheetsService.importFromGoogle(
      req.companyId!,
      entityType,
      rows,
      { updateDuplicates },
      req.user?.id
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to import from Google Sheets' });
  }
});

// 6. Run Two-Way Sync
router.post('/sync', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { entities } = req.body;
    const result = await GoogleSheetsService.runTwoWaySync(
      req.companyId!,
      { entities },
      req.user?.id
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Two-way sync failed' });
  }
});

export const googleRoutes = router;
