import { Router } from 'express';

import { loginRateLimit, totpRateLimit } from '../middleware/rateLimit';
import { requireAccessToken, requirePreAuthToken, requireEitherToken } from '../middleware/verifyToken';
import {
  loginController,
  verifyTotpController,
  recoverController,
  setupTotpController,
  verifyTotpSetupController,
  refreshController,
  logoutController,
  changePasswordController,
} from '../controllers/auth.controller';

export const authRouter = Router();

// ── Password auth ─────────────────────────────────────────────────────────────
authRouter.post('/login', loginRateLimit, loginController);

// ── TOTP (login flow) ─────────────────────────────────────────────────────────
authRouter.post('/2fa/verify',   totpRateLimit, requirePreAuthToken('pre_auth'), verifyTotpController);
authRouter.post('/2fa/recover',  totpRateLimit, recoverController);

// ── TOTP setup (requires active session) ─────────────────────────────────────
authRouter.get( '/2fa/setup',         requireAccessToken, setupTotpController);
authRouter.post('/2fa/setup/verify',  requireAccessToken, verifyTotpSetupController);

// ── Token management ──────────────────────────────────────────────────────────
authRouter.post('/refresh', refreshController);
authRouter.post('/logout',  requireAccessToken, logoutController);

// ── Password change (accepts both pre_auth 'password_change' and access tokens) ──
authRouter.post('/password/change', requireEitherToken, changePasswordController);
