import type { Request, Response, NextFunction, CookieOptions } from 'express';

import * as authService from '../services/auth.service';
import {
  LoginSchema,
  TotpCodeSchema,
  TotpSetupVerifySchema,
  TotpRecoverSchema,
  PasswordChangeSchema,
} from '../validation/auth.schemas';

// ── Cookie helpers ────────────────────────────────────────────────────────────

const REFRESH_COOKIE: CookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000,
  path:     '/',
};

const ACCESS_COOKIE: CookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   15 * 60 * 1000, // 15 minutes — matches JWT TTL
  path:     '/',
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, REFRESH_COOKIE);
}

function setAccessCookie(res: Response, token: string): void {
  res.cookie('access_token', token, ACCESS_COOKIE);
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('refresh_token', { ...REFRESH_COOKIE, maxAge: 0 });
  res.clearCookie('access_token',  { ...ACCESS_COOKIE,  maxAge: 0 });
}

function getClientIp(req: Request): string {
  return ((req.ip ?? req.socket?.remoteAddress) || 'unknown').replace(/^::ffff:/, '');
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto    = LoginSchema.parse(req.body);
    const ip     = getClientIp(req);
    const ua     = String(req.headers['user-agent'] ?? '');
    const result = await authService.login(dto, ip, ua);

    if (result.refresh_token) setRefreshCookie(res, result.refresh_token);
    if (result.access_token)  setAccessCookie(res, result.access_token);

    res.json({
      success: true,
      data: {
        pre_auth_token:           result.pre_auth_token,
        access_token:             result.access_token,
        user:                     result.user,
        requires_totp:            result.requires_totp,
        requires_password_change: result.requires_password_change,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────

export async function verifyTotpController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = TotpCodeSchema.parse(req.body);
    const ip       = getClientIp(req);
    const ua       = String(req.headers['user-agent'] ?? '');

    const result = await authService.verifyTotp(req.preAuth!, code, ip, ua);

    setRefreshCookie(res, result.refresh_token);
    setAccessCookie(res, result.access_token);
    res.json({ success: true, data: { access_token: result.access_token, user: result.user } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/2fa/recover ────────────────────────────────────────────────

export async function recoverController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto    = TotpRecoverSchema.parse(req.body);
    const ip     = getClientIp(req);
    const ua     = String(req.headers['user-agent'] ?? '');
    const result = await authService.recoverWithBackupCode(dto.pre_auth_token, dto.backup_code, ip, ua);

    setRefreshCookie(res, result.refresh_token);
    setAccessCookie(res, result.access_token);
    res.json({ success: true, data: { access_token: result.access_token, user: result.user } });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/2fa/setup ───────────────────────────────────────────────────

export async function setupTotpController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.setupTotp(req.user!.id, req.user!.schemaName);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/2fa/setup/verify ──────────────────────────────────────────

export async function verifyTotpSetupController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = TotpSetupVerifySchema.parse(req.body);
    const result   = await authService.verifyTotpSetup(req.user!.id, req.user!.schemaName, code);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

export async function refreshController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token
      ?? (req.body as Record<string, string>)?.refresh_token;

    if (!refreshToken) {
      res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Refresh token required' });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);
    setRefreshCookie(res, result.refresh_token);
    setAccessCookie(res, result.access_token);
    res.json({ success: true, data: { access_token: result.access_token } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

export async function logoutController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token
      ?? (req.body as Record<string, string>)?.refresh_token;

    if (refreshToken && req.user) {
      await authService.logout(refreshToken, req.user.id, req.user.schemaName);
    }

    clearAuthCookies(res);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/password/change ────────────────────────────────────────────

export async function changePasswordController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { new_password, current_password } = PasswordChangeSchema.parse(req.body);

    let userId: string;
    let schemaName: string;
    let isForced: boolean;

    if (req.preAuth) {
      userId     = req.preAuth.sub;
      schemaName = req.preAuth.sid;
      isForced   = true;
    } else if (req.user) {
      userId     = req.user.id;
      schemaName = req.user.schemaName;
      isForced   = false;
    } else {
      res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Authentication required' });
      return;
    }

    // Voluntary change requires the current password
    if (!isForced && !current_password) {
      res.status(400).json({
        success: false,
        error:   'VALIDATION_ERROR',
        message: 'current_password is required when changing password voluntarily',
      });
      return;
    }

    const ip     = getClientIp(req);
    const ua     = String(req.headers['user-agent'] ?? '');
    const result = await authService.changePassword(userId, schemaName, new_password, isForced ? undefined : current_password, ip, ua);

    if (result.refresh_token) setRefreshCookie(res, result.refresh_token);

    res.json({
      success: true,
      data: {
        pre_auth_token: result.pre_auth_token,
        access_token:   result.access_token,
        user:           result.user,
        requires_totp:  result.requires_totp,
        message:        'Password changed successfully',
      },
    });
  } catch (err) {
    next(err);
  }
}
