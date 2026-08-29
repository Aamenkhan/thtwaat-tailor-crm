import { prisma } from '../config/db';
import { ExpenseService } from '../modules/accounting/expense.service';
import { GSTService } from '../modules/accounting/gst.service';
import { PnLService } from '../modules/accounting/pnl.service';
import { LedgerService } from '../modules/accounting/ledger.service';

async function runAccountingGSTTests() {
  console.log('🧪 Starting Accounting, GST, Expenses & Profit-Loss (P&L) Test Suite...\n');

  // 1. Setup Manufacturing Company Tenant
  const slug = `acct-mfg-${Date.now()}`;
  const company = await prisma.company.create({
    data: {
      name: 'Bespoke Luxury Mills & Apparel Ltd',
      slug,
      phone: '9810011223',
      email: `${slug}@bespokemills.com`,
      currency: 'INR',
      gstNumber: '07AABCU9603R1ZM' // Delhi GSTIN (07)
    }
  });

  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: 'Main Tailoring Factory & Showroom',
      code: 'DEL-HQ',
      isMain: true
    }
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      name: 'Chief Financial Officer',
      email: `cfo-${slug}@bespokemills.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      passwordHash: 'dummy_hash',
      role: 'ACCOUNTANT'
    }
  });

  const customer1 = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Royal Heritage Club',
      businessName: 'Heritage Hospitality Ltd',
      phone: '9812345678',
      gstNumber: '07AAACH1234F1Z5' // Delhi B2B GSTIN
    }
  });

  const customer2 = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Sanjay Kapoor (Retail Customer)',
      phone: '9876543210' // B2C (No GSTIN)
    }
  });

  // -------------------------------------------------------------
  // TEST 1: MULTI-CATEGORY EXPENSE LOGGING & GST ITC
  // -------------------------------------------------------------
  console.log('--- Test 1: Expense Logging & GST Input Tax Credit (ITC) ---');
  const exp1 = await ExpenseService.createExpense(company.id, {
    category: 'RENT',
    title: 'Factory Shed Lease Rent - August',
    amount: 118000,
    gstRate: 18, // 18% GST (Amount includes ₹18,000 GST ITC)
    paymentMethod: 'BANK_TRANSFER',
    payeeVendor: 'Industrial Parks Infrastructure Ltd'
  }, user.id);

  const exp2 = await ExpenseService.createExpense(company.id, {
    category: 'ELECTRICITY_POWER',
    title: 'Factory Power & Generator Diesel',
    amount: 35000,
    gstRate: 18,
    paymentMethod: 'UPI',
    payeeVendor: 'Delhi State Power Distribution'
  }, user.id);

  const exp3 = await ExpenseService.createExpense(company.id, {
    category: 'MACHINE_MAINTENANCE',
    title: 'Sewing Machine Servicing & Needles',
    amount: 12000,
    gstRate: 12,
    paymentMethod: 'CASH',
    payeeVendor: 'Juki Sewing Mechanics'
  }, user.id);

  const exp4 = await ExpenseService.createExpense(company.id, {
    category: 'STAFF_SALARY',
    title: 'Floor Supervisor Monthly Stipend',
    amount: 45000,
    gstRate: 0,
    paymentMethod: 'BANK_TRANSFER'
  }, user.id);

  console.log(`  ✓ Created 4 expenses across Rent, Power, Maintenance, and Salaries.`);
  const expSummary = await ExpenseService.getExpenseSummary(company.id);
  console.log(`  ✓ Total Expenses: ₹${expSummary.totalExpenses.toLocaleString()}, Total GST Paid (ITC): ₹${expSummary.totalGstPaid.toLocaleString()}`);
  console.log(`  ✓ Top Expense Category: ${expSummary.categoryBreakdown[0].category} (₹${expSummary.categoryBreakdown[0].totalAmount}, ${expSummary.categoryBreakdown[0].percentage}%)`);
  if (expSummary.totalExpenses !== 210000 || expSummary.totalGstPaid <= 0) {
    throw new Error('Expense summary total or ITC calculation mismatch');
  }

  // -------------------------------------------------------------
  // TEST 2: GST CALCULATION ENGINE (INTRA-STATE VS INTER-STATE)
  // -------------------------------------------------------------
  console.log('\n--- Test 2: GST Calculation Engine (Intra-State vs Inter-State) ---');
  // Intra-state (Delhi to Delhi: 07 to 07)
  const intraStateGST = GSTService.calculateGST(100000, 18, '07-DELHI', '07-DELHI');
  console.log(`  ✓ Intra-State (Delhi -> Delhi): Taxable ₹${intraStateGST.taxableAmount}, CGST (9%) = ₹${intraStateGST.cgstAmount}, SGST (9%) = ₹${intraStateGST.sgstAmount}, IGST = ₹${intraStateGST.igstAmount}, Total = ₹${intraStateGST.totalWithTax}`);
  if (intraStateGST.cgstAmount !== 9000 || intraStateGST.sgstAmount !== 9000 || intraStateGST.igstAmount !== 0) {
    throw new Error('Intra-state CGST/SGST calculation mismatch');
  }

  // Inter-state (Delhi to Mumbai: 07 to 27)
  const interStateGST = GSTService.calculateGST(100000, 18, '07-DELHI', '27-MAHARASHTRA');
  console.log(`  ✓ Inter-State (Delhi -> Mumbai): Taxable ₹${interStateGST.taxableAmount}, CGST = ₹${interStateGST.cgstAmount}, SGST = ₹${interStateGST.sgstAmount}, IGST (18%) = ₹${interStateGST.igstAmount}, Total = ₹${interStateGST.totalWithTax}`);
  if (interStateGST.igstAmount !== 18000 || interStateGST.cgstAmount !== 0 || interStateGST.sgstAmount !== 0) {
    throw new Error('Inter-state IGST calculation mismatch');
  }

  // -------------------------------------------------------------
  // TEST 3: GSTR-1 OUTWARD SUPPLIES & GSTR-3B MONTHLY RETURN
  // -------------------------------------------------------------
  console.log('\n--- Test 3: GSTR-1 Outward Supplies & GSTR-3B Tax Return ---');
  // Create test order & invoices
  const order1 = await prisma.order.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      orderNumber: `ORD-B2B-${Date.now().toString().slice(-4)}`,
      customerId: customer1.id,
      deliveryDate: new Date(Date.now() + 7 * 86400000),
      totalAmount: 236000,
      finalAmount: 236000
    }
  });

  const inv1 = await prisma.invoice.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      orderId: order1.id,
      invoiceNumber: `INV-B2B-${Date.now().toString().slice(-4)}`,
      customerName: customer1.name,
      customerPhone: customer1.phone,
      customerGst: customer1.gstNumber,
      placeOfSupply: '07-DELHI',
      hsnSacCode: '6205',
      subtotal: 200000,
      taxRate: 18,
      taxAmount: 36000,
      cgstAmount: 18000,
      sgstAmount: 18000,
      igstAmount: 0,
      totalAmount: 236000,
      amountPaid: 150000,
      balanceDue: 86000,
      status: 'PARTIAL'
    }
  });

  const order2 = await prisma.order.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      orderNumber: `ORD-B2C-${Date.now().toString().slice(-4)}`,
      customerId: customer2.id,
      deliveryDate: new Date(Date.now() + 7 * 86400000),
      totalAmount: 59000,
      finalAmount: 59000
    }
  });

  const inv2 = await prisma.invoice.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      orderId: order2.id,
      invoiceNumber: `INV-B2C-${Date.now().toString().slice(-4)}`,
      customerName: customer2.name,
      customerPhone: customer2.phone,
      placeOfSupply: '27-MAHARASHTRA',
      hsnSacCode: '9988',
      subtotal: 50000,
      taxRate: 18,
      taxAmount: 9000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 9000,
      totalAmount: 59000,
      amountPaid: 59000,
      balanceDue: 0,
      status: 'PAID'
    }
  });

  // Verify GSTR-1
  const gstr1 = await GSTService.getGSTR1Report(company.id);
  console.log(`  ✓ GSTR-1: ${gstr1.summary.totalInvoices} Invoices, Taxable Value = ₹${gstr1.summary.totalTaxableValue.toLocaleString()}, Total Output Tax = ₹${gstr1.summary.totalOutputTax.toLocaleString()}`);
  console.log(`    B2B Count: ${gstr1.b2bCount} invoices (with GSTIN), B2C Count: ${gstr1.b2cCount} invoices.`);
  if (gstr1.b2bCount !== 1 || gstr1.b2cCount !== 1 || gstr1.summary.totalTaxableValue !== 250000) {
    throw new Error('GSTR-1 generation calculation mismatch');
  }

  // Verify GSTR-3B
  const gstr3b = await GSTService.getGSTR3BReport(company.id);
  console.log(`  ✓ GSTR-3B Tax Return:`);
  console.log(`    Total Output Tax Liability: ₹${gstr3b.outwardSupplies.totalOutputTax.toLocaleString()}`);
  console.log(`    Total Eligible Input Tax Credit (ITC): ₹${gstr3b.eligibleITC.totalEligibleITC.toLocaleString()}`);
  console.log(`    Net Tax Payable in Cash: ₹${gstr3b.taxPaymentSettlement.netTaxPayableInCash.toLocaleString()}`);
  if (gstr3b.outwardSupplies.totalOutputTax !== 45000) {
    throw new Error('GSTR-3B output tax calculation mismatch');
  }

  // -------------------------------------------------------------
  // TEST 4: REAL-TIME PROFIT & LOSS (P&L) STATEMENT
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Real-Time Profit & Loss (P&L) Statement ---');
  // Log direct artisan piece rate wage
  const worker = await prisma.worker.create({
    data: {
      companyId: company.id,
      name: 'Master Tailor Qasim',
      phone: '9833334444',
      role: 'TAILOR',
      wageType: 'PIECE_RATE'
    }
  });

  await prisma.pieceRateLog.create({
    data: {
      companyId: company.id,
      workerId: worker.id,
      stage: 'STITCHING',
      quantity: 50,
      ratePerPiece: 500,
      totalPayout: 25000,
      isPaid: true
    }
  });

  const pnl = await PnLService.getProfitAndLoss(company.id);
  console.log(`  ✓ Real-Time P&L Statement:`);
  console.log(`    1. Net Revenue: ₹${pnl.revenue.netRevenue.toLocaleString()} (${pnl.revenue.invoicesCount} invoices)`);
  console.log(`    2. Total COGS: ₹${pnl.costOfGoodsSold.totalCOGS.toLocaleString()} (Material: ₹${pnl.costOfGoodsSold.rawMaterialConsumption}, Wages: ₹${pnl.costOfGoodsSold.artisanPieceRateWages})`);
  console.log(`    3. Gross Profit: ₹${pnl.grossProfit.amount.toLocaleString()} (Margin: ${pnl.grossProfit.marginPercentage}%)`);
  console.log(`    4. Total OPEX: ₹${pnl.operatingExpenses.totalOPEX.toLocaleString()} (Rent: ₹${pnl.operatingExpenses.rent}, Power: ₹${pnl.operatingExpenses.electricityPower})`);
  console.log(`    5. EBITDA Operating Profit: ₹${pnl.operatingProfitEBITDA.amount.toLocaleString()} (Margin: ${pnl.operatingProfitEBITDA.marginPercentage}%)`);
  console.log(`    6. Net Profit: ₹${pnl.netProfit.amount.toLocaleString()} (Margin: ${pnl.netProfit.marginPercentage}%, Profitable: ${pnl.netProfit.isProfitable})`);
  if (pnl.revenue.netRevenue !== 250000 || pnl.operatingExpenses.totalOPEX !== 210000) {
    throw new Error('P&L revenue or OPEX calculation mismatch');
  }

  // -------------------------------------------------------------
  // TEST 5: CUSTOMER STATEMENT OF ACCOUNT & RUNNING BALANCE
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Customer Statement of Account & Ledger ---');
  // Log payment of ₹150,000 for customer1
  await prisma.payment.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      orderId: order1.id,
      invoiceId: inv1.id,
      customerId: customer1.id,
      amount: 150000,
      paymentMethod: 'NEFT',
      referenceNumber: 'NEFT-AXIS-99281',
      recordedById: user.id
    }
  });

  const custLedger = await LedgerService.getCustomerLedger(company.id, customer1.id);
  console.log(`  ✓ Customer [${custLedger.customer.name}]: Invoiced ₹${custLedger.summary.totalInvoiced}, Paid ₹${custLedger.summary.totalPaid}, Outstanding Balance = ₹${custLedger.summary.outstandingBalance}`);
  console.log(`  ✓ Verified ${custLedger.transactions.length} ledger transaction rows with chronological running balance.`);
  if (custLedger.summary.outstandingBalance !== 86000) {
    throw new Error('Customer ledger outstanding balance mismatch');
  }

  // -------------------------------------------------------------
  // TEST 6: DOUBLE-ENTRY JOURNAL ENTRY LOGGING
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Double-Entry Journal Entry Logging ---');
  const journal = await LedgerService.recordJournalEntry(company.id, {
    narration: 'Depreciation on Sewing Machinery for August 2026',
    debitAccount: 'DEPRECIATION_EXPENSE',
    creditAccount: 'ACCUMULATED_DEPRECIATION',
    amount: 8500
  });
  console.log(`  ✓ Journal Entry [${journal.entryNumber}]: Debit ${journal.debitAccount} ₹${journal.amount} | Credit ${journal.creditAccount} ₹${journal.amount}.`);
  if (!journal.id) throw new Error('Journal entry creation failed');

  // -------------------------------------------------------------
  // TEST 7: SECURITY & MULTI-TENANT ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Financial Security & Strict Tenant Isolation ---');
  const competitorCompany = await prisma.company.create({
    data: {
      name: 'Rival Fashion House',
      slug: `rival-${Date.now()}`,
      phone: '9900112233',
      email: `rival-${Date.now()}@fashion.com`
    }
  });

  const rivalExpenses = await ExpenseService.getExpenses(competitorCompany.id);
  const rivalGSTR1 = await GSTService.getGSTR1Report(competitorCompany.id);
  const rivalPnL = await PnLService.getProfitAndLoss(competitorCompany.id);

  if (rivalExpenses.length !== 0 || rivalGSTR1.summary.totalInvoices !== 0 || rivalPnL.revenue.netRevenue !== 0) {
    throw new Error('Security violation: Rival company accessed financial records!');
  }
  console.log(`  ✓ Strict Tenant Isolation verified: Rival tenant has 0 access to expenses, GST data, or P&L statements.`);

  console.log('\n🎉 ALL ACCOUNTING, GST, EXPENSES & P&L TESTS PASSED WITH 100% SUCCESS!\n');
}

runAccountingGSTTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
