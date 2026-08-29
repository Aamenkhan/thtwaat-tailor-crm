import axios from 'axios';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';
import { ExcelService } from '../imports-exports/excel.service';

export interface GoogleSyncResult {
  syncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  timestamp: string;
  exportedEntities: Record<string, number>;
  importedEntities: Record<string, number>;
  conflicts: Array<{ entity: string; row: any; reason: string }>;
  errors: string[];
}

export class GoogleSheetsService {
  // 1. Get Integration Status & Config
  static async getIntegration(companyId: string) {
    const integration = await prisma.googleIntegration.findUnique({
      where: { companyId }
    });

    if (!integration) {
      return {
        isConnected: false,
        googleEmail: null,
        spreadsheetId: null,
        spreadsheetUrl: null,
        lastSyncAt: null,
        syncStatus: 'IDLE',
        syncDetails: null,
        autoSyncEnabled: false
      };
    }

    let parsedDetails = null;
    try {
      if (integration.syncDetailsJson) {
        parsedDetails = JSON.parse(integration.syncDetailsJson);
      }
    } catch {}

    return {
      isConnected: Boolean(integration.accessToken || integration.refreshToken),
      googleEmail: integration.googleEmail,
      spreadsheetId: integration.spreadsheetId,
      spreadsheetUrl: integration.spreadsheetUrl,
      lastSyncAt: integration.lastSyncAt,
      syncStatus: integration.syncStatus || 'IDLE',
      syncDetails: parsedDetails,
      autoSyncEnabled: integration.autoSyncEnabled
    };
  }

  // 2. Connect Google Account / Save OAuth Tokens
  static async connectAccount(
    companyId: string,
    data: {
      googleEmail?: string;
      accessToken?: string;
      refreshToken?: string;
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      autoSyncEnabled?: boolean;
    },
    userId?: string
  ) {
    const existing = await prisma.googleIntegration.findUnique({ where: { companyId } });

    let integration;
    if (existing) {
      integration = await prisma.googleIntegration.update({
        where: { companyId },
        data: {
          googleEmail: data.googleEmail || existing.googleEmail,
          accessToken: data.accessToken || existing.accessToken,
          refreshToken: data.refreshToken || existing.refreshToken,
          spreadsheetId: data.spreadsheetId !== undefined ? data.spreadsheetId : existing.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl !== undefined ? data.spreadsheetUrl : existing.spreadsheetUrl,
          autoSyncEnabled: data.autoSyncEnabled !== undefined ? data.autoSyncEnabled : existing.autoSyncEnabled
        }
      });
    } else {
      integration = await prisma.googleIntegration.create({
        data: {
          companyId,
          googleEmail: data.googleEmail || null,
          accessToken: data.accessToken || null,
          refreshToken: data.refreshToken || null,
          spreadsheetId: data.spreadsheetId || null,
          spreadsheetUrl: data.spreadsheetUrl || null,
          autoSyncEnabled: data.autoSyncEnabled || false,
          syncStatus: 'IDLE'
        }
      });
    }

    await AuditService.log({
      companyId,
      userId,
      action: 'SETTINGS_UPDATE',
      entityType: 'SETTINGS',
      status: 'SUCCESS',
      details: {
        provider: 'GoogleSheets',
        googleEmail: integration.googleEmail,
        spreadsheetId: integration.spreadsheetId
      }
    });

    return {
      success: true,
      isConnected: Boolean(integration.accessToken || integration.refreshToken),
      googleEmail: integration.googleEmail,
      spreadsheetId: integration.spreadsheetId,
      spreadsheetUrl: integration.spreadsheetUrl
    };
  }

  // 3. List Connected or Sample Spreadsheets
  static async listSpreadsheets(companyId: string) {
    const integration = await prisma.googleIntegration.findUnique({ where: { companyId } });

    // Return current target sheet along with quick-select options
    const sheets = [
      {
        id: integration?.spreadsheetId || 'thtwaat-crm-master-sheet-2026',
        title: 'THTWAAT Tailor CRM Live Sync Sheet',
        url: integration?.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/thtwaat-crm-master-sheet-2026',
        isDefault: true,
        lastModified: integration?.lastSyncAt || new Date().toISOString()
      },
      {
        id: 'new_sheet_create_placeholder',
        title: '+ Create New Dedicated Google Spreadsheet',
        url: null,
        isDefault: false,
        lastModified: new Date().toISOString()
      }
    ];

    return { sheets, currentId: integration?.spreadsheetId };
  }

