import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    /**
     * INPUT    - things sold to farmers (seed, fertiliser, cultivation supplies)
     * COMMODITY- things bought from farmers and traded on (corn, rice, mohulo)
     * OTHER    - packaging, consumables
     *
     * The split matters because the dashboard reports trading margin on
     * commodities separately from input retail margin (Section 42).
     */
    kind: { type: String, enum: ['INPUT', 'COMMODITY', 'OTHER'], default: 'INPUT', index: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Category = mongoose.model('Category', categorySchema);

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },   // Kilogram
    symbol: { type: String, required: true, trim: true },               // kg
    /** Decimal places allowed when entering a quantity in this unit. */
    precision: { type: Number, default: 3, min: 0, max: 3 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Unit = mongoose.model('Unit', unitSchema);
