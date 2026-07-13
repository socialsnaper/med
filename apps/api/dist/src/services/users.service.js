"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserError = void 0;
exports.listUsers = listUsers;
exports.streamUsersCsv = streamUsersCsv;
exports.createUser = createUser;
exports.getUser = getUser;
exports.updateUser = updateUser;
exports.setUserStatus = setUserStatus;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../lib/prisma");
const email_service_1 = require("./email.service");
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
// ── Custom error ──────────────────────────────────────────────────────────────
class UserError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 400, code = 'USER_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'UserError';
    }
}
exports.UserError = UserError;
// ── CSV helpers ───────────────────────────────────────────────────────────────
/** Wrap a value in double-quotes and escape any internal double-quotes (RFC 4180). */
function csvCell(value) {
    if (value === null || value === undefined)
        return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
}
function csvRow(cells) {
    return cells.map(csvCell).join(',');
}
const CSV_HEADER = csvRow([
    'employee_code',
    'username',
    'first_name',
    'last_name',
    'email',
    'role_name',
    'role_group',
    'date_of_joining',
    'is_active',
    'last_login_at',
]);
/**
 * Returns all users in the tenant schema, ordered active-first then by name.
 * Sensitive fields (password_hash, totp_secret, totp_last_used_at) are
 * explicitly excluded via Prisma `select`.
 */
async function listUsers(schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    return db.user.findMany({
        select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePicUrl: true,
            dateOfJoining: true,
            isActive: true,
            mustChangePassword: true,
            totpEnabled: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            role: {
                select: {
                    id: true,
                    roleName: true,
                },
            },
        },
        orderBy: [
            { isActive: 'desc' },
            { firstName: 'asc' },
            { lastName: 'asc' },
        ],
    });
}
// ── CSV export ────────────────────────────────────────────────────────────────
/**
 * Queries users with the export-specific field set (adds role_group) and
 * streams a UTF-8 CSV directly to the Express Response.
 * Sensitive fields (password_hash, totp_secret, totp_last_used_at) are
 * never selected.
 */
