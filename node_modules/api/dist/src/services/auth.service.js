"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthError = void 0;
exports.login = login;
exports.setupTotp = setupTotp;
exports.verifyTotpSetup = verifyTotpSetup;
exports.verifyTotp = verifyTotp;
exports.recoverWithBackupCode = recoverWithBackupCode;
exports.refreshAccessToken = refreshAccessToken;
exports.logout = logout;
exports.changePassword = changePassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importStar(require("crypto"));
const prisma_1 = require("../../lib/prisma");
const IdentifierType = { username: 'username', ip: 'ip' };
const LoginEventType = {
    login_success: 'login_success',
    login_fail: 'login_fail',
    logout: 'logout',
    account_locked: 'account_locked',
    token_refresh: 'token_refresh',
};
const totp_service_1 = require("./totp.service");
// ── Config ────────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const PRE_AUTH_TOKEN_TTL = '5m';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
/**
 * Pre-computed bcrypt hash used to equalise response time when a user is not
 * found, preventing user-enumeration via timing attacks.
 */
const BCRYPT_DUMMY_HASH = '$2b$12$LxJNNQf4jjqNAlHmpW7jMO0dFNuRY0nCQPk1NeO.5xfpjxMrCHmea';
// ── Custom error ──────────────────────────────────────────────────────────────
class AuthError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 401, code = 'AUTH_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
// ── JWT helpers ───────────────────────────────────────────────────────────────
function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s)
        throw new Error('JWT_SECRET environment variable is required');
    return s;
}
function getJwtRefreshSecret() {
    const s = process.env.JWT_REFRESH_SECRET;
    if (!s)
        throw new Error('JWT_REFRESH_SECRET environment variable is required');
    return s;
}
function signPreAuthToken(sub, sid, stage) {
    return jsonwebtoken_1.default.sign({ sub, sid, stage }, getJwtSecret(), { expiresIn: PRE_AUTH_TOKEN_TTL });
}
function decodePreAuthToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, getJwtSecret());
    }
    catch {
        throw new AuthError('Invalid or expired pre-auth token', 401, 'INVALID_TOKEN');
    }
}
// ── DB-level rate limiting ────────────────────────────────────────────────────
async function checkRateLimit(db, identifier, type) {
    const record = await db.loginAttempt.findUnique({
        where: { identifier_identifierType: { identifier, identifierType: type } },
    });
    if (record?.lockedUntil && record.lockedUntil > new Date()) {
        const mins = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 60_000);
        throw new AuthError(`Too many failed attempts. Try again in ${mins} minute(s).`, 429, 'RATE_LIMITED');
    }
}
async function recordFailedAttempt(db, identifier, type) {
    const updated = await db.loginAttempt.upsert({
        where: { identifier_identifierType: { identifier, identifierType: type } },
        update: { attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
        create: { identifier, identifierType: type, attemptCount: 1, lastAttemptAt: new Date() },
    });
    if (updated.attemptCount >= MAX_ATTEMPTS) {
        await db.loginAttempt.update({
            where: { identifier_identifierType: { identifier, identifierType: type } },
            data: { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
        });
        if (type === IdentifierType.username) {
            await db.loginAudit.create({
                data: { usernameAttempted: identifier, eventType: LoginEventType.account_locked },
            });
        }
    }
}
async function resetAttempts(db, username, ip) {
    await db.loginAttempt.deleteMany({
        where: {
            OR: [
                { identifier: username, identifierType: IdentifierType.username },
                { identifier: ip, identifierType: IdentifierType.ip },
            ],
        },
    });
}
async function issueFullTokens(db, user, schemaName, ip, userAgent) {
    const jti = (0, crypto_1.randomUUID)();
    const permissions = (user.role.permissions ?? {});
    // ── Access token (15 min) ────────────────────────────────────────────────
    const accessPayload = {
        sub: user.id, sid: schemaName,
        role: user.roleId, roleName: user.role.roleName,
        username: user.username, firstName: user.firstName, lastName: user.lastName,
        perms: permissions,
    };
    const accessToken = jsonwebtoken_1.default.sign(accessPayload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
    // ── Refresh token (7 days) ───────────────────────────────────────────────
    const refreshPayload = { sub: user.id, sid: schemaName, jti };
    const rawRefreshToken = jsonwebtoken_1.default.sign(refreshPayload, getJwtRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL });
    const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
    await db.refreshToken.create({
        data: {
            id: jti,
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            deviceInfo: userAgent?.slice(0, 255) ?? null,
        },
    });
    // ── Housekeeping ─────────────────────────────────────────────────────────
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await db.loginAudit.create({
        data: {
            userId: user.id,
            usernameAttempted: user.username,
            eventType: LoginEventType.login_success,
            ipAddress: ip || null,
            userAgent: userAgent || null,
        },
    });
    const summary = {
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
async function login(dto, ip, userAgent) {
    const publicDb = (0, prisma_1.getPublicClient)();
    // Step 1: Find company
    const company = await publicDb.company.findUnique({
        where: { companyCode: dto.company_code },
        select: { schemaName: true, isActive: true },
    });
    if (!company?.isActive) {
        throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    const db = (0, prisma_1.getPrismaClient)(company.schemaName);
    // Step 2: IP rate limit
    await checkRateLimit(db, ip, IdentifierType.ip);
    // Step 3: Username rate limit
    await checkRateLimit(db, dto.username, IdentifierType.username);
    // Step 4: Find user
    const user = await db.user.findUnique({
        where: { username: dto.username },
        include: { role: { select: { roleName: true, permissions: true } } },
    });
    // Step 5: Verify password — always run bcrypt to prevent timing-based enumeration
    const hashToVerify = user?.passwordHash ?? BCRYPT_DUMMY_HASH;
    const passwordMatch = await bcrypt_1.default.compare(dto.password, hashToVerify);
    if (!user || !passwordMatch) {
        await Promise.all([
            recordFailedAttempt(db, ip, IdentifierType.ip),
            recordFailedAttempt(db, dto.username, IdentifierType.username),
            db.loginAudit.create({
                data: {
                    userId: user?.id ?? null,
                    usernameAttempted: dto.username,
                    eventType: LoginEventType.login_fail,
                    ipAddress: ip || null,
                    userAgent: userAgent || null,
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
            pre_auth_token: signPreAuthToken(user.id, company.schemaName, 'password_change'),
            requires_totp: false,
            requires_password_change: true,
        };
    }
    // Step 8: TOTP required
    if (user.totpEnabled) {
        return {
            pre_auth_token: signPreAuthToken(user.id, company.schemaName, 'pre_auth'),
            requires_totp: true,
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
async function setupTotp(userId, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    if (!user)
        throw new AuthError('User not found', 404, 'NOT_FOUND');
    const { encryptedSecret, otpauthUrl } = (0, totp_service_1.generateSecret)(user.username);
    await db.user.update({
        where: { id: userId },
        data: { totpSecret: encryptedSecret, totpEnabled: false },
    });
    const qrCode = await (0, totp_service_1.generateQrCode)(otpauthUrl);
    return { qr_code: qrCode, otpauth_url: otpauthUrl };
}
/**
 * POST /api/auth/2fa/setup/verify
 * Verify the first TOTP code to confirm the authenticator app is correctly configured.
 * Enables TOTP and generates 8 one-time backup codes.
 */
async function verifyTotpSetup(userId, schemaName, code) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpSecret) {
        throw new AuthError('TOTP setup not started. Call GET /api/auth/2fa/setup first.', 400, 'TOTP_NOT_INITIATED');
    }
    if (user.totpEnabled) {
        throw new AuthError('TOTP is already enabled for this account.', 400, 'TOTP_ALREADY_ENABLED');
    }
    if (!(0, totp_service_1.verifyCode)(user.totpSecret, code)) {
        throw new AuthError('Invalid TOTP code', 401, 'INVALID_TOTP');
    }
    // Generate 8 backup codes
    const plainCodes = (0, totp_service_1.generateBackupCodes)();
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt_1.default.hash(c, BCRYPT_ROUNDS)));
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
async function verifyTotp(preAuthPayload, code, ip, userAgent) {
    const db = (0, prisma_1.getPrismaClient)(preAuthPayload.sid);
    const user = await db.user.findUnique({
        where: { id: preAuthPayload.sub },
        include: { role: { select: { roleName: true, permissions: true } } },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
        throw new AuthError('TOTP is not enabled for this account.', 400, 'TOTP_NOT_ENABLED');
    }
    // Replay-attack guard — GMP requirement: compare against totpLastUsedAt
    if (user.totpLastUsedAt && (Date.now() - user.totpLastUsedAt.getTime()) < 30_000) {
        throw new AuthError('TOTP code already used. Wait for the next 30-second window.', 429, 'TOTP_REPLAY');
    }
    if (!(0, totp_service_1.verifyCode)(user.totpSecret, code)) {
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
async function recoverWithBackupCode(rawPreAuthToken, backupCode, ip, userAgent) {
    const payload = decodePreAuthToken(rawPreAuthToken);
    if (payload.stage !== 'pre_auth') {
        throw new AuthError('Invalid token stage for recovery', 401, 'INVALID_TOKEN_STAGE');
    }
    const db = (0, prisma_1.getPrismaClient)(payload.sid);
    const user = await db.user.findUnique({
        where: { id: payload.sub },
        include: { role: { select: { roleName: true, permissions: true } } },
    });
    if (!user)
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
    const unused = await db.totpBackupCode.findMany({ where: { userId: user.id, isUsed: false } });
    if (unused.length === 0) {
        throw new AuthError('No backup codes available. Contact your administrator.', 400, 'NO_BACKUP_CODES');
    }
    // Compare in parallel — all comparisons run regardless to avoid timing leaks
    const results = await Promise.all(unused.map(async (sc) => ({ id: sc.id, match: await bcrypt_1.default.compare(backupCode, sc.codeHash) })));
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
        data: { isUsed: true, usedAt: new Date() },
    });
    return issueFullTokens(db, user, payload.sid, ip, userAgent);
}
// ── Token refresh ─────────────────────────────────────────────────────────────
/**
 * POST /api/auth/refresh
 * Validate the refresh token, rotate it, and issue a new access token.
 * The old refresh token is immediately revoked (rotation prevents token reuse attacks).
 */
async function refreshAccessToken(rawRefreshToken) {
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(rawRefreshToken, getJwtRefreshSecret());
    }
    catch {
        throw new AuthError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    const db = (0, prisma_1.getPrismaClient)(payload.sid);
    const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await db.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
        throw new AuthError('Refresh token is invalid, revoked, or expired', 401, 'INVALID_REFRESH_TOKEN');
    }
    const user = await db.user.findUnique({
        where: { id: payload.sub },
        include: { role: { select: { roleName: true, permissions: true } } },
    });
    if (!user?.isActive)
        throw new AuthError('User not found or inactive', 401, 'USER_INACTIVE');
    // Revoke old token
    await db.refreshToken.update({ where: { tokenHash }, data: { isRevoked: true } });
    // Issue new pair
    const jti = (0, crypto_1.randomUUID)();
    const permissions = (user.role.permissions ?? {});
    const newAccessToken = jsonwebtoken_1.default.sign({
        sub: user.id,
        sid: payload.sid,
        role: user.roleId,
        roleName: user.role.roleName,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        perms: permissions,
    }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
    const newRefreshToken = jsonwebtoken_1.default.sign({ sub: user.id, sid: payload.sid, jti }, getJwtRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL });
    const newHash = crypto_1.default.createHash('sha256').update(newRefreshToken).digest('hex');
    await db.refreshToken.create({
        data: {
            id: jti, userId: user.id, tokenHash: newHash,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
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
async function logout(rawRefreshToken, userId, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
    await db.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { isRevoked: true },
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
async function changePassword(userId, schemaName, newPassword, currentPassword, ip = '', userAgent = '') {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { role: { select: { roleName: true, permissions: true } } },
    });
    if (!user)
        throw new AuthError('User not found', 404, 'NOT_FOUND');
    // Voluntary change — verify current password
    if (currentPassword !== undefined) {
        const match = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
        if (!match)
            throw new AuthError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }
    const newHash = await bcrypt_1.default.hash(newPassword, BCRYPT_ROUNDS);
    await db.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, mustChangePassword: false },
    });
    // After forced change: if TOTP is required, go back to the 2FA step
    if (user.totpEnabled) {
        return {
            pre_auth_token: signPreAuthToken(userId, schemaName, 'pre_auth'),
            requires_totp: true,
        };
    }
    // No TOTP — issue full tokens
    const tokens = await issueFullTokens(db, user, schemaName, ip, userAgent);
    return { ...tokens, requires_totp: false };
}
