import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { getProductLedger } from '../services/inventory.js';
import {
  createProduct,
  deactivateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../services/products.js';
import { asyncHandler } from '../utils/errors.js';
import {
  createProductSchema,
  dateRangeQuery,
  idParam,
  listProductsQuery,
  updateProductSchema,
} from '../validators/index.js';

export const productsRouter = Router();

/**
 * Product master (Section 19).
 *
 * Note what is absent: there is no route that sets `currentStock`. The update
 * service's editable-field list omits it, so Section 20's rule - "do not simply
 * let employees manually change current stock" - holds because no request shape
 * exists that could. Stock moves only through /inventory.
 */
productsRouter.get(
  '/',
  requirePermission('products:read'),
  validateQuery(listProductsQuery),
  asyncHandler(async (req, res) => {
    res.json(await listProducts(req.valid.query));
  }),
);

productsRouter.get(
  '/:id',
  requirePermission('products:read'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    res.json({ product: await getProduct(req.valid.params.id) });
  }),
);

/** The stock card: every movement for this product, plus a ledger-vs-cache check. */
productsRouter.get(
  '/:id/ledger',
  requirePermission('inventory:read'),
  validateParams(idParam),
  validateQuery(dateRangeQuery),
  asyncHandler(async (req, res) => {
    const { from, to } = req.valid.query;
    res.json(await getProductLedger(req.valid.params.id, { from, to }));
  }),
);

productsRouter.post(
  '/',
  requirePermission('products:create'),
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const product = await createProduct({ payload: req.valid.body, actor: req.user, req });
    res.status(201).json({ product });
  }),
);

productsRouter.patch(
  '/:id',
  requirePermission('products:update'),
  validateParams(idParam),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await updateProduct({
      productId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.json({ product });
  }),
);

productsRouter.post(
  '/:id/deactivate',
  requirePermission('products:update'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const product = await deactivateProduct({
      productId: req.valid.params.id,
      actor: req.user,
      req,
    });
    res.json({ product, message: 'Product marked inactive.' });
  }),
);

/**
 * A hard delete, permitted only for a product that never moved. The service
 * refuses the moment a single inventory transaction references it, because
 * removing it would leave a sale line pointing at nothing.
 */
productsRouter.delete(
  '/:id',
  requirePermission('products:delete'),
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const result = await deleteProduct({ productId: req.valid.params.id, actor: req.user, req });
    res.json(result);
  }),
);
