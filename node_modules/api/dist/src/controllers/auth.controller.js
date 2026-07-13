"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginController = loginController;
exports.verifyTotpController = verifyTotpController;
exports.recoverController = recoverController;
exports.setupTotpController = setupTotpController;
exports.verifyTotpSetupController = verifyTotpSetupController;
exports.refreshController = refreshController;
exports.logoutController = logoutController;
exports.changePasswordController = changePasswordController;
const authService = __importStar(require("../services/auth.service"));
const auth_schemas_1 = require("../validation/auth.schemas");
// ── Cookie helpers ────────────────────────────────────────────────────────────
const REFRESH_COOKIE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};
const ACCESS_COOKIE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes — matches JWT TTL
    path: '/',
};
function setRefreshCookie(res, token) {
    res.cookie('refresh_token', token, REFRESH_COOKIE);
}
function setAccessCookie(res, token) {
    res.cookie('access_token', token, ACCESS_COOKIE);
}
function clearAuthCookies(res) {
    res.clearCookie('refresh_token', { ...REFRESH_COOKIE, maxAge: 0 });
    res.clearCookie('access_token', { ...ACCESS_COOKIE, maxAge: 0 });
}
function getClientIp(req) {
    return ((req.ip ?? req.socket?.remoteAddress) || 'unknown').replace(/^::ffff:/, '');
}
// ── POST /api/auth/login ──────────────────────────────────────────────────────
async function loginController(req, res, next) {
    try {
        const dto = auth_schemas_1.LoginSchema.parse(req.body);
        const ip = getClientIp(req);
        const ua = String(req.headers['user-agent'] ?? '');
        const result = await authService.login(dto, ip, ua);
        if (result.refresh_token)
            setRefreshCookie(res, result.refresh_token);
        if (result.access_token)
            setAccessCookie(res, result.access_token);
        res.json({
            success: true,
            data: {
                pre_auth_token: result.pre_auth_token,
                access_token: result.access_token,
                user: result.user,
                requires_totp: result.requires_totp,
                requires_password_change: result.requires_password_change,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────
async function verifyTotpController(req, res, next) {
    try {
        const { code } = auth_schemas_1.TotpCodeSchema.parse(req.body);
        const ip = getClientIp(req);
        const ua = String(req.headers['user-agent'] ?? '');
        const result = await authService.verifyTotp(req.preAuth, code, ip, ua);
        setRefreshCookie(res, result.refresh_token);
        setAccessCookie(res, result.access_token);
        res.json({ success: true, data: { access_token: result.access_token, user: result.user } });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/auth/2fa/recover ────────────────────────────────────────────────
async function recoverController(req, res, next) {
    try {
        const dto = auth_schemas_1.TotpRecoverSchema.parse(req.body);
        const ip = getClientIp(req);
        const ua = String(req.headers['user-agent'] ?? '');
        const result = await authService.recoverWithBackupCode(dto.pre_auth_token, dto.backup_code, ip, ua);
        setRefreshCookie(res, result.refresh_token);
        setAccessCookie(res, result.access_token);
        res.json({ success: true, data: { access_token: result.access_token, user: result.user } });
    }
    catch (err) {
        next(err);
    }
}
// ── GET /api/auth/2fa/setup ───────────────────────────────────────────────────
async function setupTotpController(req, res, next) {
    try {
        const result = await authService.setupTotp(req.user.id, req.user.schemaName);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/auth/2fa/setup/verify ──────────────────────────────────────────
async function verifyTotpSetupController(req, res, next) {
    try {
        const { code } = auth_schemas_1.TotpSetupVerifySchema.parse(req.body);
        const result = await authService.verifyTotpSetup(req.user.id, req.user.schemaName, code);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/auth/refresh ────────────────────────────────────────────────────
async function refreshController(req, res, next) {
    try {
        const refreshToken = req.cookies?.refresh_token
            ?? req.body?.refresh_token;
        if (!refreshToken) {
            res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Refresh token required' });
            return;
        }
        const result = await authService.refreshAccessToken(refreshToken);
        setRefreshCookie(res, result.refresh_token);
        setAccessCookie(res, result.access_token);
        res.json({ success: true, data: { access_token: result.access_token } });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/auth/logout ─────────────────────────────────────────────────────
async function logoutController(req, res, next) {
    try {
        const refreshToken = req.cookies?.refresh_token
            ?? req.body?.refresh_token;
        if (refreshToken && req.user) {
            await authService.logout(refreshToken, req.user.id, req.user.schemaName);
        }
        clearAuthCookies(res);
        res.json({ success: true, data: { message: 'Logged out successfully' } });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/auth/password/change ────────────────────────────────────────────
async function changePasswordController(req, res, next) {
    try {
        const { new_password, current_password } = auth_schemas_1.PasswordChangeSchema.parse(req.body);
        let userId;
        let schemaName;
        let isForced;
        if (req.preAuth) {
            userId = req.preAuth.sub;
            schemaName = req.preAuth.sid;
            isForced = true;
        }
        else if (req.user) {
            userId = req.user.id;
            schemaName = req.user.schemaName;
            isForced = false;
        }
        else {
            res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Authentication required' });
            return;
        }
        // Voluntary change requires the current password
        if (!isForced && !current_password) {
            res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'current_password is required when changing password voluntarily',
            });
            return;
        }
        const ip = getClientIp(req);
        const ua = String(req.headers['user-agent'] ?? '');
        const result = await authService.changePassword(userId, schemaName, new_password, isForced ? undefined : current_password, ip, ua);
        if (result.refresh_token)
            setRefreshCookie(res, result.refresh_token);
        res.json({
            success: true,
            data: {
                pre_auth_token: result.pre_auth_token,
                access_token: result.access_token,
                user: result.user,
                requires_totp: result.requires_totp,
                message: 'Password changed successfully',
            },
        });
    }
    catch (err) {
        next(err);
    }
}
