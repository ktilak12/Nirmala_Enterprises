import { Invoice } from '../models/Invoice.js';
import { round2 } from '../utils/money.js';
import { amountToWords } from '../utils/words.js';
import { DOC_PREFIX, nextDocNumber } from './numbering.js';

/**
 * Create the invoice for a sale (Sections 31 and 32).
 *
 * Called only from inside the sale transaction, so a sale can never exist
 * without its invoice, nor an invoice without its sale.
 *
 * Everything is copied rather than referenced: the seller's own address and
 * GSTIN, the buyer's details, and every line. A reprint years later must show
 * what the customer was actually handed, even if the business has since moved
 * or a product has been renamed.
 */
export async function createInvoiceForSale({ session, sale, party, settings, actor }) {
  const invoiceCode = await nextDocNumber(settings.invoice.prefix || DOC_PREFIX.INVOICE, {
    session,
    date: sale.date,
  });

  const [invoice] = await Invoice.create(
    [
      {
        invoiceCode,
        sale: sale._id,
        saleCode: sale.saleCode,
        date: sale.date,

        seller: {
          name: settings.company.name,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
          // Only stamped when tax is actually in force, so a tax-free invoice
          // never carries a stray registration number.
          gstin: settings.tax.enabled ? settings.tax.gstin : '',
        },

        party: party._id,
        buyer: {
          partyCode: party.partyCode,
          name: party.name,
          phone: party.phone,
          address: party.address,
          village: party.village,
          gstin: party.customerProfile?.gstin ?? '',
        },

        items: sale.items.map((i) => ({
          productCode: i.productCode,
          productName: i.productName,
          unitSymbol: i.unitSymbol,
          qty: i.qty,
          rate: i.rate,
          discount: i.discount,
          taxRatePct: i.taxRatePct,
          taxAmount: i.taxAmount,
          lineTotal: i.lineTotal,
        })),

        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        taxEnabled: Boolean(settings.tax.enabled),
        taxTotal: sale.taxTotal,
        grandTotal: sale.grandTotal,
        amountPaid: sale.amountPaid,
        outstanding: sale.outstanding,
        paymentStatus: sale.paymentStatus,

        amountInWords: amountToWords(sale.grandTotal),
        terms: settings.invoice.terms,
        footerNote: settings.invoice.footerNote,

        createdBy: actor._id,
        createdByName: actor.name,
      },
    ],
    { session },
  );

  return invoice;
}

/**
 * Keep the invoice's payment figures in step when a later payment is recorded
 * against the sale. Runs in the payment's own transaction.
 */
export async function syncInvoicePayment({ session, sale }) {
  await Invoice.updateOne(
    { sale: sale._id },
    {
      $set: {
        amountPaid: round2(sale.amountPaid),
        outstanding: round2(sale.outstanding),
        paymentStatus: sale.paymentStatus,
      },
    },
    { session },
  );
}
