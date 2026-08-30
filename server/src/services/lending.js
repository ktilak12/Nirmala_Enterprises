import { withTransaction } from '../config/db.js';
import { Loan, LoanPayment } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { getSettings } from '../models/Setting.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round2 } from '../utils/money.js';
import { writeAudit } from './audit.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';
import { postPayment } from './payments.js';

/**
 * Farmer advances (Sections 27 and 28).
 *
 * There is NO automatic interest accrual. Section 27 says the interest and fee
 * rules must be confirmed with the business and its accountant first, and the
 * decision taken was to keep this module free of any accrual engine: any fee,
 * interest, discount or write-off is entered by hand as a labelled adjustment
 * line, attributed to whoever entered it, and captured in the audit log.
 *
 * The arithmetic is therefore deliberately simple and always re-derivable:
 *
 *     outstanding = principal + sum(adjustments) - sum(repayments)
 */

/** Recompute the derived totals on a loan document. Does not save. */
export function recomputeLoan(loan, { graceDays = 0, now = new Date() } = {}) {
  loan.adjustmentTotal = round2(
    (loan.adjustments ?? []).reduce((acc, a) => acc + Number(a.amount || 0), 0),
  );
  loan.outstanding = round2(loan.principal + loan.adjustmentTotal - loan.totalRepaid);

  if (loan.status !== 'CANCELLED') {
    if (loan.outstanding <= 0) {
      loan.status = 'PAID';
    } else if (loan.dueDate && now.getTime() > new Date(loan.dueDate).getTime() + graceDays * 86_400_000) {
      loan.status = 'OVERDUE';
    } else {
      loan.status = loan.totalRepaid > 0 ? 'PARTIALLY_PAID' : 'ACTIVE';
    }
  }

  return loan;
}

/** Re-derive a party's cached loanOutstanding from all their loans. */
async function syncPartyLoanBalance({ session, party }) {
  const loans = await Loan.find({ party: party._id, status: { $ne: 'CANCELLED' } })
    .select('outstanding')
    .session(session);
  party.balances.loanOutstanding = round2(
    loans.reduce((acc, l) => acc + Number(l.outstanding || 0), 0),
  );
  await party.save({ session });
}

/**
 * Disburse an advance. One transaction covers the loan, the cash going out,
 * and the farmer's balance.
 */
export async function createLoan({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const date = payload.date ? new Date(payload.date) : new Date();

    const party = await Party.findById(payload.partyId).session(session);
    if (!party) throw notFound('Party not found.');
    if (!party.isActive) throw badRequest(`${party.name} is marked inactive.`);

    // Taking an advance makes someone a borrower; in this business that party
    // is a farmer, so widen the record rather than create a second one.
    if (!party.roles.includes('farmer')) party.roles.push('farmer');

    const principal = round2(payload.principal);
    if (principal <= 0) throw badRequest('Advance amount must be greater than zero.');

    const loanCode = await nextDocNumber(DOC_PREFIX.LOAN, { session, date });

    const [loan] = await Loan.create(
      [
        {
          loanCode,
          party: party._id,
          partyName: party.name,
          partyPhone: party.phone,
          principal,
          date,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
          purpose: payload.purpose ?? '',
          terms: payload.terms ?? '',
          adjustments: [],
          adjustmentTotal: 0,
          totalRepaid: 0,
          outstanding: principal,
          status: 'ACTIVE',
          notes: payload.notes ?? '',
          createdBy: actor._id,
          createdByName: actor.name,
        },
      ],
      { session },
    );

    recomputeLoan(loan, { graceDays: settings.lending.overdueGraceDays });
    await loan.save({ session });

    // Cash leaving the business is a payment like any other (Section 29).
    const payment = await postPayment({
      session,
      direction: 'OUT',
      amount: principal,
      method: payload.method ?? 'CASH',
      reference: payload.reference ?? '',
      party,
      refModel: 'Loan',
      refId: loan._id,
      refCode: loan.loanCode,
      purpose: 'LOAN_DISBURSEMENT',
      remarks: payload.purpose ? `Advance: ${payload.purpose}` : 'Farmer advance',
      actor,
      date,
    });

    await syncPartyLoanBalance({ session, party });

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'Loan',
      entityId: loan._id,
      entityCode: loan.loanCode,
      summary: `Advance ${loan.loanCode} of ${principal} to ${party.name}`,
      req,
    });

    return { loan, payment };
  });
}

/**
 * Apply a repayment to a loan document in-place.
 *
 * Shared by the direct-repayment flow and by procurement's LOAN_RECOVERY
 * adjustment, so an advance cleared out of a harvest settlement produces
 * exactly the same records as one paid in cash at the counter.
 */
