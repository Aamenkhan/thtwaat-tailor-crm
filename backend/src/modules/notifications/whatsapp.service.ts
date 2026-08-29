import axios from 'axios';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';

export interface SendMessageOptions {
  to?: string;
  recipientName?: string;
  messageType?: string;
  orderId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  customerId?: string | null;
  userId?: string | null;
}

export class WhatsAppService {
  // 1. Format phone to international 12-digit (e.g. 919876543210)
  static formatPhone(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 10) clean = '91' + clean;
    return clean;
  }

  // 2. Generate WhatsApp Web URL
  static generateWaLink(phone: string, text: string): string {
    const formatted = this.formatPhone(phone);
    return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  }

  // 3. Get Tenant WhatsApp Configuration
  static async getConfig(companyId: string) {
    let config = await prisma.whatsAppConfig.findUnique({
      where: { companyId }
    });

    if (!config) {
      config = await prisma.whatsAppConfig.create({
        data: {
          companyId,
          providerType: 'FALLBACK_LINK'
        }
      });
    }

    // Mask API token for security before returning to client
    return {
      id: config.id,
      companyId: config.companyId,
      ownerWhatsApp: config.ownerWhatsApp || '',
      phoneNumberId: config.phoneNumberId || '',
      businessAccountId: config.businessAccountId || '',
      providerType: config.providerType,
      isConfigured: Boolean(config.phoneNumberId && config.apiToken),
      hasToken: Boolean(config.apiToken)
    };
  }

  // 4. Save Tenant WhatsApp Configuration
  static async saveConfig(companyId: string, data: { ownerWhatsApp?: string; phoneNumberId?: string; businessAccountId?: string; apiToken?: string; providerType?: string; webhookSecret?: string }, userId?: string) {
    const existing = await prisma.whatsAppConfig.findUnique({ where: { companyId } });

    const updateData: any = {
      ownerWhatsApp: data.ownerWhatsApp ? this.formatPhone(data.ownerWhatsApp) : undefined,
      phoneNumberId: data.phoneNumberId !== undefined ? data.phoneNumberId : undefined,
      businessAccountId: data.businessAccountId !== undefined ? data.businessAccountId : undefined,
      providerType: data.providerType || (data.apiToken && data.phoneNumberId ? 'CLOUD_API' : 'FALLBACK_LINK')
    };

    if (data.apiToken && data.apiToken.trim() !== '') {
      updateData.apiToken = data.apiToken.trim();
    }
    if (data.webhookSecret && data.webhookSecret.trim() !== '') {
      updateData.webhookSecret = data.webhookSecret.trim();
    }

    let config;
    if (existing) {
      config = await prisma.whatsAppConfig.update({
        where: { companyId },
        data: updateData
      });
    } else {
      config = await prisma.whatsAppConfig.create({
        data: {
          companyId,
          ...updateData
        }
      });
    }

    await AuditService.log({
      companyId,
      userId,
      action: 'SETTINGS_UPDATE',
      entityType: 'SETTINGS',
      status: 'SUCCESS',
      details: { field: 'WhatsAppConfig', providerType: config.providerType }
    });

    return {
      success: true,
      ownerWhatsApp: config.ownerWhatsApp,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
      providerType: config.providerType,
      isConfigured: Boolean(config.phoneNumberId && config.apiToken)
    };
  }

  // 5. Send Plain Text
  static async sendText(companyId: string, to: string, text: string, options: SendMessageOptions = {}) {
    const formattedPhone = this.formatPhone(to);
    const waLink = this.generateWaLink(to, text);
    const config = await prisma.whatsAppConfig.findUnique({ where: { companyId } });

    let status = 'SENT';
    let provider = 'WHATSAPP_WEB_LINK';
    let externalMessageId = null;
    let failureReason = null;

    if (config?.apiToken && config?.phoneNumberId) {
      try {
        const response = await axios.post(
          `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'text',
            text: { preview_url: true, body: text }
          },
          {
            headers: {
              Authorization: `Bearer ${config.apiToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        provider = 'WHATSAPP_BUSINESS_API';
        externalMessageId = response.data?.messages?.[0]?.id || null;
        status = 'SENT';
      } catch (err: any) {
        console.error('[WhatsApp Cloud API Error]:', err?.response?.data || err.message);
        status = 'FAILED';
        failureReason = err?.response?.data?.error?.message || err.message;
        provider = 'WHATSAPP_BUSINESS_API';
      }
    }

    // Save message history log
    const log = await prisma.whatsAppMessageLog.create({
      data: {
        companyId,
        recipientPhone: formattedPhone,
        recipientName: options.recipientName || 'Customer',
        messageType: options.messageType || 'CUSTOM',
        messageText: text,
        status,
        provider,
        externalMessageId,
        failureReason,
        orderId: options.orderId || undefined,
        invoiceId: options.invoiceId || undefined,
        paymentId: options.paymentId || undefined,
        customerId: options.customerId || undefined
      }
    });

    await AuditService.log({
      companyId,
      userId: options.userId,
      action: 'WHATSAPP_SENT',
      entityType: (options.messageType as any) || 'CUSTOMER',
      recordId: log.id,
      status: status === 'SENT' ? 'SUCCESS' : 'FAILED',
      details: { recipientPhone: formattedPhone, provider, error: failureReason }
    });

    return {
      success: status === 'SENT',
      status,
      provider,
      waLink,
      messageId: log.id,
      messageText: text,
      failureReason
    };
  }

  // 6. Send Template Message with Dynamic Variable Replacements
  static async sendTemplate(
    companyId: string,
    to: string,
    templateCategory: string,
    variables: Record<string, string | number>,
    options: SendMessageOptions = {}
  ) {
    // Check if custom template exists for company, else use standard default
    const customTpl = await prisma.whatsAppTemplate.findFirst({
      where: { companyId, category: templateCategory }
    });

    let rawBody = customTpl?.bodyText || this.getDefaultTemplateText(templateCategory);

    // Replace {{variable}} tokens
    let renderedText = rawBody;
    Object.entries(variables).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      renderedText = renderedText.replace(regex, String(val));
    });

    return await this.sendText(companyId, to, renderedText, {
      ...options,
      messageType: templateCategory
    });
  }

  // 7. Send Invoice Flow (Customer or Owner)
  static async sendInvoice(companyId: string, invoiceId: string, toType: 'CUSTOMER' | 'OWNER' = 'CUSTOMER', userId?: string) {
    const [invoice, company, config] = await Promise.all([
      prisma.invoice.findFirst({
        where: { id: invoiceId, companyId },
        include: { order: true }
      }),
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.whatsAppConfig.findUnique({ where: { companyId } })
    ]);

    if (!invoice) throw new Error('Invoice not found');

    let recipientPhone = invoice.customerPhone;
    let recipientName = invoice.customerName;

    if (toType === 'OWNER') {
      if (!config?.ownerWhatsApp && !company?.phone) {
        throw new Error('Owner WhatsApp number is not configured in Settings.');
      }
      recipientPhone = config?.ownerWhatsApp || company?.phone || '';
      recipientName = `${company?.name} (Owner Copy)`;
    }

    const variables = {
      customer_name: invoice.customerName,
      invoice_number: invoice.invoiceNumber,
      order_number: invoice.order.orderNumber,
      amount: invoice.totalAmount.toLocaleString(),
      paid: invoice.amountPaid.toLocaleString(),
      balance: invoice.balanceDue.toLocaleString(),
      delivery_date: invoice.order.deliveryDate ? invoice.order.deliveryDate.toISOString().split('T')[0] : 'N/A',
      company_name: company?.name || 'Tailor Boutique'
    };

    const result = await this.sendTemplate(companyId, recipientPhone, 'INVOICE', variables, {
      to: recipientPhone,
      recipientName,
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      customerId: invoice.order.customerId,
      userId
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'INVOICE_SENT',
      entityType: 'INVOICE',
      recordId: invoice.id,
      status: result.success ? 'SUCCESS' : 'FAILED',
      details: { toType, recipientPhone, invoiceNumber: invoice.invoiceNumber }
    });

    return result;
  }

  // 8. Send Payment Receipt Flow
  static async sendPaymentReceipt(companyId: string, paymentId: string, toType: 'CUSTOMER' | 'OWNER' = 'CUSTOMER', userId?: string) {
    const [payment, company, config] = await Promise.all([
      prisma.payment.findFirst({
        where: { id: paymentId, companyId },
        include: { customer: true, order: true, invoice: true }
      }),
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.whatsAppConfig.findUnique({ where: { companyId } })
    ]);

    if (!payment) throw new Error('Payment record not found');

    let recipientPhone = payment.customer.phone;
    let recipientName = payment.customer.name;

    if (toType === 'OWNER') {
      if (!config?.ownerWhatsApp && !company?.phone) {
        throw new Error('Owner WhatsApp number is not configured in Settings.');
      }
      recipientPhone = config?.ownerWhatsApp || company?.phone || '';
      recipientName = `${company?.name} (Owner)`;
    }

    const totalPaid = (payment.order?.advancePaid || 0);
    const balanceDue = payment.order?.balanceDue ?? payment.invoice?.balanceDue ?? 0;

    const variables = {
      customer_name: payment.customer.name,
      order_number: payment.order?.orderNumber || payment.invoice?.invoiceNumber || 'PAY',
      invoice_number: payment.invoice?.invoiceNumber || 'N/A',
      amount: payment.amount.toLocaleString(),
      paid: totalPaid.toLocaleString(),
      balance: balanceDue.toLocaleString(),
      company_name: company?.name || 'Tailor Boutique'
    };

    const result = await this.sendTemplate(companyId, recipientPhone, 'PAYMENT_RECEIPT', variables, {
      to: recipientPhone,
      recipientName,
      paymentId: payment.id,
      orderId: payment.orderId,
      customerId: payment.customerId,
      userId
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'PAYMENT_RECEIPT_SENT',
      entityType: 'PAYMENT',
      recordId: payment.id,
      status: result.success ? 'SUCCESS' : 'FAILED',
      details: { toType, recipientPhone, amount: payment.amount }
    });

    return result;
  }

  // 9. Send Order Updates
  static async sendOrderUpdate(companyId: string, orderId: string, updateType: 'ORDER_CONFIRM' | 'ORDER_READY' | 'DELIVERY_REMINDER' | 'DISPATCH', userId?: string) {
    const [order, company] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, companyId },
        include: { customer: true }
      }),
      prisma.company.findUnique({ where: { id: companyId } })
    ]);

    if (!order) throw new Error('Order not found');

    const variables = {
      customer_name: order.customer.name,
      order_number: order.orderNumber,
      amount: order.finalAmount.toLocaleString(),
      paid: order.advancePaid.toLocaleString(),
      balance: order.balanceDue.toLocaleString(),
      delivery_date: order.deliveryDate ? order.deliveryDate.toISOString().split('T')[0] : 'N/A',
      company_name: company?.name || 'Tailor Boutique'
    };

    return await this.sendTemplate(companyId, order.customer.phone, updateType, variables, {
      to: order.customer.phone,
      recipientName: order.customer.name,
      orderId: order.id,
      customerId: order.customerId,
      userId
    });
  }

  // 10. Message History Query
  static async getMessages(companyId: string, filters: { messageType?: string; status?: string; limit?: number; offset?: number } = {}) {
    const { messageType, status, limit = 50, offset = 0 } = filters;
    const where: any = { companyId };
    if (messageType) where.messageType = messageType;
    if (status) where.status = status;

    const [messages, total] = await Promise.all([
      prisma.whatsAppMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.whatsAppMessageLog.count({ where })
    ]);

    return { messages, total, limit, offset };
  }

  // 11. Templates Manager
  static async getTemplates(companyId: string) {
    const dbTemplates = await prisma.whatsAppTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' }
    });

    const defaultCategories = [
      'ORDER_CONFIRM',
      'INVOICE',
      'PAYMENT_RECEIPT',
      'PAYMENT_REMINDER',
      'ORDER_READY',
      'DELIVERY_REMINDER',
      'DISPATCH',
      'THANK_YOU'
    ];

    const templates = defaultCategories.map((cat) => {
      const found = dbTemplates.find((t) => t.category === cat);
      return {
        id: found?.id || `default-${cat}`,
        category: cat,
        name: found?.name || this.getTemplateDisplayName(cat),
        bodyText: found?.bodyText || this.getDefaultTemplateText(cat),
        isCustom: Boolean(found),
        supportedVariables: [
          '{{customer_name}}',
          '{{order_number}}',
          '{{invoice_number}}',
          '{{amount}}',
          '{{paid}}',
          '{{balance}}',
          '{{delivery_date}}',
          '{{company_name}}'
        ]
      };
    });

    return templates;
  }

  static async saveTemplate(companyId: string, category: string, name: string, bodyText: string) {
    const existing = await prisma.whatsAppTemplate.findFirst({
      where: { companyId, category }
    });

    if (existing) {
      return await prisma.whatsAppTemplate.update({
        where: { id: existing.id },
        data: { name, bodyText }
      });
    } else {
      return await prisma.whatsAppTemplate.create({
        data: {
          companyId,
          category,
          name,
          bodyText,
          isDefault: false
        }
      });
    }
  }

  // Helper: Default Templates
  private static getTemplateDisplayName(cat: string): string {
    switch (cat) {
      case 'ORDER_CONFIRM':
        return 'Order Confirmation';
      case 'INVOICE':
        return 'Tax Invoice & Bill';
      case 'PAYMENT_RECEIPT':
        return 'Payment Received';
      case 'PAYMENT_REMINDER':
        return 'Payment Reminder';
      case 'ORDER_READY':
        return 'Order Ready / Trial Fitting';
      case 'DELIVERY_REMINDER':
        return 'Delivery Reminder';
      case 'DISPATCH':
        return 'Garments Dispatched / Shipped';
      case 'THANK_YOU':
        return 'Thank You & Feedback';
      default:
        return cat;
    }
  }

  private static getDefaultTemplateText(cat: string): string {
    switch (cat) {
      case 'ORDER_CONFIRM':
        return `🌟 *Namaste {{customer_name}} ji!*\n\nThank you for placing your order with *{{company_name}}*.\n\n📋 *Order No:* {{order_number}}\n📅 *Delivery Date:* {{delivery_date}}\n💰 *Total Amount:* ₹{{amount}}\n💵 *Advance Paid:* ₹{{paid}}\n💳 *Balance Due:* ₹{{balance}}\n\nWe are crafting your garments with precision! ✂️\n\n_{{company_name}}_`;

      case 'INVOICE':
        return `🧾 *TAX INVOICE - {{invoice_number}}*\n\nNamaste {{customer_name}} ji,\n\nHere is your official bill from *{{company_name}}*:\n📋 *Order:* {{order_number}}\n💰 *Total:* ₹{{amount}}\n💵 *Paid:* ₹{{paid}}\n💳 *Balance Due:* ₹{{balance}}\n\nThank you for choosing us! ✂️`;

      case 'PAYMENT_RECEIPT':
        return `🧾 *Payment Received Receipt*\n\nNamaste {{customer_name}} ji, we have received your payment of *₹{{amount}}*.\n\n📋 *Order No:* {{order_number}}\n💵 *Total Paid:* ₹{{paid}}\n💳 *Remaining Balance:* ₹{{balance}}\n\nThank you for choosing *{{company_name}}*! 🙏`;

      case 'PAYMENT_REMINDER':
        return `💳 *Payment Reminder Alert*\n\nNamaste {{customer_name}} ji, this is a gentle reminder regarding your pending balance of *₹{{balance}}* for order *{{order_number}}* at *{{company_name}}*.\n\nKindly clear the dues at your convenience. Thank you!`;

      case 'ORDER_READY':
        return `👔 *Your Garments are Ready for Trial / Pickup!*\n\nNamaste {{customer_name}} ji, your order *{{order_number}}* is ready at *{{company_name}}*.\n\n💳 *Pending Balance:* ₹{{balance}}\nPlease visit our boutique at your earliest convenience! 🎉`;

      case 'DELIVERY_REMINDER':
        return `⏰ *Upcoming Delivery Alert*\n\nNamaste {{customer_name}} ji, your order *{{order_number}}* is scheduled for delivery on *{{delivery_date}}*.\n\n_{{company_name}}_`;

      case 'DISPATCH':
        return `📦 *Dispatched / Ready for Delivery*\n\nNamaste {{customer_name}} ji, your package for order *{{order_number}}* has been packed and dispatched from *{{company_name}}*.\n\nTracking info will be updated soon.`;

      case 'THANK_YOU':
        return `💖 *Thank You from {{company_name}}!*\n\nNamaste {{customer_name}} ji, thank you for your patronage! We hope you love the fit and quality of your custom garments. Looking forward to serving you again soon! ✨`;

      default:
        return `Hello {{customer_name}}, update from {{company_name}}.`;
    }
  }
}

// Backward compatibility export for server.ts
export function generateWhatsAppMessage(payload: any) {
  const { phone, customerName, companyName, type, meta = {} } = payload;
  const variables = {
    customer_name: customerName,
    company_name: companyName,
    order_number: meta.orderNumber || '',
    invoice_number: meta.invoiceNumber || '',
    amount: meta.totalAmount || meta.amount || 0,
    paid: meta.advancePaid || 0,
    balance: meta.balanceDue || 0,
    delivery_date: meta.deliveryDate || ''
  };

  const text = (WhatsAppService as any).getDefaultTemplateText(type || 'ORDER_CONFIRM');
  let rendered = text;
  Object.entries(variables).forEach(([k, v]) => {
    rendered = rendered.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'gi'), String(v));
  });

  return {
    message: rendered,
    waLink: WhatsAppService.generateWaLink(phone, rendered)
  };
}
