import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { getInvoice, listInvoices } from '../services/listing.js';
import { renderInvoicePdf } from '../services/pdf.js';
import { asyncHandler } from '../utils/errors.js';
import { idParam, listSalesQuery } from '../validators/index.js';

export const invoicesRouter = Router();

/**
 * Invoices (Sections 31 and 32).
 *
 * Invoices are immutable. There is no create route - an invoice is raised by the
 * sale that it bills, inside that sale's transaction - and no edit route, because
 * altering a document already handed to a customer is not a correction, it is a
 * discrepancy. Everything printed comes from the invoice's own snapshot of names,
 * addresses and prices, so a reprint years later shows the deal as it was struck.
 */
invoicesRouter.get(
  '/',
  requirePermission('invoices:read'),
  validateQuery(listSalesQuery),
  asyncHandler(async (req, res) => {
    res.json(await listInvoices(req.valid.query));
  }),
);

invoicesRouter.get(
  '/:id',
  requirePermission('invoices:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json({ invoice: await getInvoice(req.valid.params.id) });
  }),
);

/**
 * The printable PDF.
 *
 * `?download=1` forces a save dialog; without it the browser previews inline,
 * which is what the print button wants. Headers go out before the first byte is
 * piped, so an invoice that does not exist still produces a clean JSON 404 rather
 * than a corrupt half-PDF.
 */
invoicesRouter.get(
  '/:id/pdf',
  requirePermission('invoices:print'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const { invoice, pipeTo } = await renderInvoicePdf(req.valid.params.id);

    const disposition = req.query.download ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${invoice.invoiceCode}.pdf"`,
    );
    res.setHeader('Cache-Control', 'no-store');

    pipeTo(res);
  }),
);
