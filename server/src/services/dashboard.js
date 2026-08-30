import { Category } from '../models/Catalog.js';
import { Loan } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { Expense, Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { round2 } from '../utils/money.js';

/**
 * Dashboard aggregations (Sections 12, 13, 22 and 42).
 *
 * Everything here is computed by the database from the transaction collections,
 * never from a running total somebody could have edited. The consequence is
 * that the dashboard cannot disagree with the reports - they read the same rows.
 *
 * Financial figures (margin, profit) are separated into `financials` so the
 * route can withhold that block from a role holding `reports:read` but not
 * `reports:financial` (Section 37).
 */

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

async function sum(Model, match, field) {
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } },
  ]);
  return { total: round2(row?.total ?? 0), count: row?.count ?? 0 };
}

export async function getDashboard({ now = new Date() } = {}) {
  const today = dayRange(now);
  const month = monthRange(now);

  const [
    salesToday, salesMonth,
    purchasesToday, purchasesMonth,
    expensesMonth,
    cashInToday, cashOutToday,
    receivables, payables, lending,
    stockValue, lowStock,
    partyCounts,
    trend, categorySplit,
    recentSales, recentPurchases, overdueLoans,
    margin,
  ] = await Promise.all([
    sum(Sale, { date: { $gte: today.start, $lt: today.end } }, 'grandTotal'),
    sum(Sale, { date: { $gte: month.start, $lt: month.end } }, 'grandTotal'),
    sum(Purchase, { date: { $gte: today.start, $lt: today.end } }, 'netPayable'),
    sum(Purchase, { date: { $gte: month.start, $lt: month.end } }, 'netPayable'),
    sum(Expense, { date: { $gte: month.start, $lt: month.end } }, 'amount'),
    sum(Payment, { direction: 'IN', date: { $gte: today.start, $lt: today.end } }, 'amount'),
    sum(Payment, { direction: 'OUT', date: { $gte: today.start, $lt: today.end } }, 'amount'),

    // Aggregated from the party balances so the KPI matches every party screen.
    sum(Party, { 'balances.receivable': { $gt: 0 } }, 'balances.receivable'),
    sum(Party, { 'balances.payable': { $gt: 0 } }, 'balances.payable'),
    lendingOverview(now),

    inventoryValue(),
    Product.find({ isActive: true, minStock: { $gt: 0 }, $expr: { $lte: ['$currentStock', '$minStock'] } })
      .select('productCode name currentStock minStock')
      .populate('unit', 'symbol')
      .sort('currentStock')
      .limit(10),

    Party.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } },
    ]),

    monthlyTrend(now),
    categoryPerformance(month),

    Sale.find().sort({ date: -1, _id: -1 }).limit(8)
      .select('saleCode partyName date grandTotal paymentStatus'),
    Purchase.find().sort({ date: -1, _id: -1 }).limit(8)
      .select('purchaseCode partyName date netPayable isProcurement paymentStatus'),
    Loan.find({ status: 'OVERDUE' }).sort({ dueDate: 1 }).limit(8)
      .select('loanCode partyName principal outstanding dueDate'),

    grossMargin(month),
  ]);

  const parties = Object.fromEntries(partyCounts.map((r) => [r._id, r.count]));

  return {
    generatedAt: now,
    kpis: {
      salesToday: salesToday.total,
      salesTodayCount: salesToday.count,
      salesThisMonth: salesMonth.total,
      purchasesToday: purchasesToday.total,
      purchasesThisMonth: purchasesMonth.total,
      cashInToday: cashInToday.total,
      cashOutToday: cashOutToday.total,
      netCashToday: round2(cashInToday.total - cashOutToday.total),
      receivableTotal: receivables.total,
      receivableParties: receivables.count,
      payableTotal: payables.total,
      payableParties: payables.count,
      farmers: parties.farmer ?? 0,
      customers: parties.customer ?? 0,
      suppliers: parties.supplier ?? 0,
      lowStockCount: lowStock.length,
    },
    lending,
    inventory: { ...stockValue, lowStock },
    trend,
    categorySplit,
    recent: { sales: recentSales, purchases: recentPurchases, overdueLoans },

    /**
     * Withheld from roles lacking `reports:financial`. Sales staff should be
     * able to see today's takings without seeing the business's margin.
     */
    financials: {
      revenueThisMonth: salesMonth.total,
      costOfGoodsSold: margin.cogs,
      grossMargin: margin.gross,
      grossMarginPct: margin.pct,
      expensesThisMonth: expensesMonth.total,
      operatingProfit: round2(margin.gross - expensesMonth.total),
      inventoryValue: stockValue.totalValue,
    },
  };
}

