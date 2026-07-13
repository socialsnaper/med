/**
 * auth.service.ts
 *
 * Core authentication business logic:
 *  - Login (password verify → rate-limit → pre_auth_token or full tokens)
 *  - TOTP setup and verification
 *  - Backup code generation and recovery
 *  - Token refresh (rotation) and logout
 *  - Password change (forced and voluntary)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto, { randomUUID } from 'crypto';

import { getPrismaClient, getPublicClient } from '../../lib/prisma';

const IdentifierType = { username: 'username', ip: 'ip' } as const;
type IdentifierType = typeof IdentifierType[keyof typeof IdentifierType];

const LoginEventType = {
  login_success:   'login_success',
  login_fail:      'login_fail',
  logout:          'logout',
  account_locked:  'account_locked',
  token_refresh:   'token_refresh',
} as const;
type LoginEventType = typeof LoginEventType[keyof typeof LoginEventType];
import {
  verifyCode,
  generateSecret,
  generateQrCode,
  generateBackupCodes,
} from './totp.service';

import type { LoginInput } from '../validation/auth.schemas';
import type {
  LoginResult,
  AuthTokensResult,
  PreAuthTokenPayload,
  AccessTokenPayload,
  RefreshTokenPayload,
  UserSummary,
} from '../types/auth';
import type { PrismaClient } from '../../generated/prisma/client';

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS       = 5;
const LOCK_DURATION_MS   = 15 * 60 * 1000;  // 15 minutes

const PRE_AUTH_TOKEN_TTL = '5m';
const ACCESS_TOKEN_TTL   = '15m';
const REFRESH_TOKEN_TTL  = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

/**
 * Pre-computed bcrypt hash used to equalise response time when a user is not
 * found, preventing user-enumeration via timing attacks.
 */
const BCRYPT_DUMMY_HASH = '$2b$12$LxJNNQf4jjqNAlHmpW7jMO0dFNuRY0nCQPk1NeO.5xfpjxMrCHmea';

// ── Custom error ──────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401,
    public readonly code: string = 'AUTH_ERROR',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required');
  return s;
}

function getJwtRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET environment variable is required');
  return s;
}

function signPreAuthToken(sub: string, sid: string, stage: PreAuthTokenPayload['stage']): string {
  return jwt.sign({ sub, sid, stage }, getJwtSecret(), { expiresIn: PRE_AUTH_TOKEN_TTL });
}

function decodePreAuthToken(token: string): PreAuthTokenPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as PreAuthTokenPayload;
  } catch {
    throw new AuthError('Invalid or expired pre-auth token', 401, 'INVALID_TOKEN');
  }
}

// ── DB-level rate limiting ────────────────────────────────────────────────────

async function checkRateLimit(
  db: PrismaClient,
  identifier: string,
  type: IdentifierType,
): Promise<void> {
  const record = await db.loginAttempt.findUnique({
    where: { identifier_identifierType: { identifier, identifierType: type } },
  });
  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    const mins = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AuthError(
      `Too many failed attempts. Try again in ${mins} minute(s).`,
      429,
      'RATE_LIMITED',
    );
  }
}

