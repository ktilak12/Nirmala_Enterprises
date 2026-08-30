import { withTransaction } from '../config/db.js';
import { Loan, LoanPayment } from '../models/Loan.js';
import { Party, PARTY_ROLES } from '../models/Party.js';
import { Payment } from '../models/Payment.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round2 } from '../utils/money.js';
import { diffDocuments, writeAudit } from './audit.js';
import { ENTITY_PREFIX, nextEntityCode } from './numbering.js';

/**
 * Party master data - farmers, customers and suppliers in one collection
 * (Section 39, Sections 15 to 18).
 */

const EDITABLE = [
  'name', 'phone', 'altPhone', 'email', 'address', 'village', 'district', 'pincode',
  'roles', 'farmerProfile', 'customerProfile', 'supplierProfile', 'notes', 'isActive',
];

export async function listParties({
  role,
  q,
  village,
  isActive,
  hasDues,
  page = 1,
  limit = 25,
  sort = 'name',
} = {}) {
  const filter = {};
  if (role) filter.roles = role;
  if (village) filter.village = new RegExp(escapeRegex(village), 'i');
  if (isActive !== undefined) filter.isActive = isActive;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { partyCode: rx }, { phone: rx }, { village: rx }];
  }

  if (hasDues === 'receivable') filter['balances.receivable'] = { $gt: 0 };
  if (hasDues === 'payable') filter['balances.payable'] = { $gt: 0 };
  if (hasDues === 'loan') filter['balances.loanOutstanding'] = { $gt: 0 };

  const skip = (Math.max(1, page) - 1) * limit;

  const [rows, total] = await Promise.all([
    Party.find(filter).sort(sort).skip(skip).limit(limit),
    Party.countDocuments(filter),
  ]);

  return { rows, total, page: Number(page), limit: Number(limit) };
}

export async function getParty(partyId) {
  const party = await Party.findById(partyId);
  if (!party) throw notFound('Party not found.');
  return party;
}

/**
 * The 360-degree profile of Sections 16 to 18.
 *
 * Every dealing with this person, in one response and one chronological
 * timeline: what they bought, what we bought from them, advances taken and
 * repaid, and every rupee that moved either way. This is the payoff for keeping
 * one party record instead of three - the timeline simply cannot be assembled
 * if the same person exists as three unrelated rows.
 */
