import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validateQuery } from '../middleware/validate.js';
import { PAYMENT_METHODS } from '../models/Payment.js';
import { listPayments } from '../services/listing.js';
import { asyncHandler } from '../utils/errors.js';
import { listPaymentsQuery } from '../validators/index.js';

export const paymentsRouter = Router();

/**
 * The cash book (Section 29) - every rupee in and out, read-only.
 *
 * Payments are never created here. A payment always belongs to something: a sale
 * receipt, a purchase settlement, an advance paid out, a repayment, an expense.
 * Each of those has its own endpoint which writes the payment inside the same
 * transaction as the thing that caused it. An endpoint that could mint a
 * free-floating payment would be a hole straight through Section 41 - cash in the
 * book that no document explains.
 *
 * A loan recovery netted off a procurement settlement deliberately has no row
 * here, because no money moved. It appears in the advance's repayment history
 * instead. Including it would overstate the day's takings.
 */
paymentsRouter.get(
  '/',
  requirePermission('payments:read'),
  validateQuery(listPaymentsQuery),
  asyncHandler(async (req, res) => {
    res.json({
      ...(await listPayments(req.valid.query)),
      methods: PAYMENT_METHODS,
    });
  }),
);
