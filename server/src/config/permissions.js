/**
 * Role-based access control matrix (concept document Section 37).
 *
 * Permissions are `resource:action` strings. This file is the single source of
 * truth: the API enforces it via middleware/rbac.js, and the React client
 * merely *hides* UI based on the same list. Hiding a button is cosmetic - the
 * server check is the real control, which is why the verification plan tests
 * a SALES_STAFF token against the financial-report endpoint directly.
 */

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  SALES_STAFF: 'SALES_STAFF',
  INVENTORY_STAFF: 'INVENTORY_STAFF',
});

export const ROLE_LABELS = Object.freeze({
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  SALES_STAFF: 'Sales Staff',
  INVENTORY_STAFF: 'Inventory Staff',
});

/** Every permission the system understands, for validation and the UI. */
export const ALL_PERMISSIONS = Object.freeze([
  'dashboard:read',
  'parties:read', 'parties:create', 'parties:update', 'parties:delete',
  'products:read', 'products:create', 'products:update', 'products:delete',
  'catalog:read', 'catalog:manage',            // categories + units
  'sales:read', 'sales:create', 'sales:update', 'sales:delete',
  'purchases:read', 'purchases:create', 'purchases:update', 'purchases:delete',
  'inventory:read', 'inventory:adjust',
  'loans:read', 'loans:create', 'loans:update', 'loans:delete',
  'payments:read', 'payments:create', 'payments:delete',
  'expenses:read', 'expenses:create', 'expenses:update', 'expenses:delete',
  'invoices:read', 'invoices:print',
  'reports:read',            // operational reports
  'reports:financial',       // revenue, margin, P&L - deliberately separate
  'exports:generate',
  'users:read', 'users:manage',
  'settings:read', 'settings:update',
  'audit:read',
]);

const OPERATIONAL_REPORTS = ['reports:read', 'exports:generate'];

/**
 * Sales staff can raise a sale and add a customer, but cannot touch stock by
 * hand, delete a loan, or open the financial reports - exactly the split
 * described in Section 37.
 */
const MATRIX = {
  [ROLES.ADMIN]: ['*'],

  [ROLES.MANAGER]: [
    'dashboard:read',
    'parties:read', 'parties:create', 'parties:update',
    'products:read', 'products:create', 'products:update',
    'catalog:read', 'catalog:manage',
    'sales:read', 'sales:create', 'sales:update',
    'purchases:read', 'purchases:create', 'purchases:update',
    'inventory:read', 'inventory:adjust',
    'loans:read', 'loans:create', 'loans:update',
    'payments:read', 'payments:create',
    'expenses:read', 'expenses:create', 'expenses:update',
    'invoices:read', 'invoices:print',
    'reports:read', 'reports:financial',
    'exports:generate',
    'settings:read',
    'audit:read',
  ],

  [ROLES.ACCOUNTANT]: [
    'dashboard:read',
    'parties:read',
    'products:read',
    'catalog:read',
    'sales:read',
    'purchases:read',
    'inventory:read',
    'loans:read', 'loans:create', 'loans:update',
    'payments:read', 'payments:create',
    'expenses:read', 'expenses:create', 'expenses:update',
    'invoices:read', 'invoices:print',
    'reports:read', 'reports:financial',
    'exports:generate',
    'settings:read',
  ],

  [ROLES.SALES_STAFF]: [
    'dashboard:read',
    'parties:read', 'parties:create', 'parties:update',
    'products:read',
    'catalog:read',
    'sales:read', 'sales:create',
    'inventory:read',
    'invoices:read', 'invoices:print',
    'payments:read', 'payments:create',
    ...OPERATIONAL_REPORTS,
  ],

  [ROLES.INVENTORY_STAFF]: [
    'dashboard:read',
    'parties:read',
    'products:read', 'products:create', 'products:update',
    'catalog:read', 'catalog:manage',
    'purchases:read', 'purchases:create',
    'inventory:read', 'inventory:adjust',
    ...OPERATIONAL_REPORTS,
  ],
};

export const ROLE_PERMISSIONS = Object.freeze(
  Object.fromEntries(Object.entries(MATRIX).map(([role, perms]) => [role, Object.freeze(perms)])),
);

export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role, permission) {
  const granted = permissionsForRole(role);
  return granted.includes('*') || granted.includes(permission);
}