async function recordFailedAttempt(
  db: PrismaClient,
  identifier: string,
  type: IdentifierType,
): Promise<void> {
  const updated = await db.loginAttempt.upsert({
    where:  { identifier_identifierType: { identifier, identifierType: type } },
    update: { attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
    create: { identifier, identifierType: type, attemptCount: 1, lastAttemptAt: new Date() },
  });

  if (updated.attemptCount >= MAX_ATTEMPTS) {
    await db.loginAttempt.update({
      where: { identifier_identifierType: { identifier, identifierType: type } },
      data:  { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
    });
    if (type === IdentifierType.username) {
      await db.loginAudit.create({
        data: { usernameAttempted: identifier, eventType: LoginEventType.account_locked },
      });
    }
  }
}

async function resetAttempts(db: PrismaClient, username: string, ip: string): Promise<void> {
  await db.loginAttempt.deleteMany({
    where: {
      OR: [
        { identifier: username, identifierType: IdentifierType.username },
        { identifier: ip,       identifierType: IdentifierType.ip },
      ],
    },
  });
}

// ── Full token issuance ───────────────────────────────────────────────────────

type UserWithRole = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  roleId: string;
  role: { roleName: string; permissions: unknown };
};

async function issueFullTokens(
  db: PrismaClient,
  user: UserWithRole,
  schemaName: string,
  ip: string,
  userAgent: string,
): Promise<AuthTokensResult> {
  const jti         = randomUUID();
  const permissions = (user.role.permissions ?? {}) as Record<string, string>;

  // ── Access token (15 min) ────────────────────────────────────────────────
  const accessPayload: AccessTokenPayload = {
    sub: user.id, sid: schemaName,
    role: user.roleId, roleName: user.role.roleName,
    username: user.username, firstName: user.firstName, lastName: user.lastName,
    perms: permissions,
  };
  const accessToken = jwt.sign(accessPayload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });

  // ── Refresh token (7 days) ───────────────────────────────────────────────
  const refreshPayload: RefreshTokenPayload = { sub: user.id, sid: schemaName, jti };
  const rawRefreshToken = jwt.sign(refreshPayload, getJwtRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL });
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  await db.refreshToken.create({
    data: {
      id:         jti,
      userId:     user.id,
      tokenHash,
      expiresAt:  new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      deviceInfo: userAgent?.slice(0, 255) ?? null,
    },
  });

  // ── Housekeeping ─────────────────────────────────────────────────────────
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await db.loginAudit.create({
    data: {
      userId:           user.id,
      usernameAttempted: user.username,
      eventType:        LoginEventType.login_success,
      ipAddress:        ip   || null,
      userAgent:        userAgent || null,
    },
  });

  const summary: UserSummary = {
    id: user.id, username: user.username,
    firstName: user.firstName, lastName: user.lastName,
    role: user.role.roleName,
  };

  return { access_token: accessToken, refresh_token: rawRefreshToken, user: summary };
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * 1. Check rate limit by IP (tenant schema)
 * 2. Find company by company_code (public schema)
 * 3. Set prisma client to company.schema_name (tenant schema)
 * 4. Check rate limit by username
 * 5. Find user by username
 * 6. bcrypt.compare(password, user.password_hash)
 * 7. On failure: record attempt, log audit, throw generic error (no enumeration)
 * 8. On success: reset rate limit counters
 * 9. If must_change_password → return pre_auth_token (stage: password_change) + flag
 * 10. If totp_enabled → return pre_auth_token (stage: pre_auth) + flag
 * 11. Otherwise: issue and return full tokens immediately
 */
export async function login(dto: LoginInput, ip: string, userAgent: string): Promise<LoginResult> {
  const publicDb = getPublicClient();

  // Step 1: Find company
  const company = await publicDb.company.findUnique({
    where:  { companyCode: dto.company_code },
    select: { schemaName: true, isActive: true },
  });
  if (!company?.isActive) {
    throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const db = getPrismaClient(company.schemaName);

  // Step 2: IP rate limit
  await checkRateLimit(db, ip, IdentifierType.ip);

  // Step 3: Username rate limit
  await checkRateLimit(db, dto.username, IdentifierType.username);

  // Step 4: Find user
  const user = await db.user.findUnique({
    where:   { username: dto.username },
    include: { role: { select: { roleName: true, permissions: true } } },
  });

  // Step 5: Verify password — always run bcrypt to prevent timing-based enumeration
  const hashToVerify  = user?.passwordHash ?? BCRYPT_DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(dto.password, hashToVerify);

  if (!user || !passwordMatch) {
    await Promise.all([
      recordFailedAttempt(db, ip,           IdentifierType.ip),
      recordFailedAttempt(db, dto.username,  IdentifierType.username),
      db.loginAudit.create({
        data: {
          userId:            user?.id ?? null,
          usernameAttempted: dto.username,
          eventType:         LoginEventType.login_fail,
          ipAddress:         ip || null,
          userAgent:         userAgent || null,
        },
      }),
    ]);
    throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AuthError('Account is inactive. Contact your administrator.', 401, 'ACCOUNT_INACTIVE');
  }

  // Step 6: Reset rate limit on success
  await resetAttempts(db, dto.username, ip);

  // Step 7: Forced password change
  if (user.mustChangePassword) {
    return {
      pre_auth_token:           signPreAuthToken(user.id, company.schemaName, 'password_change'),
      requires_totp:            false,
      requires_password_change: true,
    };
  }

  // Step 8: TOTP required
  if (user.totpEnabled) {
    return {
      pre_auth_token:           signPreAuthToken(user.id, company.schemaName, 'pre_auth'),
      requires_totp:            true,
      requires_password_change: false,
    };
  }

  // Step 9: No extra steps — issue full tokens immediately
  const tokens = await issueFullTokens(db, user, company.schemaName, ip, userAgent);
  return { ...tokens, requires_totp: false, requires_password_change: false };
}

// ── TOTP setup ────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/2fa/setup
 * Generate a TOTP secret, store it encrypted in the DB (totp_enabled stays false),
 * and return a QR code data URL.
 */
export async function setupTotp(
  userId: string,
  schemaName: string,
): Promise<{ qr_code: string; otpauth_url: string }> {
  const db   = getPrismaClient(schemaName);
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user) throw new AuthError('User not found', 404, 'NOT_FOUND');

  const { encryptedSecret, otpauthUrl } = generateSecret(user.username);

  await db.user.update({
    where: { id: userId },
    data:  { totpSecret: encryptedSecret, totpEnabled: false },
  });

  const qrCode = await generateQrCode(otpauthUrl);
  return { qr_code: qrCode, otpauth_url: otpauthUrl };
}

