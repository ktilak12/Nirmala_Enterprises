import { z } from 'zod';
import { PARTY_ROLES } from '../models/Party.js';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../models/Payment.js';
import { ADJUSTMENT_TYPES } from '../models/Purchase.js';
import { LOAN_ADJUSTMENT_TYPES } from '../models/Loan.js';
import { INVENTORY_TXN_TYPES } from '../models/InventoryTxn.js';
import { ROLES } from '../config/permissions.js';

/**
 * Request schemas (Section 45's "input validation").
 *
 * Validation lives at the edge so services can trust their inputs. The messages
 * are written for the clerk who will read them on screen, not for a developer -
 * "Choose a customer" rather than "partyId: Required".
 */

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Not a valid record reference.');

const money = z.coerce.number().finite().min(0, 'Cannot be negative.');
const signedMoney = z.coerce.number().finite();
const qty = z.coerce.number().finite();

/**
 * A date the server can actually parse.
 *
 * `z.string()` on its own would let `?from=garbage` through to `new Date('garbage')`,
 * which is an Invalid Date. Mongoose then refuses to cast it and the clerk gets a
 * 500 for what is plainly a bad request - and a stack trace instead of a message.
 * Rejecting it here turns that into a 400 saying which field is wrong.
 */
const parsableDate = (v) => !Number.isNaN(new Date(v).getTime());
const dateString = z.string().trim().refine(parsableDate, 'Not a valid date.');

/** The same rule for body fields, which may arrive as a string or a Date. */
const dateish = z.union([z.string(), z.date()]).refine(parsableDate, 'Not a valid date.').optional();

/**
 * A sort instruction, optionally prefixed with `-` for descending. Constrained to
 * a field-name shape so a malformed string cannot reach Mongoose's sort parser.
 */
const sortKey = z
  .string()
  .trim()
  .regex(/^-?[a-zA-Z][\w.]*$/, 'Not a valid sort field.');

const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

export const idParam = z.object({ id: objectId });
export const productIdParam = z.object({ productId: objectId });

/**
 * The audit trail's per-record lookup. `entity` is a collection name from the
 * log's own enum, so it is length-capped rather than free text, and `entityId`
 * must be a real reference - both go straight into a query.
 */
export const auditEntityParams = z.object({
  entity: z.string().trim().min(2).max(40),
  entityId: objectId,
});

/** Optional `?from=&to=` on endpoints whose only filter is a date range. */
export const dateRangeQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

// ---------------------------------------------------------------------------
// Auth and users
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().optional(),
  username: z.string().trim().optional(),
  password: z.string().min(1, 'Enter your password.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter the person\'s name.'),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(Object.values(ROLES)),
  phone: z.string().trim().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

const partyBase = {
  name: z.string().trim().min(2, 'Enter the name.'),
  phone: z.string().trim().optional(),
  altPhone: z.string().trim().optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  address: z.string().trim().optional(),
  village: z.string().trim().optional(),
  district: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  roles: z.array(z.enum(PARTY_ROLES)).min(1, 'Choose at least one role.'),
  farmerProfile: z
    .object({
      landAcres: z.coerce.number().min(0).optional(),
      primaryCrop: z.string().trim().optional(),
      secondaryCrops: z.array(z.string()).optional(),
      bankAccountRef: z.string().trim().optional(),
    })
    .optional(),
  customerProfile: z
    .object({
      creditLimit: money.optional(),
      gstin: z.string().trim().optional(),
      businessName: z.string().trim().optional(),
    })
    .optional(),
  supplierProfile: z
    .object({
      gstin: z.string().trim().optional(),
      businessName: z.string().trim().optional(),
      materialTypes: z.array(z.string()).optional(),
    })
    .optional(),
  notes: z.string().trim().optional(),
};

export const createPartySchema = z.object(partyBase);
export const updatePartySchema = z
  .object({ ...partyBase, isActive: z.boolean().optional() })
  .partial();

