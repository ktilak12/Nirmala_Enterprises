import { AuditLog } from '../models/AuditLog.js';
import { Enquiry } from '../models/Enquiry.js';
import { InventoryTxn } from '../models/InventoryTxn.js';
import { Invoice } from '../models/Invoice.js';
import { Loan, LoanPayment } from '../models/Loan.js';
import { Expense, Payment } from '../models/Payment.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { notFound } from '../utils/errors.js';
import { recomputeLoan } from './lending.js';
import { escapeRegex } from './parties.js';

/**
 * Read-side list and detail queries for the transaction collections.
 *
 * These are deliberately separate from the write services. A write service owns
 * a transaction and a great deal of business rule; a list is a filter, a sort
 * and a page count. Keeping them apart means the sales service stays about the
 * one thing that is hard - posting a sale atomically - instead of growing a
 * second identity as a query builder.
 *
 * Every list returns the same envelope, `{ rows, total, page, limit }`, so one
 * DataTable component on the client drives all of them.
 */

const DEFAULT_LIMIT = 25;

/** Inclusive day range: `to` is pushed to the end of that day, not its midnight. */
function dateFilter(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

async function paginate(Model, filter, { page = 1, limit = DEFAULT_LIMIT, sort = '-date', select, populate } = {}) {
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  let query = Model.find(filter).sort(sort).skip(skip).limit(Number(limit));
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);

  const [rows, total] = await Promise.all([query, Model.countDocuments(filter)]);
  return { rows, total, page: Number(page), limit: Number(limit) };
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function listSales({ q, partyId, from, to, paymentStatus, page, limit } = {}) {
  const filter = {};
  if (partyId) filter.party = partyId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const range = dateFilter(from, to);
  if (range) filter.date = range;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ saleCode: rx }, { partyName: rx }, { invoiceCode: rx }, { partyPhone: rx }];
  }

  return paginate(Sale, filter, { page, limit, sort: '-date -createdAt' });
}

export async function getSale(saleId) {
  const sale = await Sale.findById(saleId).populate('party', 'partyCode name phone village roles balances');
  if (!sale) throw notFound('Sale not found.');

  const payments = await Payment.find({ refModel: 'Sale', refId: sale._id }).sort('date');
  return { sale, payments };
}

// ---------------------------------------------------------------------------
// Purchases and procurement
// ---------------------------------------------------------------------------

export async function listPurchases({ q, partyId, from, to, paymentStatus, isProcurement, page, limit } = {}) {
  const filter = {};
  if (partyId) filter.party = partyId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (isProcurement !== undefined) filter.isProcurement = isProcurement;

  const range = dateFilter(from, to);
  if (range) filter.date = range;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ purchaseCode: rx }, { partyName: rx }, { referenceNo: rx }, { partyPhone: rx }];
  }

  return paginate(Purchase, filter, { page, limit, sort: '-date -createdAt' });
}

export async function getPurchase(purchaseId) {
  const purchase = await Purchase.findById(purchaseId).populate(
    'party',
    'partyCode name phone village roles balances',
  );
  if (!purchase) throw notFound('Purchase not found.');

  const [payments, recoveries] = await Promise.all([
    Payment.find({ refModel: 'Purchase', refId: purchase._id }).sort('date'),
    LoanPayment.find({ purchase: purchase._id }).sort('date'),
  ]);

  return { purchase, payments, recoveries };
}

// ---------------------------------------------------------------------------
// Lending
// ---------------------------------------------------------------------------

export async function listLoans({ q, partyId, status, page, limit } = {}) {
  const filter = {};
  if (partyId) filter.party = partyId;
  if (status) filter.status = status;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ loanCode: rx }, { partyName: rx }, { purpose: rx }];
  }

  return paginate(Loan, filter, { page, limit, sort: '-date -createdAt' });
}

/**
 * A loan plus its repayment history.
 *
 * `recomputeLoan` runs on the way out so an advance that quietly passed its due
 * date since the last write reads as OVERDUE rather than ACTIVE. The recomputed
 * document is not saved here - a read should not write. The status is corrected
 * on disk by the next real transaction against the loan, or by the overdue sweep
 * in the reports.
 */
