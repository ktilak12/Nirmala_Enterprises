import mongoose from 'mongoose';
import { badRequest } from '../utils/errors.js';
import { moneyField, quantityField } from '../utils/money.js';

export const INVENTORY_TXN_TYPES = Object.freeze([
  'OPENING',    // opening stock when a product is first set up
  'PURCHASE',   // stock in, from supplier or farmer procurement
  'SALE',       // stock out, to customer or commodity buyer
  'RETURN',     // signed: customer return in, or return to supplier out
  'DAMAGE',     // stock out, spoilage/pest/handling loss
  'ADJUSTMENT', // signed: physical count correction, requires a reason
  'TRANSFER',   // signed: movement between locations
]);

/**
 * The stock ledger - append-only, and the SINGLE SOURCE OF TRUTH for stock.
 *
 * Section 20 of the concept document is explicit that staff must not simply
 * overwrite a current-stock number. Instead:
 *
 *     opening + purchases + returns - sales - damage - adjustments = current
 *
 * So every movement is a row here, `Product.currentStock` is only a cache of
 * the running sum, and the two are always written in the same transaction.
 * Rows are never updated or deleted; a mistake is corrected by posting an
 * opposing entry, which keeps the audit trail intact.
 */
const inventoryTxnSchema = new mongoose.Schema(
  {
    txnCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },   // snapshot, survives renames
    type: { type: String, required: true, enum: INVENTORY_TXN_TYPES, index: true },

    /** Signed: positive is stock in, negative is stock out. */
    qtyDelta: quantityField({ required: true }),

    /** Cost per unit for inbound movements; drives weighted-average valuation. */
    unitCost: moneyField(),

    /** Running balance immediately after this row was posted. */
    balanceAfter: quantityField(),

    /** What caused the movement, for drill-through from the stock ledger. */
    refModel: { type: String, enum: ['Sale', 'Purchase', 'Adjustment', null], default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refCode: { type: String, trim: true },

    /** Mandatory for ADJUSTMENT and DAMAGE - no silent stock changes. */
    remarks: { type: String, trim: true },

    date: { type: Date, required: true, default: Date.now, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String },
  },
  { timestamps: true },
);

// Product ledger view, newest first.
inventoryTxnSchema.index({ product: 1, date: -1, _id: -1 });
// Stock-movement report by period and type.
inventoryTxnSchema.index({ date: -1, type: 1 });

/**
 * A reason is mandatory for the two movement types that destroy or invent stock
 * without a document behind them (Section 20).
 *
 * Written as a throwing function rather than the older `function (next)` style:
 * Mongoose 9 invokes document middleware with no callback argument, so a
 * `return next()` here fails with "next is not a function" - and, worse, it
 * fails inside validation, which is precisely where it must not.
 */
inventoryTxnSchema.pre('validate', function requireReason() {
  if (['ADJUSTMENT', 'DAMAGE'].includes(this.type) && !this.remarks?.trim()) {
    throw badRequest(`A written reason is required for a ${this.type} stock movement.`);
  }
});

export const InventoryTxn = mongoose.model('InventoryTxn', inventoryTxnSchema);
