import { roleHasPermission } from '../config/permissions.js';
import { forbidden } from '../utils/errors.js';

/**
 * Server-side permission gate (Section 37).
 *
 * The React client also consults the same matrix, but only to decide what to
 * show. This is the control that actually matters: a SALES_STAFF token calling
 * the financial-report endpoint straight from curl gets 403 here, regardless of
 * what the UI did or did not render.
 */
export function requirePermission(...permissions) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role) return next(forbidden('Not signed in.'));

    const ok = permissions.every((p) => roleHasPermission(role, p));
    if (!ok) {
      return next(
        forbidden(
          `Your role (${role}) does not have permission to do this.`,
          { required: permissions },
        ),
      );
    }
    return next();
  };
}

/** Any one of the listed permissions is enough. */
export function requireAnyPermission(...permissions) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role) return next(forbidden('Not signed in.'));

    if (!permissions.some((p) => roleHasPermission(role, p))) {
      return next(
        forbidden(`Your role (${role}) does not have permission to do this.`, {
          requiredAnyOf: permissions,
        }),
      );
    }
    return next();
  };
}
