import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { updateEnquiry } from '../services/enquiries.js';
import { listEnquiries } from '../services/listing.js';
import { asyncHandler } from '../utils/errors.js';
import { idParam, listEnquiriesQuery, updateEnquirySchema } from '../validators/index.js';

export const enquiriesRouter = Router();

/**
 * The staff side of the public contact form (Section 9).
 *
 * Gated on `parties:read` / `parties:update` rather than a permission of its own.
 * An enquiry is a prospective party, so whoever is trusted to add a farmer to the
 * master list is exactly who should be working the enquiry queue - and adding a
 * seventh near-duplicate permission would make the matrix harder to reason about
 * for no gain.
 */
enquiriesRouter.get(
  '/',
  requirePermission('parties:read'),
  validateQuery(listEnquiriesQuery),
  asyncHandler(async (req, res) => {
    res.json(await listEnquiries(req.valid.query));
  }),
);

enquiriesRouter.patch(
  '/:id',
  requirePermission('parties:update'),
  validateParams(idParam),
  validate(updateEnquirySchema),
  asyncHandler(async (req, res) => {
    const enquiry = await updateEnquiry({
      enquiryId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.json({ enquiry });
  }),
);
