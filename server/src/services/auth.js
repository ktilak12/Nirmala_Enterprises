import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import { permissionsForRole, ROLES } from '../config/permissions.js';
import { User } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound, unauthorized, tooManyRequests, serviceUnavailable } from '../utils/errors.js';
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

// Pre-computed constant round-12 bcrypt hash for timing attack mitigation.
// When an email does not exist in the database, bcrypt comparison is still
// performed against this dummy hash to maintain constant response times and
// defeat user enumeration attacks.
const DUMMY_BCRYPT_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4N2.g/O1iG';

// In-memory lockout storage: key -> { count: number, lockedUntil: Date | null }
const loginAttempts = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function clearAllLockouts() {
  loginAttempts.clear();
}

// Clear any active lockouts on startup
clearAllLockouts();

export function getLockoutKey(identity, ip) {
  const cleanId = String(identity || '').toLowerCase().trim();
  const cleanIp = String(ip || 'unknown').trim();
  return `${cleanId}:${cleanIp}`;
}

export function checkAccountLockout(identity, ip) {
  const key = getLockoutKey(identity, ip);
  const record = loginAttempts.get(key);
  if (!record) return { isLocked: false };

  if (record.lockedUntil) {
    if (new Date() < record.lockedUntil) {
      const remainingSec = Math.ceil((record.lockedUntil - new Date()) / 1000);
      const remainingMin = Math.ceil(remainingSec / 60);
      return {
        isLocked: true,
        remainingSec,
        remainingMin,
        message: `Account temporarily locked due to 5 consecutive failed attempts. Please try again in ${remainingMin} minute(s).`,
      };
    } else {
      // Lock expired, reset
      loginAttempts.delete(key);
      return { isLocked: false };
    }
  }

  return { isLocked: false };
}

export function recordFailedLogin(identity, ip) {
  const key = getLockoutKey(identity, ip);
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  loginAttempts.set(key, record);
  return record;
}

