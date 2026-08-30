import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Loan, LoanPayment } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { getSettings } from '../models/Setting.js';
import { recomputeProductStock } from '../services/ledger.js';
import { recomputeLoan } from '../services/lending.js';
import { paymentStatusFor } from '../services/payments.js';
import { round2 } from '../utils/money.js';

/**
 * Recompute and repair the derived caches from the authoritative records.
 *
 *   node src/scripts/recompute-stock.js            dry run - report only
 *   node src/scripts/recompute-stock.js --apply    write the corrected figures
 *
 * This is the repair half of the pair whose diagnostic half is
 * verify-integrity.js. It repairs EXACTLY what that script checks, and nothing
 * it treats as authoritative:
 *
 *   repaired (derived)              re-derived from (authoritative)
 *   ────────────────────────────    ──────────────────────────────────────────
 *   product.currentStock, avgCost   the inventory ledger, in date order
 *   loan.adjustmentTotal,           the loan's adjustment lines, the LoanPayment
 *        totalRepaid, outstanding,  collection, and principal
 *        status
 *   sale/purchase.outstanding,      grandTotal/netPayable and amountPaid
 *        paymentStatus
 *   purchase.adjustmentTotal,       the purchase's adjustment lines and gross
 *        netPayable
 *   party.balances.*                the repaired documents and loans above
 *
 * Two deliberate choices:
 *
 * It defaults to a DRY RUN. `verify` tells you the books have drifted; before
 * this script overwrites anything you should know why they drifted, because the
 * cache is the symptom and something upstream is the cause. Running it without
 * `--apply` prints precisely what it would change and touches nothing.
 *
 * It does not touch `amountPaid`, `grandTotal`, `grossAmount`, or the ledger
 * itself. Those are the source of truth; if one of them is wrong, that is a
 * different and more serious problem than a stale cache, and silently
 * "repairing" a cache to match a bad total would hide it. This script only ever
 * makes the caches agree with the records, never the other way round.
 *
 * Order matters: documents and loans are repaired first, then party balances are
 * summed from the already-corrected documents.
 */

const APPLY = process.argv.includes('--apply');

const log = (msg = '') => process.stdout.write(`${msg}\n`);
const heading = (text) => log(`\n${text}\n${'─'.repeat(text.length)}`);
const money = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

let changes = 0;
const note = (msg) => {
  changes += 1;
  log(`   ${APPLY ? 'FIXED ' : 'would fix'}  ${msg}`);
};

/** 1. Products - stock and weighted-average cost, from the ledger. */
async function repairProducts() {
  heading('1. Product stock and cost');
  const products = await Product.find().select('_id').lean();
  let touched = 0;

  for (const { _id } of products) {
    // persist only when applying; otherwise this is a pure recomputation that
    // returns the drift without writing.
    const drift = await recomputeProductStock(_id, { persist: APPLY });
    const stockOff = drift.stockDrift !== 0;
    const costOff = drift.cachedAvgCost !== drift.ledgerAvgCost;
    if (stockOff || costOff) {
      touched += 1;
      const parts = [];
      if (stockOff) parts.push(`stock ${drift.cachedStock} -> ${drift.ledgerStock}`);
      if (costOff) parts.push(`avg cost ${money(drift.cachedAvgCost)} -> ${money(drift.ledgerAvgCost)}`);
      note(`${drift.productCode} ${drift.productName}: ${parts.join(', ')}`);
    }
  }

  log(`   products checked: ${products.length}, needing repair: ${touched}`);
}

/** 2. Loans - adjustment total, repaid total, outstanding, status. */
async function repairLoans(graceDays) {
  heading('2. Advances');
  const loans = await Loan.find();
  const repaid = await LoanPayment.aggregate([
    { $group: { _id: '$loan', paid: { $sum: '$amount' } } },
  ]);
  const paidByLoan = new Map(repaid.map((r) => [String(r._id), round2(r.paid)]));
  let touched = 0;

  for (const loan of loans) {
    const before = {
      adjustmentTotal: round2(loan.adjustmentTotal),
      totalRepaid: round2(loan.totalRepaid),
      outstanding: round2(loan.outstanding),
      status: loan.status,
    };

    // totalRepaid is a cache of the LoanPayment ledger; refresh it first, then
    // recomputeLoan derives adjustmentTotal, outstanding and status from it.
    loan.totalRepaid = paidByLoan.get(String(loan._id)) ?? 0;
    recomputeLoan(loan, { graceDays });

    const diffs = [];
    if (round2(loan.adjustmentTotal) !== before.adjustmentTotal) {
      diffs.push(`adjustments ${money(before.adjustmentTotal)} -> ${money(loan.adjustmentTotal)}`);
    }
    if (round2(loan.totalRepaid) !== before.totalRepaid) {
      diffs.push(`repaid ${money(before.totalRepaid)} -> ${money(loan.totalRepaid)}`);
    }
    if (round2(loan.outstanding) !== before.outstanding) {
      diffs.push(`outstanding ${money(before.outstanding)} -> ${money(loan.outstanding)}`);
    }
    if (loan.status !== before.status) diffs.push(`status ${before.status} -> ${loan.status}`);

    if (diffs.length > 0) {
      touched += 1;
      note(`${loan.loanCode} (${loan.partyName}): ${diffs.join(', ')}`);
      if (APPLY) await loan.save();
    }
  }

  log(`   advances checked: ${loans.length}, needing repair: ${touched}`);
}

