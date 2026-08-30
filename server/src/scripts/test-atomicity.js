import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, withTransaction } from '../config/db.js';
import { Counter } from '../models/Counter.js';
import { Invoice } from '../models/Invoice.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { InventoryTxn } from '../models/InventoryTxn.js';
import { User } from '../models/User.js';
import { nextEntityCode } from '../services/numbering.js';
import { createSale } from '../services/sales.js';

/**
 * Atomicity test - the single most important check in the build.
 *
 *   npm run test:atomicity
 *
 * Section 41 asks that "one transaction should update every related part of the
 * business automatically." The word that carries the weight is *transaction*: a
 * sale writes an inventory movement, a sale document, an invoice, maybe a
 * payment, and a customer balance, and either ALL of them happen or NONE do. A
 * half-completed sale - stock gone but no invoice, or an invoice with no stock
 * movement - is exactly the corruption an accounting system must never produce.
 *
 * On MongoDB that guarantee exists only if the server is a replica set. A plain
 * standalone `mongod` silently ignores the transaction and commits each write as
 * it goes, so this test is also how we know the replica set is real and doing
 * its job. If any check below fails, do not trust the books until it passes.
 *
 * It is written to leave the database exactly as it found it: the whole point is
 * that the writes it attempts are supposed to roll back, so a passing run
 * changes nothing. It reads demo data but creates nothing that survives.
 */

let failures = 0;
const log = (msg = '') => process.stdout.write(`${msg}\n`);
const heading = (text) => log(`\n${text}\n${'─'.repeat(text.length)}`);

const assert = (ok, label, detail = '') => {
  if (ok) {
    log(`   PASS  ${label}`);
  } else {
    failures += 1;
    log(`   FAIL  ${label}${detail ? ` - ${detail}` : ''}`);
  }
};

const seqOf = async (key) => (await Counter.findById(key))?.seq ?? 0;

/**
 * Test 1: a deliberate throw part-way through a transaction must undo every
 * write that preceded it - including the atomic counter increment, which is the
 * write most likely to leak because counters are so often bumped outside the
 * caller's session.
 */
async function testRawRollback() {
  heading('1. A mid-transaction throw rolls everything back');

  const sentinelName = '__ATOMICITY_PROBE__';
  const counterBefore = await seqOf('PTY');

  let threw = false;
  try {
    await withTransaction(async (session) => {
      const partyCode = await nextEntityCode('PTY', { session }); // bumps the PTY counter
      await Party.create(
        [{ partyCode, name: sentinelName, roles: ['customer'] }],
        { session },
      );
      // Everything above is now pending. Fail before commit.
      throw new Error('deliberate failure to force a rollback');
    });
  } catch (error) {
    threw = error.message.includes('deliberate failure');
  }

  assert(threw, 'the transaction surfaced the error to the caller');

  const leaked = await Party.findOne({ name: sentinelName }).lean();
  assert(!leaked, 'the party created before the throw did NOT persist', leaked ? 'a row leaked' : '');

  const counterAfter = await seqOf('PTY');
  assert(
    counterAfter === counterBefore,
    'the counter increment rolled back too',
    `before ${counterBefore}, after ${counterAfter}`,
  );
}

/**
 * Test 2: a sale that exceeds available stock must be refused with a 400, and
 * must leave no trace - no Sale, no Invoice, no stock movement, and the stock
 * itself untouched. This is the acceptance criterion from the plan.
 */
async function testOversellLeavesNothing(actor) {
  heading('2. An oversell is refused and leaves nothing behind');

  const product = await Product.findOne({ name: 'Urea 46% N' });
  const buyer = await Party.findOne({ roles: 'customer' });
  if (!product || !buyer) {
    assert(false, 'demo data present', 'run `npm run seed:demo` first');
    return;
  }

  const year = new Date().getFullYear();
  const before = {
    stock: product.currentStock,
    sales: await Sale.countDocuments({}),
    invoices: await Invoice.countDocuments({}),
    movements: await InventoryTxn.countDocuments({ product: product._id }),
    saleSeq: await seqOf(`SALE-${year}`),
    stkSeq: await seqOf(`STK-${year}`),
  };

  const attempt = product.currentStock + 1000; // guaranteed to exceed stock
  log(`   attempting to sell ${attempt} of ${product.name} (only ${before.stock} in stock)...`);

  let err = null;
  try {
    await createSale({
      payload: {
        partyId: String(buyer._id),
        items: [{ productId: String(product._id), qty: attempt, rate: product.sellingPrice }],
        amountPaid: 0,
      },
      actor,
      req: null,
    });
  } catch (error) {
    err = error;
  }

  assert(err !== null, 'the oversell was refused');
  assert(err?.statusCode === 400, 'it was rejected as a 400 (bad request), not a 500', `status ${err?.statusCode}`);
  assert(/insufficient stock/i.test(err?.message ?? ''), 'the message explains why', err?.message);

  const after = {
    stock: (await Product.findById(product._id)).currentStock,
    sales: await Sale.countDocuments({}),
    invoices: await Invoice.countDocuments({}),
    movements: await InventoryTxn.countDocuments({ product: product._id }),
    saleSeq: await seqOf(`SALE-${year}`),
    stkSeq: await seqOf(`STK-${year}`),
  };

  assert(after.stock === before.stock, 'stock is unchanged', `${before.stock} -> ${after.stock}`);
  assert(after.sales === before.sales, 'no Sale document was written', `${before.sales} -> ${after.sales}`);
  assert(after.invoices === before.invoices, 'no Invoice was written', `${before.invoices} -> ${after.invoices}`);
  assert(after.movements === before.movements, 'no stock movement was written', `${before.movements} -> ${after.movements}`);

  // The sharp one: a rolled-back sale must not consume a document number, or the
  // next real sale would skip one and the ledger would look tampered with.
  assert(
    after.saleSeq === before.saleSeq && after.stkSeq === before.stkSeq,
    'no document number was consumed by the failed sale',
    `SALE ${before.saleSeq}->${after.saleSeq}, STK ${before.stkSeq}->${after.stkSeq}`,
  );
}

// ---------------------------------------------------------------------------

try {
  const { replicaSet } = await connectDatabase();
  log(`\nAtomicity test - Nirmala Enterprises (replica set: ${replicaSet})`);

  const actor = await User.findOne({ role: 'ADMIN' });
  if (!actor) {
    log('\nNo admin user found. Run `npm run seed` first.\n');
    process.exitCode = 1;
  } else {
    await testRawRollback();
    await testOversellLeavesNothing(actor);

    heading('Result');
    if (failures === 0) {
      log('   All atomicity checks passed. Transactions are ACID on this database:');
      log('   composite writes commit all-or-nothing, and a failure leaves no');
      log('   partial documents and consumes no document numbers.\n');
    } else {
      log(`   ${failures} check(s) FAILED.`);
      log('   Transactions are NOT holding. The most likely cause is that mongod is');
      log('   running standalone rather than as replica set rs0. Do not trust the');
      log('   books until this passes.\n');
      process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(`\nAtomicity test could not run: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});
}
