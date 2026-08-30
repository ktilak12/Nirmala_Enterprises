import { withTransaction } from '../config/db.js';
import { Loan } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { getSettings } from '../models/Setting.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round2, round3 } from '../utils/money.js';
import { writeAudit } from './audit.js';
import { postMovement } from './ledger.js';
import { applyRepayment, syncPartyLoanBalance } from './lending.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';
import { paymentStatusFor, postPayment } from './payments.js';

/**
 * Purchases and farmer procurement (Sections 24 and 25).
 *
 * One function covers both, because they are the same transaction shape with
 * one extra capability. A trade purchase from a supplier is:
 *
 *     stock in -> purchase -> payment -> supplier payable
 *
 * A procurement from a farmer is the same, plus the adjustment block that makes
 * the harvest settlement work:
 *
 *     gross - adjustments = net payable
 *
 * where a LOAN_RECOVERY adjustment ALSO writes a repayment against that
 * farmer's advance inside the same transaction. That single step is what closes
 * the loop in the Section 10 diagram: advance -> cultivation -> harvest ->
 * procurement -> recovery, without anybody re-keying a figure between modules.
 */
export async function createPurchase({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const date = payload.date ? new Date(payload.date) : new Date();
    const isProcurement = Boolean(payload.isProcurement);

    const party = await Party.findById(payload.partyId).session(session);
    if (!party) throw notFound('Party not found.');
    if (!party.isActive) throw badRequest(`${party.name} is marked inactive.`);

    // Buying from someone widens their record rather than duplicating it
    // (Section 39). A harvest purchase makes them a farmer; a trade purchase
    // makes them a supplier.
    const requiredRole = isProcurement ? 'farmer' : 'supplier';
    const roleAdded = !party.roles.includes(requiredRole);
    if (roleAdded) party.roles.push(requiredRole);

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw badRequest('A purchase must contain at least one line item.');
    }

    // ---- Lines ------------------------------------------------------------
    const items = [];
    let grossAmount = 0;

    for (const raw of payload.items) {
      const product = await Product.findById(raw.productId)
        .populate('unit', 'symbol')
        .session(session);
      if (!product) throw notFound(`Product ${raw.productId} not found.`);

      const qty = round3(raw.qty);
      if (qty <= 0) throw badRequest(`Quantity for ${product.name} must be greater than zero.`);

      const rate = round2(raw.rate ?? product.purchasePrice);
      if (rate <= 0) throw badRequest(`Rate for ${product.name} must be greater than zero.`);

      const lineTotal = round2(qty * rate);

      items.push({
        product: product._id,
        productCode: product.productCode,
        productName: product.name,
        unitSymbol: product.unit?.symbol ?? '',
        qty,
        rate,
        lineTotal,
      });

      grossAmount = round2(grossAmount + lineTotal);
    }

    // ---- Adjustments ------------------------------------------------------
    const rawAdjustments = Array.isArray(payload.adjustments) ? payload.adjustments : [];

    if (rawAdjustments.length > 0 && !isProcurement) {
      const hasRecovery = rawAdjustments.some((a) => a.type === 'LOAN_RECOVERY');
      if (hasRecovery) {
        throw badRequest(
          'An advance can only be recovered on a farmer procurement, not on a trade purchase.',
        );
      }
    }

    const adjustments = [];
    const recoveries = [];
    let adjustmentTotal = 0;

    for (const raw of rawAdjustments) {
      const amount = round2(raw.amount);
      if (amount === 0) continue;
      if (!raw.label?.trim()) throw badRequest('Every adjustment needs a label.');

      let loan = null;
      if (raw.type === 'LOAN_RECOVERY') {
        if (!raw.loanId) throw badRequest('A loan recovery must name the advance it settles.');
        loan = await Loan.findById(raw.loanId).session(session);
        if (!loan) throw notFound(`Advance ${raw.loanId} not found.`);

        if (String(loan.party) !== String(party._id)) {
          throw badRequest(
            `Advance ${loan.loanCode} belongs to a different party and cannot be ` +
              `recovered from ${party.name}.`,
          );
        }
        if (amount < 0) throw badRequest('A loan recovery cannot be negative.');
        if (amount > loan.outstanding) {
          throw badRequest(
            `Recovery of ${amount} exceeds the ${loan.outstanding} outstanding on ${loan.loanCode}.`,
          );
        }
        recoveries.push({ loan, amount, label: raw.label.trim() });
      }

      adjustments.push({
        type: raw.type ?? 'OTHER',
        label: raw.label.trim(),
        amount,
        loan: loan?._id ?? null,
        loanCode: loan?.loanCode ?? null,
      });

      adjustmentTotal = round2(adjustmentTotal + amount);
    }

    const netPayable = round2(grossAmount - adjustmentTotal);
    if (netPayable < 0) {
      throw badRequest(
        `Adjustments of ${adjustmentTotal} exceed the gross value of ${grossAmount}. ` +
          'Reduce the recovery so the settlement does not go negative - the remainder ' +
          'stays outstanding on the advance and can be recovered from the next lot.',
      );
    }

    const amountPaid = round2(payload.amountPaid ?? 0);
    if (amountPaid > netPayable) {
      throw badRequest(`Amount paid (${amountPaid}) exceeds the net payable (${netPayable}).`);
    }

    const outstanding = round2(netPayable - amountPaid);
    const paymentStatus = paymentStatusFor(netPayable, amountPaid);

    // ---- Create the purchase ---------------------------------------------
    const purchaseCode = await nextDocNumber(DOC_PREFIX.PURCHASE, { session, date });

    const [purchase] = await Purchase.create(
      [
        {
          purchaseCode,
          party: party._id,
          partyName: party.name,
          partyPhone: party.phone,
          isProcurement,
          date,
          items,
          grossAmount,
          adjustments,
          adjustmentTotal,
          netPayable,
          amountPaid,
          outstanding,
          paymentStatus,
          referenceNo: payload.referenceNo ?? '',
          notes: payload.notes ?? '',
          createdBy: actor._id,
          createdByName: actor.name,
        },
      ],
      { session },
    );

    // ---- Stock in ---------------------------------------------------------
    for (const item of items) {
      await postMovement({
        session,
        productId: item.product,
        type: 'PURCHASE',
        qtyDelta: item.qty,
        unitCost: item.rate,
        refModel: 'Purchase',
        refId: purchase._id,
        refCode: purchase.purchaseCode,
        remarks: isProcurement
          ? `Procured from ${party.name}`
          : `Purchased from ${party.name}`,
        actor,
        date,
      });
    }

    // ---- Recover advances out of the settlement ---------------------------
    const repayments = [];
    for (const rec of recoveries) {
      const repayment = await applyRepayment({
        session,
        loan: rec.loan,
        party,
        amount: rec.amount,
        date,
        method: 'ADJUSTMENT',
        reference: purchase.purchaseCode,
        source: 'PROCUREMENT_ADJUSTMENT',
        purchase,
        remarks: `${rec.label} - recovered from settlement ${purchase.purchaseCode}`,
        actor,
        settings,
      });
      repayments.push(repayment);
    }

    /**
     * Note there is deliberately NO cash Payment row for a loan recovery. No
     * money moved - the debt was netted off against what we owed the farmer.
     * Creating one would double-count the day's cash.
     */

    // ---- Pay the farmer / supplier ---------------------------------------
    let payment = null;
    if (amountPaid > 0) {
      payment = await postPayment({
        session,
        direction: 'OUT',
        amount: amountPaid,
        method: payload.paymentMethod ?? 'CASH',
        reference: payload.paymentReference ?? '',
        party,
        refModel: 'Purchase',
        refId: purchase._id,
        refCode: purchase.purchaseCode,
        purpose: 'PURCHASE_SETTLEMENT',
        remarks: `Settlement for ${purchase.purchaseCode}`,
        actor,
        date,
      });
    }

    // ---- Balances ---------------------------------------------------------
    party.balances.payable = round2(party.balances.payable + outstanding);
    await party.save({ session });

    if (repayments.length > 0) {
      await syncPartyLoanBalance({ session, party });
    }

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'Purchase',
      entityId: purchase._id,
      entityCode: purchase.purchaseCode,
      summary:
        `${isProcurement ? 'Procurement' : 'Purchase'} ${purchase.purchaseCode} from ` +
        `${party.name}: gross ${grossAmount}, adjustments ${adjustmentTotal}, ` +
        `net ${netPayable}` +
        (repayments.length
          ? `, recovered ${repayments.reduce((a, r) => round2(a + r.amount), 0)} against ` +
            `${recoveries.map((r) => r.loan.loanCode).join(', ')}`
          : ''),
      req,
    });

    return { purchase, payment, repayments };
  });
}

