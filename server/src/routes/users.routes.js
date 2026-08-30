import { Router } from 'express';
import { ROLE_LABELS, ROLES } from '../config/permissions.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate, validateParams } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { createUser, resetPassword, updateUser } from '../services/auth.js';
import { asyncHandler } from '../utils/errors.js';
import {
  createUserSchema,
  idParam,
  resetPasswordSchema,
  updateUserSchema,
} from '../validators/index.js';

export const usersRouter = Router();

/** Staff accounts (Sections 36 and 37). Administrators only. */
usersRouter.get(
  '/',
  requirePermission('users:read'),
  asyncHandler(async (_req, res) => {
    const rows = await User.find().sort('name');
    res.json({
      rows,
      roles: Object.values(ROLES).map((role) => ({ value: role, label: ROLE_LABELS[role] })),
    });
  }),
);

usersRouter.post(
  '/',
  requirePermission('users:manage'),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await createUser({ payload: req.valid.body, actor: req.user, req });
    res.status(201).json({ user });
  }),
);

usersRouter.patch(
  '/:id',
  requirePermission('users:manage'),
  validateParams(idParam),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUser({
      userId: req.valid.params.id,
      payload: req.valid.body,
      actor: req.user,
      req,
    });
    res.json({ user });
  }),
);

usersRouter.post(
  '/:id/reset-password',
  requirePermission('users:manage'),
  validateParams(idParam),
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword({
      userId: req.valid.params.id,
      newPassword: req.valid.body.newPassword,
      actor: req.user,
      req,
    });
    res.json({ message: 'Password reset. The user must change it at next sign-in.' });
  }),
);
