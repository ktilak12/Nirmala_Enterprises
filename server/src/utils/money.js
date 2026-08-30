/**
 * Money and quantity rounding.
 *
 * All monetary values are stored as 2-decimal numbers and all quantities as
 * 3-decimal numbers (kg/quintal trades need gram precision). Every schema
 * money/quantity field uses these as a Mongoose `set` hook, so a value can
 * never be persisted with floating-point dust like 21999.999999999996.
 *
 * Rounding at the storage boundary keeps stored figures exact to the paisa,
 * which is what matters for an invoice that a farmer will hold in their hand.
 */

export function round2(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Sum a list of numbers, rounding the result to paisa. */
export function sumMoney(values) {
  return round2(values.reduce((acc, v) => acc + Number(v || 0), 0));
}

/** Reusable Mongoose field definitions. */
export const moneyField = (extra = {}) => ({
  type: Number,
  default: 0,
  min: 0,
  set: round2,
  ...extra,
});

/** Signed money (adjustments can be negative). */
export const signedMoneyField = (extra = {}) => ({
  type: Number,
  default: 0,
  set: round2,
  ...extra,
});

export const quantityField = (extra = {}) => ({
  type: Number,
  default: 0,
  set: round3,
  ...extra,
});

/** Format for display in logs/exports. Indian grouping. */
export function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(round2(value));
}
