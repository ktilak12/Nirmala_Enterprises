import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Invoice } from '../models/Invoice.js';
import { Loan, LoanPayment } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { auditAllStock } from '../services/ledger.js';
import { paymentStatusFor } from '../services/payments.js';
import { round2 } from '../utils/money.js';

/**
 * Integrity verification.
 *
 *   npm run verify
 *
 * This script is the price of choosing MongoDB.
 *
 * The concept document (Section 1) asked for a relational database, where the
 * engine itself would refuse a sale line pointing at a product that does not
 * exist, and where a stored balance could be a view over its transactions rather
 * than a copy of them. MongoDB enforces neither, so the guarantee has to be
 * re-established from outside: the application keeps derived caches
 * (`product.currentStock`, `party.balances`, `loan.outstanding`) for read speed,
 * and this script independently re-derives every one of them from the documents
 * that are authoritative, then reports any disagreement.
 *
 * It is READ-ONLY. It never repairs anything - a script that quietly corrected
 * the books would destroy the evidence of whatever caused the drift, and the
 * cause matters more than the symptom. `recompute-stock.js` repairs, once a
 * human has looked at what this found.
 *
 * Exit code is 0 when everything reconciles and 1 when it does not, so it can be
 * run from a scheduled task and noticed when it fails.
 */

const problems = [];
const checks = [];

const record = (name, count, detail = '') => {
  checks.push({ name, ok: count === 0, count, detail });
  if (count > 0) problems.push({ name, count, detail });
};

const heading = (text) => process.stdout.write(`\n${text}\n${'─'.repeat(text.length)}\n`);
const line = (text) => process.stdout.write(`${text}\n`);
const money = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

/**
 * 1. Stock: the inventory ledger versus `product.currentStock`.
 *
 * The ledger is append-only and authoritative. `currentStock` is a running total
 * of it maintained inside the same transaction, so the two can only diverge if a
 * write escaped a transaction - which is exactly what we want to hear about.
 */
async function checkStock() {
  heading('1. Stock ledger versus cached stock');

  const { checked, drifted, orphans } = await auditAllStock();
  line(`   products checked: ${checked}`);

  for (const row of drifted) {
    line(
      `   DRIFT  ${row.productCode} ${row.productName}: ` +
        `cached ${row.cachedStock}, ledger ${row.ledgerStock} ` +
        `(difference ${row.stockDrift})`,
    );
  }
  for (const row of orphans) {
    line(
      `   ORPHAN ${row.txnCount} ledger row(s) for product ${row.productId}, ` +
        `which no longer exists (balance ${row.ledgerStock})`,
    );
  }

  record('stock cache matches ledger', drifted.length, 'run recompute-stock.js after investigating');
  record('no orphaned ledger rows', orphans.length, 'ledger rows referencing a deleted product');

  if (drifted.length === 0 && orphans.length === 0) line('   OK - every product agrees with its ledger');
}

/**
 * 2. Loans: outstanding = principal + adjustments − repayments.
 *
 * Re-derived from the loan's own adjustment lines and from the LoanPayment
 * collection, so a repayment that was written without updating the loan, or an
 * adjustment total that was miscomputed, both surface here.
 */
async function checkLoans() {
  heading('2. Advances');

  const loans = await Loan.find().lean();
  const repayments = await LoanPayment.aggregate([
    { $group: { _id: '$loan', paid: { $sum: '$amount' }, rows: { $sum: 1 } } },
  ]);
  const paidByLoan = new Map(repayments.map((r) => [String(r._id), r.paid]));
  const loanIds = new Set(loans.map((l) => String(l._id)));

  let bad = 0;

  for (const loan of loans) {
    const adjustmentTotal = round2(
      (loan.adjustments ?? []).reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    );
    const repaid = round2(paidByLoan.get(String(loan._id)) ?? 0);
    const expected = round2(Number(loan.principal) + adjustmentTotal - repaid);

    const issues = [];
    if (round2(loan.adjustmentTotal) !== adjustmentTotal) {
      issues.push(`adjustmentTotal stored ${money(loan.adjustmentTotal)}, lines sum to ${money(adjustmentTotal)}`);
    }
    if (round2(loan.totalRepaid) !== repaid) {
      issues.push(`totalRepaid stored ${money(loan.totalRepaid)}, LoanPayments sum to ${money(repaid)}`);
    }
    if (round2(loan.outstanding) !== expected) {
      issues.push(`outstanding stored ${money(loan.outstanding)}, derives to ${money(expected)}`);
    }

    if (issues.length > 0) {
      bad += 1;
      line(`   DRIFT  ${loan.loanCode} (${loan.partyName})`);
      for (const issue of issues) line(`          ${issue}`);
    }
  }

  const orphanRepayments = repayments.filter((r) => !loanIds.has(String(r._id)));
  for (const r of orphanRepayments) {
    line(`   ORPHAN ${r.rows} repayment(s) against advance ${r._id}, which no longer exists`);
  }

  line(`   advances checked: ${loans.length}`);
  record('advance balances reconcile', bad);
  record('no orphaned repayments', orphanRepayments.length);
  if (bad === 0 && orphanRepayments.length === 0) line('   OK - every advance reconciles');
}

