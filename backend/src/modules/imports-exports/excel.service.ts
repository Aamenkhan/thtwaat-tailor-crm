import ExcelJS from 'exceljs';
import { prisma } from '../../config/db';

export interface ValidationErrorItem {
  rowNumber: number;
  sku?: string;
  field: string;
  error: string;
  suggestedFix: string;
}

export interface ValidationResult<T = any> {
  total: number;
  validCount: number;
  errorCount: number;
  validRows: T[];
  errors: ValidationErrorItem[];
}

export class ExcelService {
  // Common styling helper
  private static applyHeaderStyles(worksheet: ExcelJS.Worksheet) {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark Slate Navy
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Auto fit column widths
    worksheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const str = cell.value ? cell.value.toString() : '';
        if (str.length > maxLen) maxLen = Math.min(str.length + 3, 50);
      });
      col.width = maxLen;
    });

    // Add thin borders to data cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      }
    });
  }

  // ==========================================
  // 1. EXPORT SERVICE (13 ENTITIES + REPORTS)
  // ==========================================
  static async exportEntity(companyId: string, entityType: string, filters: Record<string, any> = {}): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'THTWAAT Tailor CRM';
    workbook.created = new Date();

    const { startDate, endDate, status, category, customerType, role } = filters;

    switch (entityType.toLowerCase()) {
      case 'customers': {
        const worksheet = workbook.addWorksheet('Customers');
        worksheet.columns = [
          { header: 'ID', key: 'id' },
          { header: 'Full Name', key: 'name' },
          { header: 'Business Name', key: 'businessName' },
          { header: 'Phone Number', key: 'phone' },
          { header: 'WhatsApp Number', key: 'whatsapp' },
          { header: 'Email Address', key: 'email' },
          { header: 'Address', key: 'address' },
          { header: 'GST Number', key: 'gstNumber' },
          { header: 'Customer Type', key: 'customerType' },
          { header: 'Notes', key: 'notes' },
          { header: 'Created Date', key: 'createdAt' }
        ];

        const where: any = { companyId };
        if (customerType) where.customerType = customerType;
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate);
          if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const data = await prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
        data.forEach((c) => {
          worksheet.addRow({
            id: c.id,
            name: c.name,
            businessName: c.businessName || '',
            phone: c.phone,
            whatsapp: c.whatsapp || '',
            email: c.email || '',
            address: c.address || '',
            gstNumber: c.gstNumber || '',
            customerType: c.customerType,
            notes: c.notes || '',
            createdAt: c.createdAt.toISOString().split('T')[0]
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'buyers': {
        const worksheet = workbook.addWorksheet('B2B Buyers');
        worksheet.columns = [
          { header: 'Buyer Name', key: 'name' },
          { header: 'Business Name', key: 'businessName' },
          { header: 'Phone', key: 'phone' },
          { header: 'Email', key: 'email' },
          { header: 'GST', key: 'gstNumber' },
          { header: 'Address', key: 'address' },
          { header: 'Total Orders', key: 'orderCount' },
          { header: 'Total Spent (₹)', key: 'totalSpent' }
        ];

        const data = await prisma.customer.findMany({
          where: { companyId, customerType: { in: ['BOUTIQUE', 'BRAND', 'WHOLESALE'] } },
          include: { orders: true }
        });

        data.forEach((b) => {
          const totalSpent = b.orders.reduce((sum, o) => sum + o.finalAmount, 0);
          worksheet.addRow({
            name: b.name,
            businessName: b.businessName || '',
            phone: b.phone,
            email: b.email || '',
            gstNumber: b.gstNumber || '',
            address: b.address || '',
            orderCount: b.orders.length,
            totalSpent
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'products': {
        const worksheet = workbook.addWorksheet('Products');
        worksheet.columns = [
          { header: 'SKU / Style No', key: 'styleNumber' },
          { header: 'Product Name', key: 'name' },
          { header: 'Category', key: 'category' },
          { header: 'Brand', key: 'brand' },
          { header: 'Gender', key: 'gender' },
          { header: 'Fabric Details', key: 'fabricDetails' },
          { header: 'Selling Price (₹)', key: 'sellingPrice' },
          { header: 'Cost Price (₹)', key: 'estimatedCost' },
          { header: 'Standard Time (mins)', key: 'standardProdMinutes' },
          { header: 'Sizes', key: 'sizeRange' },
          { header: 'Colors', key: 'colorRange' },
          { header: 'Description', key: 'description' }
        ];

        const where: any = { companyId };
        if (category) where.category = category;
        const data = await prisma.productStyle.findMany({ where, orderBy: { createdAt: 'desc' } });

        data.forEach((p) => {
          let sizes = '';
          let colors = '';
          try {
            sizes = JSON.parse(p.sizeRangeJson || '[]').join(', ');
            colors = JSON.parse(p.colorRangeJson || '[]').join(', ');
          } catch {}

          worksheet.addRow({
            styleNumber: p.styleNumber,
            name: p.name,
            category: p.category,
            brand: p.brand || '',
            gender: p.gender,
            fabricDetails: p.fabricDetails || '',
            sellingPrice: p.sellingPrice,
            estimatedCost: p.estimatedCost,
            standardProdMinutes: p.standardProdMinutes,
            sizeRange: sizes,
            colorRange: colors,
            description: p.description || ''
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'product-variants':
      case 'variants': {
        const worksheet = workbook.addWorksheet('Product Variants');
        worksheet.columns = [
          { header: 'Parent Style SKU', key: 'styleNumber' },
          { header: 'Product Name', key: 'name' },
          { header: 'Category', key: 'category' },
          { header: 'Size', key: 'size' },
          { header: 'Color', key: 'color' },
          { header: 'Selling Price (₹)', key: 'sellingPrice' },
          { header: 'Cost Price (₹)', key: 'estimatedCost' }
        ];

        const data = await prisma.productStyle.findMany({ where: { companyId } });
        data.forEach((p) => {
          let sizes: string[] = ['Standard'];
          let colors: string[] = ['Standard'];
          try {
            const s = JSON.parse(p.sizeRangeJson || '[]');
            const c = JSON.parse(p.colorRangeJson || '[]');
            if (s.length > 0) sizes = s;
            if (c.length > 0) colors = c;
          } catch {}

          sizes.forEach((sz) => {
            colors.forEach((col) => {
              worksheet.addRow({
                styleNumber: p.styleNumber,
                name: p.name,
                category: p.category,
                size: sz,
                color: col,
                sellingPrice: p.sellingPrice,
                estimatedCost: p.estimatedCost
              });
            });
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'orders': {
        const worksheet = workbook.addWorksheet('Orders');
        worksheet.columns = [
          { header: 'Order Number', key: 'orderNumber' },
          { header: 'Customer Name', key: 'customerName' },
          { header: 'Customer Phone', key: 'customerPhone' },
          { header: 'Order Type', key: 'orderType' },
          { header: 'Status', key: 'status' },
          { header: 'Priority', key: 'priority' },
          { header: 'Order Date', key: 'createdAt' },
          { header: 'Trial Date', key: 'trialDate' },
          { header: 'Delivery Date', key: 'deliveryDate' },
          { header: 'Total (₹)', key: 'totalAmount' },
          { header: 'Discount (₹)', key: 'discount' },
          { header: 'Tax (₹)', key: 'taxAmount' },
          { header: 'Final Amount (₹)', key: 'finalAmount' },
          { header: 'Advance Paid (₹)', key: 'advancePaid' },
          { header: 'Balance Due (₹)', key: 'balanceDue' },
          { header: 'Payment Status', key: 'paymentStatus' }
        ];

        const where: any = { companyId };
        if (status) where.status = status;
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate);
          if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const data = await prisma.order.findMany({
          where,
          include: { customer: true },
          orderBy: { createdAt: 'desc' }
        });

        data.forEach((o) => {
          worksheet.addRow({
            orderNumber: o.orderNumber,
            customerName: o.customer.name,
            customerPhone: o.customer.phone,
            orderType: o.orderType,
            status: o.status,
            priority: o.priority,
            createdAt: o.createdAt.toISOString().split('T')[0],
            trialDate: o.trialDate ? o.trialDate.toISOString().split('T')[0] : '',
            deliveryDate: o.deliveryDate.toISOString().split('T')[0],
            totalAmount: o.totalAmount,
            discount: o.discount,
            taxAmount: o.taxAmount,
            finalAmount: o.finalAmount,
            advancePaid: o.advancePaid,
            balanceDue: o.balanceDue,
            paymentStatus: o.paymentStatus
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'measurements': {
        const worksheet = workbook.addWorksheet('Measurements');
        worksheet.columns = [
          { header: 'Customer Name', key: 'customerName' },
          { header: 'Customer Phone', key: 'customerPhone' },
          { header: 'Measurement Title', key: 'title' },
          { header: 'Gender', key: 'gender' },
          { header: 'Unit', key: 'unit' },
          { header: 'Measurements Data', key: 'values' },
          { header: 'Special Instructions', key: 'instructions' },
          { header: 'Date Recorded', key: 'createdAt' }
        ];

        const data = await prisma.customerMeasurement.findMany({
          where: { companyId },
          include: { customer: true },
          orderBy: { createdAt: 'desc' }
        });

        data.forEach((m) => {
          let parsedVals = '';
          try {
            const parsed = JSON.parse(m.valuesJson || '{}');
            parsedVals = Object.entries(parsed)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
          } catch {}

          worksheet.addRow({
            customerName: m.customer.name,
            customerPhone: m.customer.phone,
            title: m.title,
            gender: m.gender,
            unit: m.unit,
            values: parsedVals,
            instructions: m.specialInstructions || '',
            createdAt: m.createdAt.toISOString().split('T')[0]
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'inventory': {
        const worksheet = workbook.addWorksheet('Inventory');
        worksheet.columns = [
          { header: 'SKU', key: 'sku' },
          { header: 'Item / Material Name', key: 'name' },
          { header: 'Category', key: 'category' },
          { header: 'Unit', key: 'unit' },
          { header: 'Current Stock', key: 'currentStock' },
          { header: 'Min Stock Alert', key: 'minStockAlert' },
          { header: 'Unit Cost (₹)', key: 'unitCost' },
          { header: 'Total Value (₹)', key: 'totalValue' },
          { header: 'Supplier Name', key: 'supplierName' },
          { header: 'Storage Location', key: 'location' }
        ];

        const where: any = { companyId };
        if (category) where.category = category;
        const data = await prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } });

        data.forEach((item) => {
          worksheet.addRow({
            sku: item.sku || '',
            name: item.name,
            category: item.category,
            unit: item.unit,
            currentStock: item.currentStock,
            minStockAlert: item.minStockAlert,
            unitCost: item.unitCost,
            totalValue: item.currentStock * item.unitCost,
            supplierName: item.supplierName || '',
            location: item.location || ''
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'suppliers': {
        const worksheet = workbook.addWorksheet('Suppliers');
        worksheet.columns = [
          { header: 'Supplier Contact Name', key: 'name' },
          { header: 'Company Name', key: 'companyName' },
          { header: 'Phone Number', key: 'phone' },
          { header: 'Email Address', key: 'email' },
          { header: 'Address', key: 'address' },
          { header: 'GST Number', key: 'gstNumber' },
          { header: 'Payment Terms', key: 'paymentTerms' },
          { header: 'Created Date', key: 'createdAt' }
        ];

        const data = await prisma.supplier.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        data.forEach((s) => {
          worksheet.addRow({
            name: s.name,
            companyName: s.companyName || '',
            phone: s.phone,
            email: s.email || '',
            address: s.address || '',
            gstNumber: s.gstNumber || '',
            paymentTerms: s.paymentTerms || 'Net 30',
            createdAt: s.createdAt.toISOString().split('T')[0]
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'purchases': {
        const worksheet = workbook.addWorksheet('Purchases');
        worksheet.columns = [
          { header: 'PO Number', key: 'poNumber' },
          { header: 'Supplier Name', key: 'supplierName' },
          { header: 'Status', key: 'status' },
          { header: 'Payment Status', key: 'paymentStatus' },
          { header: 'Total Amount (₹)', key: 'finalAmount' },
          { header: 'Order Date', key: 'orderDate' },
          { header: 'Received Date', key: 'receivedDate' },
          { header: 'Notes', key: 'notes' }
        ];

        const data = await prisma.purchaseOrder.findMany({
          where: { companyId },
          include: { supplier: true },
          orderBy: { createdAt: 'desc' }
        });

        data.forEach((p) => {
          worksheet.addRow({
            poNumber: p.poNumber,
            supplierName: p.supplier.name,
            status: p.status,
            paymentStatus: p.paymentStatus,
            finalAmount: p.finalAmount,
            orderDate: p.orderDate.toISOString().split('T')[0],
            receivedDate: p.receivedDate ? p.receivedDate.toISOString().split('T')[0] : '',
            notes: p.notes || ''
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'production': {
        const worksheet = workbook.addWorksheet('Production Job Cards');
        worksheet.columns = [
          { header: 'Job Card No', key: 'jobCardNumber' },
          { header: 'Order Number', key: 'orderNumber' },
          { header: 'Garment Item', key: 'itemName' },
          { header: 'Current Stage', key: 'currentStage' },
          { header: 'QC Status', key: 'qcStatus' },
          { header: 'Assigned Worker', key: 'workerName' },
          { header: 'Priority', key: 'priority' },
          { header: 'Planned Qty', key: 'plannedQuantity' },
          { header: 'Completed Qty', key: 'completedQuantity' },
          { header: 'Started Date', key: 'startedAt' },
          { header: 'Completed Date', key: 'completedAt' }
        ];

        const data = await prisma.productionJobCard.findMany({
          where: { companyId },
          include: { order: true, orderItem: true, assignedWorker: true },
          orderBy: { createdAt: 'desc' }
        });

        data.forEach((jc) => {
          worksheet.addRow({
            jobCardNumber: jc.jobCardNumber,
            orderNumber: jc.order.orderNumber,
            itemName: jc.orderItem.customItemName,
            currentStage: jc.currentStage,
            qcStatus: jc.qcStatus,
            workerName: jc.assignedWorker?.name || 'Unassigned',
            priority: jc.priority,
            plannedQuantity: jc.plannedQuantity,
            completedQuantity: jc.completedQuantity,
            startedAt: jc.startedAt.toISOString().split('T')[0],
            completedAt: jc.completedAt ? jc.completedAt.toISOString().split('T')[0] : ''
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'workers': {
        const worksheet = workbook.addWorksheet('Workers & Artisans');
        worksheet.columns = [
          { header: 'Worker Name', key: 'name' },
          { header: 'Phone Number', key: 'phone' },
          { header: 'Role', key: 'role' },
          { header: 'Wage Type', key: 'wageType' },
          { header: 'Default Piece Rate (₹)', key: 'defaultPieceRate' },
          { header: 'Monthly Salary (₹)', key: 'monthlySalary' },
          { header: 'Active Status', key: 'isActive' },
          { header: 'Joined Date', key: 'createdAt' }
        ];

        const where: any = { companyId };
        if (role) where.role = role;
        const data = await prisma.worker.findMany({ where, orderBy: { name: 'asc' } });

        data.forEach((w) => {
          worksheet.addRow({
            name: w.name,
            phone: w.phone,
            role: w.role,
            wageType: w.wageType,
            defaultPieceRate: w.defaultPieceRate,
            monthlySalary: w.monthlySalary,
            isActive: w.isActive ? 'Active' : 'Inactive',
            createdAt: w.createdAt.toISOString().split('T')[0]
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'payments': {
        const worksheet = workbook.addWorksheet('Payments');
        worksheet.columns = [
          { header: 'Date', key: 'createdAt' },
          { header: 'Customer Name', key: 'customerName' },
          { header: 'Amount (₹)', key: 'amount' },
          { header: 'Payment Method', key: 'paymentMethod' },
          { header: 'Reference / UTR', key: 'referenceNumber' },
          { header: 'Order No', key: 'orderNumber' },
          { header: 'Invoice No', key: 'invoiceNumber' },
          { header: 'Notes', key: 'notes' }
        ];

        const where: any = { companyId };
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate);
          if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const data = await prisma.payment.findMany({
          where,
          include: { customer: true, order: true, invoice: true },
          orderBy: { createdAt: 'desc' }
        });

        data.forEach((pay) => {
          worksheet.addRow({
            createdAt: pay.createdAt.toISOString().split('T')[0],
            customerName: pay.customer.name,
            amount: pay.amount,
            paymentMethod: pay.paymentMethod,
            referenceNumber: pay.referenceNumber || '',
            orderNumber: pay.order?.orderNumber || '',
            invoiceNumber: pay.invoice?.invoiceNumber || '',
            notes: pay.notes || ''
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'invoices': {
        const worksheet = workbook.addWorksheet('Invoices');
        worksheet.columns = [
          { header: 'Invoice No', key: 'invoiceNumber' },
          { header: 'Invoice Date', key: 'invoiceDate' },
          { header: 'Customer Name', key: 'customerName' },
          { header: 'Customer Phone', key: 'customerPhone' },
          { header: 'Subtotal (₹)', key: 'subtotal' },
          { header: 'Discount (₹)', key: 'discount' },
          { header: 'Tax (₹)', key: 'taxAmount' },
          { header: 'Total Amount (₹)', key: 'totalAmount' },
          { header: 'Amount Paid (₹)', key: 'amountPaid' },
          { header: 'Balance Due (₹)', key: 'balanceDue' },
          { header: 'Status', key: 'status' }
        ];

        const where: any = { companyId };
        if (status) where.status = status;
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = new Date(startDate);
          if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const data = await prisma.invoice.findMany({ where, orderBy: { invoiceDate: 'desc' } });
        data.forEach((inv) => {
          worksheet.addRow({
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
            customerName: inv.customerName,
            customerPhone: inv.customerPhone,
            subtotal: inv.subtotal,
            discount: inv.discount,
            taxAmount: inv.taxAmount,
            totalAmount: inv.totalAmount,
            amountPaid: inv.amountPaid,
            balanceDue: inv.balanceDue,
            status: inv.status
          });
        });
        this.applyHeaderStyles(worksheet);
        break;
      }

      case 'reports': {
        const summarySheet = workbook.addWorksheet('Business Overview');
        summarySheet.columns = [
          { header: 'Metric', key: 'metric' },
          { header: 'Value', key: 'value' }
        ];

        const [customersCount, ordersCount, totalRevenue, totalPending, inventoryValue, activeWorkers] =
          await Promise.all([
            prisma.customer.count({ where: { companyId } }),
            prisma.order.count({ where: { companyId } }),
            prisma.order.aggregate({ where: { companyId }, _sum: { finalAmount: true, advancePaid: true, balanceDue: true } }),
            prisma.order.aggregate({ where: { companyId, paymentStatus: { in: ['PENDING', 'PARTIAL'] } }, _sum: { balanceDue: true } }),
            prisma.inventoryItem.findMany({ where: { companyId } }),
            prisma.worker.count({ where: { companyId, isActive: true } })
          ]);

        const invTotal = inventoryValue.reduce((acc, item) => acc + item.currentStock * item.unitCost, 0);

        summarySheet.addRows([
          { metric: 'Total Customers', value: customersCount },
          { metric: 'Total Orders Placed', value: ordersCount },
          { metric: 'Total Billed Revenue (₹)', value: totalRevenue._sum.finalAmount || 0 },
          { metric: 'Total Advance Collected (₹)', value: totalRevenue._sum.advancePaid || 0 },
          { metric: 'Total Outstanding Balance Due (₹)', value: totalPending._sum.balanceDue || 0 },
          { metric: 'Total Inventory Valuation (₹)', value: invTotal },
          { metric: 'Active Tailors & Workforce', value: activeWorkers },
          { metric: 'Report Generated At', value: new Date().toISOString() }
        ]);
        this.applyHeaderStyles(summarySheet);
        break;
      }

      default:
        throw new Error(`Unsupported export entity: ${entityType}`);
    }

    return workbook;
  }

  // ==========================================
  // 2. TEMPLATES GENERATION
  // ==========================================
  static getTemplate(type: string): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'THTWAAT CRM Template Engine';

    switch (type.toLowerCase()) {
      case 'products': {
        const sheet = workbook.addWorksheet('Products Import Template');
        sheet.columns = [
          { header: 'SKU', key: 'sku' },
          { header: 'Style Number', key: 'styleNumber' },
          { header: 'Product Name', key: 'productName' },
          { header: 'Category', key: 'category' },
          { header: 'Description', key: 'description' },
          { header: 'Brand', key: 'brand' },
          { header: 'Gender', key: 'gender' },
          { header: 'Size', key: 'size' },
          { header: 'Color', key: 'color' },
          { header: 'Fabric', key: 'fabric' },
          { header: 'Unit', key: 'unit' },
          { header: 'Cost', key: 'cost' },
          { header: 'Selling Price', key: 'sellingPrice' },
          { header: 'Opening Stock', key: 'openingStock' },
          { header: 'Minimum Stock', key: 'minimumStock' },
          { header: 'Status', key: 'status' }
        ];

        // Sample rows
        sheet.addRow({
          sku: 'SHIRT-SLM-001',
          styleNumber: 'STY-SHIRT-01',
          productName: 'Classic Slim Fit Cotton Shirt',
          category: 'Shirt',
          description: '100% Egyptian Giza Cotton formal tailored shirt',
          brand: 'Raymond',
          gender: 'MEN',
          size: 'M, L, XL',
          color: 'Sky Blue, White',
          fabric: 'Giza Cotton 60s',
          unit: 'pcs',
          cost: 650,
          sellingPrice: 1699,
          openingStock: 25,
          minimumStock: 5,
          status: 'ACTIVE'
        });

        sheet.addRow({
          sku: 'SUIT-2PC-002',
          styleNumber: 'STY-SUIT-02',
          productName: 'Royal Italian 2-Piece Bespoke Suit',
          category: 'Suit',
          description: 'Handcrafted wool blend bespoke wedding suit',
          brand: 'Armani Wool Blend',
          gender: 'MEN',
          size: '38, 40, 42',
          color: 'Navy Blue, Charcoal Grey',
          fabric: 'Super 120s Italian Wool',
          unit: 'pcs',
          cost: 4500,
          sellingPrice: 12500,
          openingStock: 10,
          minimumStock: 2,
          status: 'ACTIVE'
        });

        this.applyHeaderStyles(sheet);
        break;
      }

      case 'customers': {
        const sheet = workbook.addWorksheet('Customers Import Template');
        sheet.columns = [
          { header: 'Name', key: 'name' },
          { header: 'Business Name', key: 'businessName' },
          { header: 'Phone', key: 'phone' },
          { header: 'WhatsApp', key: 'whatsapp' },
          { header: 'Email', key: 'email' },
          { header: 'Address', key: 'address' },
          { header: 'GST Number', key: 'gstNumber' },
          { header: 'Customer Type', key: 'customerType' },
          { header: 'Notes', key: 'notes' }
        ];

        sheet.addRow({
          name: 'Rahul Sharma',
          businessName: 'Sharma & Sons Apparels',
          phone: '9876543210',
          whatsapp: '9876543210',
          email: 'rahul.sharma@example.com',
          address: 'Shop 14, Commercial Market, South Delhi',
          gstNumber: '07AAAAA1234A1Z5',
          customerType: 'INDIVIDUAL',
          notes: 'Prefers slim fit stitching, regular buyer'
        });

        sheet.addRow({
          name: 'Pooja Kapoor',
          businessName: 'Glamour Boutique',
          phone: '9812345678',
          whatsapp: '9812345678',
          email: 'pooja.glamour@example.com',
          address: 'Boutique Complex, Mumbai Suburban',
          gstNumber: '27BBBBB5678B1Z2',
          customerType: 'BOUTIQUE',
          notes: 'Bulk order client for festive season dresses'
        });

        this.applyHeaderStyles(sheet);
        break;
      }

      case 'inventory': {
        const sheet = workbook.addWorksheet('Inventory Import Template');
        sheet.columns = [
          { header: 'SKU', key: 'sku' },
          { header: 'Material', key: 'material' },
          { header: 'Category', key: 'category' },
          { header: 'Unit', key: 'unit' },
          { header: 'Warehouse', key: 'warehouse' },
          { header: 'Location', key: 'location' },
          { header: 'Opening Quantity', key: 'openingQuantity' },
          { header: 'Minimum Stock', key: 'minimumStock' },
          { header: 'Cost', key: 'cost' }
        ];

        sheet.addRow({
          sku: 'FAB-CTN-WHT-100',
          material: 'Pure Egyptian Cotton 60s White',
          category: 'FABRIC',
          unit: 'meter',
          warehouse: 'Main Godown',
          location: 'Rack A-01',
          openingQuantity: 150,
          minimumStock: 30,
          cost: 220
        });

        sheet.addRow({
          sku: 'BTN-SHIRT-MOP-18',
          material: 'Mother of Pearl 18L Shirt Buttons',
          category: 'BUTTON',
          unit: 'pcs',
          warehouse: 'Trims Storage',
          location: 'Box B-04',
          openingQuantity: 2000,
          minimumStock: 300,
          cost: 2.5
        });

        sheet.addRow({
          sku: 'ZIP-YKK-MTL-08',
          material: 'YKK Antique Brass Metal Trouser Zipper 8 Inch',
          category: 'ZIPPER',
          unit: 'pcs',
          warehouse: 'Trims Storage',
          location: 'Drawer Z-02',
          openingQuantity: 250,
          minimumStock: 50,
          cost: 15
        });

        this.applyHeaderStyles(sheet);
        break;
      }

      case 'orders': {
        const sheet = workbook.addWorksheet('Orders Template');
        sheet.columns = [
          { header: 'Customer Phone', key: 'customerPhone' },
          { header: 'Order Type', key: 'orderType' },
          { header: 'Priority', key: 'priority' },
          { header: 'Garment Description', key: 'itemName' },
          { header: 'Quantity', key: 'quantity' },
          { header: 'Unit Price', key: 'unitPrice' },
          { header: 'Advance Paid', key: 'advancePaid' },
          { header: 'Delivery Date (YYYY-MM-DD)', key: 'deliveryDate' },
          { header: 'Notes', key: 'notes' }
        ];

        sheet.addRow({
          customerPhone: '9876543210',
          orderType: 'BESPOKE_TAILORING',
          priority: 'HIGH',
          itemName: 'Formal 2-Piece Navy Suit',
          quantity: 1,
          unitPrice: 8500,
          advancePaid: 3000,
          deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          notes: 'Wedding reception delivery deadline'
        });

        this.applyHeaderStyles(sheet);
        break;
      }

      case 'measurements': {
        const sheet = workbook.addWorksheet('Measurements Template');
        sheet.columns = [
          { header: 'Customer Phone', key: 'customerPhone' },
          { header: 'Measurement Title', key: 'title' },
          { header: 'Gender', key: 'gender' },
          { header: 'Unit (INCH/CM)', key: 'unit' },
          { header: 'Chest', key: 'chest' },
          { header: 'Waist', key: 'waist' },
          { header: 'Hip', key: 'hip' },
          { header: 'Shoulder', key: 'shoulder' },
          { header: 'Sleeve Length', key: 'sleeveLength' },
          { header: 'Neck', key: 'neck' },
          { header: 'Inseam', key: 'inseam' },
          { header: 'Special Instructions', key: 'notes' }
        ];

        sheet.addRow({
          customerPhone: '9876543210',
          title: 'Formal Shirt & Trouser Fit',
          gender: 'MEN',
          unit: 'INCH',
          chest: 40,
          waist: 34,
          hip: 40,
          shoulder: 18,
          sleeveLength: 25,
          neck: 15.5,
          inseam: 31,
          notes: 'Right shoulder slightly dropped, high collar stand'
        });

        this.applyHeaderStyles(sheet);
        break;
      }

      case 'suppliers': {
        const sheet = workbook.addWorksheet('Suppliers Template');
        sheet.columns = [
          { header: 'Name', key: 'name' },
          { header: 'Company Name', key: 'companyName' },
          { header: 'Phone', key: 'phone' },
          { header: 'Email', key: 'email' },
          { header: 'Address', key: 'address' },
          { header: 'GST Number', key: 'gstNumber' },
          { header: 'Payment Terms', key: 'paymentTerms' }
        ];

        sheet.addRow({
          name: 'Vikas Agarwal',
          companyName: 'Agarwal Textiles & Trims Pvt Ltd',
          phone: '9820011223',
          email: 'sales@agarwaltextiles.com',
          address: 'Textile Market, Surat, Gujarat',
          gstNumber: '24AAAAA9999A1Z1',
          paymentTerms: 'Net 30'
        });

        this.applyHeaderStyles(sheet);
        break;
      }

      default:
        throw new Error(`Unsupported template type: ${type}`);
    }

    return workbook;
  }

  // ==========================================
  // 3. ERROR WORKBOOK GENERATOR
  // ==========================================
  static generateErrorWorkbook(errors: ValidationErrorItem[]): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'THTWAAT Validation Engine';
    const sheet = workbook.addWorksheet('Import Errors');

    sheet.columns = [
      { header: 'Row Number', key: 'rowNumber' },
      { header: 'SKU / Identifier', key: 'sku' },
      { header: 'Field', key: 'field' },
      { header: 'Error Description', key: 'error' },
      { header: 'Suggested Fix', key: 'suggestedFix' }
    ];

    errors.forEach((err) => {
      sheet.addRow({
        rowNumber: err.rowNumber,
        sku: err.sku || 'N/A',
        field: err.field,
        error: err.error,
        suggestedFix: err.suggestedFix
      });
    });

    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE11D48' } // Crimson Red for error sheet
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    sheet.columns.forEach((col) => {
      let maxLen = 14;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const str = cell.value ? cell.value.toString() : '';
        if (str.length > maxLen) maxLen = Math.min(str.length + 3, 60);
      });
      col.width = maxLen;
    });

    return workbook;
  }

  // ==========================================
  // 4. BULK VALIDATION ENGINE
  // ==========================================
  static async validateProducts(companyId: string, rows: any[]): Promise<ValidationResult> {
    const validRows: any[] = [];
    const errors: ValidationErrorItem[] = [];
    const seenSKUs = new Set<string>();

    // Fetch existing style numbers in DB for this company
    const existingStyles = await prisma.productStyle.findMany({
      where: { companyId },
      select: { styleNumber: true }
    });
    const existingSKUSet = new Set(existingStyles.map((s) => s.styleNumber.toLowerCase()));

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 accounting for 1-based index and header row
      const sku = (row['SKU'] || row['sku'] || row['Style Number'] || row['styleNumber'] || '').toString().trim();
      const styleNumber = (row['Style Number'] || row['styleNumber'] || sku).toString().trim();
      const name = (row['Product Name'] || row['productName'] || row['Name'] || row['name'] || '').toString().trim();
      const category = (row['Category'] || row['category'] || 'General').toString().trim();
      const sellingPrice = parseFloat(row['Selling Price'] || row['sellingPrice'] || '0');
      const cost = parseFloat(row['Cost'] || row['cost'] || row['estimatedCost'] || '0');
      const openingStock = parseFloat(row['Opening Stock'] || row['openingStock'] || '0');
      const gender = (row['Gender'] || row['gender'] || 'MEN').toString().toUpperCase().trim();

      let rowHasError = false;

      if (!name) {
        errors.push({
          rowNumber,
          sku: sku || 'EMPTY',
          field: 'Product Name',
          error: 'Product Name is mandatory and cannot be empty.',
          suggestedFix: 'Enter a valid product name (e.g. Classic Cotton Shirt).'
        });
        rowHasError = true;
      }

      if (!sku && !styleNumber) {
        errors.push({
          rowNumber,
          sku: 'EMPTY',
          field: 'SKU / Style Number',
          error: 'SKU or Style Number is required to uniquely identify the product.',
          suggestedFix: 'Provide a unique SKU code (e.g. SHIRT-001).'
        });
        rowHasError = true;
      } else {
        const checkSku = (sku || styleNumber).toLowerCase();
        if (seenSKUs.has(checkSku)) {
          errors.push({
            rowNumber,
            sku,
            field: 'SKU',
            error: `Duplicate SKU "${sku}" found within the upload file.`,
            suggestedFix: 'Ensure every row in the file has a unique SKU.'
          });
          rowHasError = true;
        } else {
          seenSKUs.add(checkSku);
        }
      }

      if (isNaN(sellingPrice) || sellingPrice < 0) {
        errors.push({
          rowNumber,
          sku,
          field: 'Selling Price',
          error: `Invalid selling price: "${row['Selling Price']}". Must be a non-negative number.`,
          suggestedFix: 'Enter a valid positive number like 1499.00.'
        });
        rowHasError = true;
      }

      if (isNaN(cost) || cost < 0) {
        errors.push({
          rowNumber,
          sku,
          field: 'Cost',
          error: `Invalid cost price: "${row['Cost']}". Must be a non-negative number.`,
          suggestedFix: 'Enter a valid positive number like 650.00.'
        });
        rowHasError = true;
      }

      if (['MEN', 'WOMEN', 'KIDS', 'UNISEX'].indexOf(gender) === -1) {
        errors.push({
          rowNumber,
          sku,
          field: 'Gender',
          error: `Invalid gender: "${gender}". Must be MEN, WOMEN, KIDS, or UNISEX.`,
          suggestedFix: 'Choose one of MEN, WOMEN, KIDS, or UNISEX.'
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        let sizeRange = ['Standard'];
        let colorRange = ['Standard'];
        if (row['Size'] || row['size']) {
          sizeRange = (row['Size'] || row['size']).toString().split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        if (row['Color'] || row['color']) {
          colorRange = (row['Color'] || row['color']).toString().split(',').map((c: string) => c.trim()).filter(Boolean);
        }

        validRows.push({
          styleNumber: styleNumber || sku,
          name,
          category,
          description: row['Description'] || row['description'] || null,
          brand: row['Brand'] || row['brand'] || null,
          gender,
          fabricDetails: row['Fabric'] || row['fabric'] || row['fabricDetails'] || null,
          sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
          estimatedCost: isNaN(cost) ? 0 : cost,
          standardProdMinutes: parseInt(row['Standard Time'] || row['standardProdMinutes'] || '60', 10) || 60,
          sizeRangeJson: JSON.stringify(sizeRange),
          colorRangeJson: JSON.stringify(colorRange),
          openingStock: isNaN(openingStock) ? 0 : openingStock,
          isUpdate: existingSKUSet.has((styleNumber || sku).toLowerCase())
        });
      }
    });

    return {
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      validRows,
      errors
    };
  }

  static async validateCustomers(companyId: string, rows: any[]): Promise<ValidationResult> {
    const validRows: any[] = [];
    const errors: ValidationErrorItem[] = [];
    const seenPhones = new Set<string>();

    const existingCustomers = await prisma.customer.findMany({
      where: { companyId },
      select: { phone: true, email: true }
    });
    const existingPhones = new Set(existingCustomers.map((c) => c.phone.replace(/[^0-9]/g, '')));

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = (row['Name'] || row['name'] || '').toString().trim();
      const phoneRaw = (row['Phone'] || row['phone'] || '').toString().trim();
      const cleanPhone = phoneRaw.replace(/[^0-9]/g, '');
      const email = (row['Email'] || row['email'] || '').toString().trim();
      const customerType = (row['Customer Type'] || row['customerType'] || 'INDIVIDUAL').toString().toUpperCase().trim();

      let rowHasError = false;

      if (!name) {
        errors.push({
          rowNumber,
          sku: cleanPhone || 'N/A',
          field: 'Name',
          error: 'Customer name is required.',
          suggestedFix: 'Enter customer first and last name.'
        });
        rowHasError = true;
      }

      if (!cleanPhone || cleanPhone.length < 10) {
        errors.push({
          rowNumber,
          sku: phoneRaw,
          field: 'Phone',
          error: `Invalid phone number: "${phoneRaw}". Must be at least 10 digits.`,
          suggestedFix: 'Enter a 10-digit mobile number without letters or special characters.'
        });
        rowHasError = true;
      } else {
        if (seenPhones.has(cleanPhone)) {
          errors.push({
            rowNumber,
            sku: cleanPhone,
            field: 'Phone',
            error: `Duplicate phone number "${cleanPhone}" found in the upload file.`,
            suggestedFix: 'Ensure each customer in the file has a unique phone number.'
          });
          rowHasError = true;
        } else {
          seenPhones.add(cleanPhone);
        }
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({
          rowNumber,
          sku: cleanPhone,
          field: 'Email',
          error: `Invalid email format: "${email}".`,
          suggestedFix: 'Provide a valid email address (e.g. user@domain.com) or leave blank.'
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        validRows.push({
          name,
          businessName: row['Business Name'] || row['businessName'] || null,
          phone: cleanPhone,
          whatsapp: (row['WhatsApp'] || row['whatsapp'] || cleanPhone).toString().replace(/[^0-9]/g, ''),
          email: email || null,
          address: row['Address'] || row['address'] || null,
          gstNumber: row['GST Number'] || row['gstNumber'] || null,
          customerType: ['INDIVIDUAL', 'TAILOR_CUSTOMER', 'BOUTIQUE', 'BRAND', 'WHOLESALE'].includes(customerType)
            ? customerType
            : 'INDIVIDUAL',
          notes: row['Notes'] || row['notes'] || null,
          isDuplicateInDb: existingPhones.has(cleanPhone)
        });
      }
    });

    return {
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      validRows,
      errors
    };
  }

  static async validateInventory(companyId: string, rows: any[]): Promise<ValidationResult> {
    const validRows: any[] = [];
    const errors: ValidationErrorItem[] = [];
    const seenSKUs = new Set<string>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const material = (row['Material'] || row['material'] || row['Name'] || row['name'] || '').toString().trim();
      const sku = (row['SKU'] || row['sku'] || '').toString().trim();
      const category = (row['Category'] || row['category'] || 'FABRIC').toString().toUpperCase().trim();
      const unit = (row['Unit'] || row['unit'] || 'meter').toString().trim();
      const openingQty = parseFloat(row['Opening Quantity'] || row['openingQuantity'] || row['Quantity'] || '0');
      const minStock = parseFloat(row['Minimum Stock'] || row['minimumStock'] || '10');
      const cost = parseFloat(row['Cost'] || row['cost'] || row['unitCost'] || '0');

      let rowHasError = false;

      if (!material) {
        errors.push({
          rowNumber,
          sku: sku || 'EMPTY',
          field: 'Material Name',
          error: 'Material/Item name is required.',
          suggestedFix: 'Provide an item name (e.g. Cotton Fabric 60s, Pearl Buttons).'
        });
        rowHasError = true;
      }

      if (sku) {
        const skuKey = sku.toLowerCase();
        if (seenSKUs.has(skuKey)) {
          errors.push({
            rowNumber,
            sku,
            field: 'SKU',
            error: `Duplicate inventory SKU "${sku}" in upload file.`,
            suggestedFix: 'Ensure every inventory item has a unique SKU.'
          });
          rowHasError = true;
        } else {
          seenSKUs.add(skuKey);
        }
      }

      if (isNaN(openingQty) || openingQty < 0) {
        errors.push({
          rowNumber,
          sku,
          field: 'Opening Quantity',
          error: `Invalid opening quantity: "${row['Opening Quantity']}". Must be a non-negative number.`,
          suggestedFix: 'Enter a valid quantity (e.g. 50).'
        });
        rowHasError = true;
      }

      if (isNaN(cost) || cost < 0) {
        errors.push({
          rowNumber,
          sku,
          field: 'Cost',
          error: `Invalid unit cost: "${row['Cost']}". Must be a non-negative number.`,
          suggestedFix: 'Enter a valid unit price (e.g. 150.00).'
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        validRows.push({
          name: material,
          sku: sku || null,
          category: ['FABRIC', 'BUTTON', 'ZIPPER', 'THREAD', 'LINING', 'LABEL', 'PACKING_MATERIAL', 'ACCESSORY'].includes(category)
            ? category
            : 'FABRIC',
          unit,
          currentStock: isNaN(openingQty) ? 0 : openingQty,
          minStockAlert: isNaN(minStock) ? 10 : minStock,
          unitCost: isNaN(cost) ? 0 : cost,
          location: row['Location'] || row['location'] || row['Warehouse'] || null
        });
      }
    });

    return {
      total: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      validRows,
      errors
    };
  }

  // ==========================================
  // 5. TRANSACTIONAL BULK COMMITS
  // ==========================================
  static async commitProducts(companyId: string, validRows: any[]) {
    return await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      for (const row of validRows) {
        const existing = await tx.productStyle.findFirst({
          where: { companyId, styleNumber: row.styleNumber }
        });

        if (existing) {
          await tx.productStyle.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              category: row.category,
              description: row.description,
              brand: row.brand,
              gender: row.gender,
              fabricDetails: row.fabricDetails,
              sellingPrice: row.sellingPrice,
              estimatedCost: row.estimatedCost,
              standardProdMinutes: row.standardProdMinutes,
              sizeRangeJson: row.sizeRangeJson,
              colorRangeJson: row.colorRangeJson
            }
          });
          updated++;
        } else {
          await tx.productStyle.create({
            data: {
              companyId,
              styleNumber: row.styleNumber,
              name: row.name,
              category: row.category,
              description: row.description,
              brand: row.brand,
              gender: row.gender,
              fabricDetails: row.fabricDetails,
              sellingPrice: row.sellingPrice,
              estimatedCost: row.estimatedCost,
              standardProdMinutes: row.standardProdMinutes,
              sizeRangeJson: row.sizeRangeJson,
              colorRangeJson: row.colorRangeJson
            }
          });
          created++;
        }
      }

      return { total: validRows.length, created, updated };
    });
  }

  static async commitCustomers(companyId: string, validRows: any[], updateDuplicates = true) {
    return await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      for (const row of validRows) {
        const existing = await tx.customer.findFirst({
          where: { companyId, phone: row.phone }
        });

        if (existing) {
          if (updateDuplicates) {
            await tx.customer.update({
              where: { id: existing.id },
              data: {
                name: row.name,
                businessName: row.businessName,
                whatsapp: row.whatsapp,
                email: row.email,
                address: row.address,
                gstNumber: row.gstNumber,
                customerType: row.customerType,
                notes: row.notes
              }
            });
            updated++;
          }
        } else {
          await tx.customer.create({
            data: {
              companyId,
              name: row.name,
              businessName: row.businessName,
              phone: row.phone,
              whatsapp: row.whatsapp,
              email: row.email,
              address: row.address,
              gstNumber: row.gstNumber,
              customerType: row.customerType,
              notes: row.notes
            }
          });
          created++;
        }
      }

      return { total: validRows.length, created, updated };
    });
  }

  static async commitInventory(companyId: string, validRows: any[], branchId?: string, userId?: string) {
    return await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let stockMovementsCreated = 0;

      for (const row of validRows) {
        let item = null;
        if (row.sku) {
          item = await tx.inventoryItem.findFirst({
            where: { companyId, sku: row.sku }
          });
        }

        if (item) {
          // Adjust stock via movement
          const diff = row.currentStock - item.currentStock;
          const updatedItem = await tx.inventoryItem.update({
            where: { id: item.id },
            data: {
              name: row.name,
              category: row.category,
              unit: row.unit,
              currentStock: row.currentStock,
              minStockAlert: row.minStockAlert,
              unitCost: row.unitCost,
              location: row.location
            }
          });

          if (diff !== 0) {
            await tx.stockMovement.create({
              data: {
                companyId,
                branchId: branchId || undefined,
                inventoryItemId: updatedItem.id,
                movementType: diff > 0 ? 'ADJUSTMENT' : 'DAMAGE_WASTAGE',
                quantity: Math.abs(diff),
                unitCost: row.unitCost,
                referenceType: 'EXCEL_BULK_IMPORT',
                notes: `Bulk Excel adjustment: previous stock ${item.currentStock}, new stock ${row.currentStock}`,
                performedById: userId || undefined
              }
            });
            stockMovementsCreated++;
          }
          updated++;
        } else {
          // Create new item and initial stock movement
          const newItem = await tx.inventoryItem.create({
            data: {
              companyId,
              branchId: branchId || undefined,
              name: row.name,
              sku: row.sku,
              category: row.category,
              unit: row.unit,
              currentStock: row.currentStock,
              minStockAlert: row.minStockAlert,
              unitCost: row.unitCost,
              location: row.location
            }
          });

          if (row.currentStock > 0) {
            await tx.stockMovement.create({
              data: {
                companyId,
                branchId: branchId || undefined,
                inventoryItemId: newItem.id,
                movementType: 'PURCHASE_IN',
                quantity: row.currentStock,
                unitCost: row.unitCost,
                referenceType: 'EXCEL_BULK_IMPORT',
                notes: 'Opening stock from bulk Excel import',
                performedById: userId || undefined
              }
            });
            stockMovementsCreated++;
          }
          created++;
        }
      }

      return { total: validRows.length, created, updated, stockMovementsCreated };
    });
  }
}