async function streamUsersCsv(schemaName, res) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const users = await db.user.findMany({
        select: {
            employeeCode: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            dateOfJoining: true,
            isActive: true,
            lastLoginAt: true,
            role: {
                select: {
                    roleName: true,
                    roleGroup: true,
                },
            },
        },
        orderBy: [
            { isActive: 'desc' },
            { firstName: 'asc' },
            { lastName: 'asc' },
        ],
    });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `users-${date}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    // UTF-8 BOM so Excel auto-detects encoding
    res.write('\uFEFF');
    res.write(CSV_HEADER + '\r\n');
    for (const u of users) {
        res.write(csvRow([
            u.employeeCode,
            u.username,
            u.firstName,
            u.lastName,
            u.email,
            u.role.roleName,
            u.role.roleGroup,
            u.dateOfJoining ? u.dateOfJoining.toISOString().slice(0, 10) : null,
            u.isActive,
            u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        ]) + '\r\n');
    }
    res.end();
}
// ── Username generation ───────────────────────────────────────────────────────
/**
 * Strips non-ASCII, lowercases, removes anything that isn't a-z or 0-9.
 */
function slugify(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}
/**
 * Generates a unique username: `firstname.lastname`, with a numeric suffix
 * (e.g. `ravi.sharma2`) if the base name is already taken.
 */
async function generateUniqueUsername(firstName, lastName, db) {
    const base = `${slugify(firstName)}.${slugify(lastName)}`;
    // Fetch all usernames that start with this base in one query
    const taken = await db.user.findMany({
        where: { username: { startsWith: base } },
        select: { username: true },
    });
    const takenSet = new Set(taken.map((u) => u.username));
    if (!takenSet.has(base))
        return base;
    let n = 2;
    while (takenSet.has(`${base}${n}`))
        n++;
    return `${base}${n}`;
}
// ── Temporary password ────────────────────────────────────────────────────────
/**
 * Generates a cryptographically random 13-character password that satisfies:
 * at least 2 uppercase, 2 lowercase, 2 digits, 1 special character.
 */
function generateTempPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@$!%*?&_-#';
    const all = upper + lower + digits + special;
    const pick = (charset) => charset[crypto_1.default.randomInt(charset.length)];
    const chars = [
        pick(upper), pick(upper),
        pick(lower), pick(lower),
        pick(digits), pick(digits),
        pick(special),
        ...Array.from({ length: 6 }, () => pick(all)),
    ];
    // Fisher-Yates shuffle using crypto.randomInt for unbiased ordering
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto_1.default.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
/**
 * Creates a new user in the tenant schema.
 * - Auto-generates a unique username from first + last name.
 * - Generates a temporary password, bcrypt-hashes it.
 * - Sets must_change_password = true.
 * - Fires a welcome email (non-blocking — does not fail the request).
 *
 * Throws UserError for business-rule violations (email taken, etc.)
 */
async function createUser(input, schemaName, createdById) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    // ── Derive companyId from the creating admin ─────────────────────────────
    const creator = await db.user.findUnique({
        where: { id: createdById },
        select: { companyId: true },
    });
    if (!creator) {
        throw new UserError('Requesting user not found', 500, 'INTERNAL_ERROR');
    }
    // ── Uniqueness checks ─────────────────────────────────────────────────────
    const [emailTaken, codeTaken, roleExists] = await Promise.all([
        db.user.findUnique({ where: { email: input.email }, select: { id: true } }),
        input.employeeCode
            ? db.user.findUnique({ where: { employeeCode: input.employeeCode }, select: { id: true } })
            : Promise.resolve(null),
        db.role.findUnique({ where: { id: input.roleId }, select: { id: true } }),
    ]);
    if (emailTaken) {
        throw new UserError('Email address is already in use', 409, 'EMAIL_TAKEN');
    }
    if (codeTaken) {
        throw new UserError('Employee code is already in use', 409, 'EMPLOYEE_CODE_TAKEN');
    }
    if (!roleExists) {
        throw new UserError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    // ── Generate credentials ──────────────────────────────────────────────────
    const username = await generateUniqueUsername(input.firstName, input.lastName, db);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt_1.default.hash(tempPassword, BCRYPT_ROUNDS);
    // ── Persist ───────────────────────────────────────────────────────────────
    const user = await db.user.create({
        data: {
            companyId: creator.companyId,
            roleId: input.roleId,
            username,
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            employeeCode: input.employeeCode ?? null,
            dateOfJoining: input.dateOfJoining ?? null,
            isActive: true,
            mustChangePassword: true,
            createdById,
        },
        select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePicUrl: true,
            dateOfJoining: true,
            isActive: true,
            mustChangePassword: true,
            totpEnabled: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            role: {
                select: { id: true, roleName: true },
            },
        },
    });
    // ── Welcome email (fire-and-forget) ───────────────────────────────────────
    (0, email_service_1.sendWelcomeEmail)(input.email, input.firstName, username, tempPassword).catch((err) => console.error('[email] Welcome email failed for', input.email, ':', err));
    return user;
}
// ── Shared safe select ────────────────────────────────────────────────────────
const USER_SAFE_SELECT = {
    id: true,
    username: true,
    email: true,
    firstName: true,
    lastName: true,
    employeeCode: true,
    profilePicUrl: true,
    dateOfJoining: true,
    isActive: true,
    mustChangePassword: true,
    totpEnabled: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    role: {
        select: { id: true, roleName: true },
    },
};
// ── Get single user ───────────────────────────────────────────────────────────
async function getUser(userId, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const user = await db.user.findUnique({
        where: { id: userId },
        select: USER_SAFE_SELECT,
    });
    if (!user)
        throw new UserError('User not found', 404, 'USER_NOT_FOUND');
    return user;
}
async function updateUser(userId, input, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    // Verify target user exists
    const existing = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, employeeCode: true },
    });
    if (!existing)
        throw new UserError('User not found', 404, 'USER_NOT_FOUND');
    // ── Uniqueness checks (exclude self) ──────────────────────────────────────
    const checks = await Promise.all([
        input.email && input.email !== existing.email
            ? db.user.findUnique({ where: { email: input.email }, select: { id: true } })
            : Promise.resolve(null),
        input.employeeCode && input.employeeCode !== existing.employeeCode
            ? db.user.findUnique({ where: { employeeCode: input.employeeCode }, select: { id: true } })
            : Promise.resolve(null),
        input.roleId
            ? db.role.findUnique({ where: { id: input.roleId }, select: { id: true } })
            : Promise.resolve({ id: '' }), // dummy non-null to mean "skip"
    ]);
    if (checks[0])
        throw new UserError('Email address is already in use', 409, 'EMAIL_TAKEN');
    if (checks[1])
        throw new UserError('Employee code is already in use', 409, 'EMPLOYEE_CODE_TAKEN');
    if (input.roleId && !checks[2])
        throw new UserError('Role not found', 404, 'ROLE_NOT_FOUND');
    return db.user.update({
        where: { id: userId },
        data: {
            ...(input.firstName !== undefined && { firstName: input.firstName }),
            ...(input.lastName !== undefined && { lastName: input.lastName }),
            ...(input.email !== undefined && { email: input.email }),
            ...(input.roleId !== undefined && { roleId: input.roleId }),
            ...(input.employeeCode !== undefined && { employeeCode: input.employeeCode }),
            ...(input.dateOfJoining !== undefined && { dateOfJoining: input.dateOfJoining }),
        },
        select: USER_SAFE_SELECT,
    });
}
// ── Set user active/inactive status ──────────────────────────────────────────
async function setUserStatus(userId, isActive, schemaName, performedById, ip) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    // Prevent self-deactivation
    if (userId === performedById && !isActive) {
        throw new UserError('You cannot deactivate your own account', 400, 'SELF_DEACTIVATION');
    }
    const target = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, isActive: true },
    });
    if (!target)
        throw new UserError('User not found', 404, 'USER_NOT_FOUND');
    if (target.isActive === isActive) {
        const state = isActive ? 'already active' : 'already inactive';
        throw new UserError(`User is ${state}`, 409, 'STATUS_UNCHANGED');
    }
    const eventType = isActive ? 'user_reactivated' : 'user_deactivated';
    // Run inside a transaction: update status + revoke tokens + audit log
    await db.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { isActive },
        });
        // Revoke all active refresh tokens so existing sessions end immediately
        if (!isActive) {
            await tx.refreshToken.updateMany({
                where: { userId, isRevoked: false },
                data: { isRevoked: true },
            });
        }
        // Write audit record — only possible after the DB migration
        // db/extend_login_audit_event_types.sql has been applied.
        await tx.loginAudit.create({
            data: {
                userId,
                usernameAttempted: target.username,
                eventType,
                ipAddress: ip,
                // Repurpose userAgent to record the admin who performed the action
                userAgent: `admin:${performedById}`,
            },
        });
    });
    // Return fresh state
    return db.user.findUniqueOrThrow({
        where: { id: userId },
        select: USER_SAFE_SELECT,
    });
}