/**
 * 3. Documents: outstanding = total − amountPaid, and the status agrees.
 *
 * A sale whose `paymentStatus` says PAID while money is still owed would quietly
 * drop that debt out of the receivables report, so the flag is re-derived too,
 * not just the number.
 */
async function checkDocuments() {
  heading('3. Sales and purchases');

  /**
   * Re-derived with the SAME function the transaction engine uses to set the
   * flag, not a second copy of the rule. If the business ever redefines what
   * counts as PARTIAL, this check follows automatically rather than starting to
   * report false drift against the new definition.
   */
  const expectedStatus = paymentStatusFor;

  let bad = 0;

  const sales = await Sale.find().select('saleCode partyName grandTotal amountPaid outstanding paymentStatus').lean();
  for (const s of sales) {
    const expected = round2(Number(s.grandTotal) - Number(s.amountPaid));
    const status = expectedStatus(s.grandTotal, s.amountPaid);
    if (round2(s.outstanding) !== expected || s.paymentStatus !== status) {
      bad += 1;
      line(
        `   DRIFT  ${s.saleCode} (${s.partyName}): total ${money(s.grandTotal)}, ` +
          `paid ${money(s.amountPaid)} -> expected outstanding ${money(expected)}/${status}, ` +
          `stored ${money(s.outstanding)}/${s.paymentStatus}`,
      );
    }
  }

  const purchases = await Purchase.find()
    .select('purchaseCode partyName grossAmount adjustments adjustmentTotal netPayable amountPaid outstanding paymentStatus')
    .lean();

  for (const p of purchases) {
    const adjustmentTotal = round2(
      (p.adjustments ?? []).reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    );
    const netPayable = round2(Number(p.grossAmount) - adjustmentTotal);
    const expected = round2(netPayable - Number(p.amountPaid));
    const status = expectedStatus(netPayable, p.amountPaid);

    const issues = [];
    if (round2(p.adjustmentTotal) !== adjustmentTotal) {
      issues.push(`adjustmentTotal stored ${money(p.adjustmentTotal)}, lines sum to ${money(adjustmentTotal)}`);
    }
    // Section 25: gross - adjustments = net.
    if (round2(p.netPayable) !== netPayable) {
      issues.push(`netPayable stored ${money(p.netPayable)}, gross - adjustments = ${money(netPayable)}`);
    }
    if (round2(p.outstanding) !== expected || p.paymentStatus !== status) {
      issues.push(`outstanding ${money(p.outstanding)}/${p.paymentStatus}, expected ${money(expected)}/${status}`);
    }

    if (issues.length > 0) {
      bad += 1;
      line(`   DRIFT  ${p.purchaseCode} (${p.partyName})`);
      for (const issue of issues) line(`          ${issue}`);
    }
  }

  line(`   sales checked: ${sales.length}, purchases checked: ${purchases.length}`);
  record('document totals reconcile', bad);
  if (bad === 0) line('   OK - every document reconciles');
}

/**
 * 4. Party balances versus the documents behind them.
 *
 * receivable      = unpaid remainder of that party's sales
 * payable         = unpaid remainder of that party's purchases and procurements
 * loanOutstanding = sum of their advances still outstanding
 *
 * These three drive the outstanding-dues report and the 360-degree profile, so
 * drift here is drift a farmer would notice.
 */
async function checkPartyBalances() {
  heading('4. Party balances');

  const [parties, salesByParty, purchasesByParty, loansByParty] = await Promise.all([
    Party.find().select('partyCode name balances').lean(),
    Sale.aggregate([{ $group: { _id: '$party', due: { $sum: '$outstanding' } } }]),
    Purchase.aggregate([{ $group: { _id: '$party', due: { $sum: '$outstanding' } } }]),
    Loan.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$party', due: { $sum: '$outstanding' } } },
    ]),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), round2(r.due)]));
  const receivables = toMap(salesByParty);
  const payables = toMap(purchasesByParty);
  const advances = toMap(loansByParty);

  let bad = 0;

  for (const party of parties) {
    const id = String(party._id);
    const expected = {
      receivable: receivables.get(id) ?? 0,
      payable: payables.get(id) ?? 0,
      loanOutstanding: advances.get(id) ?? 0,
    };
    const stored = {
      receivable: round2(party.balances?.receivable ?? 0),
      payable: round2(party.balances?.payable ?? 0),
      loanOutstanding: round2(party.balances?.loanOutstanding ?? 0),
    };

    const wrong = Object.keys(expected).filter((k) => stored[k] !== expected[k]);
    if (wrong.length > 0) {
      bad += 1;
      line(`   DRIFT  ${party.partyCode} ${party.name}`);
      for (const k of wrong) line(`          ${k}: stored ${money(stored[k])}, documents give ${money(expected[k])}`);
    }
  }

  /** Documents pointing at a party that has been removed. */
  const partyIds = new Set(parties.map((p) => String(p._id)));
  const orphanDocs = [
    ...salesByParty.filter((r) => !partyIds.has(String(r._id))).map((r) => ['sale', r._id]),
    ...purchasesByParty.filter((r) => !partyIds.has(String(r._id))).map((r) => ['purchase', r._id]),
    ...loansByParty.filter((r) => !partyIds.has(String(r._id))).map((r) => ['advance', r._id]),
  ];
  for (const [kind, id] of orphanDocs) {
    line(`   ORPHAN ${kind} documents reference party ${id}, which no longer exists`);
  }

  line(`   parties checked: ${parties.length}`);
  record('party balances reconcile', bad);
  record('no orphaned documents', orphanDocs.length);
  if (bad === 0 && orphanDocs.length === 0) line('   OK - every balance matches its documents');
}

