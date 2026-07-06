import { z } from 'zod';

// ── Request body schemas ──────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Copilot tip: "Create a Zod schema for the login request
 * body with company_code, username, password"
 */
export const LoginSchema = z.object({
  company_code: z.string().min(1).max(50).trim(),
  username:     z.string().min(1).max(100).trim(),
  password:     z.string().min(1).max(200),
});

/** POST /api/auth/2fa/verify — pre_auth_token is in the Authorization header; only code is in the body */
export const TotpCodeSchema = z.object({
  code: z
    .string()
    .length(6, 'TOTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must contain only digits'),
});

/** POST /api/auth/2fa/setup/verify */
export const TotpSetupVerifySchema = TotpCodeSchema;

/** POST /api/auth/2fa/recover — pre_auth_token + backup code both in body */
export const TotpRecoverSchema = z.object({
  pre_auth_token: z.string().min(1),
  backup_code: z
    .string()
    .regex(/^[0-9a-f]{4}-[0-9a-f]{4}$/, 'Backup code must be in format xxxx-xxxx'),
});

/** POST /api/auth/password/change */
export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1).max(200).optional(),
  new_password: z
    .string()
    .min(8,  'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/,         'Must contain at least one uppercase letter')
    .regex(/[a-z]/,         'Must contain at least one lowercase letter')
    .regex(/\d/,            'Must contain at least one number')
    .regex(/[@$!%*?&_\-#]/, 'Must contain at least one special character (@$!%*?&_-#)'),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type LoginInput          = z.infer<typeof LoginSchema>;
export type TotpCodeInput       = z.infer<typeof TotpCodeSchema>;
export type TotpSetupVerifyInput = z.infer<typeof TotpSetupVerifySchema>;
export type TotpRecoverInput    = z.infer<typeof TotpRecoverSchema>;
export type PasswordChangeInput = z.infer<typeof PasswordChangeSchema>;
