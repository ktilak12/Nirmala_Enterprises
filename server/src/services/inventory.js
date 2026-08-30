import { withTransaction } from '../config/db.js';
import { InventoryTxn } from '../models/InventoryTxn.js';
import { Product } from '../models/Product.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round3 } from '../utils/money.js';
import { writeAudit } from './audit.js';
import { postMovement, recomputeProductStock } from './ledger.js';

/**
 * Manual stock movements (Section 20).
 *
 * Section 20 is explicit: "Do not simply let employees manually change current
 * stock." So there is no endpoint anywhere that sets `currentStock` to a number.
 * The only way a human can move stock outside a sale or purchase is to record a
 * movement here, which:
 *
 *   - names a movement type, so the reason is classified, not free text alone
 *   - demands a written reason for ADJUSTMENT and DAMAGE (enforced in the model)
 *   - leaves a permanent, attributed row in the ledger
 *   - is audited
 *
 * A stock-take that finds 5 bags missing therefore reads as "ADJUSTMENT -5,
 * 'physical count 14 Aug, 5 bags unaccounted', entered by Ramesh" forever -
 * not as a silently edited number.
 */

/** Movement types a person may record directly. */
export const MANUAL_TXN_TYPES = Object.freeze([
  'OPENING',    // stock on hand when the system went live
  'RETURN',     // goods coming back from a customer
  'DAMAGE',     // spoilage, pest damage, spillage - reason required
  'ADJUSTMENT', // physical-count correction - reason required
  'TRANSFER',
]);

export async function recordManualMovement({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const type = payload.type;
    if (!MANUAL_TXN_TYPES.includes(type)) {
      throw badRequest(
        `${type} movements are created by the sales and purchase screens, not by hand. ` +
          `Choose one of: ${MANUAL_TXN_TYPES.join(', ')}.`,
      );
    }

    const qtyDelta = round3(payload.qtyDelta);
    if (qtyDelta === 0) throw badRequest('Quantity cannot be zero.');

    // Direction is part of the meaning of the type, so guard against a typo
    // producing a "damage" that increases stock.
    if (type === 'DAMAGE' && qtyDelta > 0) {
      throw badRequest('A damage movement must reduce stock. Enter the quantity as negative.');
    }
    if (type === 'OPENING' && qtyDelta < 0) {
      throw badRequest('Opening stock cannot be negative.');
    }
    if (type === 'RETURN' && qtyDelta < 0) {
      throw badRequest(
        'A customer return increases stock. To send goods back to a supplier, ' +
          'record it as an ADJUSTMENT with the reason stated.',
      );
    }

    const product = await Product.findById(payload.productId).session(session);
    if (!product) throw notFound('Product not found.');

    if (type === 'OPENING') {
      const existing = await InventoryTxn.countDocuments({
        product: product._id,
        type: 'OPENING',
      }).session(session);
      if (existing > 0) {
        throw badRequest(
          `${product.name} already has an opening balance. Correct it with an ` +
            'ADJUSTMENT so the original figure stays on record.',
        );
      }
    }

    const { txn, balanceBefore, balanceAfter } = await postMovement({
      session,
      productId: product._id,
      type,
      qtyDelta,
      unitCost: payload.unitCost ?? product.avgCost,
      remarks: payload.remarks ?? '',
      actor,
      date: payload.date ? new Date(payload.date) : new Date(),
    });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'InventoryTxn',
      entityId: txn._id,
      entityCode: txn.txnCode,
      summary:
        `${type} of ${qtyDelta} on ${product.productCode} ${product.name}` +
        (payload.remarks ? `: ${payload.remarks}` : ''),
      changes: [{ field: 'currentStock', from: balanceBefore, to: balanceAfter }],
      req,
    });

    return { txn, balanceBefore, balanceAfter };
  });
}

/**
 * The stock ledger for one product (Section 21) - a running statement showing
 * how the current balance was arrived at, with each row linked back to the sale
 * or purchase that caused it.
 */
export async function getProductLedger(productId, { from, to, limit = 500 } = {}) {
  const product = await Product.findById(productId)
    .populate('category', 'name kind')
    .populate('unit', 'name symbol');
  if (!product) throw notFound('Product not found.');

  const filter = { product: productId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const txns = await InventoryTxn.find(filter).sort({ date: -1, _id: -1 }).limit(limit);
  const integrity = await recomputeProductStock(productId);

  return { product, txns, integrity };
}
