import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { getInvoiceBySale, getSale, listSales } from '../services/listing.js';
import { createSale, recordSalePayment } from '../services/sales.js';
import { asyncHandler } from '../utils/errors.js';
import {
  createSaleSchema,
  idParam,
  listSalesQuery,
  recordPaymentSchema,
} from '../validators/index.js';

export const salesRouter = Router();

/**
 * Sales (Section 23).
 *
 * `POST /` is the single busiest write in the system and the clearest instance of
 * Section 41: one call reduces stock, writes the ledger rows, raises the invoice,
 * records the cash tendered and moves the customer's receivable - all inside one
 * transaction, so a failure part-way leaves none of it.
 *
 * There is no PATCH and no DELETE. A posted sale has moved stock and money; the
 * correction for a mistake is a return or an adjustment, both of which leave the
 * original on record. That is why `sales:update` and `sales:delete` exist in the
 * permission matrix but no route consumes them yet - they are reserved for the
 * returns screen rather than quietly enabling a destructive edit.
 */
salesRouter.get(
  '/',
  requirePermission('sales:read'),
  validateQuery(listSalesQuery),
  asyncHandler(async (req, res) => {
    res.json(await listSales(req.valid.query));
  }),
);

salesRouter.get(
  '/:id',
  requirePermission('sales:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json(await getSale(req.valid.params.id));
  }),
);

/** Lets the sale screen jump straight to its invoice without a second lookup. */
salesRouter.get(
  '/:id/invoice',
  requirePermission('invoices:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json({ invoice: await getInvoiceBySale(req.valid.params.id) });
  }),
);

salesRouter.post(
  '/',
  requirePermission('sales:create'),
  validate(createSaleSchema),
  asyncHandler(async (req, res) => {
    const { sale, invoice, payment } = await createSale({
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ sale, invoice, payment });
  }),
);

/** A part-payment collected later (Section 29). */
salesRouter.post(
  '/:id/payments',
  requirePermission('payments:create'),
  validateParams(idParam),
  validate(recordPaymentSchema),
  asyncHandler(async (req, res) => {
    const { sale, payment } = await recordSalePayment({
      saleId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ sale, payment });
  }),
);
