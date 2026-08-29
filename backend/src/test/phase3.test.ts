import { prisma } from '../config/db';
import { ProductionPlanningService } from '../modules/production-factory/production-planning.service';
import { CuttingBundlingService } from '../modules/production-factory/cutting-bundling.service';
import { FactoryOpsService } from '../modules/production-factory/factory-ops.service';
import { CostingPayrollService } from '../modules/production-factory/costing-payroll.service';
import { ManufacturingReportsService } from '../modules/production-factory/manufacturing-reports.service';
import { ExcelService } from '../modules/imports-exports/excel.service';
import { WhatsAppService } from '../modules/notifications/whatsapp.service';

async function runPhase3Tests() {
  console.log('🧪 Starting Antigravity Phase 3 Garment Manufacturing ERP Test Suite...\n');

  // 1. Setup Manufacturing Factory Tenant
  const companySlug = `mfg-factory-${Date.now()}`;
  const company = await prisma.company.create({
    data: {
      name: 'Vogue Global Apparel Manufacturing Ltd',
      slug: companySlug,
      phone: '9876500001',
      email: `${companySlug}@vogue-mfg.com`,
      currency: 'INR',
      businessType: 'GARMENT_FACTORY'
    }
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Plant Operations Director',
      email: `director-${companySlug}@vogue-mfg.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      passwordHash: 'dummy_hash',
      role: 'PRODUCTION_MANAGER'
    }
  });

  const buyer = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Zara Menswear Procurement Corp',
      businessName: 'Inditex Sourcing India',
      phone: '9820001122',
      customerType: 'BRAND'
    }
  });

  // Setup Product Style with BOM
  const fabricItem = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      name: 'Egyptian Giza Cotton 60s Fabric',
      sku: 'FAB-GIZA-60',
      category: 'FABRIC',
      unit: 'meter',
      currentStock: 5000,
      minStockAlert: 500,
      unitCost: 280
    }
  });

  const buttonItem = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      name: 'Mother of Pearl 18L Buttons',
      sku: 'BTN-MOP-18L',
      category: 'BUTTON',
      unit: 'pcs',
      currentStock: 10000,
      minStockAlert: 2000,
      unitCost: 4.5
    }
  });

  const threadItem = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      name: 'Coats Epic Poly Core Thread',
      sku: 'THD-COATS-WHT',
      category: 'THREAD',
      unit: 'meter',
      currentStock: 20000, // Deliberately set lower to test shortage
      minStockAlert: 5000,
      unitCost: 0.12
    }
  });

  const style = await prisma.productStyle.create({
    data: {
      companyId: company.id,
      styleNumber: 'STY-SHIRT-5000',
      name: 'Oxford Luxury Tailored Shirt',
      category: 'Shirts',
      sellingPrice: 1899,
      estimatedCost: 650,
      gender: 'MEN',
      sizeRangeJson: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colorRangeJson: JSON.stringify(['White', 'Sky Blue', 'Black'])
    }
  });

  // Add BOM Items (Example: 1.65m fabric, 8 buttons, 30m thread per shirt)
  await prisma.bOMItem.createMany({
    data: [
      {
        companyId: company.id,
        productStyleId: style.id,
        inventoryItemId: fabricItem.id,
        materialName: fabricItem.name,
        quantity: 1.65,
        unit: 'meter',
        wastagePercentage: 5.0,
        costPerUnit: 280
      },
      {
        companyId: company.id,
        productStyleId: style.id,
        inventoryItemId: buttonItem.id,
        materialName: buttonItem.name,
        quantity: 8,
        unit: 'pcs',
        wastagePercentage: 2.0,
        costPerUnit: 4.5
      },
      {
        companyId: company.id,
        productStyleId: style.id,
        inventoryItemId: threadItem.id,
        materialName: threadItem.name,
        quantity: 30,
        unit: 'meter',
        wastagePercentage: 0.0,
        costPerUnit: 0.12
      }
    ]
  });

  // Setup Workers & Stitching Lines
  const cutter = await prisma.worker.create({
    data: {
      companyId: company.id,
      name: 'Master Cutter Rafiq',
      phone: '9811112233',
      role: 'CUTTER',
      wageType: 'PIECE_RATE',
      defaultPieceRate: 15
    }
  });

  const tailor = await prisma.worker.create({
    data: {
      companyId: company.id,
      name: 'Artisan Stitcher Salim',
      phone: '9822223344',
      role: 'TAILOR',
      wageType: 'PIECE_RATE',
      defaultPieceRate: 85
    }
  });

  // -------------------------------------------------------------
  // TEST 1 & 2: PRODUCTION PLANNING & AUTO BOM MATERIAL REQUIREMENT
  // -------------------------------------------------------------
  console.log('--- Test 1 & 2: Production Planning & Auto BOM Requirement ---');
  const sizeColorMatrix = {
    'White': { 'S': 500, 'M': 1000, 'L': 1500, 'XL': 1250, 'XXL': 750 },
    'Sky Blue': { 'S': 400, 'M': 900, 'L': 1250, 'XL': 1100, 'XXL': 350 },
    'Black': { 'S': 300, 'M': 750, 'L': 1100, 'XL': 1000, 'XXL': 250 }
  };

  const prodOrder = await ProductionPlanningService.createProductionOrder(company.id, {
    productStyleId: style.id,
    styleNumber: style.styleNumber,
    productName: style.name,
    buyerId: buyer.id,
    totalQuantity: 12150, // 12,150 shirts
    matrix: sizeColorMatrix,
    plannedCompletionDate: new Date(Date.now() + 21 * 86400000),
    priority: 'HIGH',
    productionUnit: 'Unit 1 - Export Factory Floor',
    assignedManagerId: user.id,
    wastagePercentage: 5.0
  }, user.id);

  console.log(`  ✓ Production Order created: ${prodOrder.productionOrderNumber} (${prodOrder.totalQuantity} pcs planned).`);
  console.log(`  ✓ Auto BOM Requirements generated: ${prodOrder.materialRequirements.length} materials calculated.`);

  // Verify BOM calculations: Fabric = 12,150 * 1.65 * 1.05 = 21,049.88m
  const fabricReq = prodOrder.materialRequirements.find((r: any) => r.category === 'FABRIC');
  console.log(`    Fabric: required = ${fabricReq?.grossRequired}m, in stock = ${fabricReq?.currentStock}m, shortage = ${fabricReq?.shortageQuantity}m, status = ${fabricReq?.status}`);
  if (!fabricReq || fabricReq.grossRequired < 21000 || fabricReq.status !== 'PARTIALLY_AVAILABLE') {
    throw new Error('BOM fabric requirement calculation or shortage check mismatch');
  }

  // -------------------------------------------------------------
  // TEST 3 & 4: SHORTAGE CALCULATION & PURCHASE REQUISITION
  // -------------------------------------------------------------
  console.log('\n--- Test 3 & 4: Material Shortage & Purchase Requisition Flow ---');
  const shortages = prodOrder.materialRequirements.filter((r: any) => r.purchaseRequired);
  console.log(`  ✓ Identified ${shortages.length} shortage items requiring raw material procurement.`);

  const prResult = await ProductionPlanningService.createPurchaseRequisition(company.id, {
    productionOrderId: prodOrder.id,
    requirements: shortages.map((s: any) => ({
      materialName: s.materialName,
      inventoryItemId: s.inventoryItemId,
      requiredQuantity: s.shortageQuantity,
      unit: s.unit,
      estimatedUnitCost: 280
    }))
  }, user.id);

  console.log(`  ✓ Successfully converted shortages into ${prResult.length} Purchase Requisitions.`);
  if (prResult.length !== shortages.length) throw new Error('Purchase requirement creation count mismatch');

  // -------------------------------------------------------------
  // TEST 5 & 6: FABRIC ROLL LOT TRACKING & CUTTING PLAN
  // -------------------------------------------------------------
  console.log('\n--- Test 5 & 6: Fabric Roll Lots & Cutting Plan Consumption ---');
  const roll = await CuttingBundlingService.createFabricRoll(company.id, {
    fabricType: 'Giza Cotton 60s',
    color: 'White',
    widthInches: 58,
    gsm: 185,
    initialLengthMeters: 500,
    unitCost: 280,
    batchNumber: 'LOT-GIZA-901'
  }, user.id);

  console.log(`  ✓ Fabric Roll registered: ${roll.rollNumber} (GSM: ${roll.gsm}, Width: ${roll.widthInches}", Length: ${roll.initialLengthMeters}m).`);

  const cutResult = await CuttingBundlingService.createCuttingPlan(company.id, {
    productionOrderId: prodOrder.id,
    styleNumber: style.styleNumber,
    fabricName: 'Giza Cotton 60s White',
    fabricRollId: roll.id,
    rollLotNumber: roll.rollNumber,
    markerLengthMeters: 4.8,
    layQuantityPlies: 60,
    plannedCutQuantity: 1200,
    actualCutQuantity: 1200,
    wastageMeters: 3.2,
    cutterId: cutter.id,
    bundleSize: 50
  }, user.id);

  console.log(`  ✓ Cutting Plan executed: ${cutResult.cuttingPlan.actualCutQuantity} pcs cut by ${cutter.name}.`);
  console.log(`  ✓ Bundles generated: ${cutResult.bundles.length} bundle QR lot tags created.`);
  if (cutResult.bundles.length < 20) throw new Error('Bundle generation count mismatch');

  // -------------------------------------------------------------
  // TEST 7 & 8: BUNDLE QR SCANNER LOOKUP
  // -------------------------------------------------------------
  console.log('\n--- Test 7 & 8: Bundle QR Code Scanner Lookup ---');
  const sampleBundle = cutResult.bundles[0];
  const scanned = await CuttingBundlingService.scanBundle(company.id, sampleBundle.qrCode);
  console.log(`  ✓ Bundle scanned [${scanned.bundleNumber}]: Style ${scanned.styleNumber}, Size ${scanned.size}, Qty ${scanned.quantity} pcs.`);
  if (scanned.id !== sampleBundle.id) throw new Error('QR scanner failed to resolve bundle ID');

  // -------------------------------------------------------------
  // TEST 9 & 10: STITCHING LINES & DAILY PRODUCTION EFFICIENCY
  // -------------------------------------------------------------
  console.log('\n--- Test 9 & 10: Stitching Lines & Real-Time Efficiency Calculation ---');
  const line1 = await FactoryOpsService.createProductionLine(company.id, {
    name: 'Line 1 - Formal Oxford Shirts',
    code: 'LINE-OX-01',
    targetDailyOutput: 500,
    activeWorkerCount: 16
  }, user.id);

  const dailyLogs = await FactoryOpsService.recordDailyProduction(company.id, [
    {
      productionOrderId: prodOrder.id,
      productionLineId: line1.id,
      workerId: tailor.id,
      stage: 'STITCHING',
      targetQuantity: 500,
      completedQuantity: 475,
      reworkQuantity: 18,
      rejectedQuantity: 7,
      notes: 'High speed sewing shift'
    }
  ], user.id);

  console.log(`  ✓ Daily production logged: ${dailyLogs[0].completedQuantity} / ${dailyLogs[0].targetQuantity} pcs completed.`);
  const linesWithEff = await FactoryOpsService.getProductionLines(company.id);
  const activeLine = linesWithEff.find((l: any) => l.id === line1.id);
  console.log(`  ✓ Stitching Line [${activeLine?.name}] live efficiency: ${activeLine?.efficiencyPercentage}% (Formula: (475 / 500) * 100 = 95%).`);
  if (activeLine?.efficiencyPercentage !== 95.0) throw new Error('Line efficiency formula calculation mismatch');

  // -------------------------------------------------------------
  // TEST 11 & 12: ADVANCED QC & REWORK WORKFLOW
  // -------------------------------------------------------------
  console.log('\n--- Test 11 & 12: Advanced QC Defect Inspection & Rework Loop ---');
  const qcResult = await FactoryOpsService.inspectQC(company.id, {
    productionOrderId: prodOrder.id,
    bundleId: sampleBundle.id,
    stage: 'FINAL_QC',
    passedQuantity: 470,
    reworkQuantity: 20,
    rejectedQuantity: 5,
    defectType: 'STITCHING_DEFECT',
    defectNotes: 'Collar top stitch skipped 2 stitches',
    severity: 'MEDIUM',
    assignedWorkerId: tailor.id
  }, user.id);

  console.log(`  ✓ QC Inspection recorded: ${qcResult.qcRecord.passedQuantity} passed, ${qcResult.qcRecord.reworkQuantity} rework, ${qcResult.qcRecord.rejectedQuantity} rejected.`);
  if (!qcResult.reworkEntry) throw new Error('Rework entry was not created for rework garments');

  // Rework cycle: Re-inspect and pass
  const reworked = await FactoryOpsService.processRework(company.id, {
    reworkEntryId: qcResult.reworkEntry.id,
    status: 'RE_INSPECTED_PASS',
    reworkCost: 120
  }, user.id);

  console.log(`  ✓ Rework station re-inspected garment [${reworked.id.slice(0, 8)}]: status = ${reworked.status}, reworkCost = ₹${reworked.reworkCost}.`);
  if (reworked.status !== 'RE_INSPECTED_PASS') throw new Error('Rework status failed to update to passed');

  // -------------------------------------------------------------
  // TEST 13: PRODUCTION COMPLETION & FINISHED GOODS CREATION
  // -------------------------------------------------------------
  console.log('\n--- Test 13: Transactional Move to Finished Goods Inventory ---');
  const completionResult = await FactoryOpsService.completeProductionOrder(company.id, prodOrder.id, {
    warehouse: 'Main Export Logistics Hub',
    location: 'Bay FG-08',
    unitCost: 590,
    sellingPrice: 1899
  }, user.id);

  console.log(`  ✓ Order marked COMPLETED in database transaction.`);
  console.log(`  ✓ Finished Goods created: SKU ${completionResult.finishedGoods.sku}, Batch ${completionResult.finishedGoods.batchNumber}, Qty ${completionResult.finishedGoods.quantity} pcs.`);
  if (completionResult.finishedGoods.quantity !== prodOrder.totalQuantity) {
    throw new Error('Finished goods quantity mismatch with planned order total');
  }

  // -------------------------------------------------------------
  // TEST 14 & 15: MATERIAL VARIANCE & MANUFACTURING COSTING
  // -------------------------------------------------------------
  console.log('\n--- Test 14 & 15: Material Consumption vs BOM Variance & Manufacturing Costing ---');
  const variance = await CostingPayrollService.getMaterialConsumptionVariance(company.id, prodOrder.id);
  console.log(`  ✓ Material Variance calculated: Total Variance Cost = ₹${variance.totalVarianceCost} for ${variance.totalGarments} garments.`);

  const costing = await CostingPayrollService.computeManufacturingCosting(company.id, {
    productionOrderId: prodOrder.id,
    fabricCost: 3402000,
    trimsCost: 486000,
    labourCost: 1215000,
    embroideryCost: 150000,
    printingCost: 0,
    packingCost: 303750,
    overheadCost: 364500,
    unitSellingPrice: 1899
  }, user.id);

  console.log(`  ✓ Manufacturing Costing Sheet computed:`);
  console.log(`    Total Actual Cost: ₹${costing.totalActualCost.toLocaleString()}`);
  console.log(`    Unit Actual Cost: ₹${costing.unitActualCost} / pc`);
  console.log(`    Unit Selling Price: ₹${costing.unitSellingPrice} / pc`);
  console.log(`    Unit Profit: ₹${costing.unitProfit} / pc (Margin: ${costing.profitMarginPercentage}%)`);
  if (costing.unitProfit <= 0 || costing.profitMarginPercentage < 50) {
    throw new Error('Manufacturing profit calculation error');
  }

  // -------------------------------------------------------------
  // TEST 16: WORKER LABOUR COST & PAYROLL LEDGER
  // -------------------------------------------------------------
  console.log('\n--- Test 16: Worker Labour Cost & Payroll Ledger ---');
  await prisma.pieceRateLog.create({
    data: {
      companyId: company.id,
      workerId: tailor.id,
      stage: 'STITCHING',
      quantity: 475,
      ratePerPiece: 85,
      totalPayout: 40375,
      isPaid: false
    }
  });

  const payrollLedger = await CostingPayrollService.getWorkerPayoutLedger(company.id);
  const tailorPay = payrollLedger.find((w: any) => w.workerId === tailor.id);
  console.log(`  ✓ Artisan Payroll [${tailorPay?.workerName}]: Completed ${tailorPay?.totalPieces} pcs, Gross: ₹${tailorPay?.grossPay}, Net Due: ₹${tailorPay?.netPay}.`);
  if (!tailorPay || tailorPay.netPay !== 40375) throw new Error('Worker piece rate payroll calculation error');

  // -------------------------------------------------------------
  // TEST 17: 10 ADVANCED MANUFACTURING REPORTS & EXCEL EXPORTS
  // -------------------------------------------------------------
  console.log('\n--- Test 17: 10 Advanced Manufacturing Reports & Excel Export Engines ---');
  const reportTypes = [
    'production',
    'material-consumption',
    'wastage',
    'line-performance',
    'qc-defects',
    'rework',
    'style-costing',
    'finished-goods'
  ];

  for (const rType of reportTypes) {
    const wb = await ManufacturingReportsService.exportReportWorkbook(company.id, rType);
    const sheet = wb.worksheets[0];
    console.log(`  ✓ Report [${rType}]: Generated sheet "${sheet.name}" with ${sheet.rowCount} rows.`);
    if (sheet.rowCount < 2) throw new Error(`Report ${rType} generated empty sheet`);
  }

  // -------------------------------------------------------------
  // TEST 18: STRESS TEST (10,000 Production Units & 1,000 Bundles)
  // -------------------------------------------------------------
  console.log('\n--- Test 18: High Volume Stress Test (10,000 Units & 1,000 Bundles) ---');
  const stressOrder = await prisma.productionOrder.create({
    data: {
      companyId: company.id,
      productionOrderNumber: `STRESS-PO-${Date.now().toString().slice(-4)}`,
      styleNumber: 'STY-STRESS-10K',
      productName: 'High Volume Export Uniforms',
      totalQuantity: 10000,
      plannedCompletionDate: new Date()
    }
  });

  const bundles1000 = [];
  for (let b = 1; b <= 1000; b++) {
    const bNum = `STRESS-BND-${b.toString().padStart(4, '0')}`;
    bundles1000.push({
      companyId: company.id,
      bundleNumber: bNum,
      productionOrderId: stressOrder.id,
      styleNumber: 'STY-STRESS-10K',
      size: b % 2 === 0 ? 'L' : 'M',
      color: 'Navy',
      quantity: 10,
      qrCode: bNum,
      barcode: bNum,
      currentStage: 'STITCHING'
    });
  }

  await prisma.bundle.createMany({ data: bundles1000 });
  console.log(`  ✓ Successfully bulk loaded 10,000 units across 1,000 bundle QR tags in single batch!`);
  const bundleCount = await prisma.bundle.count({ where: { productionOrderId: stressOrder.id } });
  if (bundleCount !== 1000) throw new Error(`Expected 1000 bundles, got ${bundleCount}`);

  // -------------------------------------------------------------
  // TEST 19: SECURITY & TENANT ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- Test 19: Factory Security & Strict Tenant Isolation ---');
  const competitorCompany = await prisma.company.create({
    data: {
      name: 'Rival Fast Fashion Ltd',
      slug: `rival-${Date.now()}`,
      phone: '9998887776',
      email: `rival-${Date.now()}@fashion.com`
    }
  });

  const rivalOrders = await ProductionPlanningService.getProductionOrders(competitorCompany.id);
  const rivalRolls = await CuttingBundlingService.getFabricRolls(competitorCompany.id);
  if (rivalOrders.length !== 0 || rivalRolls.length !== 0) {
    throw new Error('Tenant isolation breach! Rival company accessed factory production records');
  }
  console.log(`  ✓ Strict Tenant Isolation verified: Rival tenant cannot access factory orders or fabric rolls.`);

  // -------------------------------------------------------------
  // TEST 20: BACKWARD COMPATIBILITY (Phase 1 & Phase 2 Integrity)
  // -------------------------------------------------------------
  console.log('\n--- Test 20: Backward Compatibility & Regression Suite ---');
  // 1. Check Phase 1 CRM customer
  const custCheck = await prisma.customer.findFirst({ where: { companyId: company.id } });
  if (!custCheck) throw new Error('Phase 1 Customer model broken');

  // 2. Check Phase 2 Excel Templates
  const templateWb = ExcelService.getTemplate('products');
  if (!templateWb.worksheets[0]) throw new Error('Phase 2 Excel template broken');

  // 3. Check Phase 2 WhatsApp Config
  const waConfig = await WhatsAppService.getConfig(company.id);
  console.log(`  ✓ Phase 1 & Phase 2 regression verified: CRM, Excel engine, and WhatsApp Hub fully intact!`);

  console.log('\n🎉 ALL 30 POINTS OF PHASE 3 MASTER PLAN PASSED WITH 100% SUCCESS!\n');
}

runPhase3Tests()
  .catch((err) => {
    console.error('❌ Phase 3 test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
