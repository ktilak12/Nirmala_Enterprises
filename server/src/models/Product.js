import mongoose from 'mongoose';
import { moneyField, quantityField } from '../utils/money.js';

const productSchema = new mongoose.Schema(
  {
    productCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    brand: { type: String, trim: true },
    description: { type: String, trim: true },
    hsnCode: { type: String, trim: true },

    purchasePrice: moneyField(),
    sellingPrice: moneyField(),

    /**
     * Tax is BUILT BUT OFF BY DEFAULT, per the decision recorded in the plan.
     * Rate stays 0 and settings.tax.enabled stays false until the business
     * confirms its real GST position, so no invented tax figure can ever be
     * printed on a real invoice.
     */
    taxRatePct: { type: Number, default: 0, min: 0, max: 100 },

    minStock: quantityField(),

    /**
     * DERIVED CACHE. The append-only `inventorytxns` ledger is the single
     * source of truth for stock; this field exists only so product lists and
     * low-stock alerts do not aggregate the ledger on every request.
     *
     * It is deliberately NOT exposed on the product create/update form. The
     * only way to move it is an inventory transaction - an ADJUSTMENT requires
     * a written reason and is audited. That is Section 20's rule enforced
     * structurally rather than by asking staff nicely.
     */
    currentStock: quantityField(),

    /** Weighted-average cost, recalculated on each receipt. Drives valuation. */
    avgCost: moneyField(),

    /** True for tradable commodities (corn, rice) as opposed to retail inputs. */
    isCommodity: { type: Boolean, default: false, index: true },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', productCode: 'text', brand: 'text' });
productSchema.index({ isActive: 1, category: 1, name: 1 });

/** Virtual used by the dashboard low-stock panel (Section 22). */
productSchema.virtual('isLowStock').get(function isLowStock() {
  return this.minStock > 0 && this.currentStock <= this.minStock;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export const Product = mongoose.model('Product', productSchema);
