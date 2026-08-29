import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { ExcelService } from './excel.service';
import { AuditService } from '../audit/audit.service';

const router = Router();

// -------------------------------------------------------------
// DOWNLOAD EXCEL DATA EXPORT (13 ENTITIES + REPORTS)
// -------------------------------------------------------------
router.get('/:entityType', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const { entityType } = req.params;
    const filters = req.query;

    const workbook = await ExcelService.exportEntity(companyId, entityType, filters);

    const filename = `${entityType.toUpperCase()}_Export_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);

    await AuditService.log({
      companyId,
      userId: req.user?.id,
      action: 'EXCEL_EXPORT',
      entityType: entityType.toUpperCase() as any,
      status: 'SUCCESS',
      details: { entityType, filters, filename }
    });

    return res.end();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// -------------------------------------------------------------
// DOWNLOAD PRE-FORMATTED EXCEL IMPORT TEMPLATES
// -------------------------------------------------------------
router.get('/templates/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const workbook = ExcelService.getTemplate(type);

    const filename = `${type.toUpperCase()}_Import_Template.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to download template' });
  }
});

export const exportRoutes = router;
