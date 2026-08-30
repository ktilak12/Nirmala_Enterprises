import { withTransaction } from '../config/db.js';
import { Category, Unit } from '../models/Catalog.js';
import { Product } from '../models/Product.js';
import { badRequest, notFound } from '../utils/errors.js';
import { diffDocuments, writeAudit } from './audit.js';

/**
 * Categories and units (Section 19's supporting master data).
 *
 * Both are referenced by every product, so neither can be deleted while a
 * product points at it - that would leave products with a dangling reference
 * MongoDB will not complain about. The check here is the referential integrity
 * the database is not providing.
 */

const MODELS = { Category, Unit };

export async function listCatalog(kind, { includeInactive = false } = {}) {
  const Model = MODELS[kind];
  const filter = includeInactive ? {} : { isActive: true };
  return Model.find(filter).sort('name');
}

export async function createCatalogEntry({ kind, payload, actor, req }) {
  const Model = MODELS[kind];

  return withTransaction(async (session) => {
    const [doc] = await Model.create([payload], { session });

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: kind,
      entityId: doc._id,
      entityCode: doc.name,
      summary: `Added ${kind.toLowerCase()} ${doc.name}`,
      req,
    });

    return doc;
  });
}

export async function updateCatalogEntry({ kind, id, payload, actor, req }) {
  const Model = MODELS[kind];

  return withTransaction(async (session) => {
    const doc = await Model.findById(id).session(session);
    if (!doc) throw notFound(`${kind} not found.`);

    const before = doc.toObject();
    Object.assign(doc, payload);
    const changes = diffDocuments(before, doc.toObject(), {
      include: new Set(Object.keys(payload)),
    });

    if (changes.length === 0) return doc;
    await doc.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: kind,
      entityId: doc._id,
      entityCode: doc.name,
      summary: `Updated ${kind.toLowerCase()} ${doc.name}`,
      changes,
      req,
    });

    return doc;
  });
}

export async function deleteCatalogEntry({ kind, id, actor, req }) {
  const Model = MODELS[kind];
  const field = kind === 'Category' ? 'category' : 'unit';

  return withTransaction(async (session) => {
    const doc = await Model.findById(id).session(session);
    if (!doc) throw notFound(`${kind} not found.`);

    const inUse = await Product.countDocuments({ [field]: id }).session(session);
    if (inUse > 0) {
      throw badRequest(
        `${doc.name} is used by ${inUse} product${inUse === 1 ? '' : 's'} and cannot be deleted. ` +
          'Mark it inactive instead - it will stop appearing in dropdowns while existing ' +
          'products keep working.',
      );
    }

    await Model.deleteOne({ _id: id }).session(session);

    await writeAudit({
      session,
      actor,
      action: 'DELETE',
      entity: kind,
      entityId: doc._id,
      entityCode: doc.name,
      summary: `Deleted unused ${kind.toLowerCase()} ${doc.name}`,
      req,
    });

    return { ok: true };
  });
}
