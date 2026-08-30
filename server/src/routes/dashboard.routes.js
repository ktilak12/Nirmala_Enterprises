import { Router } from 'express';
import { roleHasPermission } from '../config/permissions.js';
import { requirePermission } from '../middleware/rbac.js';
import { getDashboard } from '../services/dashboard.js';
import { asyncHandler } from '../utils/errors.js';

export const dashboardRouter = Router();

/**
 * The admin home screen (Sections 12, 13, 22 and 42).
 *
 * The financial block is removed for roles without `reports:financial` rather
 * than merely hidden by the client. Sales staff should see today's takings and
 * what needs attention; they should not see the business's gross margin. Because
 * `dashboard.js` gathers those figures under one `financials` key, withholding
 * them is a delete of one property rather than a scatter of conditionals - and
 * there is no way to ask for them back through a query parameter.
 */
dashboardRouter.get(
  '/',
  requirePermission('dashboard:read'),
  asyncHandler(async (req, res) => {
    const data = await getDashboard();

    if (!roleHasPermission(req.user.role, 'reports:financial')) {
      delete data.financials;
      data.meta = { ...(data.meta ?? {}), financialsWithheld: true };
    }

    res.json(data);
  }),
);
