import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ROLE_LABELS } from '../config/permissions.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changeOwnPassword, login, checkAccountLockout, recordFailedLogin, resetLoginAttempts } from '../services/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { changePasswordSchema, loginSchema } from '../validators/index.js';

export const authRouter = Router();

/**
 * Enterprise Secure Demo Roles with bcrypt hash verification (12 rounds).
 */
const BCRYPT_HASH_ADMIN123 = '$2b$12$23EXrkfxWSs7x.IPvxw7F.N1YciqWMxpYZaBQIHuwhxtCn3a5zFsa';
const BCRYPT_HASH_ADMIN_SPECIAL = '$2b$12$omt59gDq7QVT19ElYng5fuzKeWwzhFW30tbVgWH4Fm39bKHJntm6a';

const DEMO_ROLES = {
  superadmin: { role: 'SUPER_ADMIN', name: 'Super Admin', email: 'superadmin@nirmalaenterprises.in', hashes: [BCRYPT_HASH_ADMIN123, BCRYPT_HASH_ADMIN_SPECIAL] },
  'superadmin@nirmalaenterprises.in': { role: 'SUPER_ADMIN', name: 'Super Admin', email: 'superadmin@nirmalaenterprises.in', hashes: [BCRYPT_HASH_ADMIN123, BCRYPT_HASH_ADMIN_SPECIAL] },
  admin: { role: 'SUPER_ADMIN', name: 'Super Admin', email: 'superadmin@nirmalaenterprises.in', hashes: [BCRYPT_HASH_ADMIN123, BCRYPT_HASH_ADMIN_SPECIAL] },
  'admin@nirmalaenterprises.in': { role: 'SUPER_ADMIN', name: 'Super Admin', email: 'superadmin@nirmalaenterprises.in', hashes: [BCRYPT_HASH_ADMIN123, BCRYPT_HASH_ADMIN_SPECIAL] },
};

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = (req.body.username ?? req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // 1. Enforce Account Lockout Check
    const lockout = checkAccountLockout(username, clientIp);
    if (lockout.isLocked) {
      return res.status(429).json({
        success: false,
        message: lockout.message,
      });
    }

    // 2. Try DB login service first
    try {
      const result = await login({ email: username, password, req });
      if (result.user.role !== 'SUPER_ADMIN' && result.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: Only the Super Admin is authorized to access the admin portal.',
        });
      }
      const token = signToken({ _id: result.user._id, role: 'SUPER_ADMIN' });
      resetLoginAttempts(username, clientIp);
      return res.json({
        success: true,
        token,
        user: shapeUser({ ...result.user, role: 'SUPER_ADMIN' }, ['*']),
      });
    } catch (err) {
      if (err.status === 429 || (err.message && err.message.includes('locked'))) {
        return res.status(429).json({ success: false, message: err.message });
      }
    }

    // 3. Fallback: Bcrypt Hash verification for authorized admin roles
    if (DEMO_ROLES[username]) {
      const demo = DEMO_ROLES[username];
      let matches = false;
      for (const hash of demo.hashes) {
        if (await bcrypt.compare(password, hash)) {
          matches = true;
          break;
        }
      }

      if (matches) {
        resetLoginAttempts(username, clientIp);
        const demoUser = {
          _id: '65f000000000000000000001',
          name: demo.name,
          email: demo.email,
          role: demo.role,
          isActive: true,
        };
        const token = signToken({ _id: demoUser._id, role: demoUser.role });
        return res.json({
          success: true,
          token,
          user: shapeUser(demoUser, ['*']),
        });
      }
    }

    // 4. Failed Login: Record attempt & trigger lockout if limit reached (5 attempts)
    const record = recordFailedLogin(username, clientIp);
    if (record.lockedUntil) {
      return res.status(429).json({
        success: false,
        message: 'Account temporarily locked due to 5 consecutive failed attempts. Please try again after 15 minutes.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password. Only Super Admin credentials are authorized.',
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
  const role = user.role || 'SUPER_ADMIN';
  return {
    id: String(user._id),
    name: user.name || 'Super Admin',
    email: user.email || 'superadmin@nirmalaenterprises.in',
    phone: user.phone ?? '',
    role,
    roleLabel: ROLE_LABELS[role] ?? 'Super Administrator',
    permissions: role === 'SUPER_ADMIN' || role === 'ADMIN' ? ['*'] : permissions,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt ?? null,
    isActive: user.isActive,
  };
}
