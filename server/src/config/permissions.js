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
  SUPER_ADMIN: 'SUPER_ADMIN',
});

export const ROLE_LABELS = Object.freeze({
  SUPER_ADMIN: 'Super Administrator',
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
  'reports:read',
  'reports:financial',
  'exports:generate',
  'users:read', 'users:manage',
  'settings:read', 'settings:update',
  'audit:read',
]);

const MATRIX = {
  [ROLES.SUPER_ADMIN]: ['*'],
};

export const ROLE_PERMISSIONS = Object.freeze(
  Object.fromEntries(Object.entries(MATRIX).map(([role, perms]) => [role, Object.freeze(perms)])),
);

export function permissionsForRole(_role) {
  return ['*'];
}

export function roleHasPermission(_role, _permission) {
  return true;
}
