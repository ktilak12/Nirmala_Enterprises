import mongoose from 'mongoose';

/**
 * Audit trail (Section 38).
 *
 * Records who changed what, when, and what the values were before and after.
 * `changes` holds only the fields that actually differed, which keeps the log
 * readable - the Section 38 example ("Old Price 220 -> New Price 230") is
 * exactly one entry in this array.
 *
 * Entries are written inside the same transaction as the change itself, so an
 * action that rolls back leaves no misleading audit record.
 */
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String },
    userRole: { type: String },

    action: {
      type: String,
      required: true,
      enum: [
        'CREATE', 'UPDATE', 'DELETE',
        'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
        'STOCK_ADJUST', 'PAYMENT', 'EXPORT', 'SETTINGS_UPDATE',
      ],
      index: true,
    },

    entity: { type: String, required: true, index: true },   // 'Product', 'Sale', ...
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityCode: { type: String },                            // 'PRD-0001'
    summary: { type: String },                               // human-readable one-liner

    changes: {
      type: [
        new mongoose.Schema(
          {
            field: String,
            from: mongoose.Schema.Types.Mixed,
            to: mongoose.Schema.Types.Mixed,
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    ip: { type: String },
    userAgent: { type: String },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

auditLogSchema.index({ at: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, at: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