/** Advances overview (Section 13). */
async function lendingOverview(now) {
  const [rows] = await Loan.aggregate([
    { $match: { status: { $ne: 'CANCELLED' } } },
    {
      $group: {
        _id: null,
        disbursed: { $sum: '$principal' },
        adjustments: { $sum: '$adjustmentTotal' },
        repaid: { $sum: '$totalRepaid' },
        outstanding: { $sum: '$outstanding' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byStatus = await Loan.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, outstanding: { $sum: '$outstanding' } } },
  ]);

  const overdue = await Loan.aggregate([
    { $match: { status: 'OVERDUE' } },
    { $group: { _id: null, total: { $sum: '$outstanding' }, count: { $sum: 1 } } },
  ]);

  return {
    totalDisbursed: round2(rows?.disbursed ?? 0),
    totalAdjustments: round2(rows?.adjustments ?? 0),
    totalRepaid: round2(rows?.repaid ?? 0),
    totalOutstanding: round2(rows?.outstanding ?? 0),
    activeCount: rows?.count ?? 0,
    overdueTotal: round2(overdue[0]?.total ?? 0),
    overdueCount: overdue[0]?.count ?? 0,
    byStatus: Object.fromEntries(
      byStatus.map((r) => [r._id, { count: r.count, outstanding: round2(r.outstanding) }]),
    ),
    now,
  };
}

/**
 * Inventory valued at weighted-average cost (Section 43).
 *
 * The plan flags that the exact valuation methodology must be agreed with the
 * business's accountant. Weighted average is what is implemented, and the method
 * is returned alongside the figure so no report shows a valuation without
 * saying how it was arrived at.
 */
async function inventoryValue() {
  const [row] = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalValue: { $sum: { $multiply: ['$currentStock', '$avgCost'] } },
        skuCount: { $sum: 1 },
        unitsOnHand: { $sum: '$currentStock' },
      },
    },
  ]);

  return {
    totalValue: round2(row?.totalValue ?? 0),
    skuCount: row?.skuCount ?? 0,
    unitsOnHand: round2(row?.unitsOnHand ?? 0),
    valuationMethod: 'WEIGHTED_AVERAGE',
  };
}

/** Twelve months of sales against purchases, for the trend chart. */
async function monthlyTrend(now) {
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const shape = (rows, field) =>
    Object.fromEntries(
      rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, round2(r[field])]),
    );

  const [sales, purchases] = await Promise.all([
    Sale.aggregate([
      { $match: { date: { $gte: start } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          total: { $sum: '$grandTotal' },
        },
      },
    ]),
    Purchase.aggregate([
      { $match: { date: { $gte: start } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          total: { $sum: '$netPayable' },
        },
      },
    ]),
  ]);

  const salesMap = shape(sales, 'total');
  const purchaseMap = shape(purchases, 'total');

  // Emit every month in the window, including the empty ones, so the chart's
  // x-axis is continuous instead of skipping a quiet month.
  const series = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    series.push({
      month: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      sales: salesMap[key] ?? 0,
      purchases: purchaseMap[key] ?? 0,
    });
  }
  return series;
}

/** Which categories are actually earning, this month (Section 42). */
async function categoryPerformance({ start, end }) {
  const rows = await Sale.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        revenue: { $sum: '$items.lineTotal' },
        cost: { $sum: { $multiply: ['$items.qty', '$items.costAtSale'] } },
        qty: { $sum: '$items.qty' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  const categories = await Category.find({ _id: { $in: rows.map((r) => r._id) } }).select('name kind');
  const nameOf = Object.fromEntries(categories.map((c) => [String(c._id), c]));

  return rows.map((r) => ({
    categoryId: r._id,
    name: nameOf[String(r._id)]?.name ?? 'Uncategorised',
    kind: nameOf[String(r._id)]?.kind ?? 'OTHER',
    revenue: round2(r.revenue),
    cost: round2(r.cost),
    margin: round2(r.revenue - r.cost),
    qty: round2(r.qty),
  }));
}

/**
 * Gross margin from the cost snapshotted on each sale line at the moment of
 * sale, not from today's average cost. Recosting old sales at today's prices
 * would rewrite last month's profit every time a new lot arrives.
 */
async function grossMargin({ start, end }) {
  const [row] = await Sale.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$items.lineTotal' },
        cogs: { $sum: { $multiply: ['$items.qty', '$items.costAtSale'] } },
      },
    },
  ]);

  const revenue = round2(row?.revenue ?? 0);
  const cogs = round2(row?.cogs ?? 0);
  const gross = round2(revenue - cogs);

  return { revenue, cogs, gross, pct: revenue > 0 ? round2((gross / revenue) * 100) : 0 };
}

export { dayRange, monthRange };