export async function getLoan(loanId, { graceDays = 0 } = {}) {
  const loan = await Loan.findById(loanId).populate(
    'party',
    'partyCode name phone village roles balances farmerProfile',
  );
  if (!loan) throw notFound('Advance not found.');

  recomputeLoan(loan, { graceDays });

  const repayments = await LoanPayment.find({ loan: loan._id }).sort('date createdAt');
  return { loan, repayments };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function listPayments({ q, direction, method, purpose, partyId, from, to, page, limit } = {}) {
  const filter = {};
  if (direction) filter.direction = direction;
  if (method) filter.method = method;
  if (purpose) filter.purpose = purpose;
  if (partyId) filter.party = partyId;

  const range = dateFilter(from, to);
  if (range) filter.date = range;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ paymentCode: rx }, { partyName: rx }, { refCode: rx }, { reference: rx }];
  }

  const result = await paginate(Payment, filter, { page, limit, sort: '-date -createdAt' });

  /**
   * Cash in and cash out for the filtered set, not just the visible page. A
   * clerk reconciling the day's takings needs the totals for the whole filter;
   * summing the 50 rows on screen would understate it.
   */
  const [totals] = await Payment.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$direction',
        amount: { $sum: '$amount' },
      },
    },
    {
      $group: {
        _id: null,
        cashIn: { $sum: { $cond: [{ $eq: ['$_id', 'IN'] }, '$amount', 0] } },
        cashOut: { $sum: { $cond: [{ $eq: ['$_id', 'OUT'] }, '$amount', 0] } },
      },
    },
    { $project: { _id: 0, cashIn: 1, cashOut: 1 } },
  ]);

  const cashIn = totals?.cashIn ?? 0;
  const cashOut = totals?.cashOut ?? 0;
  return { ...result, totals: { cashIn, cashOut, net: cashIn - cashOut } };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses({ q, category, from, to, page, limit } = {}) {
  const filter = {};
  if (category) filter.category = category;

  const range = dateFilter(from, to);
  if (range) filter.date = range;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ expenseCode: rx }, { description: rx }, { partyName: rx }, { reference: rx }];
  }

  const result = await paginate(Expense, filter, { page, limit, sort: '-date -createdAt' });

  const [agg] = await Expense.aggregate([
    { $match: filter },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);

  return { ...result, totals: { amount: agg?.amount ?? 0 } };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function listInvoices({ q, partyId, from, to, paymentStatus, page, limit } = {}) {
  const filter = {};
  if (partyId) filter.party = partyId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const range = dateFilter(from, to);
  if (range) filter.date = range;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ invoiceCode: rx }, { saleCode: rx }, { 'buyer.name': rx }, { 'buyer.phone': rx }];
  }

  return paginate(Invoice, filter, { page, limit, sort: '-date -createdAt' });
}

export async function getInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  return invoice;
}

/** Used by the sale detail screen's "Print invoice" button, which knows the sale. */
export async function getInvoiceBySale(saleId) {
  const invoice = await Invoice.findOne({ sale: saleId });
  if (!invoice) throw notFound('No invoice has been raised for this sale.');
  return invoice;
}

// ---------------------------------------------------------------------------
// Inventory movements (Section 21)
// ---------------------------------------------------------------------------

/**
 * The whole-warehouse movement log, as opposed to `getProductLedger`, which is
 * the running statement for a single product. This one answers "what moved this
 * week", so it is sorted newest first and carries the product name inline from
 * the snapshot rather than needing a join.
 */
export async function listMovements({ productId, type, from, to, page, limit } = {}) {
  const filter = {};
  if (productId) filter.product = productId;
  if (type) filter.type = type;

  const range = dateFilter(from, to);
  if (range) filter.date = range;

  return paginate(InventoryTxn, filter, {
    page,
    limit,
    sort: '-date -_id',
    populate: { path: 'product', select: 'productCode name unit', populate: { path: 'unit', select: 'symbol' } },
  });
}

// ---------------------------------------------------------------------------
// Audit log (Section 38)
// ---------------------------------------------------------------------------

export async function listAudit({ q, userId, entity, action, from, to, page, limit } = {}) {
  const filter = {};
  if (userId) filter.user = userId;
  if (entity) filter.entity = entity;
  if (action) filter.action = action;

  if (from || to) {
    const range = dateFilter(from, to);
    if (range) filter.at = range;
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ summary: rx }, { entityCode: rx }, { userName: rx }];
  }

  return paginate(AuditLog, filter, { page, limit, sort: '-at' });
}

// ---------------------------------------------------------------------------
// Enquiries from the public contact form (Section 9)
// ---------------------------------------------------------------------------

export async function listEnquiries({ status, enquiryType, page, limit } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (enquiryType) filter.enquiryType = enquiryType;

  return paginate(Enquiry, filter, { page, limit, sort: '-createdAt' });
}
