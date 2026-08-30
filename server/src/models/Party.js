import mongoose from 'mongoose';
import { moneyField } from '../utils/money.js';

export const PARTY_ROLES = Object.freeze(['farmer', 'customer', 'supplier']);

/**
 * A person or business Nirmala Enterprises deals with.
 *
 * ONE collection covers farmers, customers and suppliers, because Section 39
 * of the concept document is explicit that Ravi Kumar - who takes an advance,
 * buys fertiliser, and sells his corn - must be a single record holding
 * several relationships rather than three disconnected rows that can never be
 * reconciled. `roles` is an array, so the same party can be a farmer AND a
 * customer AND a supplier, and his 360-degree history in Section 16 falls out
 * naturally.
 *
 * Section 39's example lists "Borrower" alongside those, but it is deliberately
 * NOT one of the roles here. A party is a borrower exactly while an advance is
 * outstanding, which the loans already record - storing it as well would create
 * a second version of that fact, and the stored one would go stale the day the
 * advance was cleared. So it is derived, not kept.
 *
 * Role-specific attributes live in their own sub-documents so a pure customer
 * record is not cluttered with land acreage.
 */
const partySchema = new mongoose.Schema(
  {
    partyCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, index: true },
    altPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    village: { type: String, trim: true, index: true },
    district: { type: String, trim: true },
    pincode: { type: String, trim: true },

    roles: {
      type: [{ type: String, enum: PARTY_ROLES }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A party must have at least one role (farmer, customer or supplier).',
      },
      index: true,
    },

    farmerProfile: {
      landAcres: { type: Number, min: 0, default: 0 },
      primaryCrop: { type: String, trim: true },
      secondaryCrops: [{ type: String, trim: true }],
      bankAccountRef: { type: String, trim: true },
    },
    customerProfile: {
      creditLimit: moneyField(),
      gstin: { type: String, trim: true, uppercase: true },
      businessName: { type: String, trim: true },
    },
    supplierProfile: {
      gstin: { type: String, trim: true, uppercase: true },
      businessName: { type: String, trim: true },
      materialTypes: [{ type: String, trim: true }],
    },

    /**
     * DERIVED CACHE - never treat as authoritative.
     *
     * These three figures are maintained inside the same transaction as the
     * sale/purchase/loan that moves them, purely so list screens do not have
     * to aggregate the whole ledger on every page load. The authoritative
     * values are always recomputable from sales, purchases, payments, loans
     * and loanpayments - which is exactly what scripts/verify-integrity.js
     * does, and recompute-stock.js repairs.
     */
    balances: {
      receivable: moneyField({ min: undefined }),      // customer owes us
      payable: moneyField({ min: undefined }),         // we owe farmer/supplier
      loanOutstanding: moneyField({ min: undefined }), // advances not yet recovered
    },

    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Backs the Section 35 global search.
partySchema.index({ name: 'text', partyCode: 'text', phone: 'text', village: 'text' });
partySchema.index({ roles: 1, isActive: 1, name: 1 });

export const Party = mongoose.model('Party', partySchema);
