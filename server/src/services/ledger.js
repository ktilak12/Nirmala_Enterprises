import { InventoryTxn } from '../models/InventoryTxn.js';
import { Product } from '../models/Product.js';
import { getSettings } from '../models/Setting.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round2, round3 } from '../utils/money.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';

/**
 * THE stock chokepoint.
 *
 * Nothing anywhere else in the codebase may write `Product.currentStock`
 * directly. Every movement - sale, purchase, procurement, damage, physical
 * count correction - comes through here, which guarantees that the ledger and
 * the cached balance are written together in one transaction and can never
 * disagree.
 *
 * This is what makes Section 20 true structurally:
 *     opening + purchases + returns - sales - damage +/- adjustments = current
 */

/** Movement types that add stock; used to decide whether cost is re-averaged. */
const INBOUND = new Set(['OPENING', 'PURCHASE']);

export async function postMovement({
  session,
  productId,
  type,
  qtyDelta,
  unitCost = 0,
  refModel = null,
  refId = null,
  refCode = null,
  remarks = '',
  actor,
  date = new Date(),
}) {
  if (!session) {
    // A stock movement outside a transaction could commit while its parent
    // sale fails, which is precisely the drift this module exists to prevent.
    throw new Error('postMovement requires a transaction session.');
  }

  const delta = round3(qtyDelta);
  if (delta === 0) throw badRequest('A stock movement cannot be for zero quantity.');

  const product = await Product.findById(productId).session(session);
  if (!product) throw notFound(`Product ${productId} not found.`);

  const settings = await getSettings(session);
  const before = round3(product.currentStock);
  const after = round3(before + delta);

  if (delta < 0 && after < 0 && settings.inventory.blockNegativeStock) {
    throw badRequest(
      `Insufficient stock for ${product.name}. ` +
        `Available ${before}, tried to remove ${Math.abs(delta)}.`,
      { productCode: product.productCode, available: before, requested: Math.abs(delta) },
    );
  }

  /**
   * Weighted-average cost, recalculated only on receipts (Section 43).
   *
   * Issuing stock does not change the average cost of what remains. If the
   * book balance is at or below zero the previous average is meaningless, so
   * the incoming cost simply becomes the new average.
   */
  let avgCost = round2(product.avgCost);
  if (INBOUND.has(type) && delta > 0) {
    avgCost =
      before > 0
        ? round2((before * avgCost + delta * round2(unitCost)) / (before + delta))
        : round2(unitCost);
  }

  const txnCode = await nextDocNumber(DOC_PREFIX.STOCK, { session, date });

  const [txn] = await InventoryTxn.create(
    [
      {
        txnCode,
        product: product._id,
        productName: product.name,
        type,
        qtyDelta: delta,
        unitCost: round2(unitCost),
        balanceAfter: after,
        refModel,
        refId,
        refCode,
        remarks,
        date,
        user: actor._id,
        userName: actor.name,
      },
    ],
    { session },
  );

  product.currentStock = after;
  product.avgCost = avgCost;
  await product.save({ session });

  return { txn, product, balanceBefore: before, balanceAfter: after };
}

/**
 * Recompute a product's stock and average cost from the ledger alone.
 *
 * This is the compensating control for MongoDB not enforcing referential
 * integrity itself: the cached figures are only ever a convenience, and this
 * function proves - or repairs - them from the append-only source of truth.
 */
export async function recomputeProductStock(productId, { session = null, persist = false } = {}) {
  const product = await Product.findById(productId).session(session);
  if (!product) throw notFound(`Product ${productId} not found.`);

  const query = InventoryTxn.find({ product: productId }).sort({ date: 1, _id: 1 });
  if (session) query.session(session);
  const txns = await query;

  let stock = 0;
  let avgCost = 0;

  for (const t of txns) {
    if (INBOUND.has(t.type) && t.qtyDelta > 0) {
      avgCost =
        stock > 0
          ? round2((stock * avgCost + t.qtyDelta * t.unitCost) / (stock + t.qtyDelta))
          : round2(t.unitCost);
    }
    stock = round3(stock + t.qtyDelta);
  }

  const drift = {
    productCode: product.productCode,
    productName: product.name,
    cachedStock: round3(product.currentStock),
    ledgerStock: stock,
    stockDrift: round3(product.currentStock - stock),
    cachedAvgCost: round2(product.avgCost),
    ledgerAvgCost: avgCost,
    txnCount: txns.length,
  };
  drift.matches = drift.stockDrift === 0 && drift.cachedAvgCost === drift.ledgerAvgCost;

  if (persist && (drift.stockDrift !== 0 || drift.cachedAvgCost !== avgCost)) {
    product.currentStock = stock;
    product.avgCost = avgCost;
    await product.save({ session });
    drift.repaired = true;
  }

  return drift;
}

/**
 * The same ledger-versus-cache check across the whole catalogue, in two queries
 * rather than two per product.
 *
 * `recomputeProductStock` has to walk a product's movements in order because the
 * weighted-average cost depends on the sequence of receipts. Stock does not - it
 * is a plain sum - so the fleet-wide check can be a single `$group`, which keeps
 * the integrity screen usable on a catalogue of any size. Anything this reports
 * as drifted is then worth examining with the per-product function, which also
 * verifies the cost.
 */
export async function auditAllStock() {
  const [sums, products] = await Promise.all([
    InventoryTxn.aggregate([
      { $group: { _id: '$product', ledgerStock: { $sum: '$qtyDelta' }, txnCount: { $sum: 1 } } },
    ]),
    Product.find().select('productCode name currentStock').lean(),
  ]);

  const byProduct = new Map(sums.map((s) => [String(s._id), s]));

  const rows = products.map((p) => {
    const found = byProduct.get(String(p._id));
    const ledgerStock = round3(found?.ledgerStock ?? 0);
    const cachedStock = round3(p.currentStock ?? 0);

    return {
      productId: String(p._id),
      productCode: p.productCode,
      productName: p.name,
      cachedStock,
      ledgerStock,
      stockDrift: round3(cachedStock - ledgerStock),
      txnCount: found?.txnCount ?? 0,
      matches: round3(cachedStock - ledgerStock) === 0,
    };
  });

  /**
   * Ledger rows whose product no longer exists. MongoDB has no foreign keys, so
   * this is exactly the orphan the relational database would have prevented -
   * worth surfacing rather than silently skipping.
   */
  const knownIds = new Set(products.map((p) => String(p._id)));
  const orphans = sums
    .filter((s) => !knownIds.has(String(s._id)))
    .map((s) => ({ productId: String(s._id), txnCount: s.txnCount, ledgerStock: round3(s.ledgerStock) }));

  return {
    checked: rows.length,
    drifted: rows.filter((r) => !r.matches),
    orphans,
  };
}