/** Record a later payment against an outstanding purchase settlement. */
export async function recordPurchasePayment({ purchaseId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const purchase = await Purchase.findById(purchaseId).session(session);
    if (!purchase) throw notFound('Purchase not found.');

    const amount = round2(payload.amount);
    if (amount <= 0) throw badRequest('Payment amount must be greater than zero.');
    if (amount > purchase.outstanding) {
      throw badRequest(
        `Payment of ${amount} exceeds the outstanding balance of ${purchase.outstanding}.`,
      );
    }

    const party = await Party.findById(purchase.party).session(session);
    if (!party) throw notFound('Party not found.');

    const date = payload.date ? new Date(payload.date) : new Date();
    const before = purchase.outstanding;

    purchase.amountPaid = round2(purchase.amountPaid + amount);
    purchase.outstanding = round2(purchase.netPayable - purchase.amountPaid);
    purchase.paymentStatus = paymentStatusFor(purchase.netPayable, purchase.amountPaid);
    await purchase.save({ session });

    const payment = await postPayment({
      session,
      direction: 'OUT',
      amount,
      method: payload.method ?? 'CASH',
      reference: payload.reference ?? '',
      party,
      refModel: 'Purchase',
      refId: purchase._id,
      refCode: purchase.purchaseCode,
      purpose: 'PURCHASE_SETTLEMENT',
      remarks: payload.remarks ?? `Settlement for ${purchase.purchaseCode}`,
      actor,
      date,
    });

    party.balances.payable = round2(party.balances.payable - amount);
    await party.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'PAYMENT',
      entity: 'Purchase',
      entityId: purchase._id,
      entityCode: purchase.purchaseCode,
      summary: `Paid ${amount} to ${party.name} against ${purchase.purchaseCode}`,
      changes: [{ field: 'outstanding', from: before, to: purchase.outstanding }],
      req,
    });

    return { purchase, payment };
  });
}
