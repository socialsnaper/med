"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const rateLimit_1 = require("../middleware/rateLimit");
const verifyToken_1 = require("../middleware/verifyToken");
const auth_controller_1 = require("../controllers/auth.controller");
exports.authRouter = (0, express_1.Router)();
// ── Password auth ─────────────────────────────────────────────────────────────
exports.authRouter.post('/login', rateLimit_1.loginRateLimit, auth_controller_1.loginController);
// ── TOTP (login flow) ─────────────────────────────────────────────────────────
exports.authRouter.post('/2fa/verify', rateLimit_1.totpRateLimit, (0, verifyToken_1.requirePreAuthToken)('pre_auth'), auth_controller_1.verifyTotpController);
exports.authRouter.post('/2fa/recover', rateLimit_1.totpRateLimit, auth_controller_1.recoverController);
// ── TOTP setup (requires active session) ─────────────────────────────────────
exports.authRouter.get('/2fa/setup', verifyToken_1.requireAccessToken, auth_controller_1.setupTotpController);
exports.authRouter.post('/2fa/setup/verify', verifyToken_1.requireAccessToken, auth_controller_1.verifyTotpSetupController);
// ── Token management ──────────────────────────────────────────────────────────
exports.authRouter.post('/refresh', auth_controller_1.refreshController);
exports.authRouter.post('/logout', verifyToken_1.requireAccessToken, auth_controller_1.logoutController);
// ── Password change (accepts both pre_auth 'password_change' and access tokens) ──
exports.authRouter.post('/password/change', verifyToken_1.requireEitherToken, auth_controller_1.changePasswordController);
