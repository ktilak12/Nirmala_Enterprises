import { Counter } from '../models/Counter.js';

/**
 * Structured, human-readable document numbers (Section 32).
 *
 * Plain 1, 2, 3 is useless once the business has thousands of records, so
 * transactional documents get PREFIX-YEAR-SEQUENCE and master records get
 * PREFIX-SEQUENCE:
 *
 *     INV-2026-000001   SALE-2026-000001   PUR-2026-000001
 *     LOAN-2026-000001  PAY-2026-000001    EXP-2026-000001
 *     PRD-0001          PTY-000045
 *
 * The sequence is drawn with a single atomic findOneAndUpdate($inc), and the
 * caller MUST pass its transaction session. That matters twice over:
 *   - two clerks billing simultaneously cannot receive the same number, and
 *   - if the sale rolls back, so does the increment, so the books show no
 *     unexplained gap in the invoice run.
 */

async function nextSeq(key, session) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true, session },
  );
  return doc.seq;
}

/** Transactional document: PREFIX-YYYY-000001 */
export async function nextDocNumber(prefix, { session, date = new Date(), width = 6 } = {}) {
  const year = date.getFullYear();
  const seq = await nextSeq(`${prefix}-${year}`, session);
  return `${prefix}-${year}-${String(seq).padStart(width, '0')}`;
}

/** Master-data record: PREFIX-0001 (no year - a product is not year-bound) */
export async function nextEntityCode(prefix, { session, width = 4 } = {}) {
  const seq = await nextSeq(prefix, session);
  return `${prefix}-${String(seq).padStart(width, '0')}`;
}

export const DOC_PREFIX = Object.freeze({
  SALE: 'SALE',
  PURCHASE: 'PUR',
  INVOICE: 'INV',
  LOAN: 'LOAN',
  PAYMENT: 'PAY',
  EXPENSE: 'EXP',
  STOCK: 'STK',
});

export const ENTITY_PREFIX = Object.freeze({
  PARTY: 'PTY',
  PRODUCT: 'PRD',
});
