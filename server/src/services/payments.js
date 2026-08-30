import { Payment } from '../models/Payment.js';
import { round2 } from '../utils/money.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';

/**
 * Central money-movement recorder (Section 29).
 *
 * Sales, purchases, loan disbursements, loan repayments and expenses all post
 * through here rather than each keeping its own private notion of cash. That
 * is what makes the Payments screen sufficient to reconcile a day's takings,
 * and it means "how much cash moved today" has exactly one answer.
 *
 * Always called with the caller's session - a payment must live or die with
 * the document it settles.
 */
export async function postPayment({
  session,
  direction,
  amount,
  method = 'CASH',
  reference = '',
  party = null,
  refModel = null,
  refId = null,
  refCode = null,
  purpose = 'OTHER',
  remarks = '',
  actor,
  date = new Date(),
}) {
  if (!session) throw new Error('postPayment requires a transaction session.');

  const value = round2(amount);
  if (value <= 0) throw new Error('A payment must be for a positive amount.');

  const paymentCode = await nextDocNumber(DOC_PREFIX.PAYMENT, { session, date });

  const [payment] = await Payment.create(
    [
      {
        paymentCode,
        date,
        direction,
        amount: value,
        method,
        reference,
        party: party?._id ?? null,
        partyName: party?.name ?? null,
        refModel,
        refId,
        refCode,
        purpose,
        remarks,
        recordedBy: actor._id,
        recordedByName: actor.name,
      },
    ],
    { session },
  );

  return payment;
}

/** Derive the payment status of a document from its totals. */
export function paymentStatusFor(total, paid) {
  const t = round2(total);
  const p = round2(paid);
  if (p <= 0) return 'UNPAID';
  if (p >= t) return 'PAID';
  return 'PARTIAL';
}