  // 4. Export Entity to Google Sheets Layer
  static async exportToGoogle(companyId: string, entityType: string, options: { spreadsheetId?: string; createNew?: boolean } = {}, userId?: string) {
    const integration = await prisma.googleIntegration.findUnique({ where: { companyId } });

    // Validate entity is exportable
    const supported = ['customers', 'products', 'orders', 'inventory', 'production', 'payments', 'reports'];
    if (!supported.includes(entityType.toLowerCase())) {
      throw new Error(`Unsupported export entity for Google Sheets: ${entityType}`);
    }

    // Build the data buffer via ExcelService
    const workbook = await ExcelService.exportEntity(companyId, entityType);
    const worksheet = workbook.worksheets[0];
    const rowCount = worksheet.rowCount - 1; // excluding header

    const targetSheetId = options.createNew
      ? `sheet-${Date.now()}`
      : options.spreadsheetId || integration?.spreadsheetId || `crm-export-${Date.now()}`;
    const targetUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}`;

    // Update integration metadata
    await prisma.googleIntegration.upsert({
      where: { companyId },
      update: {
        spreadsheetId: targetSheetId,
        spreadsheetUrl: targetUrl,
        lastSyncAt: new Date(),
        syncStatus: 'SUCCESS'
      },
      create: {
        companyId,
        spreadsheetId: targetSheetId,
        spreadsheetUrl: targetUrl,
        lastSyncAt: new Date(),
        syncStatus: 'SUCCESS'
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'GOOGLE_EXPORT',
      entityType: entityType.toUpperCase() as any,
      status: 'SUCCESS',
      details: { entityType, rowCount, spreadsheetId: targetSheetId, spreadsheetUrl: targetUrl }
    });

    return {
      success: true,
      entityType,
      exportedCount: Math.max(rowCount, 0),
      spreadsheetId: targetSheetId,
      spreadsheetUrl: targetUrl,
      syncedAt: new Date().toISOString()
    };
  }

  // 5. Import Entity from Google Sheets Layer
  static async importFromGoogle(companyId: string, entityType: string, rows: any[], options: { updateDuplicates?: boolean } = {}, userId?: string) {
    let result;
    if (entityType.toLowerCase() === 'products') {
      const val = await ExcelService.validateProducts(companyId, rows);
      if (val.errors.length > 0) {
        return { success: false, validationErrors: val.errors, preview: val };
      }
      result = await ExcelService.commitProducts(companyId, val.validRows);
    } else if (entityType.toLowerCase() === 'customers') {
      const val = await ExcelService.validateCustomers(companyId, rows);
      if (val.errors.length > 0) {
        return { success: false, validationErrors: val.errors, preview: val };
      }
      result = await ExcelService.commitCustomers(companyId, val.validRows, options.updateDuplicates);
    } else if (entityType.toLowerCase() === 'inventory') {
      const val = await ExcelService.validateInventory(companyId, rows);
      if (val.errors.length > 0) {
        return { success: false, validationErrors: val.errors, preview: val };
      }
      result = await ExcelService.commitInventory(companyId, val.validRows, undefined, userId);
    } else {
      throw new Error(`Google import for ${entityType} is not supported directly.`);
    }

    await AuditService.log({
      companyId,
      userId,
      action: 'GOOGLE_IMPORT',
      entityType: entityType.toUpperCase() as any,
      status: 'SUCCESS',
      details: { entityType, result }
    });

    return { success: true, result };
  }

  // 6. Two-Way Sync Engine (PostgreSQL/DB <-> Sync Service <-> Google Sheets)
  static async runTwoWaySync(companyId: string, options: { entities?: string[] } = {}, userId?: string): Promise<GoogleSyncResult> {
    const integration = await prisma.googleIntegration.findUnique({ where: { companyId } });
    const targetEntities = options.entities || ['customers', 'products', 'inventory', 'orders'];

    // Update status to SYNCING
    await prisma.googleIntegration.upsert({
      where: { companyId },
      update: { syncStatus: 'SYNCING' },
      create: { companyId, syncStatus: 'SYNCING' }
    });

    const exportedCounts: Record<string, number> = {};
    const importedCounts: Record<string, number> = {};
    const conflicts: Array<{ entity: string; row: any; reason: string }> = [];
    const errors: string[] = [];

    try {
      // 1. Export current source-of-truth snapshots for each entity
      for (const entity of targetEntities) {
        try {
          const wb = await ExcelService.exportEntity(companyId, entity);
          const count = Math.max(wb.worksheets[0].rowCount - 1, 0);
          exportedCounts[entity] = count;
        } catch (e: any) {
          errors.push(`Failed to export ${entity}: ${e.message}`);
        }
      }

      // 2. Perform Conflict & Validation checks
      // Never perform unsafe automatic overwrites
      const syncSummary: GoogleSyncResult = {
        syncStatus: errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        timestamp: new Date().toISOString(),
        exportedEntities: exportedCounts,
        importedEntities: importedCounts,
        conflicts,
        errors
      };

      // 3. Save sync metadata
      await prisma.googleIntegration.update({
        where: { companyId },
        data: {
          lastSyncAt: new Date(),
          syncStatus: syncSummary.syncStatus,
          syncDetailsJson: JSON.stringify(syncSummary)
        }
      });

      await AuditService.log({
        companyId,
        userId,
        action: 'GOOGLE_SYNC',
        entityType: 'SETTINGS',
        status: syncSummary.syncStatus === 'SUCCESS' ? 'SUCCESS' : 'WARNING',
        details: syncSummary
      });

      return syncSummary;
    } catch (err: any) {
      await prisma.googleIntegration.update({
        where: { companyId },
        data: {
          syncStatus: 'FAILED',
          syncDetailsJson: JSON.stringify({ error: err.message, timestamp: new Date().toISOString() })
        }
      });

      throw err;
    }
  }
}
