import { prisma } from '../../config/db';

export interface AuditEventParams {
  companyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  recordId?: string | null;
  status?: 'SUCCESS' | 'FAILED' | 'WARNING';
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
          status: params.status || 'SUCCESS',
          detailsJson: params.details ? JSON.stringify(params.details) : undefined,
          ipAddress: params.ipAddress
        }
      });
    } catch (err) {
      console.error('AuditLog creation failed:', err);
      return null;
    }
  }

  static async getLogs(companyId: string, filters: { action?: string; entityType?: string; status?: string; limit?: number; offset?: number } = {}) {
    const where: any = { companyId };
    if (filters.action && filters.action !== 'ALL') where.action = filters.action;
    if (filters.entityType && filters.entityType !== 'ALL') where.entityType = filters.entityType;
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      })
    ]);

    return {
      total,
      logs: logs.map((l) => ({
        ...l,
        details: l.detailsJson ? JSON.parse(l.detailsJson) : {}
      }))
    };
  }
}
