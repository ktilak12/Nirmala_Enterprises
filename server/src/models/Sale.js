import mongoose from 'mongoose';
import { moneyField, quantityField } from '../utils/money.js';

export const PAYMENT_STATUS = Object.freeze(['UNPAID', 'PARTIAL', 'PAID']);

/**
 * Line items snapshot the product name, unit symbol and rate at the moment of
 * sale. Without the snapshot, renaming a product or changing its price would
 * silently rewrite history on every invoice ever issued for it.
 */
const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    unitSymbol: { type: String, default: '' },

    qty: quantityField({ required: true, min: 0.001 }),
    rate: moneyField({ required: true }),
    discount: moneyField(),

    taxRatePct: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: moneyField(),

    /** qty * rate - discount + taxAmount */
    lineTotal: moneyField(),

    /** Weighted-average cost at time of sale, so margin is computable later. */
    costAtSale: moneyField(),
  },
  { _id: false },
);

const saleSchema = new mongoose.Schema(
  {
    saleCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    partyName: { type: String, required: true },
    partyPhone: { type: String },

    date: { type: Date, required: true, default: Date.now, index: true },

    items: {
      type: [saleItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A sale must contain at least one line item.',
      },
    },

    subtotal: moneyField(),        // sum of qty*rate
    discountTotal: moneyField(),
    taxTotal: moneyField(),
    grandTotal: moneyField(),

    amountPaid: moneyField(),
    outstanding: moneyField({ min: undefined }),
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'UNPAID', index: true },

    /** Set in the same transaction that creates the sale. */
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceCode: { type: String },

    /** True when the goods sold were commodities rather than retail inputs. */
    isCommoditySale: { type: Boolean, default: false },

    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String },
  },
  { timestamps: true },
);

saleSchema.index({ saleCode: 'text', partyName: 'text' });
saleSchema.index({ party: 1, date: -1 });
saleSchema.index({ date: -1, paymentStatus: 1 });

export const Sale = mongoose.model('Sale', saleSchema);
