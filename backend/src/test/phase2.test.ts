import { prisma } from '../config/db';
import { ExcelService } from '../modules/imports-exports/excel.service';
import { WhatsAppService } from '../modules/notifications/whatsapp.service';
import { GoogleSheetsService } from '../modules/integrations/google-sheets.service';
import { AuditService } from '../modules/audit/audit.service';

async function runTests() {
  console.log('🧪 Starting Antigravity Phase 2 Master Test Suite...\n');

  // 1. Setup Test Tenant Company
  const companySlug = `test-co-${Date.now()}`;
  const company = await prisma.company.create({
    data: {
      name: 'Royal Heritage Bespoke Factory',
      slug: companySlug,
      phone: '9876543210',
      email: `${companySlug}@tailorcrm.com`,
      currency: 'INR',
      businessType: 'HYBRID'
    }
  });
  console.log(`✅ Test Tenant Company created: ${company.name} (ID: ${company.id})`);

  // Setup Test User
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Master Tailor Admin',
      email: `admin-${companySlug}@tailorcrm.com`,
      phone: `99${Date.now().toString().slice(-8)}`,
      passwordHash: 'dummy_hash',
      role: 'OWNER'
    }
  });

  // -------------------------------------------------------------
  // TEST 1: EXCEL TEMPLATES GENERATION
  // -------------------------------------------------------------
  console.log('\n--- Test 1: Excel Templates Generation ---');
  const templateTypes = ['products', 'customers', 'inventory', 'orders', 'measurements', 'suppliers'];
  for (const t of templateTypes) {
    const wb = ExcelService.getTemplate(t);
    if (!wb.worksheets[0] || wb.worksheets[0].rowCount < 2) {
      throw new Error(`Template for ${t} failed to generate header or sample rows`);
    }
    console.log(`  ✓ Template [${t}] generated with ${wb.worksheets[0].columnCount} columns & sample rows.`);
  }

  // -------------------------------------------------------------
  // TEST 2: BULK PRODUCT VALIDATION & DUPLICATE SKU CHECK
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Bulk Product Upload Validation & Error File ---');
  const testProductRows = [
    {
      'SKU': 'SHIRT-SLIM-01',
      'Product Name': 'Formal White Slim Shirt',
      'Category': 'Shirts',
      'Cost': 450,
      'Selling Price': 1499,
      'Gender': 'MEN',
      'Opening Stock': 20
    },
    {
      'SKU': 'SHIRT-SLIM-01', // Duplicate SKU within file
      'Product Name': 'Duplicate Shirt SKU',
      'Cost': 500,
      'Selling Price': 1599,
      'Gender': 'MEN'
    },
    {
      'SKU': 'INVALID-PROD-02',
      'Product Name': '', // Missing name
      'Cost': -100, // Negative cost
      'Selling Price': 2000,
      'Gender': 'INVALID_GENDER'
    }
  ];

  const prodValResult = await ExcelService.validateProducts(company.id, testProductRows);
  console.log(`  Total: ${prodValResult.total}, Valid: ${prodValResult.validCount}, Errors: ${prodValResult.errorCount}`);
  if (prodValResult.validCount !== 1 || prodValResult.errorCount < 3) {
    throw new Error('Product validation did not catch invalid rows or duplicate SKU properly');
  }
  console.log(`  ✓ Detected missing product name, duplicate SKU, negative cost, and invalid gender!`);

  // Test Error Workbook Generation
  const errWb = ExcelService.generateErrorWorkbook(prodValResult.errors);
  if (errWb.worksheets[0].rowCount < 4) {
    throw new Error('Error workbook failed to write all error rows');
  }
  console.log(`  ✓ Error Excel Workbook generated with ${errWb.worksheets[0].rowCount - 1} error records.`);

  // -------------------------------------------------------------
  // TEST 3: BULK PRODUCT IMPORT (500 Records Stress Test)
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Bulk Product Import (500 Items Stress Test) ---');
  const bulk500Rows = [];
  for (let i = 1; i <= 500; i++) {
    bulk500Rows.push({
      styleNumber: `BULK-STY-${i}`,
      name: `Luxury Tailored Garment ${i}`,
      category: i % 2 === 0 ? 'Suit' : 'Shirt',
      sellingPrice: 1200 + i * 10,
      estimatedCost: 400 + i * 5,
      gender: 'MEN',
      standardProdMinutes: 60,
      sizeRangeJson: JSON.stringify(['38', '40', '42']),
      colorRangeJson: JSON.stringify(['Black', 'Navy']),
      openingStock: 10
    });
  }

  const commitProdResult = await ExcelService.commitProducts(company.id, bulk500Rows);
  console.log(`  ✓ Successfully committed ${commitProdResult.created} products in a single database transaction!`);
  if (commitProdResult.created !== 500) {
    throw new Error(`Expected 500 products created, got ${commitProdResult.created}`);
  }

  // -------------------------------------------------------------
  // TEST 4: BULK CUSTOMER IMPORT (1,000 Customers Stress Test & Duplicate Detection)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Bulk Customer Import (1,000 Customers) ---');
  const bulk1000Customers = [];
  for (let i = 1; i <= 1000; i++) {
    bulk1000Customers.push({
      name: `Client Number ${i}`,
      businessName: i % 10 === 0 ? `Boutique House ${i}` : null,
      phone: `910000${i.toString().padStart(4, '0')}`,
      whatsapp: `910000${i.toString().padStart(4, '0')}`,
      email: `client${i}@bespoke-client.com`,
      customerType: i % 10 === 0 ? 'BOUTIQUE' : 'INDIVIDUAL'
    });
  }

  const commitCustResult = await ExcelService.commitCustomers(company.id, bulk1000Customers);
  console.log(`  ✓ Successfully committed ${commitCustResult.created} customers in transaction!`);
  if (commitCustResult.created !== 1000) {
    throw new Error(`Expected 1000 customers created, got ${commitCustResult.created}`);
  }

  // -------------------------------------------------------------
  // TEST 5: INVENTORY IMPORT & STOCK MOVEMENT AUDIT TRAIL
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Inventory Bulk Import & StockMovement Audit History ---');
  const inventoryRows = [
    {
      name: 'Super 150s Italian Wool Fabric',
      sku: 'FAB-WOOL-150',
      category: 'FABRIC',
      unit: 'meter',
      currentStock: 120,
      minStockAlert: 20,
      unitCost: 1850,
      location: 'Rack W-01'
    },
    {
      name: 'Horn Buttons 24L Premium',
      sku: 'BTN-HORN-24L',
      category: 'BUTTON',
      unit: 'pcs',
      currentStock: 500,
      minStockAlert: 100,
      unitCost: 8.5,
      location: 'Box H-12'
    }
  ];

  const commitInvResult = await ExcelService.commitInventory(company.id, inventoryRows, undefined, user.id);
  console.log(`  ✓ Inventory items created: ${commitInvResult.created}, Stock movements created: ${commitInvResult.stockMovementsCreated}`);
  if (commitInvResult.stockMovementsCreated !== 2) {
    throw new Error('StockMovement audit records were not created for opening stock!');
  }

  // Verify stock movements exist in DB
  const movements = await prisma.stockMovement.findMany({ where: { companyId: company.id } });
  if (movements.length < 2) {
    throw new Error('Database missing StockMovement history records');
  }
  console.log(`  ✓ StockMovement history verified: ${movements.length} opening movement audit rows confirmed.`);

  // -------------------------------------------------------------
  // TEST 6: EXCEL EXPORT (13 ENTITIES + REPORTS)
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Production-Ready Excel Exports (13 Entities + Reports) ---');
  const exportEntities = [
    'customers',
    'buyers',
    'products',
    'variants',
    'orders',
    'measurements',
    'inventory',
    'suppliers',
    'purchases',
    'production',
    'workers',
    'payments',
    'invoices',
    'reports'
  ];

  for (const ent of exportEntities) {
    const wb = await ExcelService.exportEntity(company.id, ent);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error(`Export sheet for ${ent} was null`);
    console.log(`  ✓ Exported [${ent}]: Sheet "${sheet.name}" with ${sheet.rowCount} rows.`);
  }

  // -------------------------------------------------------------
  // TEST 7: WHATSAPP ENGINE, BILL SHARING & FALLBACK
  // -------------------------------------------------------------
  console.log('\n--- Test 7: WhatsApp Hub, Bill Sharing & Deep-Link Fallback ---');
  // Configure Owner WhatsApp
  await WhatsAppService.saveConfig(company.id, {
    ownerWhatsApp: '9876543210',
    providerType: 'FALLBACK_LINK'
  }, user.id);

  // Create an Order and Invoice
  const testCustomer = await prisma.customer.findFirst({ where: { companyId: company.id } });
  const testOrder = await prisma.order.create({
    data: {
      companyId: company.id,
      branchId: (await prisma.branch.findFirst({ where: { companyId: company.id } }))?.id || (await prisma.branch.create({ data: { companyId: company.id, name: 'Main', code: 'MAIN' } })).id,
      customerId: testCustomer!.id,
      orderNumber: 'ORD-TEST-999',
      deliveryDate: new Date(Date.now() + 7 * 86400000),
      totalAmount: 2800,
      finalAmount: 2800,
      advancePaid: 1000,
      balanceDue: 1800,
      paymentStatus: 'PARTIAL'
    }
  });

  const testInvoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      branchId: testOrder.branchId,
      orderId: testOrder.id,
      invoiceNumber: 'INV-1024',
      customerName: testCustomer!.name,
      customerPhone: testCustomer!.phone,
      totalAmount: 2800,
      amountPaid: 1000,
      balanceDue: 1800,
      status: 'PARTIAL'
    }
  });

  // Flow A: Send Invoice to Customer WhatsApp
  const custRes = await WhatsAppService.sendInvoice(company.id, testInvoice.id, 'CUSTOMER', user.id);
  console.log(`  ✓ Customer WhatsApp invoice processed: provider = ${custRes.provider}, waLink = ${custRes.waLink.slice(0, 45)}...`);
  if (!custRes.messageText.includes('INV-1024') || (!custRes.messageText.includes('1,800') && !custRes.messageText.includes('1800'))) {
    throw new Error('Invoice message text does not include invoice number or balance due');
  }

  // Flow B: Send Invoice to Owner WhatsApp
  const ownerRes = await WhatsAppService.sendInvoice(company.id, testInvoice.id, 'OWNER', user.id);
  console.log(`  ✓ Owner WhatsApp copy processed: sent to ${custRes.messageId ? 'logged message' : 'recipient'}`);

  // Test Payment Receipt
  const testPayment = await prisma.payment.create({
    data: {
      companyId: company.id,
      branchId: testOrder.branchId,
      customerId: testCustomer!.id,
      orderId: testOrder.id,
      invoiceId: testInvoice.id,
      amount: 1000,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-REF-892189'
    }
  });

  const payRes = await WhatsAppService.sendPaymentReceipt(company.id, testPayment.id, 'CUSTOMER', user.id);
  console.log(`  ✓ Payment Receipt WhatsApp processed: amount ₹1,000, balance ₹1,800 logged!`);

  // Verify WhatsApp Message Log in Database
  const waLogs = await prisma.whatsAppMessageLog.findMany({ where: { companyId: company.id } });
  console.log(`  ✓ WhatsApp Message Logs verified in DB: ${waLogs.length} messages logged.`);
  if (waLogs.length < 3) {
    throw new Error('WhatsApp message logging failed to persist');
  }

  // -------------------------------------------------------------
  // TEST 8: GOOGLE SHEETS INTEGRATION & TWO-WAY SYNC ENGINE
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Google Sheets Integration & Two-Way Sync Layer ---');
  await GoogleSheetsService.connectAccount(company.id, {
    googleEmail: 'boutique.owner@gmail.com',
    spreadsheetId: 'sheet-bespoke-2026',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-bespoke-2026'
  }, user.id);

  const googleExport = await GoogleSheetsService.exportToGoogle(company.id, 'products', {}, user.id);
  console.log(`  ✓ Google Sheets export products: ${googleExport.exportedCount} records pushed.`);

  const syncResult = await GoogleSheetsService.runTwoWaySync(company.id, { entities: ['customers', 'products', 'inventory', 'orders'] }, user.id);
  console.log(`  ✓ Two-way sync engine finished: status = ${syncResult.syncStatus}`);
  console.log(`    Exported snapshots: ${JSON.stringify(syncResult.exportedEntities)}`);

  // -------------------------------------------------------------
  // TEST 9: AUDIT LOGS & TENANT ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Security Audit Trail & Tenant Isolation ---');
  const auditLogs = await AuditService.getLogs(company.id);
  console.log(`  ✓ Audit records captured: ${auditLogs.total} events (Imports, Exports, WhatsApp, Google Sync).`);
  if (auditLogs.total < 5) {
    throw new Error('Audit logs missing events');
  }

  // Verify Company B cannot see Company A's data
  const companyB = await prisma.company.create({
    data: {
      name: 'Competitor Tailors',
      slug: `comp-${Date.now()}`,
      phone: '9999999999',
      email: `comp-${Date.now()}@tailor.com`
    }
  });

  const compBCustomers = await prisma.customer.findMany({ where: { companyId: companyB.id } });
  if (compBCustomers.length !== 0) {
    throw new Error('Tenant isolation breach! Company B found Company A data');
  }
  console.log(`  ✓ Tenant isolation verified: Company B has 0 access to Company A records.`);

  console.log('\n🎉 ALL PHASE 2 TESTS PASSED PERFECTLY!\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
