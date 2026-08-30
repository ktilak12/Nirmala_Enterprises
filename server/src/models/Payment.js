import mongoose from 'mongoose';
import { moneyField } from '../utils/money.js';

export const PAYMENT_METHODS = Object.freeze([
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'ADJUSTMENT',
  'OTHER',
]);

/**
 * The central record of every movement of money (Section 29).
 *
 * `direction` is IN when money reaches the business (customer paying an
 * invoice, farmer repaying an advance) and OUT when it leaves (settling a
 * farmer for his corn, paying a supplier, an expense, disbursing an advance).
 * Because sales, purchases, loans and expenses all write here, the Payments
 * screen alone is enough to reconcile a day's cash box.
 */
const paymentSchema = new mongoose.Schema(
  {
    paymentCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    date: { type: Date, required: true, default: Date.now, index: true },

    direction: { type: String, enum: ['IN', 'OUT'], required: true, index: true },
    amount: moneyField({ required: true, min: 0.01 }),

    method: { type: String, enum: PAYMENT_METHODS, default: 'CASH', index: true },
    reference: { type: String, trim: true },

    /** Null for an expense, which has no counterparty in `parties`. */
    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null, index: true },
    partyName: { type: String },

    /** What this payment settles, for drill-through. */
    refModel: {
      type: String,
      enum: ['Sale', 'Purchase', 'Loan', 'LoanPayment', 'Expense', null],
      default: null,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refCode: { type: String, trim: true },

    purpose: {
      type: String,
      enum: [
        'SALE_RECEIPT',
        'PURCHASE_SETTLEMENT',
        'LOAN_DISBURSEMENT',
        'LOAN_REPAYMENT',
        'EXPENSE',
        'OTHER',
      ],
      default: 'OTHER',
      index: true,
    },

    remarks: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordedByName: { type: String },
  },
  { timestamps: true },
);

paymentSchema.index({ paymentCode: 'text', partyName: 'text', reference: 'text' });
paymentSchema.index({ date: -1, direction: 1 });
paymentSchema.index({ party: 1, date: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);

export const EXPENSE_CATEGORIES = Object.freeze([
  'TRANSPORT',
  'LABOUR',
  'LOADING_UNLOADING',
  'WAREHOUSE',
  'PACKAGING',
  'ELECTRICITY',
  'SALARIES',
  'REPAIRS',
  'MAINTENANCE',
  'FUEL',
  'OFFICE',
  'OTHER',
]);

/**
 * Operating expenses (Section 30). Without these the dashboard can only show
 * gross margin; with them it can show real operating profit (Section 42).
 */
const expenseSchema = new mongoose.Schema(
  {
    expenseCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: moneyField({ required: true, min: 0.01 }),
    date: { type: Date, required: true, default: Date.now, index: true },
    method: { type: String, enum: PAYMENT_METHODS, default: 'CASH' },
    reference: { type: String, trim: true },

    /** Optional - e.g. a transporter who also exists as a supplier. */
    party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    partyName: { type: String },

    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    paymentCode: { type: String },

    remarks: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordedByName: { type: String },
  },
  { timestamps: true },
);

expenseSchema.index({ date: -1, category: 1 });
expenseSchema.index({ expenseCode: 'text', description: 'text' });

export const Expense = mongoose.model('Expense', expenseSchema);
