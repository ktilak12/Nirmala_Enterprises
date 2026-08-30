import { Invoice } from '../models/Invoice.js';
import { Loan } from '../models/Loan.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { Purchase } from '../models/Purchase.js';
import { Sale } from '../models/Sale.js';
import { escapeRegex } from './parties.js';

/**
 * Global search (Section 35).
 *
 * One box that finds a farmer by name, phone or village, a product by name or
 * code, and any document by its number. Everything is queried in parallel and
 * capped tightly, because this fires on every keystroke.
 */
const PER_TYPE = 5;

export async function globalSearch(term, { permissions = [] } = {}) {
  const q = String(term ?? '').trim();
  if (q.length < 2) return { query: q, groups: [] };

  const rx = new RegExp(escapeRegex(q), 'i');
  const can = (p) => permissions.includes('*') || permissions.includes(p);

  const tasks = [];

  if (can('parties:read')) {
    tasks.push(
      Party.find({ $or: [{ name: rx }, { partyCode: rx }, { phone: rx }, { village: rx }] })
        .select('partyCode name phone village roles balances')
        .limit(PER_TYPE)
        .then((rows) => ({
          type: 'party',
          label: 'People',
          rows: rows.map((p) => ({
            id: p._id,
            code: p.partyCode,
            title: p.name,
            subtitle: [p.village, p.phone].filter(Boolean).join(' - '),
            meta: p.roles.join(' / '),
            href: `/admin/parties/${p._id}`,
          })),
        })),
    );
  }

  if (can('products:read')) {
    tasks.push(
      Product.find({ $or: [{ name: rx }, { productCode: rx }, { brand: rx }] })
        .select('productCode name brand currentStock sellingPrice')
        .limit(PER_TYPE)
        .then((rows) => ({
          type: 'product',
          label: 'Products',
          rows: rows.map((p) => ({
            id: p._id,
            code: p.productCode,
            title: p.name,
            subtitle: p.brand ?? '',
            meta: `${p.currentStock} in stock`,
            href: `/admin/products/${p._id}`,
          })),
        })),
    );
  }

  if (can('sales:read')) {
    tasks.push(
      Sale.find({ $or: [{ saleCode: rx }, { partyName: rx }] })
        .select('saleCode partyName date grandTotal paymentStatus')
        .sort({ date: -1 })
        .limit(PER_TYPE)
        .then((rows) => ({
          type: 'sale',
          label: 'Sales',
          rows: rows.map((s) => ({
            id: s._id,
            code: s.saleCode,
            title: s.partyName,
            subtitle: new Date(s.date).toLocaleDateString('en-IN'),
            meta: `${s.grandTotal} - ${s.paymentStatus}`,
            href: `/admin/sales/${s._id}`,
          })),
        })),
    );
  }

  if (can('purchases:read')) {
    tasks.push(
      Purchase.find({ $or: [{ purchaseCode: rx }, { partyName: rx }, { referenceNo: rx }] })
        .select('purchaseCode partyName date netPayable isProcurement paymentStatus')
        .sort({ date: -1 })
        .limit(PER_TYPE)
        .then((rows) => ({
          type: 'purchase',
          label: 'Purchases',
          rows: rows.map((p) => ({
            id: p._id,
            code: p.purchaseCode,
            title: p.partyName,
            subtitle: p.isProcurement ? 'Farmer procurement' : 'Supplier purchase',
            meta: `${p.netPayable} - ${p.paymentStatus}`,
            href: `/admin/purchases/${p._id}`,
          })),
        })),
    );
  }

  if (can('invoices:read')) {
    tasks.push(
      Invoice.find({ $or: [{ invoiceCode: rx }, { 'buyer.name': rx }] })
        .select('invoiceCode buyer.name date grandTotal paymentStatus')
        .sort({ date: -1 })
        .limit(PER_TYPE)
        .then((rows) => ({
          type: 'invoice',
          label: 'Invoices',
          rows: rows.map((i) => ({
            id: i._id,
            code: i.invoiceCode,
            title: i.buyer?.name ?? '',
            subtitle: new Date(i.date).toLocaleDateString('en-IN'),
            meta: `${i.grandTotal} - ${i.paymentStatus}`,
            href: `/admin/invoices/${i._id}`,
          })),
        })),
    );
  }

  if (can('loans:read')) {
    tasks.push(
      Loan.find({ $or: [{ loanCode: rx }, { partyName: rx }] })
        .select('loanCode partyName date principal outstanding status')
        .sort({ date: -1 })
        .limit(PER_TYPE)
        .then((rows) => ({
          type: 'loan',
          label: 'Advances',
          rows: rows.map((l) => ({
            id: l._id,
            code: l.loanCode,
            title: l.partyName,
            subtitle: `Advance of ${l.principal}`,
            meta: `${l.outstanding} outstanding - ${l.status}`,
            href: `/admin/lending/${l._id}`,
          })),
        })),
    );
  }

  const groups = (await Promise.all(tasks)).filter((g) => g.rows.length > 0);
  return { query: q, groups };
}
