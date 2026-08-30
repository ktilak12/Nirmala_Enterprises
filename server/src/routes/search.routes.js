import { Router } from 'express';
import { validateQuery } from '../middleware/validate.js';
import { globalSearch } from '../services/search.js';
import { asyncHandler } from '../utils/errors.js';
import { searchQuery } from '../validators/index.js';

export const searchRouter = Router();

/**
 * Global search (Section 35).
 *
 * No `requirePermission` guard, because the permission check is per result group
 * rather than per request: the service is handed `req.permissions` and simply
 * does not query the collections this user cannot read. A sales-staff search for
 * "Ravi" returns his party record and his sales, and silently omits the advances.
 * Guarding the whole route instead would have forced a single permission for a
 * feature that spans six of them.
 */
searchRouter.get(
  '/',
  validateQuery(searchQuery),
  asyncHandler(async (req, res) => {
    res.json(await globalSearch(req.valid.query.q, { permissions: req.permissions }));
  }),
);
