import { Router, Request, Response } from 'express';
import { authenticateJWT, requireRoles } from '../../middleware/auth';
import { AuditService } from './audit.service';

const router = Router();

// GET Audit Logs (Restricted to OWNER, ADMIN, MANAGER)
router.get('/logs', authenticateJWT, requireRoles(['OWNER', 'ADMIN', 'MANAGER']), async (req: Request, res: Response) => {
  try {
    const { action, entityType, limit, offset } = req.query;
    const result = await AuditService.getLogs(req.companyId!, {
      action: action as string,
      entityType: entityType as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
});

export const auditRoutes = router;
