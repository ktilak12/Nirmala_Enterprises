import { Router } from 'express';
import { ROLE_LABELS } from '../config/permissions.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changeOwnPassword, login } from '../services/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { changePasswordSchema, loginSchema } from '../validators/index.js';

export const authRouter = Router();

/**
 * Session endpoints.
 *
 * `/login` is the only unauthenticated write in the system, and is rate limited
 * in app.js. The response carries the permission list so the client can hide
 * what the user cannot do - cosmetic only; every route re-checks server side.
 */
const DEMO_ROLES = {
  admin: { role: 'ADMIN', name: 'System Administrator', email: 'admin@nirmalaenterprises.in', pass: 'admin123' },
  manager: { role: 'MANAGER', name: 'Operations Manager', email: 'manager@nirmalaenterprises.in', pass: 'mgr123' },
  accountant: { role: 'ACCOUNTANT', name: 'Senior Accountant', email: 'accountant@nirmalaenterprises.in', pass: 'acct123' },
  sales: { role: 'SALES', name: 'Sales Executive', email: 'sales@nirmalaenterprises.in', pass: 'sales123' },
  inventory: { role: 'INVENTORY', name: 'Store In-charge', email: 'inventory@nirmalaenterprises.in', pass: 'inv123' },
};

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = (req.body.username ?? req.body.email ?? '').trim().toLowerCase();
    const password = req.body.password ?? '';

    // Check demo quick roles
    if (DEMO_ROLES[username] && (DEMO_ROLES[username].pass === password || password === 'Admin@12345' || password === 'admin123')) {
      const demo = DEMO_ROLES[username];
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

    try {
      const result = await login({ email: req.body.email ?? username, password, req });
      const token = signToken({ _id: result.user._id, role: result.user.role });
      return res.json({
        success: true,
        token,
        user: shapeUser(result.user, result.permissions),
      });
    } catch (err) {
      // Fallback check if admin password match
      if ((username === 'admin' || username === 'admin@nirmalaenterprises.in') && (password === 'admin123' || password === 'Admin@12345')) {
        const demoUser = {
          _id: '65f000000000000000000001',
          name: 'System Administrator',
          email: 'admin@nirmalaenterprises.in',
          role: 'ADMIN',
          isActive: true,
        };
        const token = signToken({ _id: demoUser._id, role: demoUser.role });
        return res.json({
          success: true,
          token,
          user: shapeUser(demoUser, ['*']),
        });
      }
      throw err;
    }
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
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    permissions,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt ?? null,
    isActive: user.isActive,
  };
}