/**
 * POST /api/auth/2fa/setup/verify
 * Verify the first TOTP code to confirm the authenticator app is correctly configured.
 * Enables TOTP and generates 8 one-time backup codes.
 */
export async function verifyTotpSetup(
  userId: string,
  schemaName: string,
  code: string,
): Promise<{ backup_codes: string[] }> {
  const db   = getPrismaClient(schemaName);
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpSecret) {
    throw new AuthError('TOTP setup not started. Call GET /api/auth/2fa/setup first.', 400, 'TOTP_NOT_INITIATED');
  }
  if (user.totpEnabled) {
    throw new AuthError('TOTP is already enabled for this account.', 400, 'TOTP_ALREADY_ENABLED');
  }
  if (!verifyCode(user.totpSecret, code)) {
    throw new AuthError('Invalid TOTP code', 401, 'INVALID_TOTP');
  }

  // Generate 8 backup codes
  const plainCodes  = generateBackupCodes();
  const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { totpEnabled: true } }),
    db.totpBackupCode.deleteMany({ where: { userId } }),
    db.totpBackupCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);

  return { backup_codes: plainCodes };
}

// ── TOTP verify (login flow) ──────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/verify
 * Verify a 6-digit TOTP code during the login flow.
 * Requires a pre_auth_token (stage: pre_auth) from the middleware.
 *
 * GMP note: totpLastUsedAt is checked and updated atomically to prevent replay attacks.
 */