/**
 * 5. Invoices: one per sale, and agreeing with it.
 *
 * Section 30 wants every sale to produce an invoice. Since both are written in
 * one transaction, a sale without one means a transaction did not hold.
 */
async function checkInvoices() {
  heading('5. Invoices');

  const [sales, invoices] = await Promise.all([
    Sale.find().select('saleCode grandTotal amountPaid').lean(),
    Invoice.find().select('invoiceCode sale grandTotal amountPaid').lean(),
  ]);

  const bySale = new Map();
  const duplicates = [];
  for (const inv of invoices) {
    const key = String(inv.sale);
    if (bySale.has(key)) duplicates.push(inv.invoiceCode);
    else bySale.set(key, inv);
  }

  const missing = [];
  let mismatched = 0;

  for (const sale of sales) {
    const inv = bySale.get(String(sale._id));
    if (!inv) {
      missing.push(sale.saleCode);
      continue;
    }
    if (round2(inv.grandTotal) !== round2(sale.grandTotal) || round2(inv.amountPaid) !== round2(sale.amountPaid)) {
      mismatched += 1;
      line(
        `   DRIFT  ${inv.invoiceCode} vs ${sale.saleCode}: ` +
          `invoice ${money(inv.grandTotal)}/${money(inv.amountPaid)} paid, ` +
          `sale ${money(sale.grandTotal)}/${money(sale.amountPaid)} paid`,
      );
    }
  }

  const saleIds = new Set(sales.map((s) => String(s._id)));
  const orphanInvoices = invoices.filter((i) => !saleIds.has(String(i.sale))).map((i) => i.invoiceCode);

  for (const code of missing) line(`   MISSING invoice for sale ${code}`);
  for (const code of duplicates) line(`   DUPLICATE invoice ${code} - two invoices for one sale`);
  for (const code of orphanInvoices) line(`   ORPHAN  invoice ${code} references a sale that no longer exists`);

  line(`   sales checked: ${sales.length}, invoices: ${invoices.length}`);
  record('every sale has an invoice', missing.length);
  record('no duplicate invoices', duplicates.length);
  record('invoice totals match their sale', mismatched);
  record('no orphaned invoices', orphanInvoices.length);
  if (!missing.length && !duplicates.length && !mismatched && !orphanInvoices.length) {
    line('   OK - one invoice per sale, all agreeing');
  }
}

/** 6. Product references that no longer resolve. */
async function checkProductReferences() {
  heading('6. Product references');

  const productIds = new Set((await Product.find().select('_id').lean()).map((p) => String(p._id)));

  const [saleRefs, purchaseRefs] = await Promise.all([
    Sale.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.product', rows: { $sum: 1 } } }]),
    Purchase.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.product', rows: { $sum: 1 } } }]),
  ]);

  const dangling = [
    ...saleRefs.filter((r) => !productIds.has(String(r._id))).map((r) => ['sale line', r]),
    ...purchaseRefs.filter((r) => !productIds.has(String(r._id))).map((r) => ['purchase line', r]),
  ];

  for (const [kind, r] of dangling) {
    line(`   ORPHAN ${r.rows} ${kind}(s) reference product ${r._id}, which no longer exists`);
  }

  line(`   products: ${productIds.size}`);
  record('no dangling product references', dangling.length);
  if (dangling.length === 0) {
    line('   OK - every line item resolves');
    line('   (line items also carry a name snapshot, so a historic document still');
    line('    reads correctly even if a product is later renamed)');
  }
}

// ---------------------------------------------------------------------------

try {
  const { replicaSet } = await connectDatabase();
  line(`\nIntegrity check - Nirmala Enterprises (replica set: ${replicaSet})`);
  line('Read-only. Nothing below is modified.');

  await checkStock();
  await checkLoans();
  await checkDocuments();
  await checkPartyBalances();
  await checkInvoices();
  await checkProductReferences();

  heading('Summary');
  for (const c of checks) {
    line(`   ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` (${c.count})`}`);
  }

  if (problems.length === 0) {
    line('\nAll checks passed. Every derived figure agrees with the documents');
    line('and the ledger it was derived from.\n');
  } else {
    line(`\n${problems.length} check(s) failed.`);
    line('The ledger and the documents are authoritative - the caches are not.');
    line('Investigate the cause before repairing, then run:  npm run recompute\n');
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`\nVerification could not run: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
