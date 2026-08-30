import mongoose from 'mongoose';

/**
 * Business-wide settings. A singleton document, keyed by `key: 'GLOBAL'`.
 *
 * Tax defaults to OFF, per the decision recorded in the build plan: the fields
 * exist and the invoice can carry tax the moment the business confirms its GST
 * position, but until then no invented tax figure appears anywhere.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true },

    company: {
      name: { type: String, default: 'Nirmala Enterprises' },
      tagline: {
        type: String,
        default: 'Supporting Farmers. Supplying Agriculture. Connecting Markets.',
      },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      email: { type: String, default: '' },
      businessHours: { type: String, default: 'Mon-Sat, 9:00 AM - 7:00 PM' },
      mapEmbedUrl: { type: String, default: '' },
    },

    tax: {
      /** Off until the business confirms its real GST position. */
      enabled: { type: Boolean, default: false },
      gstin: { type: String, default: '' },
      defaultRatePct: { type: Number, default: 0, min: 0, max: 100 },
      label: { type: String, default: 'GST' },
    },

    invoice: {
      prefix: { type: String, default: 'INV' },
      terms: { type: String, default: '' },
      footerNote: { type: String, default: 'Thank you for your business.' },
      showBankDetails: { type: Boolean, default: false },
      bankDetails: { type: String, default: '' },
    },

    inventory: {
      /** Weighted average is the only method implemented; recorded explicitly
       *  so the choice is visible to whoever reviews the books. */
      valuationMethod: { type: String, enum: ['WEIGHTED_AVERAGE'], default: 'WEIGHTED_AVERAGE' },
      blockNegativeStock: { type: Boolean, default: true },
    },

    lending: {
      /** No automatic accrual - adjustments are entered by hand (Section 27). */
      interestEnabled: { type: Boolean, default: false },
      overdueGraceDays: { type: Number, default: 0, min: 0 },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Setting = mongoose.model('Setting', settingSchema);

/** Fetch the singleton, creating it with defaults on first run. */
export async function getSettings(session = null) {
  const query = Setting.findOne({ key: 'GLOBAL' });
  if (session) query.session(session);
  let doc = await query;
  if (!doc) {
    const created = await Setting.create([{ key: 'GLOBAL' }], session ? { session } : {});
    doc = created[0];
  }
  return doc;
}
