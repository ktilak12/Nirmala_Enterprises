import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { LOAN_ADJUSTMENT_TYPES } from '../models/Loan.js';
import {
  addLoanAdjustment,
  cancelLoan,
  createLoan,
  recordRepayment,
} from '../services/lending.js';
import { getLoan, listLoans } from '../services/listing.js';
import { asyncHandler } from '../utils/errors.js';
import {
  cancelLoanSchema,
  createLoanSchema,
  idParam,
  listLoansQuery,
  loanAdjustmentSchema,
  recordPaymentSchema,
} from '../validators/index.js';

export const loansRouter = Router();

/**
 * Farmer advances (Sections 26 to 28).
 *
 * No interest is calculated anywhere. The concept document says any interest or
 * fee rules "should be confirmed with the business/accountant before
 * implementation", so instead of inventing a rate this system takes every charge
 * as an explicit, labelled adjustment entered by a named user - which the audit
 * trail then attributes. If the business later confirms a rate, it becomes a
 * helper that proposes an adjustment; it does not become a silent accrual.
 */
loansRouter.get(
  '/',
  requirePermission('loans:read'),
  validateQuery(listLoansQuery),
  asyncHandler(async (req, res) => {
    res.json({
      ...(await listLoans(req.valid.query)),
      adjustmentTypes: LOAN_ADJUSTMENT_TYPES,
    });
  }),
);

loansRouter.get(
  '/:id',
  requirePermission('loans:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json(await getLoan(req.valid.params.id));
  }),
);

loansRouter.post(
  '/',
  requirePermission('loans:create'),
  validate(createLoanSchema),
  asyncHandler(async (req, res) => {
    const { loan, payment } = await createLoan({
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ loan, payment });
  }),
);

/**
 * A repayment in cash at the counter. The other way an advance comes down is a
 * LOAN_RECOVERY adjustment on a procurement settlement - see purchases.routes.js.
 * Both paths run through the same `applyRepayment`, so the records are identical
 * whichever way the farmer settled.
 */
loansRouter.post(
  '/:id/repayments',
  requirePermission('payments:create'),
  validateParams(idParam),
  validate(recordPaymentSchema),
  asyncHandler(async (req, res) => {
    const result = await recordRepayment({
      loanId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json(result);
  }),
);

/** A hand-entered fee, interest or discount line (Section 27). */
loansRouter.post(
  '/:id/adjustments',
  requirePermission('loans:update'),
  validateParams(idParam),
  validate(loanAdjustmentSchema),
  asyncHandler(async (req, res) => {
    const loan = await addLoanAdjustment({
      loanId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ loan });
  }),
);

/**
 * Cancelling is a status change with a mandatory reason, not a delete. An advance
 * that was paid out moved real cash; erasing the record would leave that payment
 * unexplained. `loans:delete` is therefore held by the administrator alone and
 * still only reaches this route.
 */
loansRouter.post(
  '/:id/cancel',
  requirePermission('loans:delete'),
  validateParams(idParam),
  validate(cancelLoanSchema),
  asyncHandler(async (req, res) => {
    const loan = await cancelLoan({
      loanId: req.valid.params.id,
      reason: req.valid.body.reason,
      actor: req.user,
      req,
    });
    res.json({ loan, message: 'Advance cancelled. The record stays on file.' });
  }),
);