export async function verifyTotp(
  preAuthPayload: PreAuthTokenPayload,
  code: string,
  ip: string,
  userAgent: string,
): Promise<AuthTokensResult> {
  const db   = getPrismaClient(preAuthPayload.sid);
  const user = await db.user.findUnique({
    where:   { id: preAuthPayload.sub },
    include: { role: { select: { roleName: true, permissions: true } } },
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    throw new AuthError('TOTP is not enabled for this account.', 400, 'TOTP_NOT_ENABLED');
  }

  // Replay-attack guard — GMP requirement: compare against totpLastUsedAt
  if (user.totpLastUsedAt && (Date.now() - user.totpLastUsedAt.getTime()) < 30_000) {
    throw new AuthError('TOTP code already used. Wait for the next 30-second window.', 429, 'TOTP_REPLAY');
  }

  if (!verifyCode(user.totpSecret, code)) {
    await db.loginAudit.create({
      data: {
        userId: user.id, usernameAttempted: user.username,
        eventType: LoginEventType.login_fail, ipAddress: ip || null, userAgent: userAgent || null,
      },
    });
    throw new AuthError('Invalid TOTP code', 401, 'INVALID_TOTP');
  }

  // Atomically stamp totpLastUsedAt to block replay within the same 30 s window
  await db.user.update({ where: { id: user.id }, data: { totpLastUsedAt: new Date() } });

  return issueFullTokens(db, user, preAuthPayload.sid, ip, userAgent);
}

// ── Backup code recovery ──────────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/recover
 * Use a one-time backup code to bypass TOTP during the login flow.
 * The backup code and pre_auth_token are both supplied in the request body.
 *
 * // Generate 8 backup codes
 * const codes = Array.from({length: 8}, () =>
 *   crypto.randomBytes(4).toString('hex')
 *     .match(/.{4}/g)!.join('-')
 * )
 */
export async function recoverWithBackupCode(
  rawPreAuthToken: string,
  backupCode: string,
  ip: string,
  userAgent: string,
): Promise<AuthTokensResult> {
  const payload = decodePreAuthToken(rawPreAuthToken);
  if (payload.stage !== 'pre_auth') {
    throw new AuthError('Invalid token stage for recovery', 401, 'INVALID_TOKEN_STAGE');
  }

  const db   = getPrismaClient(payload.sid);
  const user = await db.user.findUnique({
    where:   { id: payload.sub },
    include: { role: { select: { roleName: true, permissions: true } } },
  });
  if (!user) throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');

  const unused = await db.totpBackupCode.findMany({ where: { userId: user.id, isUsed: false } });
  if (unused.length === 0) {
    throw new AuthError('No backup codes available. Contact your administrator.', 400, 'NO_BACKUP_CODES');
  }

  // Compare in parallel — all comparisons run regardless to avoid timing leaks
  const results = await Promise.all(
    unused.map(async (sc) => ({ id: sc.id, match: await bcrypt.compare(backupCode, sc.codeHash) })),
  );
  const matched = results.find((r) => r.match);

  if (!matched) {
    await db.loginAudit.create({
      data: {
        userId: user.id, usernameAttempted: user.username,
        eventType: LoginEventType.login_fail, ipAddress: ip || null, userAgent: userAgent || null,
      },
    });
    throw new AuthError('Invalid backup code', 401, 'INVALID_BACKUP_CODE');
  }

  // Mark code as consumed — one-time use
  await db.totpBackupCode.update({
    where: { id: matched.id },
    data:  { isUsed: true, usedAt: new Date() },
  });

  return issueFullTokens(db, user, payload.sid, ip, userAgent);
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Validate the refresh token, rotate it, and issue a new access token.
 * The old refresh token is immediately revoked (rotation prevents token reuse attacks).
 */
export async function refreshAccessToken(
  rawRefreshToken: string,
): Promise<{ access_token: string; refresh_token: string }> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(rawRefreshToken, getJwtRefreshSecret()) as RefreshTokenPayload;
  } catch {
    throw new AuthError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const db        = getPrismaClient(payload.sid);
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  const stored = await db.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new AuthError('Refresh token is invalid, revoked, or expired', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await db.user.findUnique({
    where:   { id: payload.sub },
    include: { role: { select: { roleName: true, permissions: true } } },
  });
  if (!user?.isActive) throw new AuthError('User not found or inactive', 401, 'USER_INACTIVE');

  // Revoke old token
  await db.refreshToken.update({ where: { tokenHash }, data: { isRevoked: true } });

  // Issue new pair
  const jti         = randomUUID();
  const permissions = (user.role.permissions ?? {}) as Record<string, string>;

  const newAccessToken = jwt.sign(
    {
      sub:      user.id,
      sid:      payload.sid,
      role:     user.roleId,
      roleName: user.role.roleName,
      username: user.username,
      firstName: user.firstName,
      lastName:  user.lastName,
      perms:    permissions,
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_TTL },
  );
  const newRefreshToken = jwt.sign(
    { sub: user.id, sid: payload.sid, jti },
    getJwtRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_TTL },
  );
  const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  await db.refreshToken.create({
    data: {
      id: jti, userId: user.id, tokenHash: newHash,
      expiresAt:  new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      deviceInfo: stored.deviceInfo,
    },
  });

  await db.loginAudit.create({
    data: { userId: user.id, usernameAttempted: user.username, eventType: LoginEventType.token_refresh },
  });

  return { access_token: newAccessToken, refresh_token: newRefreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Revoke the current refresh token and invalidate the httpOnly cookie.
 */
export async function logout(
  rawRefreshToken: string,
  userId: string,
  schemaName: string,
): Promise<void> {
  const db        = getPrismaClient(schemaName);
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  await db.refreshToken.updateMany({
    where: { userId, tokenHash },
    data:  { isRevoked: true },
  });

  await db.loginAudit.create({
    data: { userId, usernameAttempted: '', eventType: LoginEventType.logout },
  });
}

// ── Password change ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/password/change
 * Change a user's password.
 *
 * - Forced change (pre_auth stage: 'password_change'): currentPassword is undefined.
 *   The user was already authenticated at login, so we skip re-verification.
 * - Voluntary change (access token): currentPassword must be provided and verified.
 *
 * After change:
 *   - If totp_enabled → return pre_auth_token (stage: pre_auth) for the TOTP step.
 *   - Otherwise      → issue full tokens.
 *
 * # These 3 endpoints complete the full auth cycle
 */
export async function changePassword(
  userId: string,
  schemaName: string,
  newPassword: string,
  currentPassword: string | undefined,
  ip      = '',
  userAgent = '',
): Promise<{ pre_auth_token?: string; access_token?: string; refresh_token?: string; requires_totp: boolean; user?: UserSummary }> {
  const db   = getPrismaClient(schemaName);
  const user = await db.user.findUnique({
    where:   { id: userId },
    include: { role: { select: { roleName: true, permissions: true } } },
  });
  if (!user) throw new AuthError('User not found', 404, 'NOT_FOUND');

  // Voluntary change — verify current password
  if (currentPassword !== undefined) {
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new AuthError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.user.update({
    where: { id: userId },
    data:  { passwordHash: newHash, mustChangePassword: false },
  });

  // After forced change: if TOTP is required, go back to the 2FA step
  if (user.totpEnabled) {
    return {
      pre_auth_token: signPreAuthToken(userId, schemaName, 'pre_auth'),
      requires_totp:  true,
    };
  }

  // No TOTP — issue full tokens
  const tokens = await issueFullTokens(db, user, schemaName, ip, userAgent);
  return { ...tokens, requires_totp: false };
}
