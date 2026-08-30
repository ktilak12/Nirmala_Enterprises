import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { getPurchase, listPurchases } from '../services/listing.js';
import { createPurchase, recordPurchasePayment } from '../services/purchases.js';
import { asyncHandler } from '../utils/errors.js';
import {
  createPurchaseSchema,
  idParam,
  listPurchasesQuery,
  recordPaymentSchema,
} from '../validators/index.js';

export const purchasesRouter = Router();

/**
 * Purchases from suppliers (Section 24) and commodity procurement from farmers
 * (Section 25) - one route, distinguished by `isProcurement`.
 *
 * They share a route because they are the same movement of goods and money in
 * opposite directions from a sale; only the counterparty's role and the presence
 * of `adjustments[]` differ. Procurement is where the concept document's whole
 * loop closes: an adjustment of type LOAN_RECOVERY reduces the farmer's advance
 * inside this transaction, so `gross - adjustments = net payable` and the debt
 * comes down together, or neither happens.
 */
purchasesRouter.get(
  '/',
  requirePermission('purchases:read'),
  validateQuery(listPurchasesQuery),
  asyncHandler(async (req, res) => {
    res.json(await listPurchases(req.valid.query));
  }),
);

purchasesRouter.get(
  '/:id',
  requirePermission('purchases:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json(await getPurchase(req.valid.params.id));
  }),
);

purchasesRouter.post(
  '/',
  requirePermission('purchases:create'),
  validate(createPurchaseSchema),
  asyncHandler(async (req, res) => {
    const { purchase, payment, repayments } = await createPurchase({
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ purchase, payment, repayments });
  }),
);

purchasesRouter.post(
  '/:id/payments',
  requirePermission('payments:create'),
  validateParams(idParam),
  validate(recordPaymentSchema),
  asyncHandler(async (req, res) => {
    const { purchase, payment } = await recordPurchasePayment({
      purchaseId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ purchase, payment });
  }),
);
