import mongoose from 'mongoose';

/**
 * Atomic sequence source for human-readable document numbers.
 *
 * `_id` is the sequence key, e.g. "SALE-2026". Incrementing happens with a
 * single findOneAndUpdate($inc) INSIDE the caller's transaction, so two clerks
 * saving a sale at the same instant can never be handed the same invoice
 * number, and a rolled-back sale does not burn a number that leaves a
 * suspicious gap in the books.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter = mongoose.model('Counter', counterSchema);
