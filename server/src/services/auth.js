import bcrypt from 'bcryptjs';
import { withTransaction } from '../config/db.js';
import { permissionsForRole, ROLES } from '../config/permissions.js';
import { User } from '../models/User.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import { writeAudit } from './audit.js';

/**
 * Authentication and user administration (Sections 36, 37 and 45).
 *
 * Section 45: "Never store plain-text passwords." Passwords exist as plain text
 * only inside these functions, for the microseconds between arriving on the
 * request and being handed to bcrypt. Nothing else in the codebase reads
 * `passwordHash` (the field is `select: false`), nothing logs a password, and
 * the audit trail records that a password changed without recording what to.
 */

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Minimum password rules. Deliberately modest - this is a small office, and a
 * rule so strict that everyone writes the password on the wall is worse than
 * no rule at all.
 */
export function assertPasswordAcceptable(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw badRequest('Password must be at least 8 characters long.');
  }
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) {
    throw badRequest('Password must contain at least one letter and one number.');
  }
}

export async function login({ email, password, req }) {
  const user = await User.findOne({ email: String(email ?? '').toLowerCase().trim() }).select(
    '+passwordHash',
  );

  /**
   * The same message and the same amount of work whether the email exists or
   * not. Saying "no such user" would let anyone enumerate staff accounts, and
   * returning early would leak the answer through response timing.
   */
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(String(password ?? ''), hash);

  if (!user || !ok) {
    /**
     * Failed attempts are recorded so a run of them against one account is
     * visible afterwards. No session: this is not part of any transaction, and
     * the entry must survive regardless. The password is never written down,
     * and the email is only recorded when it belongs to a real account - logging
     * arbitrary strings from a public endpoint would let anyone write into the
     * audit trail.
     */
    await writeAudit({
      actor: user ?? null,
      action: 'LOGIN_FAILED',
      entity: 'User',
      entityId: user?._id ?? null,
      entityCode: user?.email ?? null,
      summary: user
        ? `Failed sign-in attempt for ${user.email}`
        : 'Failed sign-in attempt for an unknown email address',
      req,
    }).catch(() => {});

    throw unauthorized('Email or password is incorrect.');
  }

  if (!user.isActive) throw unauthorized('This account has been deactivated.');

  user.lastLoginAt = new Date();
  await user.save();

  await writeAudit({
    actor: user,
    action: 'LOGIN',
    entity: 'User',
    entityId: user._id,
    entityCode: user.email,
    summary: `${user.name} signed in`,
    req,
  }).catch(() => {});

  const safe = user.toJSON();
  delete safe.passwordHash;

  return {
    user: safe,
    permissions: permissionsForRole(user.role),
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export async function changeOwnPassword({ user, currentPassword, newPassword, req }) {
  const full = await User.findById(user._id).select('+passwordHash');
  if (!full) throw notFound('Account not found.');

  const ok = await bcrypt.compare(String(currentPassword ?? ''), full.passwordHash);
  if (!ok) throw badRequest('Your current password is incorrect.');

  assertPasswordAcceptable(newPassword);
  if (await bcrypt.compare(newPassword, full.passwordHash)) {
    throw badRequest('The new password must be different from the current one.');
  }

  return withTransaction(async (session) => {
    full.passwordHash = await hashPassword(newPassword);
    full.mustChangePassword = false;
    await full.save({ session });

    await writeAudit({
      session,
      actor: full,
      action: 'UPDATE',
      entity: 'User',
      entityId: full._id,
      entityCode: full.email,
      summary: `${full.name} changed their own password`,
      req,
    });

    return { ok: true };
  });
}

export async function createUser({ payload, actor, req }) {
  assertPasswordAcceptable(payload.password);

  const email = String(payload.email).toLowerCase().trim();
  if (await User.exists({ email })) {
    throw conflict('A user with that email address already exists.');
  }

  if (!Object.values(ROLES).includes(payload.role)) {
    throw badRequest(`${payload.role} is not a valid role.`);
  }

  return withTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: payload.name,
          email,
          passwordHash: await hashPassword(payload.password),
          role: payload.role,
          phone: payload.phone ?? '',
          isActive: true,
          // The administrator who created the account knows the password, so
          // the holder is asked to replace it on first sign-in.
          mustChangePassword: true,
          createdBy: actor._id,
        },
      ],
      { session },
    );

    await writeAudit({
      session,
      actor,
      action: 'CREATE',
      entity: 'User',
      entityId: user._id,
      entityCode: user.email,
      summary: `Created ${payload.role} account for ${payload.name} (${email})`,
      req,
    });

    return user.toJSON();
  });
}

export async function updateUser({ userId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw notFound('User not found.');

    const changes = [];
    const track = (field, next) => {
      if (next === undefined) return;
      if (String(user[field] ?? '') !== String(next)) {
        changes.push({ field, from: user[field] ?? null, to: next });
        user[field] = next;
      }
    };

    track('name', payload.name);
    track('phone', payload.phone);

    if (payload.role !== undefined) {
      if (!Object.values(ROLES).includes(payload.role)) {
        throw badRequest(`${payload.role} is not a valid role.`);
      }
      // Locking yourself out of your own system is not a recoverable mistake
      // without database access, so it is refused.
      if (String(user._id) === String(actor._id) && payload.role !== user.role) {
        throw badRequest('You cannot change your own role.');
      }
      track('role', payload.role);
    }

    if (payload.isActive !== undefined) {
      if (String(user._id) === String(actor._id) && payload.isActive === false) {
        throw badRequest('You cannot deactivate your own account.');
      }
      if (user.isActive !== payload.isActive) {
        changes.push({ field: 'isActive', from: user.isActive, to: payload.isActive });
        user.isActive = payload.isActive;
      }
    }

    if (changes.length === 0) return user.toJSON();

    await user.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'User',
      entityId: user._id,
      entityCode: user.email,
      summary: `Updated account ${user.email}`,
      changes,
      req,
    });

    return user.toJSON();
  });
}

/** An administrator resetting somebody else's forgotten password. */
export async function resetPassword({ userId, newPassword, actor, req }) {
  assertPasswordAcceptable(newPassword);

  return withTransaction(async (session) => {
    const user = await User.findById(userId).select('+passwordHash').session(session);
    if (!user) throw notFound('User not found.');

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = true;
    await user.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'User',
      entityId: user._id,
      entityCode: user.email,
      // The new password is never recorded - only the fact of the reset.
      summary: `${actor.name} reset the password for ${user.email}`,
      changes: [{ field: 'passwordHash', from: '(hidden)', to: '(reset)' }],
      req,
    });

    return { ok: true };
  });
}
