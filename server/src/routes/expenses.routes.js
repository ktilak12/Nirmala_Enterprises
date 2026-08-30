import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { EXPENSE_CATEGORIES } from '../models/Payment.js';
import { createExpense } from '../services/expenses.js';
import { listExpenses } from '../services/listing.js';
import { asyncHandler } from '../utils/errors.js';
import { createExpenseSchema, listExpensesQuery } from '../validators/index.js';

export const expensesRouter = Router();

/**
 * Business expenses (Section 30).
 *
 * Recording an expense writes both the expense and its outgoing cash-book entry
 * in one transaction, so the two can never disagree about how much left the till.
 */
expensesRouter.get(
  '/',
  requirePermission('expenses:read'),
  validateQuery(listExpensesQuery),
  asyncHandler(async (req, res) => {
    res.json({
      ...(await listExpenses(req.valid.query)),
      categories: EXPENSE_CATEGORIES,
    });
  }),
);

expensesRouter.post(
  '/',
  requirePermission('expenses:create'),
  validate(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const { expense, payment } = await createExpense({
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ expense, payment });
  }),
);
