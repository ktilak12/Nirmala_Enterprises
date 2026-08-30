import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { AuditLog } from '../models/AuditLog.js';
import { listAudit } from '../services/listing.js';
import { asyncHandler } from '../utils/errors.js';
import { auditEntityParams, listAuditQuery } from '../validators/index.js';

export const auditRouter = Router();

/**
 * The audit trail (Section 38) - read-only, and deliberately so.
 *
 * There is no create route: entries are written by the services, inside the same
 * transaction as the change they describe, so a rolled-back sale leaves no record
 * claiming it happened. There is no delete route either. A log that the people
 * being logged can edit is not a log, which is why `audit:read` is the only audit
 * permission in the matrix - not even the administrator has `audit:delete`,
 * because no such permission exists to grant.
 */
auditRouter.get(
  '/',
  requirePermission('audit:read'),
  validateQuery(listAuditQuery),
  asyncHandler(async (req, res) => {
    res.json(await listAudit(req.valid.query));
  }),
);

/**
 * The filter options, taken from what the log actually contains rather than from
 * a hardcoded list, so a new entity type appears in the dropdown by itself.
 */
auditRouter.get(
  '/filters',
  requirePermission('audit:read'),
  asyncHandler(async (_req, res) => {
    const [entities, actions, users] = await Promise.all([
      AuditLog.distinct('entity'),
      AuditLog.distinct('action'),
      AuditLog.aggregate([
        { $group: { _id: '$user', name: { $first: '$userName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      entities: entities.sort(),
      actions: actions.sort(),
      users: users
        .filter((u) => u._id)
        .map((u) => ({ id: String(u._id), name: u.name, count: u.count })),
    });
  }),
);

/** The history of one record - "who has touched this invoice?" */
auditRouter.get(
  '/entity/:entity/:entityId',
  requirePermission('audit:read'),
  validateParams(auditEntityParams),
  asyncHandler(async (req, res) => {
    const { entity, entityId } = req.valid.params;
    const rows = await AuditLog.find({ entity, entityId }).sort('-at');

    res.json({ rows });
  }),
);
