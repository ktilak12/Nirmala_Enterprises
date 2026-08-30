import mongoose from 'mongoose';
import { moneyField, quantityField, signedMoneyField } from '../utils/money.js';
import { PAYMENT_STATUS } from './Sale.js';

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productCode: { type: String, required: true },
    productName: { type: String, required: true },
    unitSymbol: { type: String, default: '' },

    qty: quantityField({ required: true, min: 0.001 }),
    rate: moneyField({ required: true }),
    lineTotal: moneyField(),
  },
  { _id: false },
);

export const ADJUSTMENT_TYPES = Object.freeze([
  'LOAN_RECOVERY',  // recovers a farmer advance - also writes a LoanPayment
  'TRANSPORT',
  'LABOUR',
  'QUALITY_CUT',    // moisture/foreign-matter deduction on a commodity lot
  'PACKAGING',
  'ADVANCE_PAID',
  'OTHER',
]);

/**
 * A deduction (or addition) applied to a procurement settlement.
 *
 * Section 25: `Gross Amount - Adjustments = Net Amount`. A POSITIVE amount is
 * therefore DEDUCTED from the gross. Negative amounts are allowed for the
 * occasional addition (a transport reimbursement paid to the farmer).
 *
 * When `type` is LOAN_RECOVERY the procurement service also writes a
 * LoanPayment against `loan` inside the SAME transaction, which is how a
 * harvest settlement clears an advance in one step.
 */
const adjustmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ADJUSTMENT_TYPES, required: true },
    label: { type: String, required: true, trim: true },
    amount: signedMoneyField({ required: true }),
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null },
    loanCode: { type: String, default: null },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    partyName: { type: String, required: true },
    partyPhone: { type: String },

    /**
     * True when buying a harvested commodity from a farmer (Section 25) rather
     * than stock from a trade supplier (Section 24). Procurement is the only
     * flow that may carry LOAN_RECOVERY adjustments.
     */
    isProcurement: { type: Boolean, default: false, index: true },

    date: { type: Date, required: true, default: Date.now, index: true },

    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A purchase must contain at least one line item.',
      },
    },

    grossAmount: moneyField(),          // sum of line totals
    adjustments: { type: [adjustmentSchema], default: [] },
    adjustmentTotal: signedMoneyField(),
    netPayable: moneyField(),           // grossAmount - adjustmentTotal

    amountPaid: moneyField(),
    outstanding: moneyField({ min: undefined }),
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'UNPAID', index: true },

    referenceNo: { type: String, trim: true },   // supplier bill number
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String },
  },
  { timestamps: true },
);

purchaseSchema.index({ purchaseCode: 'text', partyName: 'text' });
purchaseSchema.index({ party: 1, date: -1 });
purchaseSchema.index({ date: -1, isProcurement: 1 });

export const Purchase = mongoose.model('Purchase', purchaseSchema);