export async function getPartyProfile(partyId, { limit = 100 } = {}) {
  const party = await getParty(partyId);

  const [sales, purchases, loans, loanPayments, payments] = await Promise.all([
    Sale.find({ party: partyId }).sort({ date: -1 }).limit(limit),
    Purchase.find({ party: partyId }).sort({ date: -1 }).limit(limit),
    Loan.find({ party: partyId }).sort({ date: -1 }).limit(limit),
    LoanPayment.find({ party: partyId }).sort({ date: -1 }).limit(limit),
    Payment.find({ party: partyId }).sort({ date: -1 }).limit(limit),
  ]);

  const timeline = [
    ...sales.map((s) => ({
      at: s.date, kind: 'SALE', code: s.saleCode, id: s._id,
      amount: s.grandTotal, outstanding: s.outstanding,
      description: `Sold ${s.items.length} item${s.items.length === 1 ? '' : 's'}`,
      status: s.paymentStatus,
    })),
    ...purchases.map((p) => ({
      at: p.date, kind: p.isProcurement ? 'PROCUREMENT' : 'PURCHASE',
      code: p.purchaseCode, id: p._id,
      amount: p.netPayable, outstanding: p.outstanding,
      description: p.isProcurement
        ? `Procured ${p.items.map((i) => i.productName).join(', ')}`
        : `Purchased ${p.items.length} item${p.items.length === 1 ? '' : 's'}`,
      status: p.paymentStatus,
    })),
    ...loans.map((l) => ({
      at: l.date, kind: 'ADVANCE', code: l.loanCode, id: l._id,
      amount: l.principal, outstanding: l.outstanding,
      description: l.purpose ? `Advance for ${l.purpose}` : 'Advance disbursed',
      status: l.status,
    })),
    ...loanPayments.map((r) => ({
      at: r.date, kind: 'ADVANCE_REPAID', code: r.loanCode, id: r._id,
      amount: r.amount, outstanding: r.outstandingAfter,
      description: r.source === 'PROCUREMENT_ADJUSTMENT'
        ? `Recovered from settlement ${r.purchaseCode}`
        : 'Repayment received',
      status: null,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const totals = {
    salesValue: sumField(sales, 'grandTotal'),
    purchaseValue: sumField(purchases, 'netPayable'),
    advancesTaken: sumField(loans.filter((l) => l.status !== 'CANCELLED'), 'principal'),
    advancesRepaid: sumField(loanPayments, 'amount'),
    receivable: party.balances.receivable,
    payable: party.balances.payable,
    loanOutstanding: party.balances.loanOutstanding,
    /**
     * The single figure the office actually wants: after netting what they owe
     * us against what we owe them, who is out of pocket. Positive means the
     * party owes Nirmala; negative means Nirmala owes the party.
     */
    netPosition: round2(
      party.balances.receivable + party.balances.loanOutstanding - party.balances.payable,
    ),
  };

  return { party, totals, timeline, sales, purchases, loans, loanPayments, payments };
}

export async function createParty({ payload, actor, req }) {
  const roles = normaliseRoles(payload.roles);

  return withTransaction(async (session) => {
    const partyCode = await nextEntityCode(ENTITY_PREFIX.PARTY, { session, width: 6 });

    const [party] = await Party.create(
      [
        {
          partyCode,
          ...pick(payload, EDITABLE),
          roles,
          createdBy: actor._id,
        },
      ],
      { session },
    );

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'Party',
      entityId: party._id,
      entityCode: party.partyCode,
      summary: `Added ${roles.join(' / ')} ${party.name}${party.village ? ` of ${party.village}` : ''}`,
      req,
    });

    return party;
  });
}

export async function updateParty({ partyId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const party = await Party.findById(partyId).session(session);
    if (!party) throw notFound('Party not found.');

    const before = party.toObject();
    const patch = pick(payload, EDITABLE);
    if (patch.roles) patch.roles = normaliseRoles(patch.roles);

    /**
     * A role can be added freely but not removed while it is still carrying
     * business. Dropping "farmer" from someone with an outstanding advance
     * would hide that advance from the farmer list while the money is still
     * owed.
     */
    if (patch.roles) {
      const removed = party.roles.filter((r) => !patch.roles.includes(r));
      if (removed.includes('farmer') && party.balances.loanOutstanding > 0) {
        throw badRequest(
          `${party.name} still has ${party.balances.loanOutstanding} outstanding on advances, ` +
            'so the farmer role cannot be removed.',
        );
      }
      if (removed.includes('customer') && party.balances.receivable > 0) {
        throw badRequest(
          `${party.name} still owes ${party.balances.receivable}, so the customer role ` +
            'cannot be removed.',
        );
      }
      if (removed.includes('supplier') && party.balances.payable > 0) {
        throw badRequest(
          `${party.name} is still owed ${party.balances.payable}, so the supplier role ` +
            'cannot be removed.',
        );
      }
    }

    Object.assign(party, patch);
    const changes = diffDocuments(before, party.toObject(), {
      include: new Set(Object.keys(patch)),
    });

    if (changes.length === 0) return party;

    await party.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Party',
      entityId: party._id,
      entityCode: party.partyCode,
      summary: `Updated ${party.name}`,
      changes,
      req,
    });

    return party;
  });
}

/**
 * Deactivate rather than delete.
 *
 * A party is the anchor of every sale, purchase and advance ever recorded
 * against them. Removing the row would orphan that history and make old
 * invoices unexplainable, so the record is retired instead - it stops appearing
 * in pickers but every past document still resolves.
 */
export async function deactivateParty({ partyId, actor, req }) {
  return withTransaction(async (session) => {
    const party = await Party.findById(partyId).session(session);
    if (!party) throw notFound('Party not found.');

    const { receivable, payable, loanOutstanding } = party.balances;
    if (receivable > 0 || payable > 0 || loanOutstanding > 0) {
      throw badRequest(
        `${party.name} still has open balances (receivable ${receivable}, payable ${payable}, ` +
          `advances ${loanOutstanding}). Settle them before deactivating the record.`,
      );
    }

    if (!party.isActive) return party;

    party.isActive = false;
    await party.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Party',
      entityId: party._id,
      entityCode: party.partyCode,
      summary: `Deactivated ${party.name}`,
      changes: [{ field: 'isActive', from: true, to: false }],
      req,
    });

    return party;
  });
}

function normaliseRoles(roles) {
  const list = Array.isArray(roles) ? [...new Set(roles)] : [];
  if (list.length === 0) throw badRequest('Choose at least one role: farmer, customer or supplier.');
  const bad = list.filter((r) => !PARTY_ROLES.includes(r));
  if (bad.length) throw badRequest(`Unknown role: ${bad.join(', ')}.`);
  return list;
}

function pick(source, keys) {
  const out = {};
  for (const k of keys) if (source[k] !== undefined) out[k] = source[k];
  return out;
}

function sumField(docs, field) {
  return round2(docs.reduce((acc, d) => acc + Number(d[field] || 0), 0));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { escapeRegex };