export async function applyRepayment({
  session,
  loan,
  party,
  amount,
  date,
  method = 'CASH',
  reference = '',
  source = 'DIRECT',
  purchase = null,
  remarks = '',
  actor,
  settings,
}) {
  const value = round2(amount);
  if (value <= 0) throw badRequest('Repayment amount must be greater than zero.');
  if (loan.status === 'CANCELLED') throw badRequest(`Advance ${loan.loanCode} is cancelled.`);
  if (value > loan.outstanding) {
    throw badRequest(
      `Repayment of ${value} exceeds the outstanding balance of ${loan.outstanding} ` +
        `on ${loan.loanCode}.`,
    );
  }

  loan.totalRepaid = round2(loan.totalRepaid + value);
  recomputeLoan(loan, { graceDays: settings?.lending?.overdueGraceDays ?? 0 });
  await loan.save({ session });

  const [repayment] = await LoanPayment.create(
    [
      {
        loan: loan._id,
        loanCode: loan.loanCode,
        party: party._id,
        partyName: party.name,
        amount: value,
        date,
        method,
        reference,
        source,
        purchase: purchase?._id ?? null,
        purchaseCode: purchase?.purchaseCode ?? null,
        outstandingAfter: loan.outstanding,
        remarks,
        recordedBy: actor._id,
        recordedByName: actor.name,
      },
    ],
    { session },
  );

  return repayment;
}

/** Repayment handed over directly, rather than deducted from a settlement. */
export async function recordRepayment({ loanId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const loan = await Loan.findById(loanId).session(session);
    if (!loan) throw notFound('Advance not found.');

    const party = await Party.findById(loan.party).session(session);
    if (!party) throw notFound('Party not found.');

    const date = payload.date ? new Date(payload.date) : new Date();
    const outstandingBefore = loan.outstanding;

    const repayment = await applyRepayment({
      session,
      loan,
      party,
      amount: payload.amount,
      date,
      method: payload.method ?? 'CASH',
      reference: payload.reference ?? '',
      source: 'DIRECT',
      remarks: payload.remarks ?? '',
      actor,
      settings,
    });

    const payment = await postPayment({
      session,
      direction: 'IN',
      amount: repayment.amount,
      method: payload.method ?? 'CASH',
      reference: payload.reference ?? '',
      party,
      refModel: 'LoanPayment',
      refId: repayment._id,
      refCode: loan.loanCode,
      purpose: 'LOAN_REPAYMENT',
      remarks: payload.remarks ?? `Repayment against ${loan.loanCode}`,
      actor,
      date,
    });

    await syncPartyLoanBalance({ session, party });

    await writeAudit({
      session,
      actor,
      action: 'PAYMENT',
      entity: 'Loan',
      entityId: loan._id,
      entityCode: loan.loanCode,
      summary: `Repayment of ${repayment.amount} from ${party.name} against ${loan.loanCode}`,
      changes: [{ field: 'outstanding', from: outstandingBefore, to: loan.outstanding }],
      req,
    });

    return { loan, repayment, payment };
  });
}

/**
 * Add a manual adjustment line (fee, interest, discount, write-off).
 *
 * This is the only route by which anything other than principal and repayments
 * can change what a farmer owes - no hidden accrual anywhere.
 */
export async function addLoanAdjustment({ loanId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const loan = await Loan.findById(loanId).session(session);
    if (!loan) throw notFound('Advance not found.');
    if (loan.status === 'CANCELLED') throw badRequest('Advance is cancelled.');

    const party = await Party.findById(loan.party).session(session);
    if (!party) throw notFound('Party not found.');

    const amount = round2(payload.amount);
    if (amount === 0) throw badRequest('Adjustment amount cannot be zero.');
    if (!payload.label?.trim()) throw badRequest('An adjustment needs a label explaining it.');

    const outstandingBefore = loan.outstanding;

    loan.adjustments.push({
      date: payload.date ? new Date(payload.date) : new Date(),
      type: payload.type ?? 'OTHER',
      label: payload.label.trim(),
      amount,
      enteredBy: actor._id,
      enteredByName: actor.name,
    });

    recomputeLoan(loan, { graceDays: settings.lending.overdueGraceDays });

    if (loan.outstanding < 0) {
      throw badRequest(
        'That adjustment would make the outstanding balance negative. ' +
          'Record a refund instead.',
      );
    }

    await loan.save({ session });
    await syncPartyLoanBalance({ session, party });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Loan',
      entityId: loan._id,
      entityCode: loan.loanCode,
      summary: `${payload.type ?? 'OTHER'} adjustment "${payload.label}" of ${amount} on ${loan.loanCode}`,
      changes: [{ field: 'outstanding', from: outstandingBefore, to: loan.outstanding }],
      req,
    });

    return loan;
  });
}

/** Cancel an advance that was raised in error. Never deletes history. */
export async function cancelLoan({ loanId, reason, actor, req }) {
  return withTransaction(async (session) => {
    const loan = await Loan.findById(loanId).session(session);
    if (!loan) throw notFound('Advance not found.');
    if (loan.totalRepaid > 0) {
      throw badRequest(
        'This advance already has repayments recorded against it, so it cannot be ' +
          'cancelled. Use a WRITE_OFF adjustment instead, which keeps the history.',
      );
    }

    const party = await Party.findById(loan.party).session(session);
    const previous = loan.status;
    loan.status = 'CANCELLED';
    loan.outstanding = 0;
    loan.notes = [loan.notes, `Cancelled: ${reason ?? 'no reason given'}`].filter(Boolean).join('\n');
    await loan.save({ session });

    if (party) await syncPartyLoanBalance({ session, party });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Loan',
      entityId: loan._id,
      entityCode: loan.loanCode,
      summary: `Advance ${loan.loanCode} cancelled: ${reason ?? 'no reason given'}`,
      changes: [{ field: 'status', from: previous, to: 'CANCELLED' }],
      req,
    });

    return loan;
  });
}

export { syncPartyLoanBalance };
