import type { Request, Response, NextFunction } from 'express';
import * as rolesService from '../services/roles.service';

// ── GET /api/roles ────────────────────────────────────────────────────────────

export async function listRolesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const roles = await rolesService.listRoles(req.user!.schemaName);
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
}
