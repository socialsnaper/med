import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { AccessTokenPayload, PreAuthTokenPayload, AuthenticatedUser } from '../types/auth';
import { getPrismaClient } from '../../lib/prisma';

// ── Augment Express Request with custom properties ────────────────────────────
// Declared inline here so it is guaranteed to be picked up by ts-node when
// this file is compiled, regardless of d.ts file ordering issues.
declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by requireAccessToken middleware */
    user?: AuthenticatedUser;
    /** Populated by requirePreAuthToken / requireEitherToken middleware */
    preAuth?: PreAuthTokenPayload;
  }
}

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required');
  return s;
}

// ── Access token ──────────────────────────────────────────────────────────────

/**
 * Middleware: verifies an access token from `Authorization: Bearer <token>`.
 * Rejects pre-auth tokens (they have a `stage` field).
 * Checks that the user is still active in the DB (catches mid-session deactivation).
 * Attaches decoded payload to `req.user`.
 */
export const requireAccessToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Access token required' });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), getJwtSecret()) as AccessTokenPayload;

    if ('stage' in payload) {
      res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Access token required, not a pre-auth token' });
      return;
    }

    // Check that the user account is still active in the tenant DB.
    // This catches deactivation that happened after the token was issued.
    const db = getPrismaClient(payload.sid);
    const dbUser = await db.user.findUnique({
      where:  { id: payload.sub },
      select: { isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      res.status(401).json({
        success: false,
        error:   'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact your administrator.',
      });
      return;
    }

    req.user = {
      id:          payload.sub,
      schemaName:  payload.sid,
      roleId:      payload.role,
      roleName:    payload.roleName,
      permissions: payload.perms,
    };
    next();
  } catch (err) {
    // Avoid leaking DB errors — treat any unexpected error as invalid token
    if ((err as NodeJS.ErrnoException)?.name?.startsWith('JsonWebToken')) {
      res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired access token' });
    } else {
      res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired access token' });
    }
  }
};

// ── Pre-auth token ────────────────────────────────────────────────────────────

/**
 * Middleware factory: verifies a pre-auth token and optionally checks `stage`.
 * Attaches decoded payload to `req.preAuth`.
 *
 * @param stage  If provided, requests with a different stage are rejected.
 */
export const requirePreAuthToken =
  (stage?: 'pre_auth' | 'password_change') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Pre-auth token required' });
      return;
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), getJwtSecret()) as PreAuthTokenPayload;

      if (!payload.stage) {
        res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Pre-auth token required' });
        return;
      }

      if (stage && payload.stage !== stage) {
        res.status(401).json({
          success: false,
          error:   'INVALID_TOKEN_STAGE',
          message: `Expected token stage '${stage}', received '${payload.stage}'`,
        });
        return;
      }

      req.preAuth = payload;
      next();
    } catch {
      res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired pre-auth token' });
    }
  };

// ── Either token (password change supports both) ──────────────────────────────

/**
 * Middleware: accepts either an access token or a `password_change` pre-auth token.
 * Populates `req.user` or `req.preAuth` accordingly.
 * Use on POST /api/auth/password/change.
 */
export const requireEitherToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'MISSING_TOKEN', message: 'Authentication required' });
    return;
  }

  try {
    const raw     = authHeader.slice(7);
    const payload = jwt.verify(raw, getJwtSecret()) as AccessTokenPayload | PreAuthTokenPayload;

    if ('stage' in payload && payload.stage === 'password_change') {
      req.preAuth = payload as PreAuthTokenPayload;
    } else if ('role' in payload && !('stage' in payload)) {
      const p = payload as AccessTokenPayload;
      req.user = { id: p.sub, schemaName: p.sid, roleId: p.role, roleName: p.roleName, permissions: p.perms };
    } else {
      res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Valid access or password-change token required' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired token' });
  }
};
