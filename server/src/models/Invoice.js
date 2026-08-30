import mongoose from 'mongoose';
import { moneyField, quantityField } from '../utils/money.js';
import { PAYMENT_STATUS } from './Sale.js';

const invoiceItemSchema = new mongoose.Schema(
  {
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    unitSymbol: { type: String, default: '' },
    qty: quantityField({ required: true }),
    rate: moneyField({ required: true }),
    discount: moneyField(),
    taxRatePct: { type: Number, default: 0 },
    taxAmount: moneyField(),
    lineTotal: moneyField(),
  },
  { _id: false },
);

/**
 * A printed invoice, created in the same transaction as its sale.
 *
 * Everything is SNAPSHOTTED - the company's own address and GSTIN as well as
 * the customer's details and every line. A reprint two years from now must
 * reproduce exactly what the customer was handed, even if the business has
 * since moved premises, re-registered for tax, or renamed a product.
 *
 * `taxEnabled` records whether tax was in force when the invoice was raised.
 * The PDF and print view hide the tax columns entirely when it is false, so a
 * tax-free business never shows a misleading zero-tax column.
 */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
    saleCode: { type: String, required: true },

    date: { type: Date, required: true, default: Date.now, index: true },

    seller: {
      name: { type: String, required: true },
      address: { type: String },
      phone: { type: String },
      email: { type: String },
      gstin: { type: String },
    },

    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    buyer: {
      partyCode: { type: String },
      name: { type: String, required: true },
      phone: { type: String },
      address: { type: String },
      village: { type: String },
      gstin: { type: String },
    },

    items: { type: [invoiceItemSchema], required: true },

    subtotal: moneyField(),
    discountTotal: moneyField(),
    taxEnabled: { type: Boolean, default: false },
    taxTotal: moneyField(),
    grandTotal: moneyField(),
    amountPaid: moneyField(),
    outstanding: moneyField({ min: undefined }),
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'UNPAID' },

    amountInWords: { type: String },
    terms: { type: String },
    footerNote: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String },
  },
  { timestamps: true },
);

invoiceSchema.index({ invoiceCode: 'text', 'buyer.name': 'text' });
invoiceSchema.index({ date: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
