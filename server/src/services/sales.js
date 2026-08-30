import { withTransaction } from '../config/db.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { getSettings } from '../models/Setting.js';
import { badRequest, notFound } from '../utils/errors.js';
import { round2, round3 } from '../utils/money.js';
import { writeAudit } from './audit.js';
import { createInvoiceForSale } from './invoicing.js';
import { postMovement } from './ledger.js';
import { paymentStatusFor, postPayment } from './payments.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';

/**
 * Create a sale - the flagship of the "one transaction updates every related
 * part of the business" rule (Sections 23 and 41).
 *
 * A single atomic transaction:
 *
 *     validate stock
 *        -> post one SALE movement per line (stock down, ledger row)
 *        -> create the Sale
 *        -> create the Invoice
 *        -> record the Payment, if anything was tendered
 *        -> move the customer's receivable balance
 *        -> write the audit entry
 *
 * If any step fails, all of it unwinds. There is no code path that can reduce
 * stock without producing an invoice, or bill a customer without moving their
 * balance.
 */
export async function createSale({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const date = payload.date ? new Date(payload.date) : new Date();

    const party = await Party.findById(payload.partyId).session(session);
    if (!party) throw notFound('Customer not found.');
    if (!party.isActive) throw badRequest(`${party.name} is marked inactive.`);

    /**
     * Selling to a party who is currently only a farmer makes them a customer
     * too. Section 39 wants one Ravi Kumar holding several relationships, not a
     * second record, so we widen the existing party rather than refusing.
     */
    const roleAdded = !party.roles.includes('customer');
    if (roleAdded) party.roles.push('customer');

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw badRequest('A sale must contain at least one line item.');
    }

    // ---- Build the lines, snapshotting product details -------------------
    const taxEnabled = Boolean(settings.tax.enabled);
    const items = [];
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let isCommoditySale = false;

    for (const raw of payload.items) {
      const product = await Product.findById(raw.productId)
        .populate('unit', 'symbol')
        .session(session);
      if (!product) throw notFound(`Product ${raw.productId} not found.`);
      if (!product.isActive) throw badRequest(`${product.name} is marked inactive.`);

      const qty = round3(raw.qty);
      if (qty <= 0) throw badRequest(`Quantity for ${product.name} must be greater than zero.`);

      const rate = round2(raw.rate ?? product.sellingPrice);
      const discount = round2(raw.discount ?? 0);
      const gross = round2(qty * rate);

      if (discount > gross) {
        throw badRequest(`Discount on ${product.name} cannot exceed the line value.`);
      }

      const taxRatePct = taxEnabled ? Number(raw.taxRatePct ?? product.taxRatePct ?? 0) : 0;
      const taxAmount = taxEnabled ? round2(((gross - discount) * taxRatePct) / 100) : 0;
      const lineTotal = round2(gross - discount + taxAmount);

      if (product.isCommodity) isCommoditySale = true;

      items.push({
        product: product._id,
        productCode: product.productCode,
        productName: product.name,
        unitSymbol: product.unit?.symbol ?? '',
        qty,
        rate,
        discount,
        taxRatePct,
        taxAmount,
        lineTotal,
        // Captured now so gross margin stays computable even after the
        // product's average cost moves on later receipts.
        costAtSale: round2(product.avgCost),
      });

      subtotal = round2(subtotal + gross);
      discountTotal = round2(discountTotal + discount);
      taxTotal = round2(taxTotal + taxAmount);
    }

    const grandTotal = round2(subtotal - discountTotal + taxTotal);
    const amountPaid = round2(payload.amountPaid ?? 0);

    if (amountPaid > grandTotal) {
      throw badRequest(
        `Amount paid (${amountPaid}) is more than the sale total (${grandTotal}). ` +
          'Record the excess as a separate advance instead.',
      );
    }

    const outstanding = round2(grandTotal - amountPaid);
    const paymentStatus = paymentStatusFor(grandTotal, amountPaid);

    // ---- Create the sale --------------------------------------------------
    const saleCode = await nextDocNumber(DOC_PREFIX.SALE, { session, date });

    const [sale] = await Sale.create(
      [
        {
          saleCode,
          party: party._id,
          partyName: party.name,
          partyPhone: party.phone,
          date,
          items,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          amountPaid,
          outstanding,
          paymentStatus,
          isCommoditySale,
          notes: payload.notes ?? '',
          createdBy: actor._id,
          createdByName: actor.name,
        },
      ],
      { session },
    );

    // ---- Stock out, one ledger row per line ------------------------------
    for (const item of items) {
      await postMovement({
        session,
        productId: item.product,
        type: 'SALE',
        qtyDelta: -item.qty,
        unitCost: item.costAtSale,
        refModel: 'Sale',
        refId: sale._id,
        refCode: sale.saleCode,
        remarks: `Sold to ${party.name}`,
        actor,
        date,
      });
    }

    // ---- Invoice ---------------------------------------------------------
    const invoice = await createInvoiceForSale({ session, sale, party, settings, actor });
    sale.invoice = invoice._id;
    sale.invoiceCode = invoice.invoiceCode;
    await sale.save({ session });

    // ---- Payment, if any money changed hands now -------------------------
    let payment = null;
    if (amountPaid > 0) {
      payment = await postPayment({
        session,
        direction: 'IN',
        amount: amountPaid,
        method: payload.paymentMethod ?? 'CASH',
        reference: payload.paymentReference ?? '',
        party,
        refModel: 'Sale',
        refId: sale._id,
        refCode: sale.saleCode,
        purpose: 'SALE_RECEIPT',
        remarks: `Receipt against ${invoice.invoiceCode}`,
        actor,
        date,
      });
    }

    // ---- Customer balance ------------------------------------------------
    party.balances.receivable = round2(party.balances.receivable + outstanding);
    await party.save({ session });

    // ---- Audit -----------------------------------------------------------
    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'Sale',
      entityId: sale._id,
      entityCode: sale.saleCode,
      summary:
        `Sale ${sale.saleCode} to ${party.name} for ${grandTotal} ` +
        `(${items.length} line${items.length === 1 ? '' : 's'}, invoice ${invoice.invoiceCode})` +
        (roleAdded ? ' - party also granted the customer role' : ''),
      req,
    });

    return { sale, invoice, payment };
  });
}

