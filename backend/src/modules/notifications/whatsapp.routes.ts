import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { WhatsAppService } from './whatsapp.service';

const router = Router();

// 1. Get Tenant WhatsApp Settings
router.get('/config', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const config = await WhatsAppService.getConfig(req.companyId!);
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch WhatsApp config' });
  }
});

// 2. Save Tenant WhatsApp Settings
router.post('/config', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await WhatsAppService.saveConfig(req.companyId!, req.body, req.user?.id);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save WhatsApp config' });
  }
});

// 3. Get WhatsApp Status
router.get('/status', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const config = await WhatsAppService.getConfig(req.companyId!);
    return res.json({
      success: true,
      data: {
        isConnected: config.isConfigured,
        providerType: config.providerType,
        ownerConfigured: Boolean(config.ownerWhatsApp),
        ownerWhatsApp: config.ownerWhatsApp
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Get Message History Logs
router.get('/messages', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { messageType, status, limit, offset } = req.query;
    const result = await WhatsAppService.getMessages(req.companyId!, {
      messageType: messageType as string,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch messages' });
  }
});

// 5. Get Templates
router.get('/templates', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const templates = await WhatsAppService.getTemplates(req.companyId!);
    return res.json({ success: true, data: templates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch templates' });
  }
});

// 6. Save Custom Template
router.post('/templates', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { category, name, bodyText } = req.body;
    if (!category || !bodyText) {
      return res.status(400).json({ error: 'Category and bodyText are required' });
    }
    const template = await WhatsAppService.saveTemplate(
      req.companyId!,
      category,
      name || category,
      bodyText
    );
    return res.json({ success: true, data: template });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save template' });
  }
});

// 7. Send Plain Text / Direct WhatsApp
router.post('/send-text', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { to, text, recipientName, orderId, invoiceId, paymentId, customerId } = req.body;
    if (!to || !text) {
      return res.status(400).json({ error: 'Recipient phone (to) and text message are required' });
    }
    const result = await WhatsAppService.sendText(req.companyId!, to, text, {
      recipientName,
      orderId,
      invoiceId,
      paymentId,
      customerId,
      userId: req.user?.id
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send WhatsApp message' });
  }
});

// 8. Send Template Message
router.post('/send-template', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { to, templateCategory, variables, recipientName, orderId, invoiceId, paymentId, customerId } = req.body;
    if (!to || !templateCategory) {
      return res.status(400).json({ error: 'Recipient phone (to) and templateCategory are required' });
    }
    const result = await WhatsAppService.sendTemplate(
      req.companyId!,
      to,
      templateCategory,
      variables || {},
      {
        recipientName,
        orderId,
        invoiceId,
        paymentId,
        customerId,
        userId: req.user?.id
      }
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send template message' });
  }
});

// 9. Send Invoice Flow (Customer or Owner)
router.post('/send-invoice', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { invoiceId, toType = 'CUSTOMER' } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }
    const result = await WhatsAppService.sendInvoice(req.companyId!, invoiceId, toType, req.user?.id);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send invoice on WhatsApp' });
  }
});

// 10. Send Payment Receipt Flow
router.post('/send-receipt', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { paymentId, toType = 'CUSTOMER' } = req.body;
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }
    const result = await WhatsAppService.sendPaymentReceipt(req.companyId!, paymentId, toType, req.user?.id);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send payment receipt on WhatsApp' });
  }
});

export const whatsappRoutes = router;