export function resetLoginAttempts(identity, ip) {
  const key = getLockoutKey(identity, ip);
  loginAttempts.delete(key);
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Enterprise Security Password Rules.
 * Requires: minimum 10 characters, uppercase letter, lowercase letter, number, and special character.
 */
export function assertPasswordAcceptable(plain) {
  if (typeof plain !== 'string' || plain.length < 10) {
    throw badRequest('Password must be at least 10 characters long.');
  }
  if (!/[A-Z]/.test(plain)) {
    throw badRequest('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(plain)) {
    throw badRequest('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(plain)) {
    throw badRequest('Password must contain at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(plain)) {
    throw badRequest('Password must contain at least one special character (!@#$%^&*...).');
  }
}

export async function login({ email, password, req }) {
  const cleanEmail = String(email ?? '').toLowerCase().trim();
  const cleanPassword = String(password ?? '');
  const clientIp = req?.ip || 'unknown';

  if (!cleanEmail) {
    throw badRequest('Enter your email or username.');
  }

  // 1. Check lockout status
  const lockout = checkAccountLockout(cleanEmail, clientIp);
  if (lockout.isLocked) {
    throw tooManyRequests(lockout.message);
  }

  const isDbConnected = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
  let user = null;
  let authenticated = false;
  let isFromDb = false;

  if (isDbConnected) {
    try {
      user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
      if (user) isFromDb = true;
    } catch {
      user = null;
    }

    if (user && isFromDb) {
      const hash = user.passwordHash ?? '';
      authenticated = await bcrypt.compare(cleanPassword, hash);
    } else {
      // User does not exist in DB: execute dummy comparison to protect against timing-based user enumeration
      await bcrypt.compare(cleanPassword, DUMMY_BCRYPT_HASH);
      authenticated = false;
    }
  } else {
    // Database is offline: strictly fail in production
    if (env.isProduction) {
      throw serviceUnavailable('Authentication service is currently unavailable. Please try again later.');
    }

    // In DEVELOPMENT mode ONLY, provide a secure offline fallback for the seed admin.
    // Explicitly verify BOTH username and password (using constant-time SHA-256 buffer comparison to prevent length leakage).
    const devAdminEmail = String(env.seedAdmin?.email || '').toLowerCase().trim();
    const devAdminPassword = String(env.seedAdmin?.password || '');

    if (devAdminEmail && devAdminPassword && cleanEmail === devAdminEmail) {
      const inputHash = crypto.createHash('sha256').update(cleanPassword).digest();
      const targetHash = crypto.createHash('sha256').update(devAdminPassword).digest();
      if (crypto.timingSafeEqual(inputHash, targetHash)) {
        authenticated = true;
        user = {
          _id: '65f000000000000000000001',
          name: env.seedAdmin?.name || 'System Administrator',
          email: devAdminEmail,
          role: ROLES.SUPER_ADMIN,
          isActive: true,
          mustChangePassword: false,
          toJSON() { return { ...this }; }
        };
        console.warn(`[SECURITY WARNING] Database is offline: authenticated ${cleanEmail} via environment seed admin fallback (Development mode only).`);
      } else {
        await bcrypt.compare(cleanPassword, DUMMY_BCRYPT_HASH);
        authenticated = false;
      }
    } else {
      await bcrypt.compare(cleanPassword, DUMMY_BCRYPT_HASH);
      authenticated = false;
    }
  }

  // 2. Reject if not authenticated or user missing
  if (!user || !authenticated) {
    const record = recordFailedLogin(cleanEmail, clientIp);

    await writeAudit({
      actor: null,
      action: 'LOGIN_FAILED',
      entity: 'User',
      entityId: user?._id ?? null,
      entityCode: cleanEmail,
      summary: `Failed sign-in attempt (${record.count}/${MAX_FAILED_ATTEMPTS}) for ${cleanEmail} from IP ${clientIp}`,
      req,
    }).catch(() => {});

    if (record.lockedUntil) {
      throw unauthorized(`Account temporarily locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in 15 minutes.`);
    }

    throw unauthorized('Email or password is incorrect.');
  }

  // 3. Reset failed attempt counter on successful login
  resetLoginAttempts(cleanEmail, clientIp);

  // 4. Verify account active state
  if (!user.isActive) {
    throw unauthorized('This account has been deactivated.');
  }

  if (isFromDb && user.save) {
    user.lastLoginAt = new Date();
    await user.save().catch(() => {});
  }

  await writeAudit({
    actor: user,
    action: 'LOGIN',
    entity: 'User',
    entityId: user._id,
    entityCode: user.email,
    summary: `${user.name} signed in`,
    req,
  }).catch(() => {});

  const safe = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
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

  const userRole = Object.values(ROLES).includes(payload.role) ? payload.role : ROLES.SALES_STAFF;

  if (userRole === ROLES.SUPER_ADMIN && actor?.role !== ROLES.SUPER_ADMIN) {
    throw forbidden('Only a Super Administrator can create Super Administrator accounts.');
  }

  if (
    userRole === ROLES.ADMIN &&
    actor?.role !== ROLES.SUPER_ADMIN &&
    actor?.role !== ROLES.ADMIN
  ) {
    throw forbidden('Only an Administrator can assign administrative roles.');
  }

  const email = String(payload.email).toLowerCase().trim();
  if (await User.exists({ email })) {
    throw conflict('A user with that email address already exists.');
  }

  return withTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: payload.name,
          email,
          passwordHash: await hashPassword(payload.password),
          role: userRole,
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
      summary: `Created ${userRole} account for ${payload.name} (${email})`,
      req,
    });

    return user.toJSON();
  });
}

export async function updateUser({ userId, payload, actor, req }) {
  if (payload.role === ROLES.SUPER_ADMIN && actor?.role !== ROLES.SUPER_ADMIN) {
    throw forbidden('Only a Super Administrator can assign the Super Administrator role.');
  }

  if (
    payload.role === ROLES.ADMIN &&
    actor?.role !== ROLES.SUPER_ADMIN &&
    actor?.role !== ROLES.ADMIN
  ) {
    throw forbidden('Only an Administrator can assign administrative roles.');
  }

  return withTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw notFound('User not found.');

    if (user.role === ROLES.SUPER_ADMIN && actor?.role !== ROLES.SUPER_ADMIN) {
      throw forbidden('Only a Super Administrator can modify a Super Administrator account.');
    }

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

    if (user.role === ROLES.SUPER_ADMIN && actor?.role !== ROLES.SUPER_ADMIN) {
      throw forbidden('Only a Super Administrator can reset the password for a Super Administrator account.');
    }

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
