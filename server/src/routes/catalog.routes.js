import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams } from '../middleware/validate.js';
import {
  createCatalogEntry,
  deleteCatalogEntry,
  listCatalog,
  updateCatalogEntry,
} from '../services/catalog.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { categorySchema, idParam, unitSchema } from '../validators/index.js';

export const catalogRouter = Router();

/**
 * Categories and units - the two lookup lists behind every product.
 *
 * Both are handled by one pair of routes because they behave identically. The
 * `:kind` segment maps to a model rather than being interpolated anywhere, so an
 * unknown value is a 404 and never reaches the database.
 */
const KINDS = {
  categories: { model: 'Category', schema: categorySchema, label: 'category' },
  units: { model: 'Unit', schema: unitSchema, label: 'unit' },
};

function resolveKind(req, _res, next) {
  /**
   * `Object.hasOwn`, not a plain lookup. `KINDS['constructor']` would return
   * something truthy off Object.prototype, sail past the check, and then fail
   * deeper in with a 500 - so an unknown catalogue name has to be tested for
   * membership rather than for truthiness.
   */
  if (!Object.hasOwn(KINDS, req.params.kind)) {
    return next(notFound(`There is no catalogue called "${req.params.kind}".`));
  }
  req.catalogKind = KINDS[req.params.kind];
  return next();
}

/** Body validation has to wait until `resolveKind` has chosen the schema. */
function validateForKind(req, res, next) {
  return validate(req.catalogKind.schema)(req, res, next);
}

catalogRouter.get(
  '/:kind',
  requirePermission('catalog:read'),
  resolveKind,
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    res.json({ rows: await listCatalog(req.catalogKind.model, { includeInactive }) });
  }),
);

catalogRouter.post(
  '/:kind',
  requirePermission('catalog:manage'),
  resolveKind,
  validateForKind,
  asyncHandler(async (req, res) => {
    const row = await createCatalogEntry({
      kind: req.catalogKind.model,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.status(201).json({ row });
  }),
);

catalogRouter.patch(
  '/:kind/:id',
  requirePermission('catalog:manage'),
  resolveKind,
  validateParams(idParam),
  validateForKind,
  asyncHandler(async (req, res) => {
    const row = await updateCatalogEntry({
      kind: req.catalogKind.model,
      id: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.json({ row });
  }),
);

catalogRouter.delete(
  '/:kind/:id',
  requirePermission('catalog:manage'),
  resolveKind,
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    await deleteCatalogEntry({
      kind: req.catalogKind.model,
      id: req.valid.params.id,
      actor: req.user,
      req,
    });
    res.json({ message: `${req.catalogKind.label} deleted.` });
  }),
);
