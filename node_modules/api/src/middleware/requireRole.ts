import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory: rejects with 403 if req.user.roleName is not in allowedRoles.
 * Must be used after requireAccessToken (which populates req.user).
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roleName = req.user?.roleName;
    if (!roleName || !allowedRoles.includes(roleName)) {
      res.status(403).json({
        success: false,
        error:   'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
      return;
    }
    next();
  };
}
