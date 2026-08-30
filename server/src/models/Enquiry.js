import mongoose from 'mongoose';

/**
 * A message from the public Contact Us page (Section 9).
 *
 * Kept deliberately thin and completely separate from `parties`. An enquiry is
 * an unverified stranger typing into a public form; a party is someone the
 * office has actually taken on. Writing straight into the party master from an
 * open endpoint would let anyone on the internet fill the farmer list with
 * junk, so an enquiry sits here until a member of staff converts it by hand.
 */
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    village: { type: String, trim: true },

    enquiryType: {
      type: String,
      enum: ['INPUTS', 'SELL_PRODUCE', 'BUY_COMMODITY', 'ADVANCE', 'OTHER'],
      default: 'OTHER',
      index: true,
    },

    message: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'],
      default: 'NEW',
      index: true,
    },

    /** Set when staff turn the enquiry into a real party record. */
    convertedParty: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },

    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String },
    staffNotes: { type: String, trim: true },

    /** Recorded for abuse handling on an unauthenticated endpoint. */
    ip: { type: String },
  },
  { timestamps: true },
);

enquirySchema.index({ createdAt: -1, status: 1 });

export const Enquiry = mongoose.model('Enquiry', enquirySchema);
