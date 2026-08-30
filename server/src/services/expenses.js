import { withTransaction } from '../config/db.js';
import { Party } from '../models/Party.js';
import { Expense } from '../models/Payment.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round2 } from '../utils/money.js';
import { writeAudit } from './audit.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';
import { postPayment } from './payments.js';

/**
 * Operating expenses (Section 30).
 *
 * Every expense also writes an OUT payment, so the Payments screen remains a
 * complete picture of the day's cash and the profit figure in Section 42 can be
 * real operating profit rather than gross margin dressed up as profit.
 */
export async function createExpense({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const date = payload.date ? new Date(payload.date) : new Date();

    const amount = round2(payload.amount);
    if (amount <= 0) throw badRequest('Expense amount must be greater than zero.');
    if (!payload.description?.trim()) throw badRequest('An expense needs a description.');

    let party = null;
    if (payload.partyId) {
      party = await Party.findById(payload.partyId).session(session);
      if (!party) throw notFound('Party not found.');
    }

    const expenseCode = await nextDocNumber(DOC_PREFIX.EXPENSE, { session, date });

    const [expense] = await Expense.create(
      [
        {
          expenseCode,
          category: payload.category ?? 'OTHER',
          description: payload.description.trim(),
          amount,
          date,
          method: payload.method ?? 'CASH',
          reference: payload.reference ?? '',
          party: party?._id ?? null,
          partyName: party?.name ?? null,
          remarks: payload.remarks ?? '',
          recordedBy: actor._id,
          recordedByName: actor.name,
        },
      ],
      { session },
    );

    const payment = await postPayment({
      session,
      direction: 'OUT',
      amount,
      method: payload.method ?? 'CASH',
      reference: payload.reference ?? '',
      party,
      refModel: 'Expense',
      refId: expense._id,
      refCode: expense.expenseCode,
      purpose: 'EXPENSE',
      remarks: expense.description,
      actor,
      date,
    });

    expense.payment = payment._id;
    expense.paymentCode = payment.paymentCode;
    await expense.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'Expense',
      entityId: expense._id,
      entityCode: expense.expenseCode,
      summary: `${expense.category} expense of ${amount}: ${expense.description}`,
      req,
    });

    return { expense, payment };
  });
}
