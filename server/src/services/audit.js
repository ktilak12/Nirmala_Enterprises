import { AuditLog } from '../models/AuditLog.js';

/**
 * Audit trail writer (Section 38).
 *
 * Always called with the caller's transaction session so an audit entry can
 * never outlive the change it describes - a rolled-back sale leaves no trace
 * suggesting it happened.
 */
export async function writeAudit({
  session,
  actor,
  action,
  entity,
  entityId = null,
  entityCode = null,
  summary = '',
  changes = [],
  req = null,
}) {
  const entry = {
    user: actor?._id ?? null,
    userName: actor?.name ?? 'system',
    userRole: actor?.role ?? null,
    action,
    entity,
    entityId,
    entityCode,
    summary,
    changes,
    ip: req?.ip ?? null,
    userAgent: req?.get?.('user-agent') ?? null,
    at: new Date(),
  };

  const [doc] = await AuditLog.create([entry], session ? { session } : {});
  return doc;
}

const IGNORED_FIELDS = new Set([
  '_id', '__v', 'createdAt', 'updatedAt', 'passwordHash',
  // Derived caches move as a consequence of a transaction, not as an edit
  // somebody made, so logging them would bury the real change in noise.
  'currentStock', 'avgCost', 'balances', 'outstanding', 'totalRepaid', 'adjustmentTotal',
]);

/**
 * Compare two plain objects and return only the fields that actually changed.
 *
 * Produces the Section 38 shape: { field: 'sellingPrice', from: 220, to: 230 }.
 */
export function diffDocuments(before = {}, after = {}, { include = null } = {}) {
  const fields = include ?? new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];

  for (const field of fields) {
    if (IGNORED_FIELDS.has(field)) continue;

    const from = normalise(before[field]);
    const to = normalise(after[field]);
    if (to === undefined) continue;                     // field not part of this update
    if (JSON.stringify(from) === JSON.stringify(to)) continue;

    changes.push({ field, from, to });
  }

  return changes;
}

function normalise(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (IGNORED_FIELDS.has(k)) continue;
      out[k] = normalise(v);
    }
    return out;
  }
  return value;
}
