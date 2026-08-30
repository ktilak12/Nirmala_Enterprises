import { withTransaction } from '../config/db.js';
import { Category, Unit } from '../models/Catalog.js';
import { InventoryTxn } from '../models/InventoryTxn.js';
import { Product } from '../models/Product.js';
import { badRequest, notFound } from '../utils/errors.js';
import { diffDocuments, writeAudit } from './audit.js';
import { ENTITY_PREFIX, nextEntityCode } from './numbering.js';
import { escapeRegex } from './parties.js';

/**
 * Product master data (Section 19).
 *
 * Note what is NOT here: no way to set `currentStock`. The editable field list
 * deliberately excludes it and `avgCost`, so even a crafted request cannot
 * hand-edit stock - it has to go through an audited inventory movement
 * (Section 20).
 */
const EDITABLE = [
  'name', 'category', 'unit', 'brand', 'description', 'hsnCode',
  'purchasePrice', 'sellingPrice', 'taxRatePct', 'minStock', 'isCommodity', 'isActive',
];

export async function listProducts({
  q,
  category,
  isCommodity,
  isActive,
  lowStock,
  page = 1,
  limit = 25,
  sort = 'name',
} = {}) {
  const filter = {};
  if (category) filter.category = category;
  if (isCommodity !== undefined) filter.isCommodity = isCommodity;
  if (isActive !== undefined) filter.isActive = isActive;

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { productCode: rx }, { brand: rx }];
  }

  // minStock of 0 means "no reorder level set", so those are not low stock.
  if (lowStock) {
    filter.minStock = { $gt: 0 };
    filter.$expr = { $lte: ['$currentStock', '$minStock'] };
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [rows, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name kind')
      .populate('unit', 'name symbol precision')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return { rows, total, page: Number(page), limit: Number(limit) };
}

export async function getProduct(productId) {
  const product = await Product.findById(productId)
    .populate('category', 'name kind')
    .populate('unit', 'name symbol precision');
  if (!product) throw notFound('Product not found.');
  return product;
}

export async function createProduct({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const category = await Category.findById(payload.category).session(session);
    if (!category) throw notFound('Category not found.');
    const unit = await Unit.findById(payload.unit).session(session);
    if (!unit) throw notFound('Unit not found.');

    const productCode = await nextEntityCode(ENTITY_PREFIX.PRODUCT, { session, width: 4 });

    const [product] = await Product.create(
      [
        {
          productCode,
          ...pick(payload, EDITABLE),
          currentStock: 0,
          avgCost: 0,
          createdBy: actor._id,
        },
      ],
      { session },
    );

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'Product',
      entityId: product._id,
      entityCode: product.productCode,
      summary: `Added product ${product.name} at ${product.sellingPrice} per ${unit.symbol}`,
      req,
    });

    return product;
  });
}

export async function updateProduct({ productId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const product = await Product.findById(productId).session(session);
    if (!product) throw notFound('Product not found.');

    const before = product.toObject();
    const patch = pick(payload, EDITABLE);

    Object.assign(product, patch);
    const changes = diffDocuments(before, product.toObject(), {
      include: new Set(Object.keys(patch)),
    });

    if (changes.length === 0) return product;

    await product.save({ session });

    /**
     * A price change is the example Section 38 gives for the audit log, so the
     * summary spells it out in the same words the report shows:
     * "Old Price 220 -> New Price 230".
     */
    const priceChange = changes.find((c) => c.field === 'sellingPrice');
    const summary = priceChange
      ? `${product.name}: Old Price ${priceChange.from} -> New Price ${priceChange.to}`
      : `Updated product ${product.name}`;

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Product',
      entityId: product._id,
      entityCode: product.productCode,
      summary,
      changes,
      req,
    });

    return product;
  });
}

/**
 * Retire a product. Never a hard delete once it has moved: an old invoice must
 * still resolve, and the stock ledger must stay complete.
 */
export async function deactivateProduct({ productId, actor, req }) {
  return withTransaction(async (session) => {
    const product = await Product.findById(productId).session(session);
    if (!product) throw notFound('Product not found.');

    if (product.currentStock !== 0) {
      throw badRequest(
        `${product.name} still shows ${product.currentStock} in stock. Clear the balance with ` +
          'a sale or an adjustment before retiring it.',
      );
    }

    if (!product.isActive) return product;

    product.isActive = false;
    await product.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Product',
      entityId: product._id,
      entityCode: product.productCode,
      summary: `Retired product ${product.name}`,
      changes: [{ field: 'isActive', from: true, to: false }],
      req,
    });

    return product;
  });
}

/**
 * Hard delete, permitted only for a product that has never moved. Useful for
 * clearing a typo made minutes ago; impossible once any history exists.
 */
export async function deleteProduct({ productId, actor, req }) {
  return withTransaction(async (session) => {
    const product = await Product.findById(productId).session(session);
    if (!product) throw notFound('Product not found.');

    const movements = await InventoryTxn.countDocuments({ product: productId }).session(session);
    if (movements > 0) {
      throw badRequest(
        `${product.name} has ${movements} stock movement${movements === 1 ? '' : 's'} recorded ` +
          'against it, so deleting it would break that history. Retire it instead.',
      );
    }

    await Product.deleteOne({ _id: productId }).session(session);

    await writeAudit({
      session,
      actor,
      action: 'DELETE',
      entity: 'Product',
      entityId: product._id,
      entityCode: product.productCode,
      summary: `Deleted unused product ${product.name}`,
      req,
    });

    return { ok: true };
  });
}

function pick(source, keys) {
  const out = {};
  for (const k of keys) if (source[k] !== undefined) out[k] = source[k];
  return out;
}