/**
 * Record a later payment against an existing sale (Section 29).
 *
 * Updates the sale, its invoice and the customer's receivable together, so a
 * part-payment taken next week cannot leave the three disagreeing.
 */
export async function recordSalePayment({ saleId, payload, actor, req }) {
  const { syncInvoicePayment } = await import('./invoicing.js');

  return withTransaction(async (session) => {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) throw notFound('Sale not found.');

    const amount = round2(payload.amount);
    if (amount <= 0) throw badRequest('Payment amount must be greater than zero.');
    if (amount > sale.outstanding) {
      throw badRequest(
        `Payment of ${amount} exceeds the outstanding balance of ${sale.outstanding}.`,
      );
    }

    const party = await Party.findById(sale.party).session(session);
    if (!party) throw notFound('Customer not found.');

    const date = payload.date ? new Date(payload.date) : new Date();

    sale.amountPaid = round2(sale.amountPaid + amount);
    sale.outstanding = round2(sale.grandTotal - sale.amountPaid);
    sale.paymentStatus = paymentStatusFor(sale.grandTotal, sale.amountPaid);
    await sale.save({ session });

    await syncInvoicePayment({ session, sale });

    const payment = await postPayment({
      session,
      direction: 'IN',
      amount,
      method: payload.method ?? 'CASH',
      reference: payload.reference ?? '',
      party,
      refModel: 'Sale',
      refId: sale._id,
      refCode: sale.saleCode,
      purpose: 'SALE_RECEIPT',
      remarks: payload.remarks ?? `Receipt against ${sale.invoiceCode ?? sale.saleCode}`,
      actor,
      date,
    });

    party.balances.receivable = round2(party.balances.receivable - amount);
    await party.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'PAYMENT',
      entity: 'Sale',
      entityId: sale._id,
      entityCode: sale.saleCode,
      summary: `Received ${amount} from ${party.name} against ${sale.saleCode}`,
      changes: [{ field: 'outstanding', from: round2(sale.outstanding + amount), to: sale.outstanding }],
      req,
    });

    return { sale, payment };
  });
}
