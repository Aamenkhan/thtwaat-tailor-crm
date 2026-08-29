import { prisma } from '../../config/db';

export interface AuditEventParams {
  companyId: string;
  userId?: string | null;
  action:
    | 'EXCEL_IMPORT'
    | 'EXCEL_EXPORT'
    | 'GOOGLE_IMPORT'
    | 'GOOGLE_EXPORT'
    | 'GOOGLE_SYNC'
    | 'WHATSAPP_SENT'
    | 'INVOICE_SENT'
    | 'PAYMENT_RECEIPT_SENT'
    | 'TEMPLATE_DOWNLOAD'
    | 'SETTINGS_UPDATE';
  entityType:
    | 'PRODUCT'
    | 'CUSTOMER'
    | 'INVENTORY'
    | 'ORDER'
    | 'INVOICE'
    | 'PAYMENT'
    | 'TEMPLATE'
    | 'SETTINGS'
    | 'WORKER'
    | 'SUPPLIER'
    | 'PRODUCTION'
    | 'PURCHASE'
    | 'REPORT';
  recordId?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  details?: Record<string, any>;
  ipAddress?: string;
}

export class AuditService {
  static async log(params: AuditEventParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          companyId: params.companyId,
          userId: params.userId || undefined,
          action: params.action,
          entityType: params.entityType,
          recordId: params.recordId || undefined,
          status: params.status,
          detailsJson: params.details ? JSON.stringify(params.details) : undefined,
          ipAddress: params.ipAddress || undefined
        }
      });
    } catch (err) {
      console.error('[AuditService] Failed to record audit event:', err);
      return null;
    }
  }

  static async getLogs(companyId: string, options: { action?: string; entityType?: string; limit?: number; offset?: number } = {}) {
    const { action, entityType, limit = 50, offset = 0 } = options;
    const where: any = { companyId };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditLog.count({ where })
    ]);

    return { logs, total, limit, offset };
  }
}