/** 3. Sales - outstanding and payment status. */
async function repairSales() {
  heading('3. Sales');
  const sales = await Sale.find();
  let touched = 0;

  for (const sale of sales) {
    const outstanding = round2(sale.grandTotal - sale.amountPaid);
    const status = paymentStatusFor(sale.grandTotal, sale.amountPaid);
    if (round2(sale.outstanding) !== outstanding || sale.paymentStatus !== status) {
      touched += 1;
      note(
        `${sale.saleCode} (${sale.partyName}): ` +
          `${money(sale.outstanding)}/${sale.paymentStatus} -> ${money(outstanding)}/${status}`,
      );
      sale.outstanding = outstanding;
      sale.paymentStatus = status;
      if (APPLY) await sale.save();
    }
  }

  log(`   sales checked: ${sales.length}, needing repair: ${touched}`);
}

/** 4. Purchases - adjustment total, net payable, outstanding, status. */
async function repairPurchases() {
  heading('4. Purchases and procurements');
  const purchases = await Purchase.find();
  let touched = 0;

  for (const p of purchases) {
    const adjustmentTotal = round2(
      (p.adjustments ?? []).reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    );
    // Section 25: gross - adjustments = net payable.
    const netPayable = round2(p.grossAmount - adjustmentTotal);
    const outstanding = round2(netPayable - p.amountPaid);
    const status = paymentStatusFor(netPayable, p.amountPaid);

    const changed =
      round2(p.adjustmentTotal) !== adjustmentTotal ||
      round2(p.netPayable) !== netPayable ||
      round2(p.outstanding) !== outstanding ||
      p.paymentStatus !== status;

    if (changed) {
      touched += 1;
      note(
        `${p.purchaseCode} (${p.partyName}): net ${money(p.netPayable)} -> ${money(netPayable)}, ` +
          `${money(p.outstanding)}/${p.paymentStatus} -> ${money(outstanding)}/${status}`,
      );
      p.adjustmentTotal = adjustmentTotal;
      p.netPayable = netPayable;
      p.outstanding = outstanding;
      p.paymentStatus = status;
      if (APPLY) await p.save();
    }
  }

  log(`   purchases checked: ${purchases.length}, needing repair: ${touched}`);
}

/**
 * 5. Party balances - summed from the documents repaired above.
 *
 * Runs last on purpose. If applying, steps 2-4 have already written the correct
 * per-document figures, so these sums are over corrected data. If a dry run,
 * they are over the current (possibly stale) documents - which is honest: it
 * shows what the balances would be if you repaired nothing else, and re-running
 * with --apply repairs everything in the right order in one pass.
 */
async function repairPartyBalances() {
  heading('5. Party balances');

  const [parties, salesByParty, purchasesByParty, loansByParty] = await Promise.all([
    Party.find(),
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
  let touched = 0;

  for (const party of parties) {
    const id = String(party._id);
    const want = {
      receivable: receivables.get(id) ?? 0,
      payable: payables.get(id) ?? 0,
      loanOutstanding: advances.get(id) ?? 0,
    };
    const have = {
      receivable: round2(party.balances?.receivable ?? 0),
      payable: round2(party.balances?.payable ?? 0),
      loanOutstanding: round2(party.balances?.loanOutstanding ?? 0),
    };

    const wrong = Object.keys(want).filter((k) => have[k] !== want[k]);
    if (wrong.length > 0) {
      touched += 1;
      note(
        `${party.partyCode} ${party.name}: ` +
          wrong.map((k) => `${k} ${money(have[k])} -> ${money(want[k])}`).join(', '),
      );
      party.balances.receivable = want.receivable;
      party.balances.payable = want.payable;
      party.balances.loanOutstanding = want.loanOutstanding;
      if (APPLY) await party.save();
    }
  }

  log(`   parties checked: ${parties.length}, needing repair: ${touched}`);
}

// ---------------------------------------------------------------------------

try {
  const { replicaSet } = await connectDatabase();
  log(`\nRecompute derived caches - Nirmala Enterprises (replica set: ${replicaSet})`);
  log(APPLY ? 'APPLYING corrections - caches will be overwritten to match the records.' : 'DRY RUN - nothing will be written. Add --apply to repair.');

  const settings = await getSettings();
  const graceDays = settings?.lending?.overdueGraceDays ?? 0;

  await repairProducts();
  await repairPurchases();
  await repairSales();
  await repairLoans(graceDays);
  await repairPartyBalances();

  heading('Summary');
  if (changes === 0) {
    log('   Nothing to repair. Every cache already agrees with the records.\n');
  } else if (APPLY) {
    log(`   ${changes} correction(s) applied. Run \`npm run verify\` to confirm zero drift.\n`);
  } else {
    log(`   ${changes} correction(s) needed. Re-run with --apply to write them:`);
    log('   node src/scripts/recompute-stock.js --apply\n');
  }
} catch (error) {
  process.stderr.write(`\nRecompute failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});
}