export const listPartiesQuery = z.object({
  role: z.enum(PARTY_ROLES).optional(),
  q: z.string().trim().optional(),
  village: z.string().trim().optional(),
  isActive: boolish.optional(),
  hasDues: z.enum(['receivable', 'payable', 'loan']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  sort: sortKey.default('name'),
});

// ---------------------------------------------------------------------------
// Products and catalog
// ---------------------------------------------------------------------------

const productBase = {
  name: z.string().trim().min(2, 'Enter the product name.'),
  category: objectId,
  unit: objectId,
  brand: z.string().trim().optional(),
  description: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  purchasePrice: money.default(0),
  sellingPrice: money.default(0),
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
  minStock: qty.min(0).default(0),
  isCommodity: z.boolean().default(false),
};

export const createProductSchema = z.object(productBase);
export const updateProductSchema = z
  .object({ ...productBase, isActive: z.boolean().optional() })
  .partial();

export const listProductsQuery = z.object({
  q: z.string().trim().optional(),
  category: objectId.optional(),
  isCommodity: boolish.optional(),
  isActive: boolish.optional(),
  lowStock: boolish.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  sort: sortKey.default('name'),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Enter the category name.'),
  kind: z.enum(['INPUT', 'COMMODITY', 'OTHER']).default('INPUT'),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const unitSchema = z.object({
  name: z.string().trim().min(1, 'Enter the unit name, e.g. Kilogram.'),
  symbol: z.string().trim().min(1, 'Enter the symbol, e.g. kg.'),
  precision: z.coerce.number().int().min(0).max(3).default(3),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export const createSaleSchema = z.object({
  partyId: objectId,
  date: dateish,
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: qty.gt(0, 'Quantity must be more than zero.'),
        rate: money.optional(),
        discount: money.optional(),
        taxRatePct: z.coerce.number().min(0).max(100).optional(),
      }),
    )
    .min(1, 'Add at least one product.'),
  amountPaid: money.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  paymentReference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const recordPaymentSchema = z.object({
  amount: money.gt(0, 'Enter an amount greater than zero.'),
  date: dateish,
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const listSalesQuery = z.object({
  q: z.string().trim().optional(),
  partyId: objectId.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

// ---------------------------------------------------------------------------
// Purchases and procurement
// ---------------------------------------------------------------------------

export const createPurchaseSchema = z.object({
  partyId: objectId,
  isProcurement: z.boolean().default(false),
  date: dateish,
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: qty.gt(0, 'Quantity must be more than zero.'),
        rate: money.optional(),
      }),
    )
    .min(1, 'Add at least one product.'),
  adjustments: z
    .array(
      z.object({
        type: z.enum(ADJUSTMENT_TYPES),
        label: z.string().trim().min(2, 'Describe the adjustment.'),
        amount: signedMoney,
        loanId: objectId.optional(),
      }),
    )
    .optional(),
  amountPaid: money.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  paymentReference: z.string().trim().optional(),
  referenceNo: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const listPurchasesQuery = listSalesQuery.extend({
  isProcurement: boolish.optional(),
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const manualMovementSchema = z.object({
  productId: objectId,
  type: z.enum(INVENTORY_TXN_TYPES),
  qtyDelta: qty.refine((v) => v !== 0, 'Quantity cannot be zero.'),
  unitCost: money.optional(),
  date: dateish,
  remarks: z.string().trim().optional(),
});

export const listMovementsQuery = z.object({
  productId: objectId.optional(),
  type: z.enum(INVENTORY_TXN_TYPES).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------
// Lending
// ---------------------------------------------------------------------------

export const createLoanSchema = z.object({
  partyId: objectId,
  principal: money.gt(0, 'Enter the advance amount.'),
  date: dateish,
  dueDate: dateish,
  purpose: z.string().trim().optional(),
  terms: z.string().trim().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const loanAdjustmentSchema = z.object({
  type: z.enum(LOAN_ADJUSTMENT_TYPES),
  label: z.string().trim().min(2, 'Explain what this adjustment is for.'),
  amount: signedMoney.refine((v) => v !== 0, 'Amount cannot be zero.'),
  date: dateish,
});

export const cancelLoanSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason for cancelling.'),
});

export const listLoansQuery = z.object({
  q: z.string().trim().optional(),
  partyId: objectId.optional(),
  status: z.enum(['ACTIVE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

// ---------------------------------------------------------------------------
// Expenses and payments
// ---------------------------------------------------------------------------

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(3, 'Describe the expense.'),
  amount: money.gt(0, 'Enter an amount greater than zero.'),
  date: dateish,
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().optional(),
  partyId: objectId.optional(),
  remarks: z.string().trim().optional(),
});

export const listPaymentsQuery = z.object({
  q: z.string().trim().optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  purpose: z.string().trim().optional(),
  partyId: objectId.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listExpensesQuery = z.object({
  q: z.string().trim().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------
// Reports, audit, settings, search
// ---------------------------------------------------------------------------

export const reportQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  partyId: objectId.optional(),
  productId: objectId.optional(),
  categoryId: objectId.optional(),
  groupBy: z.string().optional(),
  kind: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  lowStockOnly: boolish.optional(),
  includeInactive: boolish.optional(),
  overdueOnly: boolish.optional(),
  format: z.enum(['json', 'excel', 'csv']).default('json'),
});

export const listAuditQuery = z.object({
  q: z.string().trim().optional(),
  userId: objectId.optional(),
  entity: z.string().trim().optional(),
  action: z.string().trim().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const searchQuery = z.object({ q: z.string().trim().default('') });

export const updateSettingsSchema = z.object({
  company: z.record(z.string(), z.any()).optional(),
  tax: z.record(z.string(), z.any()).optional(),
  invoice: z.record(z.string(), z.any()).optional(),
  inventory: z.record(z.string(), z.any()).optional(),
  lending: z.record(z.string(), z.any()).optional(),
});

/**
 * The public catalogue filters. Small, but it has to exist: an unvalidated
 * `?category=nonsense` reaches Mongoose as a cast failure and answers a stranger
 * with a 500 and a stack-shaped error message. A rejected filter is a 400.
 */
export const publicProductsQuery = z.object({
  category: objectId.optional(),
  kind: z.enum(['commodity', 'inputs']).optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.'),
  phone: z.string().trim().min(6, 'Enter a phone number we can reach you on.'),
  email: z.union([z.email(), z.literal('')]).optional(),
  village: z.string().trim().optional(),
  enquiryType: z
    .enum(['INPUTS', 'SELL_PRODUCE', 'BUY_COMMODITY', 'ADVANCE', 'OTHER'])
    .default('OTHER'),
  message: z.string().trim().min(5, 'Tell us how we can help.').max(2000, 'Please keep it under 2000 characters.'),
});

export const listEnquiriesQuery = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(),
  enquiryType: z
    .enum(['INPUTS', 'SELL_PRODUCE', 'BUY_COMMODITY', 'ADVANCE', 'OTHER'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const updateEnquirySchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(),
  staffNotes: z.string().trim().max(2000).optional(),
  convertedPartyId: objectId.optional(),
});

export { objectId };
