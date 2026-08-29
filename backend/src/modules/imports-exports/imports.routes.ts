import { Router, Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { authenticateJWT } from '../../middleware/auth';
import { ExcelService } from './excel.service';
import { AuditService } from '../audit/audit.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to extract rows from uploaded Excel buffer
async function parseExcelBuffer(buffer: Buffer): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  const rows: any[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? cell.value.toString().trim() : `Column_${colNumber}`;
      });
    } else {
      const rowObj: any = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowObj[header] = cell.value !== null && cell.value !== undefined ? cell.value : '';
        }
      });
      // Only include non-empty rows
      if (Object.values(rowObj).some((val) => val !== '')) {
        rows.push(rowObj);
      }
    }
  });

  return rows;
}

// -------------------------------------------------------------
// PRODUCTS BULK IMPORT ENDPOINTS
// -------------------------------------------------------------
router.post(
  '/products/validate',
  authenticateJWT,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId!;
      let rows = req.body.rows;

      if (req.file) {
        rows = await parseExcelBuffer(req.file.buffer);
      } else if (typeof rows === 'string') {
        try {
          rows = JSON.parse(rows);
        } catch {}
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No data rows found in uploaded file or payload.' });
      }

      const result = await ExcelService.validateProducts(companyId, rows);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Validation failed' });
    }
  }
);

router.post('/products/commit', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const { validRows } = req.body;

    if (!Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ error: 'No valid product rows provided for commit.' });
    }

    const result = await ExcelService.commitProducts(companyId, validRows);

    await AuditService.log({
      companyId,
      userId: req.user?.id,
      action: 'EXCEL_IMPORT',
      entityType: 'PRODUCT',
      status: 'SUCCESS',
      details: { total: validRows.length, result }
    });

    return res.json({ success: true, message: 'Products imported successfully', data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bulk commit failed' });
  }
});

// -------------------------------------------------------------
// CUSTOMERS BULK IMPORT ENDPOINTS
// -------------------------------------------------------------
router.post(
  '/customers/validate',
  authenticateJWT,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId!;
      let rows = req.body.rows;

      if (req.file) {
        rows = await parseExcelBuffer(req.file.buffer);
      } else if (typeof rows === 'string') {
        try {
          rows = JSON.parse(rows);
        } catch {}
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No customer data rows found in uploaded file or payload.' });
      }

      const result = await ExcelService.validateCustomers(companyId, rows);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Customer validation failed' });
    }
  }
);

router.post('/customers/commit', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const { validRows, updateDuplicates = true } = req.body;

    if (!Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ error: 'No valid customer rows provided for commit.' });
    }

    const result = await ExcelService.commitCustomers(companyId, validRows, updateDuplicates);

    await AuditService.log({
      companyId,
      userId: req.user?.id,
      action: 'EXCEL_IMPORT',
      entityType: 'CUSTOMER',
      status: 'SUCCESS',
      details: { total: validRows.length, result }
    });

    return res.json({ success: true, message: 'Customers imported successfully', data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bulk commit failed' });
  }
});

// -------------------------------------------------------------
// INVENTORY BULK IMPORT ENDPOINTS
// -------------------------------------------------------------
router.post(
  '/inventory/validate',
  authenticateJWT,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId!;
      let rows = req.body.rows;

      if (req.file) {
        rows = await parseExcelBuffer(req.file.buffer);
      } else if (typeof rows === 'string') {
        try {
          rows = JSON.parse(rows);
        } catch {}
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No inventory data rows found in uploaded file or payload.' });
      }

      const result = await ExcelService.validateInventory(companyId, rows);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Inventory validation failed' });
    }
  }
);

router.post('/inventory/commit', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const { validRows } = req.body;

    if (!Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ error: 'No valid inventory rows provided for commit.' });
    }

    const result = await ExcelService.commitInventory(companyId, validRows, req.branchId, req.user?.id);

    await AuditService.log({
      companyId,
      userId: req.user?.id,
      action: 'EXCEL_IMPORT',
      entityType: 'INVENTORY',
      status: 'SUCCESS',
      details: { total: validRows.length, result }
    });

    return res.json({ success: true, message: 'Inventory items imported successfully', data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bulk inventory commit failed' });
  }
});

// -------------------------------------------------------------
// DOWNLOAD ERROR EXCEL WORKBOOK
// -------------------------------------------------------------
router.post('/error-file', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { errors } = req.body;
    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ error: 'No errors to generate report for.' });
    }

    const workbook = ExcelService.generateErrorWorkbook(errors);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Import_Errors.xlsx"');

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate error file' });
  }
});

export const importRoutes = router;
