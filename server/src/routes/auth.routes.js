import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ROLE_LABELS } from '../config/permissions.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changeOwnPassword, login, checkAccountLockout, recordFailedLogin, resetLoginAttempts } from '../services/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { changePasswordSchema, loginSchema } from '../validators/index.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, username: uField, password } = req.valid.body;
    const username = String(email || uField || '').trim().toLowerCase();
    const clientIp = req.ip || 'unknown';

    // 1. Enforce Account Lockout Check
    const lockout = checkAccountLockout(username, clientIp);
    if (lockout.isLocked) {
      return res.status(429).json({
        success: false,
        message: lockout.message,
      });
    }

    // 2. Database authentication service
    const result = await login({ email: username, password, req });
    const token = signToken({ _id: result.user._id, role: result.user.role });
    resetLoginAttempts(username, clientIp);

    return res.json({
      success: true,
      token,
      user: shapeUser(result.user, result.permissions),
      mustChangePassword: result.mustChangePassword,
    });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      user: shapeUser(req.user, req.permissions),
    });
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.valid.body;
    await changeOwnPassword({ user: req.user, currentPassword, newPassword, req });
    res.json({ message: 'Password changed.' });
  }),
);

/**
 * The shape the client's AuthContext consumes. Accepts either a Mongoose
 * document or the plain object `login` returns, and never includes
 * `passwordHash` - the field is `select: false` and stays that way.
 */
export function shapeUser(user, permissions = []) {
  const role = user.role;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    permissions: role === 'SUPER_ADMIN' || role === 'ADMIN' ? ['*'] : permissions,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt ?? null,
    isActive: user.isActive,
  };
}
