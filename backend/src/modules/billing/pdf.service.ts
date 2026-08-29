import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface InvoicePDFData {
  company: {
    name: string;
    phone: string;
    email: string;
    address?: string | null;
    gstNumber?: string | null;
    currency: string;
  };
  invoice: {
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate?: Date | null;
    customerName: string;
    customerPhone: string;
    customerAddress?: string | null;
    customerGst?: string | null;
    subtotal: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    status: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
}

export async function generateInvoicePDFBuffer(data: InvoicePDFData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Generate UPI QR Code image buffer if balance due > 0
      let qrImageBuffer: Buffer | null = null;
      try {
        const upiString = `upi://pay?pa=${data.company.phone}@upi&pn=${encodeURIComponent(data.company.name)}&am=${data.invoice.balanceDue}&cu=INR`;
        qrImageBuffer = await QRCode.toBuffer(upiString, { width: 120, margin: 1 });
      } catch (e) {
        // Ignore QR generation failure if unsupported
      }

      // Header - Company Brand
      doc.fillColor('#1E293B').fontSize(22).font('Helvetica-Bold').text(data.company.name, 40, 40);
      doc.fontSize(9).font('Helvetica').fillColor('#64748B');
      if (data.company.address) doc.text(data.company.address);
      doc.text(`Phone: ${data.company.phone} | Email: ${data.company.email}`);
      if (data.company.gstNumber) doc.text(`GSTIN: ${data.company.gstNumber}`);

      // Title & Invoice Meta
      doc.fillColor('#0F172A').fontSize(18).font('Helvetica-Bold').text('TAX INVOICE', 380, 40, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#475569');
      doc.text(`Invoice No: ${data.invoice.invoiceNumber}`, 380, 65, { align: 'right' });
      doc.text(`Date: ${new Date(data.invoice.invoiceDate).toLocaleDateString()}`, 380, 80, { align: 'right' });
      if (data.invoice.dueDate) {
        doc.text(`Delivery/Due: ${new Date(data.invoice.dueDate).toLocaleDateString()}`, 380, 95, { align: 'right' });
      }
      doc.text(`Status: ${data.invoice.status}`, 380, 110, { align: 'right' });

      // Horizontal Rule
      doc.moveTo(40, 135).lineTo(555, 135).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // Billed To (Customer)
      doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('BILLED TO:', 40, 150);
      doc.font('Helvetica').fontSize(10).fillColor('#334155');
      doc.text(data.invoice.customerName, 40, 166);
      doc.text(`Phone: ${data.invoice.customerPhone}`, 40, 180);
      if (data.invoice.customerAddress) doc.text(`Address: ${data.invoice.customerAddress}`, 40, 194);
      if (data.invoice.customerGst) doc.text(`GSTIN: ${data.invoice.customerGst}`, 40, 208);

      // Items Table Header
      const tableTop = 230;
      doc.rect(40, tableTop, 515, 24).fill('#F1F5F9');
      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold');
      doc.text('ITEM & DESCRIPTION', 50, tableTop + 7);
      doc.text('QTY', 330, tableTop + 7, { width: 50, align: 'center' });
      doc.text('RATE', 390, tableTop + 7, { width: 70, align: 'right' });
      doc.text('AMOUNT', 470, tableTop + 7, { width: 75, align: 'right' });

      // Items Rows
      let y = tableTop + 30;
      doc.font('Helvetica').fontSize(9).fillColor('#1E293B');

      data.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name}`, 50, y, { width: 270 });
        doc.text(`${item.quantity}`, 330, y, { width: 50, align: 'center' });
        doc.text(`₹${item.unitPrice.toFixed(2)}`, 390, y, { width: 70, align: 'right' });
        doc.text(`₹${item.totalAmount.toFixed(2)}`, 470, y, { width: 75, align: 'right' });
        
        y += 24;
        doc.moveTo(40, y - 5).lineTo(555, y - 5).strokeColor('#F1F5F9').stroke();
      });

      // Totals & Calculations
      const totalsY = Math.max(y + 15, 380);

      // Left Column: UPI QR Code & Note
      if (qrImageBuffer && data.invoice.balanceDue > 0) {
        doc.image(qrImageBuffer, 45, totalsY, { width: 90 });
        doc.fontSize(8).fillColor('#64748B').text('Scan to Pay via UPI', 45, totalsY + 95);
      }

      // Right Column: Price summary
      const rightX = 350;
      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      
      doc.text('Subtotal:', rightX, totalsY);
      doc.text(`₹${data.invoice.subtotal.toFixed(2)}`, 470, totalsY, { width: 75, align: 'right' });

      if (data.invoice.discount > 0) {
        doc.text('Discount:', rightX, totalsY + 16);
        doc.text(`-₹${data.invoice.discount.toFixed(2)}`, 470, totalsY + 16, { width: 75, align: 'right' });
      }

      if (data.invoice.taxAmount > 0) {
        doc.text(`GST (${data.invoice.taxRate}%):`, rightX, totalsY + 32);
        doc.text(`₹${data.invoice.taxAmount.toFixed(2)}`, 470, totalsY + 32, { width: 75, align: 'right' });
      }

      doc.rect(rightX - 5, totalsY + 50, 210, 24).fill('#F8FAFC');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A');
      doc.text('Total Amount:', rightX, totalsY + 56);
      doc.text(`₹${data.invoice.totalAmount.toFixed(2)}`, 470, totalsY + 56, { width: 75, align: 'right' });

      doc.font('Helvetica').fontSize(9).fillColor('#16A34A');
      doc.text('Advance Paid:', rightX, totalsY + 80);
      doc.text(`₹${data.invoice.amountPaid.toFixed(2)}`, 470, totalsY + 80, { width: 75, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#DC2626');
      doc.text('Balance Due:', rightX, totalsY + 98);
      doc.text(`₹${data.invoice.balanceDue.toFixed(2)}`, 470, totalsY + 98, { width: 75, align: 'right' });

      // Footer Terms
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8');
      doc.text('Thank you for your business! Items once tailored are subject to trial fitting within 7 days.', 40, 750, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
