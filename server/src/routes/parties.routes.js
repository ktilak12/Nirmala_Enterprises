import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import {
  createParty,
  deactivateParty,
  getParty,
  getPartyProfile,
  listParties,
  updateParty,
} from '../services/parties.js';
import { asyncHandler } from '../utils/errors.js';
import {
  createPartySchema,
  idParam,
  listPartiesQuery,
  updatePartySchema,
} from '../validators/index.js';

export const partiesRouter = Router();

/**
 * Farmers, customers and suppliers - one collection, several roles (Section 39).
 *
 * There is deliberately no `/farmers`, `/customers` and `/suppliers` triplet.
 * Those screens are the same list filtered by `?role=`, which is what keeps
 * Ravi Kumar a single record rather than three.
 */
partiesRouter.get(
  '/',
  requirePermission('parties:read'),
  validateQuery(listPartiesQuery),
  asyncHandler(async (req, res) => {
    res.json(await listParties(req.valid.query));
  }),
);

partiesRouter.get(
  '/:id',
  requirePermission('parties:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json({ party: await getParty(req.valid.params.id) });
  }),
);

/** The 360-degree profile of Sections 16 to 18: every dealing, one timeline. */
partiesRouter.get(
  '/:id/profile',
  requirePermission('parties:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json(await getPartyProfile(req.valid.params.id));
  }),
);

partiesRouter.post(
  '/',
  requirePermission('parties:create'),
  validate(createPartySchema),
  asyncHandler(async (req, res) => {
    const party = await createParty({ payload: req.valid.body, actor: req.user, req });
    res.status(201).json({ party });
  }),
);

partiesRouter.patch(
  '/:id',
  requirePermission('parties:update'),
  validateParams(idParam),
  validate(updatePartySchema),
  asyncHandler(async (req, res) => {
    const party = await updateParty({
      partyId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.json({ party });
  }),
);

/**
 * Deactivate, never delete. A farmer with ten years of history cannot be removed
 * without destroying the history, so the service refuses while any balance is
 * open and marks the record inactive otherwise.
 */
partiesRouter.delete(
  '/:id',
  requirePermission('parties:delete'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const party = await deactivateParty({ partyId: req.valid.params.id, actor: req.user, req });
    res.json({ party, message: 'Marked inactive. The history stays on record.' });
  }),
);
