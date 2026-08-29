import { prisma } from '../config/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting database seeding for Tailor CRM...');

  // Clean old data if any
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.pieceRateLog.deleteMany();
  await prisma.qCRecord.deleteMany();
  await prisma.productionLog.deleteMany();
  await prisma.productionJobCard.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.bOMItem.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.productStyle.deleteMany();
  await prisma.customerMeasurement.deleteMany();
  await prisma.measurementTemplate.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();

  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      name: 'Royal Stitch Boutique & Garment Co.',
      slug: 'royal-stitch-boutique',
      phone: '9876543210',
      email: 'admin@royalstitch.com',
      address: 'Shop 104, Fashion Avenue, Bandra West, Mumbai, MH',
      gstNumber: '27AABCT1234F1Z5',
      currency: 'INR',
      businessType: 'HYBRID'
    }
  });

  // 2. Create Branches
  const mainBranch = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: 'Main Boutique & Showroom',
      code: 'B-01',
      phone: '9876543210',
      address: 'Bandra West, Mumbai',
      isMain: true
    }
  });

  const factoryBranch = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: 'Central Cutting & Stitching Unit',
      code: 'F-01',
      phone: '9876543211',
      address: 'MIDC Industrial Area, Andheri East, Mumbai',
      isMain: false
    }
  });

  // 3. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      branchId: mainBranch.id,
      name: 'Aamen Ansari (Master Tailor & Owner)',
      email: 'owner@royalstitch.com',
      phone: '9876543210',
      passwordHash,
      role: 'OWNER'
    }
  });

  const prodManager = await prisma.user.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      name: 'Vikram Singh (Factory Incharge)',
      email: 'production@royalstitch.com',
      phone: '9876543212',
      passwordHash,
      role: 'PRODUCTION_MANAGER'
    }
  });

  // 4. Create Workers (Artisans & Cutters)
  const masterCutter = await prisma.worker.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      name: 'Master Rashid Khan',
      phone: '9811223344',
      role: 'CUTTER',
      wageType: 'PIECE_RATE',
      defaultPieceRate: 40
    }
  });

  const tailorImran = await prisma.worker.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      name: 'Imran Sheikh (Suit Specialist)',
      phone: '9822334455',
      role: 'TAILOR',
      wageType: 'PIECE_RATE',
      defaultPieceRate: 250
    }
  });

  const tailorSunita = await prisma.worker.create({
    data: {
      companyId: company.id,
      branchId: mainBranch.id,
      name: 'Sunita Sharma (Blouse & Kurti Master)',
      phone: '9833445566',
      role: 'TAILOR',
      wageType: 'PIECE_RATE',
      defaultPieceRate: 150
    }
  });

  // 5. Create Measurement Templates
  const shirtTemplate = await prisma.measurementTemplate.create({
    data: {
      companyId: company.id,
      name: "Men's Formal Shirt",
      gender: 'MEN',
      category: 'Tops',
      fieldsJson: JSON.stringify([
        { key: 'chest', label: 'Chest', placeholder: '40', unit: 'inch' },
        { key: 'waist', label: 'Waist', placeholder: '36', unit: 'inch' },
        { key: 'shoulder', label: 'Shoulder', placeholder: '18', unit: 'inch' },
        { key: 'sleeve', label: 'Sleeve Length', placeholder: '25', unit: 'inch' },
        { key: 'collar', label: 'Collar / Neck', placeholder: '16', unit: 'inch' },
        { key: 'length', label: 'Shirt Length', placeholder: '29', unit: 'inch' },
        { key: 'cuff', label: 'Cuff Size', placeholder: '9.5', unit: 'inch' }
      ]),
      isDefault: true
    }
  });

  const pantTemplate = await prisma.measurementTemplate.create({
    data: {
      companyId: company.id,
      name: "Men's Trousers",
      gender: 'MEN',
      category: 'Bottoms',
      fieldsJson: JSON.stringify([
        { key: 'waist', label: 'Waist', placeholder: '34', unit: 'inch' },
        { key: 'hip', label: 'Seat / Hip', placeholder: '40', unit: 'inch' },
        { key: 'length', label: 'Outseam Length', placeholder: '41', unit: 'inch' },
        { key: 'inseam', label: 'Inseam', placeholder: '31', unit: 'inch' },
        { key: 'thigh', label: 'Thigh', placeholder: '24', unit: 'inch' },
        { key: 'bottom', label: 'Bottom Opening', placeholder: '14', unit: 'inch' }
      ]),
      isDefault: true
    }
  });

  const kurtiTemplate = await prisma.measurementTemplate.create({
    data: {
      companyId: company.id,
      name: "Women's Designer Kurti",
      gender: 'WOMEN',
      category: 'Ethnic',
      fieldsJson: JSON.stringify([
        { key: 'bust', label: 'Bust', placeholder: '36', unit: 'inch' },
        { key: 'waist', label: 'Waist', placeholder: '30', unit: 'inch' },
        { key: 'hip', label: 'Hip', placeholder: '38', unit: 'inch' },
        { key: 'shoulder', label: 'Shoulder', placeholder: '14.5', unit: 'inch' },
        { key: 'sleeve_length', label: 'Sleeve Length', placeholder: '16', unit: 'inch' },
        { key: 'kurti_length', label: 'Full Length', placeholder: '42', unit: 'inch' }
      ]),
      isDefault: true
    }
  });

  // 6. Create Customers
  const custRahul = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Rahul Khanna',
      businessName: 'Khanna Exports',
      phone: '9820011223',
      whatsapp: '9820011223',
      email: 'rahul.khanna@gmail.com',
      address: 'Flat 402, Sea View Apartments, Worli, Mumbai',
      customerType: 'INDIVIDUAL',
      notes: 'Prefers Italian slim fit cuts and mother of pearl buttons',
      tags: JSON.stringify(['VIP', 'Wedding', 'Regular'])
    }
  });

  const custPooja = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Pooja Mehta',
      businessName: 'Mehta Couture Boutique',
      phone: '9870099887',
      whatsapp: '9870099887',
      email: 'pooja@mehtaboutique.com',
      address: 'Lokhandwala Complex, Andheri West',
      customerType: 'BOUTIQUE',
      notes: 'Bulk boutique client for ethnic dresses',
      tags: JSON.stringify(['Boutique', 'B2B'])
    }
  });

  // 7. Save Measurements for Rahul
  const rahulShirtMeas = await prisma.customerMeasurement.create({
    data: {
      companyId: company.id,
      customerId: custRahul.id,
      templateId: shirtTemplate.id,
      title: 'Formal Italian Fit Shirt',
      gender: 'MEN',
      unit: 'INCH',
      valuesJson: JSON.stringify({
        chest: 41,
        waist: 35,
        shoulder: 18.5,
        sleeve: 25.5,
        collar: 16.5,
        length: 30,
        cuff: 9.75
      }),
      specialInstructions: 'Double button cuff, french placket',
      version: 1
    }
  });

  // 8. Create Inventory Items
  const invFabricCotton = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      name: 'Egyptian Giza Cotton 60s (Navy Blue)',
      sku: 'FAB-EGY-001',
      category: 'FABRIC',
      unit: 'meter',
      currentStock: 120.5,
      minStockAlert: 30,
      unitCost: 450,
      supplierName: 'Raymond Mills Ltd'
    }
  });

  const invFabricLinen = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      name: 'Pure Irish Linen (Crisp White)',
      sku: 'FAB-LIN-002',
      category: 'FABRIC',
      unit: 'meter',
      currentStock: 8.0, // LOW STOCK TRIGGER
      minStockAlert: 20,
      unitCost: 850,
      supplierName: 'Linen Club'
    }
  });

  const invButtons = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      name: 'Mother of Pearl 18L Shirt Buttons',
      sku: 'TRM-BTN-01',
      category: 'BUTTON',
      unit: 'pcs',
      currentStock: 450,
      minStockAlert: 100,
      unitCost: 4,
      supplierName: 'Apex Trims'
    }
  });

  // 9. Create Product Style with BOM
  const styleShirt = await prisma.productStyle.create({
    data: {
      companyId: company.id,
      styleNumber: 'SH-101',
      name: 'Bespoke Royal Egyptian Cotton Shirt',
      category: 'Shirts',
      description: 'Luxury handcrafted bespoke dress shirt with mother-of-pearl buttons and fused collar.',
      fabricDetails: '100% Egyptian Giza Cotton',
      gender: 'MEN',
      sizeRangeJson: JSON.stringify(['38', '40', '42', '44', 'Custom']),
      colorRangeJson: JSON.stringify(['Navy Blue', 'Crisp White', 'Sky Blue']),
      sellingPrice: 2400,
      estimatedCost: 850,
      standardProdMinutes: 75
    }
  });

  // Add BOM items
  await prisma.bOMItem.createMany({
    data: [
      {
        companyId: company.id,
        productStyleId: styleShirt.id,
        inventoryItemId: invFabricCotton.id,
        materialName: 'Egyptian Giza Cotton',
        quantity: 1.65,
        unit: 'meter',
        wastagePercentage: 5,
        costPerUnit: 450
      },
      {
        companyId: company.id,
        productStyleId: styleShirt.id,
        inventoryItemId: invButtons.id,
        materialName: 'Pearl Buttons',
        quantity: 8,
        unit: 'pcs',
        wastagePercentage: 0,
        costPerUnit: 4
      }
    ]
  });

  // 10. Create Sample Orders
  const today = new Date();
  const deliveryDate = new Date(today);
  deliveryDate.setDate(deliveryDate.getDate() + 5);

  const order1 = await prisma.order.create({
    data: {
      companyId: company.id,
      branchId: mainBranch.id,
      customerId: custRahul.id,
      orderNumber: 'ORD-20260828-1001',
      orderType: 'BESPOKE_TAILORING',
      status: 'IN_STITCHING',
      priority: 'HIGH',
      deliveryDate,
      totalAmount: 4800,
      discount: 300,
      taxRate: 5,
      taxAmount: 225,
      finalAmount: 4725,
      advancePaid: 2500,
      balanceDue: 2225,
      paymentStatus: 'PARTIAL',
      notes: 'Customer requires urgent trial on 30th August.',
      createdById: owner.id
    }
  });

  const orderItem1 = await prisma.orderItem.create({
    data: {
      companyId: company.id,
      orderId: order1.id,
      productStyleId: styleShirt.id,
      measurementId: rahulShirtMeas.id,
      customItemName: 'Egyptian Cotton Bespoke Shirt (Navy Blue)',
      quantity: 2,
      unitPrice: 2400,
      totalAmount: 4800,
      color: 'Navy Blue'
    }
  });

  const jobCard1 = await prisma.productionJobCard.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      orderId: order1.id,
      orderItemId: orderItem1.id,
      jobCardNumber: 'JOB-20260828-1001-1',
      currentStage: 'STITCHING',
      qcStatus: 'PENDING',
      qrCode: JSON.stringify({
        jobCardNumber: 'JOB-20260828-1001-1',
        orderId: order1.id,
        item: 'Egyptian Cotton Bespoke Shirt',
        qty: 2
      }),
      priority: 'HIGH',
      assignedWorkerId: tailorImran.id,
      plannedQuantity: 2
    }
  });

  // Add Production Log for cutting completed
  await prisma.productionLog.create({
    data: {
      companyId: company.id,
      jobCardId: jobCard1.id,
      stage: 'CUTTING',
      workerId: masterCutter.id,
      quantity: 2,
      notes: 'Cut pattern accurately with 1/2 inch seam allowance.'
    }
  });

  // Piece rate log for cutting
  await prisma.pieceRateLog.create({
    data: {
      companyId: company.id,
      branchId: factoryBranch.id,
      workerId: masterCutter.id,
      jobCardId: jobCard1.id,
      stage: 'CUTTING',
      quantity: 2,
      ratePerPiece: 40,
      totalPayout: 80,
      isPaid: false,
      notes: 'Auto-logged from job card JOB-20260828-1001-1'
    }
  });

  // Create Invoice for Order 1
  const invoice1 = await prisma.invoice.create({
    data: {
      companyId: company.id,
      branchId: mainBranch.id,
      orderId: order1.id,
      invoiceNumber: 'INV-20260828-1001',
      customerName: custRahul.name,
      customerPhone: custRahul.phone,
      customerAddress: custRahul.address,
      subtotal: 4800,
      discount: 300,
      taxRate: 5,
      taxAmount: 225,
      totalAmount: 4725,
      amountPaid: 2500,
      balanceDue: 2225,
      dueDate: deliveryDate,
      status: 'PARTIAL'
    }
  });

  // Record Advance Payment
  await prisma.payment.create({
    data: {
      companyId: company.id,
      branchId: mainBranch.id,
      orderId: order1.id,
      invoiceId: invoice1.id,
      customerId: custRahul.id,
      amount: 2500,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI/2026/88990011',
      notes: 'Initial 50% advance deposit via GPay',
      recordedById: owner.id
    }
  });

  console.log('✅ Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('👑 Admin Login: owner@royalstitch.com / password123');
  console.log('🏭 Production Mgr: production@royalstitch.com / password123');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
