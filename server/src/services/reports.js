import { Category } from '../models/Catalog.js';
import { InventoryTxn } from '../models/InventoryTxn.js';
import { Loan, LoanPayment } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { Expense, Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { round2, round3 } from '../utils/money.js';

/**
 * Reports (Section 33).
 *
 * Each report returns `{ title, period, columns, rows, totals, meta }`. The
 * uniform shape is what lets one `exporting.js` turn any report into Excel or
 * CSV without knowing anything about the report - add a report here and it
 * becomes exportable for free.
 *
 * `columns` carries a `type` per column (`money`, `qty`, `date`, `text`) so the
 * exporter can apply number formats and the client can right-align figures
 * without hard-coding column names.
 */

function period(from, to) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  // Make `to` inclusive of the whole day - a clerk entering 31 August expects
  // 31 August's sales included.
  end.setHours(23, 59, 59, 999);
  return { start, end, label: `${fmt(start)} to ${fmt(end)}` };
}

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const col = (key, label, type = 'text') => ({ key, label, type });

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function salesReport({ from, to, partyId, groupBy = 'document' } = {}) {
  const p = period(from, to);
  const match = { date: { $gte: p.start, $lte: p.end } };
  if (partyId) match.party = partyId;

  if (groupBy === 'product') {
    const rows = await Sale.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productCode: { $first: '$items.productCode' },
          productName: { $first: '$items.productName' },
          unitSymbol: { $first: '$items.unitSymbol' },
          qty: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
          cost: { $sum: { $multiply: ['$items.qty', '$items.costAtSale'] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const shaped = rows.map((r) => ({
      productCode: r.productCode,
      productName: r.productName,
      unitSymbol: r.unitSymbol,
      qty: round3(r.qty),
      revenue: round2(r.revenue),
      cost: round2(r.cost),
      margin: round2(r.revenue - r.cost),
      marginPct: r.revenue > 0 ? round2(((r.revenue - r.cost) / r.revenue) * 100) : 0,
    }));

    return {
      title: 'Sales by Product',
      period: p.label,
      columns: [
        col('productCode', 'Code'),
        col('productName', 'Product'),
        col('unitSymbol', 'Unit'),
        col('qty', 'Quantity', 'qty'),
        col('revenue', 'Revenue', 'money'),
        col('cost', 'Cost', 'money'),
        col('margin', 'Margin', 'money'),
        col('marginPct', 'Margin %', 'number'),
      ],
      rows: shaped,
      totals: {
        qty: round3(shaped.reduce((a, r) => a + r.qty, 0)),
        revenue: round2(shaped.reduce((a, r) => a + r.revenue, 0)),
        cost: round2(shaped.reduce((a, r) => a + r.cost, 0)),
        margin: round2(shaped.reduce((a, r) => a + r.margin, 0)),
      },
      meta: { financial: true },
    };
  }

  const sales = await Sale.find(match).sort({ date: 1, saleCode: 1 });

  const rows = sales.map((s) => ({
    date: s.date,
    saleCode: s.saleCode,
    invoiceCode: s.invoiceCode ?? '',
    partyName: s.partyName,
    items: s.items.length,
    subtotal: s.subtotal,
    discountTotal: s.discountTotal,
    taxTotal: s.taxTotal,
    grandTotal: s.grandTotal,
    amountPaid: s.amountPaid,
    outstanding: s.outstanding,
    paymentStatus: s.paymentStatus,
  }));

  return {
    title: 'Sales Register',
    period: p.label,
    columns: [
      col('date', 'Date', 'date'),
      col('saleCode', 'Sale No.'),
      col('invoiceCode', 'Invoice No.'),
      col('partyName', 'Customer'),
      col('items', 'Lines', 'number'),
      col('subtotal', 'Subtotal', 'money'),
      col('discountTotal', 'Discount', 'money'),
      col('taxTotal', 'Tax', 'money'),
      col('grandTotal', 'Total', 'money'),
      col('amountPaid', 'Paid', 'money'),
      col('outstanding', 'Outstanding', 'money'),
      col('paymentStatus', 'Status'),
    ],
    rows,
    totals: sumCols(rows, ['subtotal', 'discountTotal', 'taxTotal', 'grandTotal', 'amountPaid', 'outstanding']),
    meta: { count: rows.length },
  };
}

// ---------------------------------------------------------------------------
// Purchases and procurement
// ---------------------------------------------------------------------------

export async function purchaseReport({ from, to, partyId, kind = 'all' } = {}) {
  const p = period(from, to);
  const match = { date: { $gte: p.start, $lte: p.end } };
  if (partyId) match.party = partyId;
  if (kind === 'procurement') match.isProcurement = true;
  if (kind === 'supplier') match.isProcurement = false;

  const purchases = await Purchase.find(match).sort({ date: 1, purchaseCode: 1 });

  const rows = purchases.map((r) => ({
    date: r.date,
    purchaseCode: r.purchaseCode,
    partyName: r.partyName,
    type: r.isProcurement ? 'Procurement' : 'Purchase',
    items: r.items.length,
    grossAmount: r.grossAmount,
    adjustmentTotal: r.adjustmentTotal,
    loanRecovered: round2(
      r.adjustments
        .filter((a) => a.type === 'LOAN_RECOVERY')
        .reduce((acc, a) => acc + Number(a.amount || 0), 0),
    ),
    netPayable: r.netPayable,
    amountPaid: r.amountPaid,
    outstanding: r.outstanding,
    paymentStatus: r.paymentStatus,
  }));

  return {
    title: kind === 'procurement' ? 'Farmer Procurement Register' : 'Purchase Register',
    period: p.label,
    columns: [
      col('date', 'Date', 'date'),
      col('purchaseCode', 'Purchase No.'),
      col('partyName', 'Party'),
      col('type', 'Type'),
      col('items', 'Lines', 'number'),
      col('grossAmount', 'Gross', 'money'),
      col('adjustmentTotal', 'Adjustments', 'money'),
      col('loanRecovered', 'Advance Recovered', 'money'),
      col('netPayable', 'Net Payable', 'money'),
      col('amountPaid', 'Paid', 'money'),
      col('outstanding', 'Outstanding', 'money'),
      col('paymentStatus', 'Status'),
    ],
    rows,
    totals: sumCols(rows, ['grossAmount', 'adjustmentTotal', 'loanRecovered', 'netPayable', 'amountPaid', 'outstanding']),
    meta: { count: rows.length },
  };
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** Stock position with valuation at weighted-average cost (Sections 21, 43). */
export async function inventoryReport({ categoryId, lowStockOnly, includeInactive } = {}) {
  const filter = {};
  if (categoryId) filter.category = categoryId;
  if (!includeInactive) filter.isActive = true;
  if (lowStockOnly) {
    filter.minStock = { $gt: 0 };
    filter.$expr = { $lte: ['$currentStock', '$minStock'] };
  }

  const products = await Product.find(filter)
    .populate('category', 'name kind')
    .populate('unit', 'symbol')
    .sort('name');

  const rows = products.map((pr) => ({
    productCode: pr.productCode,
    productName: pr.name,
    category: pr.category?.name ?? '',
    unitSymbol: pr.unit?.symbol ?? '',
    currentStock: pr.currentStock,
    minStock: pr.minStock,
    status: pr.minStock > 0 && pr.currentStock <= pr.minStock ? 'LOW' : 'OK',
    avgCost: pr.avgCost,
    stockValue: round2(pr.currentStock * pr.avgCost),
    sellingPrice: pr.sellingPrice,
  }));

  return {
    title: lowStockOnly ? 'Low Stock Report' : 'Stock Position and Valuation',
    period: `As at ${fmt(new Date())}`,
    columns: [
      col('productCode', 'Code'),
      col('productName', 'Product'),
      col('category', 'Category'),
      col('unitSymbol', 'Unit'),
      col('currentStock', 'In Stock', 'qty'),
      col('minStock', 'Reorder Level', 'qty'),
      col('status', 'Status'),
      col('avgCost', 'Avg. Cost', 'money'),
      col('stockValue', 'Stock Value', 'money'),
      col('sellingPrice', 'Selling Price', 'money'),
    ],
    rows,
    totals: { stockValue: round2(rows.reduce((a, r) => a + r.stockValue, 0)) },
    meta: {
      valuationMethod: 'WEIGHTED_AVERAGE',
      // Printed on the report itself so nobody quotes the figure without the
      // caveat the concept document asks for (Section 43).
      valuationNote:
        'Valued at weighted-average cost. The valuation method should be confirmed with ' +
        'the business accountant before this figure is used in final accounts.',
      financial: true,
    },
  };
}

/** Stock movement register - the audit trail behind the position above. */
export async function stockMovementReport({ from, to, productId, type } = {}) {
  const p = period(from, to);
  const filter = { date: { $gte: p.start, $lte: p.end } };
  if (productId) filter.product = productId;
  if (type) filter.type = type;

  const txns = await InventoryTxn.find(filter).sort({ date: 1, _id: 1 }).limit(5000);

  const rows = txns.map((t) => ({
    date: t.date,
    txnCode: t.txnCode,
    productName: t.productName,
    type: t.type,
    qtyDelta: t.qtyDelta,
    balanceAfter: t.balanceAfter,
    unitCost: t.unitCost,
    refCode: t.refCode ?? '',
    remarks: t.remarks ?? '',
    userName: t.userName ?? '',
  }));

  return {
    title: 'Stock Movement Register',
    period: p.label,
    columns: [
      col('date', 'Date', 'date'),
      col('txnCode', 'Movement No.'),
      col('productName', 'Product'),
      col('type', 'Type'),
      col('qtyDelta', 'Change', 'qty'),
      col('balanceAfter', 'Balance', 'qty'),
      col('unitCost', 'Unit Cost', 'money'),
      col('refCode', 'Reference'),
      col('remarks', 'Reason / Remarks'),
      col('userName', 'Entered By'),
    ],
    rows,
    totals: { qtyDelta: round3(rows.reduce((a, r) => a + r.qtyDelta, 0)) },
    meta: { count: rows.length, truncated: txns.length === 5000 },
  };
}

// ---------------------------------------------------------------------------
// Farmers and lending
// ---------------------------------------------------------------------------

/**
 * Per-farmer summary (Section 33): what we sold them, what we bought from them,
 * what they still owe on advances, and the net position.
 */
export async function farmerReport({ from, to } = {}) {
  const p = period(from, to);
  const farmers = await Party.find({ roles: 'farmer' }).sort('name');
  const ids = farmers.map((f) => f._id);
  const range = { $gte: p.start, $lte: p.end };

  const [sales, procurements, advances, recoveries] = await Promise.all([
    Sale.aggregate([
      { $match: { party: { $in: ids }, date: range } },
      { $group: { _id: '$party', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: { party: { $in: ids }, date: range, isProcurement: true } },
      { $group: { _id: '$party', gross: { $sum: '$grossAmount' }, net: { $sum: '$netPayable' }, count: { $sum: 1 } } },
    ]),
    Loan.aggregate([
      { $match: { party: { $in: ids }, date: range, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$party', total: { $sum: '$principal' }, count: { $sum: 1 } } },
    ]),
    LoanPayment.aggregate([
      { $match: { party: { $in: ids }, date: range } },
      { $group: { _id: '$party', total: { $sum: '$amount' } } },
    ]),
  ]);

  const byId = (arr) => Object.fromEntries(arr.map((r) => [String(r._id), r]));
  const S = byId(sales); const P = byId(procurements);
  const A = byId(advances); const R = byId(recoveries);

  const rows = farmers.map((f) => {
    const k = String(f._id);
    return {
      partyCode: f.partyCode,
      name: f.name,
      village: f.village ?? '',
      phone: f.phone ?? '',
      inputsBought: round2(S[k]?.total ?? 0),
      produceSold: round2(P[k]?.net ?? 0),
      produceGross: round2(P[k]?.gross ?? 0),
      advancesTaken: round2(A[k]?.total ?? 0),
      advancesRepaid: round2(R[k]?.total ?? 0),
      advanceOutstanding: f.balances.loanOutstanding,
      receivable: f.balances.receivable,
      payable: f.balances.payable,
      netPosition: round2(
        f.balances.receivable + f.balances.loanOutstanding - f.balances.payable,
      ),
    };
  });

  return {
    title: 'Farmer Summary',
    period: p.label,
    columns: [
      col('partyCode', 'Code'),
      col('name', 'Farmer'),
      col('village', 'Village'),
      col('phone', 'Phone'),
      col('inputsBought', 'Inputs Bought', 'money'),
      col('produceSold', 'Produce Sold (Net)', 'money'),
      col('advancesTaken', 'Advances Taken', 'money'),
      col('advancesRepaid', 'Advances Repaid', 'money'),
      col('advanceOutstanding', 'Advance Outstanding', 'money'),
      col('receivable', 'Owes Us', 'money'),
      col('payable', 'We Owe', 'money'),
      col('netPosition', 'Net Position', 'money'),
    ],
    rows,
    totals: sumCols(rows, [
      'inputsBought', 'produceSold', 'advancesTaken', 'advancesRepaid',
      'advanceOutstanding', 'receivable', 'payable', 'netPosition',
    ]),
    meta: {
      count: rows.length,
      note: 'Net position: positive means the farmer owes Nirmala, negative means Nirmala owes the farmer.',
    },
  };
}

/** Advance register with ageing (Sections 26, 33). */
export async function lendingReport({ status, overdueOnly } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (overdueOnly) filter.status = 'OVERDUE';

  const loans = await Loan.find(filter).sort({ date: -1 });
  const now = Date.now();

  const rows = loans.map((l) => {
    const daysOverdue = l.dueDate && l.outstanding > 0
      ? Math.max(0, Math.floor((now - new Date(l.dueDate).getTime()) / 86_400_000))
      : 0;

    return {
      loanCode: l.loanCode,
      date: l.date,
      partyName: l.partyName,
      purpose: l.purpose ?? '',
      principal: l.principal,
      adjustmentTotal: l.adjustmentTotal,
      totalRepaid: l.totalRepaid,
      outstanding: l.outstanding,
      dueDate: l.dueDate ?? null,
      daysOverdue,
      ageing: bucket(daysOverdue),
      status: l.status,
    };
  });

  return {
    title: overdueOnly ? 'Overdue Advances' : 'Advance Register',
    period: `As at ${fmt(new Date())}`,
    columns: [
      col('loanCode', 'Advance No.'),
      col('date', 'Date', 'date'),
      col('partyName', 'Farmer'),
      col('purpose', 'Purpose'),
      col('principal', 'Principal', 'money'),
      col('adjustmentTotal', 'Adjustments', 'money'),
      col('totalRepaid', 'Repaid', 'money'),
      col('outstanding', 'Outstanding', 'money'),
      col('dueDate', 'Due Date', 'date'),
      col('daysOverdue', 'Days Overdue', 'number'),
      col('ageing', 'Ageing'),
      col('status', 'Status'),
    ],
    rows,
    totals: sumCols(rows, ['principal', 'adjustmentTotal', 'totalRepaid', 'outstanding']),
    meta: {
      count: rows.length,
      note: 'No interest is accrued automatically. Any fee, interest or discount appears as a ' +
        'labelled adjustment entered by a named user.',
    },
  };
}

function bucket(days) {
  if (days <= 0) return 'Current';
  if (days <= 30) return '1-30 days';
  if (days <= 60) return '31-60 days';
  if (days <= 90) return '61-90 days';
  return 'Over 90 days';
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Cash book: every rupee in and out, in one list (Section 29). */
export async function cashBookReport({ from, to, direction, method } = {}) {
  const p = period(from, to);
  const filter = { date: { $gte: p.start, $lte: p.end } };
  if (direction) filter.direction = direction;
  if (method) filter.method = method;

  const payments = await Payment.find(filter).sort({ date: 1, _id: 1 });

  const rows = payments.map((pm) => ({
    date: pm.date,
    paymentCode: pm.paymentCode,
    partyName: pm.partyName ?? '',
    purpose: pm.purpose,
    method: pm.method,
    reference: pm.reference ?? '',
    moneyIn: pm.direction === 'IN' ? pm.amount : 0,
    moneyOut: pm.direction === 'OUT' ? pm.amount : 0,
    refCode: pm.refCode ?? '',
    recordedByName: pm.recordedByName ?? '',
  }));

  const totals = sumCols(rows, ['moneyIn', 'moneyOut']);
  totals.net = round2(totals.moneyIn - totals.moneyOut);

  return {
    title: 'Cash Book',
    period: p.label,
    columns: [
      col('date', 'Date', 'date'),
      col('paymentCode', 'Payment No.'),
      col('partyName', 'Party'),
      col('purpose', 'Purpose'),
      col('method', 'Method'),
      col('reference', 'Reference'),
      col('moneyIn', 'Money In', 'money'),
      col('moneyOut', 'Money Out', 'money'),
      col('refCode', 'Against'),
      col('recordedByName', 'Recorded By'),
    ],
    rows,
    totals,
    meta: { count: rows.length },
  };
}

export async function outstandingReport({ kind = 'receivable' } = {}) {
  const field = kind === 'payable' ? 'balances.payable' : 'balances.receivable';
  const parties = await Party.find({ [field]: { $gt: 0 } }).sort({ [field]: -1 });

  const rows = parties.map((pt) => ({
    partyCode: pt.partyCode,
    name: pt.name,
    roles: pt.roles.join(' / '),
    village: pt.village ?? '',
    phone: pt.phone ?? '',
    amount: kind === 'payable' ? pt.balances.payable : pt.balances.receivable,
    loanOutstanding: pt.balances.loanOutstanding,
  }));

  return {
    title: kind === 'payable' ? 'Amounts We Owe' : 'Amounts Owed To Us',
    period: `As at ${fmt(new Date())}`,
    columns: [
      col('partyCode', 'Code'),
      col('name', 'Party'),
      col('roles', 'Roles'),
      col('village', 'Village'),
      col('phone', 'Phone'),
      col('amount', kind === 'payable' ? 'We Owe' : 'They Owe', 'money'),
      col('loanOutstanding', 'Advance Outstanding', 'money'),
    ],
    rows,
    totals: sumCols(rows, ['amount', 'loanOutstanding']),
    meta: { count: rows.length },
  };
}

export async function expenseReport({ from, to, category } = {}) {
  const p = period(from, to);
  const filter = { date: { $gte: p.start, $lte: p.end } };
  if (category) filter.category = category;

  const expenses = await Expense.find(filter).sort({ date: 1 });

  const rows = expenses.map((e) => ({
    date: e.date,
    expenseCode: e.expenseCode,
    category: e.category,
    description: e.description,
    partyName: e.partyName ?? '',
    method: e.method,
    amount: e.amount,
    recordedByName: e.recordedByName ?? '',
  }));

  const byCategory = {};
  for (const r of rows) byCategory[r.category] = round2((byCategory[r.category] ?? 0) + r.amount);

  return {
    title: 'Expense Register',
    period: p.label,
    columns: [
      col('date', 'Date', 'date'),
      col('expenseCode', 'Expense No.'),
      col('category', 'Category'),
      col('description', 'Description'),
      col('partyName', 'Paid To'),
      col('method', 'Method'),
      col('amount', 'Amount', 'money'),
      col('recordedByName', 'Recorded By'),
    ],
    rows,
    totals: sumCols(rows, ['amount']),
    meta: { count: rows.length, byCategory, financial: true },
  };
}

/**
 * Profit and loss (Section 42).
 *
 * Deliberately labelled a management summary rather than a statutory statement:
 * it reports what the transaction data supports - revenue, cost of goods at the
 * cost snapshotted on each sale, and recorded operating expenses.
 */
export async function profitReport({ from, to } = {}) {
  const p = period(from, to);
  const range = { $gte: p.start, $lte: p.end };

  const [marginRows, expenseRows, procurement] = await Promise.all([
    Sale.aggregate([
      { $match: { date: range } },
      { $unwind: '$items' },
      {
        $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' },
      },
      { $unwind: '$p' },
      {
        $group: {
          _id: '$p.category',
          revenue: { $sum: '$items.lineTotal' },
          cogs: { $sum: { $multiply: ['$items.qty', '$items.costAtSale'] } },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { date: range } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    Purchase.aggregate([
      { $match: { date: range } },
      {
        $group: {
          _id: '$isProcurement',
          gross: { $sum: '$grossAmount' },
          net: { $sum: '$netPayable' },
        },
      },
    ]),
  ]);

  const categories = await Category.find({ _id: { $in: marginRows.map((r) => r._id) } })
    .select('name kind');
  const catOf = Object.fromEntries(categories.map((c) => [String(c._id), c]));

  const byCategory = marginRows.map((r) => ({
    name: catOf[String(r._id)]?.name ?? 'Uncategorised',
    kind: catOf[String(r._id)]?.kind ?? 'OTHER',
    revenue: round2(r.revenue),
    cogs: round2(r.cogs),
    margin: round2(r.revenue - r.cogs),
  })).sort((a, b) => b.revenue - a.revenue);

  const revenue = round2(byCategory.reduce((a, r) => a + r.revenue, 0));
  const cogs = round2(byCategory.reduce((a, r) => a + r.cogs, 0));
  const grossProfit = round2(revenue - cogs);
  const expenses = round2(expenseRows.reduce((a, r) => a + r.total, 0));

  const rows = [
    { line: 'Revenue', amount: revenue, note: 'Sales of inputs and commodities' },
    { line: 'Less: Cost of goods sold', amount: -cogs, note: 'At cost recorded on each sale' },
    { line: 'Gross profit', amount: grossProfit, note: revenue > 0 ? `${round2((grossProfit / revenue) * 100)}% of revenue` : '' },
    ...expenseRows.map((e) => ({
      line: `Less: ${titleCase(e._id)}`,
      amount: -round2(e.total),
      note: 'Operating expense',
    })),
    { line: 'Operating profit', amount: round2(grossProfit - expenses), note: 'Gross profit less recorded expenses' },
  ];

  return {
    title: 'Profit and Loss (Management Summary)',
    period: p.label,
    columns: [col('line', 'Item'), col('amount', 'Amount', 'money'), col('note', 'Note')],
    rows,
    totals: { amount: round2(grossProfit - expenses) },
    meta: {
      financial: true,
      revenue,
      cogs,
      grossProfit,
      grossMarginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
      expenses,
      operatingProfit: round2(grossProfit - expenses),
      byCategory,
      procurementGross: round2(procurement.find((r) => r._id === true)?.gross ?? 0),
      procurementNet: round2(procurement.find((r) => r._id === true)?.net ?? 0),
      note:
        'A management summary derived from recorded transactions, not a statutory financial ' +
        'statement. Depreciation, accruals, taxation and opening/closing stock adjustments are ' +
        'not included. Have it reviewed by the business accountant before filing.',
    },
  };
}

const titleCase = (s) =>
  String(s).toLowerCase().split('_').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');

function sumCols(rows, keys) {
  const out = {};
  for (const k of keys) out[k] = round2(rows.reduce((a, r) => a + Number(r[k] || 0), 0));
  return out;
}

/**
 * Registry so one export endpoint can serve every report.
 *
 * `permission` is the report's usual classification. It is not the whole control:
 * a report can change shape with its parameters (the sales register becomes a
 * margin analysis under `?groupBy=product`), so the route also inspects the
 * produced `meta.financial` flag before returning anything.
 */
export const REPORTS = Object.freeze({
  sales: {
    run: salesReport,
    permission: 'reports:read',
    label: 'Sales register',
    description: 'Every sale in the period, or grouped by product to show margin.',
  },
  purchases: {
    run: purchaseReport,
    permission: 'reports:read',
    label: 'Purchases and procurement',
    description: 'Goods bought in, from suppliers and from farmers.',
  },
  inventory: {
    run: inventoryReport,
    permission: 'reports:financial',
    label: 'Stock valuation',
    description: 'Stock on hand with its value at weighted-average cost.',
  },
  'stock-movements': {
    run: stockMovementReport,
    permission: 'reports:read',
    label: 'Stock movements',
    description: 'Every movement in and out, with the document that caused it.',
  },
  farmers: {
    run: farmerReport,
    permission: 'reports:read',
    label: 'Farmer summary',
    description: 'Per farmer: inputs bought, produce sold to us, advances outstanding.',
  },
  lending: {
    run: lendingReport,
    permission: 'reports:read',
    label: 'Advances',
    description: 'Advances outstanding, repaid and overdue.',
  },
  'cash-book': {
    run: cashBookReport,
    permission: 'reports:financial',
    label: 'Cash book',
    description: 'Money in and out, by date and method.',
  },
  outstanding: {
    run: outstandingReport,
    permission: 'reports:read',
    label: 'Outstanding balances',
    description: 'Who owes us, and who we owe.',
  },
  expenses: {
    run: expenseReport,
    permission: 'reports:financial',
    label: 'Expenses',
    description: 'Business expenses by category.',
  },
  profit: {
    run: profitReport,
    permission: 'reports:financial',
    label: 'Profit and loss',
    description: 'Management summary of revenue, cost of goods sold and expenses.',
  },
});
