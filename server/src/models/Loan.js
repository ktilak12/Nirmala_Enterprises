import mongoose from 'mongoose';
import { moneyField, signedMoneyField } from '../utils/money.js';

export const LOAN_STATUS = Object.freeze([
  'ACTIVE',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
]);

export const LOAN_ADJUSTMENT_TYPES = Object.freeze([
  'FEE',
  'INTEREST',
  'DISCOUNT',
  'WRITE_OFF',
  'CORRECTION',
  'OTHER',
]);

/**
 * A manually entered adjustment to a farmer advance.
 *
 * There is deliberately NO interest engine. Section 27 of the concept document
 * says the interest and fee rules must be confirmed with the business and its
 * accountant before implementation, and the decision taken was to record any
 * such amount by hand as a labelled line rather than to accrue it
 * automatically. A positive amount INCREASES what the farmer owes; a negative
 * amount (a discount or write-off) reduces it. Every line records who entered
 * it, and the audit log keeps the before/after.
 */
const loanAdjustmentSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    type: { type: String, enum: LOAN_ADJUSTMENT_TYPES, required: true },
    label: { type: String, required: true, trim: true },
    amount: signedMoneyField({ required: true }),
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enteredByName: { type: String },
  },
  { _id: true },
);

const loanSchema = new mongoose.Schema(
  {
    loanCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    partyName: { type: String, required: true },
    partyPhone: { type: String },

    principal: moneyField({ required: true, min: 0.01 }),
    date: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date, index: true },

    purpose: { type: String, trim: true },
    terms: { type: String, trim: true },

    adjustments: { type: [loanAdjustmentSchema], default: [] },
    adjustmentTotal: signedMoneyField(),

    totalRepaid: moneyField(),

    /**
     * outstanding = principal + adjustmentTotal - totalRepaid
     *
     * Recomputed by the lending service inside the transaction that changes any
     * of its inputs, and independently re-derived by verify-integrity.js.
     */
    outstanding: moneyField({ min: undefined }),

    status: { type: String, enum: LOAN_STATUS, default: 'ACTIVE', index: true },

    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String },
  },
  { timestamps: true },
);

loanSchema.index({ loanCode: 'text', partyName: 'text' });
loanSchema.index({ party: 1, date: -1 });
loanSchema.index({ status: 1, dueDate: 1 });

export const Loan = mongoose.model('Loan', loanSchema);

/**
 * A repayment against an advance.
 *
 * `source` distinguishes cash handed over at the counter (DIRECT) from an
 * amount recovered by deducting it from a harvest settlement
 * (PROCUREMENT_ADJUSTMENT), which is the mechanism the business actually uses
 * most. Both write here, so the loan's repayment history is complete however
 * the money came back.
 */
const loanPaymentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    loanCode: { type: String, required: true },
    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    partyName: { type: String, required: true },

    amount: moneyField({ required: true, min: 0.01 }),
    date: { type: Date, required: true, default: Date.now, index: true },

    method: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT', 'OTHER'],
      default: 'CASH',
    },
    reference: { type: String, trim: true },

    source: {
      type: String,
      enum: ['DIRECT', 'PROCUREMENT_ADJUSTMENT'],
      default: 'DIRECT',
      index: true,
    },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
    purchaseCode: { type: String, default: null },

    /** Loan outstanding immediately after this repayment - Section 28. */
    outstandingAfter: moneyField({ min: undefined }),

    remarks: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordedByName: { type: String },
  },
  { timestamps: true },
);

loanPaymentSchema.index({ loan: 1, date: -1 });

export const LoanPayment = mongoose.model('LoanPayment', loanPaymentSchema);
