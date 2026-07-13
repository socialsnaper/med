"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordChangeSchema = exports.TotpRecoverSchema = exports.TotpSetupVerifySchema = exports.TotpCodeSchema = exports.LoginSchema = void 0;
const zod_1 = require("zod");
// ── Request body schemas ──────────────────────────────────────────────────────
/**
 * POST /api/auth/login
 * Copilot tip: "Create a Zod schema for the login request
 * body with company_code, username, password"
 */
exports.LoginSchema = zod_1.z.object({
    company_code: zod_1.z.string().min(1).max(50).trim(),
    username: zod_1.z.string().min(1).max(100).trim(),
    password: zod_1.z.string().min(1).max(200),
});
/** POST /api/auth/2fa/verify — pre_auth_token is in the Authorization header; only code is in the body */
exports.TotpCodeSchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .length(6, 'TOTP code must be exactly 6 digits')
        .regex(/^\d{6}$/, 'TOTP code must contain only digits'),
});
/** POST /api/auth/2fa/setup/verify */
exports.TotpSetupVerifySchema = exports.TotpCodeSchema;
/** POST /api/auth/2fa/recover — pre_auth_token + backup code both in body */
exports.TotpRecoverSchema = zod_1.z.object({
    pre_auth_token: zod_1.z.string().min(1),
    backup_code: zod_1.z
        .string()
        .regex(/^[0-9a-f]{4}-[0-9a-f]{4}$/, 'Backup code must be in format xxxx-xxxx'),
});
/** POST /api/auth/password/change */
exports.PasswordChangeSchema = zod_1.z.object({
    current_password: zod_1.z.string().min(1).max(200).optional(),
    new_password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password too long')
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Must contain at least one lowercase letter')
        .regex(/\d/, 'Must contain at least one number')
        .regex(/[@$!%*?&_\-#]/, 'Must contain at least one special character (@$!%*?&_-#)'),
});
