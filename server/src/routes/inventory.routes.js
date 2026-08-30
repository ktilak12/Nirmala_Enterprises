import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { getProductLedger, MANUAL_TXN_TYPES, recordManualMovement } from '../services/inventory.js';
import { auditAllStock } from '../services/ledger.js';
import { listMovements } from '../services/listing.js';
import { asyncHandler } from '../utils/errors.js';
import {
  dateRangeQuery,
  listMovementsQuery,
  manualMovementSchema,
  productIdParam,
} from '../validators/index.js';

export const inventoryRouter = Router();

/**
 * Stock movements (Sections 20 and 21).
 *
 * The ledger is the source of truth; `product.currentStock` is a cache of it. So
 * this router exposes movements and never a "set stock to N" operation - the
 * closest thing is an ADJUSTMENT with a written reason, which is a new ledger row
 * like any other and stays visible forever.
 */
inventoryRouter.get(
  '/movements',
  requirePermission('inventory:read'),
  validateQuery(listMovementsQuery),
  asyncHandler(async (req, res) => {
    res.json({
      ...(await listMovements(req.valid.query)),
      manualTypes: MANUAL_TXN_TYPES,
    });
  }),
);

inventoryRouter.post(
  '/movements',
  requirePermission('inventory:adjust'),
  validate(manualMovementSchema),
  asyncHandler(async (req, res) => {
    const result = await recordManualMovement({
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json(result);
  }),
);

/** The stock card for one product: opening, every movement, closing balance. */
inventoryRouter.get(
  '/ledger/:productId',
  requirePermission('inventory:read'),
  validateParams(productIdParam),
  validateQuery(dateRangeQuery),
  asyncHandler(async (req, res) => {
    const { from, to } = req.valid.query;
    res.json(await getProductLedger(req.valid.params.productId, { from, to }));
  }),
);

/**
 * Ledger-versus-cache check across the whole catalogue.
 *
 * MongoDB will not enforce that `currentStock` still equals the sum of the
 * ledger, so this is the compensating control: it recomputes every product from
 * its movements and reports any drift. It is read-only - repair is a deliberate
 * act, run from `scripts/recompute-stock.js`, not a side effect of viewing a page.
 */
inventoryRouter.get(
  '/integrity',
  requirePermission('inventory:read'),
  asyncHandler(async (_req, res) => {
    const { checked, drifted, orphans } = await auditAllStock();

    res.json({
      checked,
      drifted: drifted.length,
      rows: drifted,
      orphans,
      message: drifted.length || orphans.length
        ? 'Cached stock disagrees with the ledger for the products listed. ' +
          'The ledger is authoritative. Run scripts/recompute-stock.js to repair.'
        : "Every product's cached stock matches its ledger.",
    });
  }),
);
