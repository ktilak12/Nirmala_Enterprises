import { Router } from 'express';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../models/Payment.js';
import { PARTY_ROLES } from '../models/Party.js';
import { ADJUSTMENT_TYPES } from '../models/Purchase.js';
import { LOAN_ADJUSTMENT_TYPES, LOAN_STATUS } from '../models/Loan.js';
import { INVENTORY_TXN_TYPES } from '../models/InventoryTxn.js';
import { ROLE_LABELS, ROLES } from '../config/permissions.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { MANUAL_TXN_TYPES } from '../services/inventory.js';
import { readSettings, updateSettings } from '../services/settings.js';
import { asyncHandler } from '../utils/errors.js';
import { updateSettingsSchema } from '../validators/index.js';

export const settingsRouter = Router();

/** Business configuration (Section 36). */
settingsRouter.get(
  '/',
  requirePermission('settings:read'),
  asyncHandler(async (_req, res) => {
    res.json({ settings: await readSettings() });
  }),
);

settingsRouter.patch(
  '/',
  requirePermission('settings:update'),
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await updateSettings({ payload: req.valid.body, actor: req.user, req });
    res.json({ settings });
  }),
);

/**
 * Every enumeration the client needs to build a dropdown, in one call.
 *
 * These lists live in the Mongoose schemas, which are the things that will
 * actually reject a bad value. Serving them from here means a dropdown can never
 * drift out of step with what the database accepts - the alternative is the same
 * list typed a second time in React, which is the sort of duplication that is
 * correct on the day it is written and wrong six months later.
 */
settingsRouter.get(
  '/enums',
  asyncHandler(async (_req, res) => {
    res.json({
      partyRoles: PARTY_ROLES,
      paymentMethods: PAYMENT_METHODS,
      expenseCategories: EXPENSE_CATEGORIES,
      purchaseAdjustmentTypes: ADJUSTMENT_TYPES,
      loanAdjustmentTypes: LOAN_ADJUSTMENT_TYPES,
      loanStatuses: LOAN_STATUS,
      inventoryTxnTypes: INVENTORY_TXN_TYPES,
      manualInventoryTxnTypes: MANUAL_TXN_TYPES,
      paymentStatuses: ['UNPAID', 'PARTIAL', 'PAID'],
      roles: Object.values(ROLES).map((role) => ({ value: role, label: ROLE_LABELS[role] })),
    });
  }),
);
