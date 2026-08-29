export interface WhatsAppMessagePayload {
  phone: string;
  customerName: string;
  companyName: string;
  type: 'ORDER_CONFIRM' | 'MEASUREMENT_RECORDED' | 'TRIAL_READY' | 'READY_FOR_PICKUP' | 'PAYMENT_RECEIPT';
  meta?: Record<string, any>;
}

export function generateWhatsAppMessage(payload: WhatsAppMessagePayload): { message: string; waLink: string } {
  const { phone, customerName, companyName, type, meta = {} } = payload;
  let text = '';

  switch (type) {
    case 'ORDER_CONFIRM':
      text = `🌟 *Namaste ${customerName} ji!*\n\nThank you for placing your tailoring order with *${companyName}*.\n\n📋 *Order No:* ${meta.orderNumber || ''}\n📅 *Delivery Date:* ${meta.deliveryDate || ''}\n${meta.trialDate ? `🪡 *Trial Date:* ${meta.trialDate}\n` : ''}💰 *Total Amount:* ₹${meta.totalAmount || 0}\n💵 *Advance Paid:* ₹${meta.advancePaid || 0}\n💳 *Balance Due:* ₹${meta.balanceDue || 0}\n\nWe are crafting your garments with precision! ✂️\n\n_${companyName}_`;
      break;

    case 'MEASUREMENT_RECORDED':
      text = `✂️ *Namaste ${customerName} ji!*\n\nYour measurements for *${meta.title || 'Custom Fitting'}* have been successfully recorded in *${companyName}*.\n\nUnit: ${meta.unit || 'INCH'}\nWe ensure perfect fitting for your clothes.\n\n_${companyName}_`;
      break;

    case 'TRIAL_READY':
      text = `👔 *Trial Ready Alert!*\n\nNamaste ${customerName} ji, your order *${meta.orderNumber || ''}* is ready for trial fitting at *${companyName}*.\n\nPlease visit our boutique at your earliest convenience.\n\n_${companyName}_`;
      break;

    case 'READY_FOR_PICKUP':
      text = `🎉 *Your Order is Ready!*\n\nNamaste ${customerName} ji, your garments for order *${meta.orderNumber || ''}* are finished, quality checked, and ready for pickup!\n\n💳 *Balance to Pay:* ₹${meta.balanceDue || 0}\n\nWe look forward to seeing you at *${companyName}*!\n\n_${companyName}_`;
      break;

    case 'PAYMENT_RECEIPT':
      text = `🧾 *Payment Received Receipt*\n\nNamaste ${customerName} ji, we received your payment of *₹${meta.amount || 0}* via ${meta.paymentMethod || 'Cash'}.\n\nRemaining Balance: *₹${meta.balanceDue || 0}*\n\nThank you for choosing *${companyName}*!`;
      break;

    default:
      text = `Hello ${customerName}, update from ${companyName}.`;
  }

  // Clean international phone number format (e.g. 919876543210)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone; // default India code
  }

  const encoded = encodeURIComponent(text);
  const waLink = `https://wa.me/${cleanPhone}?text=${encoded}`;

  return { message: text, waLink };
}
