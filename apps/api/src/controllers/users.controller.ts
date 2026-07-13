import type { Request, Response, NextFunction } from 'express';
import * as usersService from '../services/users.service';
import {
  CreateUserSchema,
  UpdateUserSchema,
  SetUserStatusSchema,
} from '../validation/users.schemas';

function getClientIp(req: Request): string {
  return ((req.ip ?? req.socket?.remoteAddress) || 'unknown').replace(/^::ffff:/, '');
}

/** Express 5 types req.params values as `string | string[]`; extract a single string. */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ── GET /api/users ────────────────────────────────────────────────────────────

export async function listUsersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const users = await usersService.listUsers(req.user!.schemaName);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/users ───────────────────────────────────────────────────────────

export async function createUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateUserSchema.parse(req.body);
    const user = await usersService.createUser(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/users/export ─────────────────────────────────────────────────────

export async function exportUsersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await usersService.streamUsersCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      console.error('[exportUsersController] Error after headers sent:', err);
      res.end();
    }
  }
}

// ── GET /api/users/:id ────────────────────────────────────────────────────────

export async function getUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await usersService.getUser(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────

export async function updateUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateUserSchema.parse(req.body);
    const user = await usersService.updateUser(param(req, 'id'), dto, req.user!.schemaName);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/users/:id/status ───────────────────────────────────────────────

export async function setUserStatusController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { is_active } = SetUserStatusSchema.parse(req.body);
    const user = await usersService.setUserStatus(
      param(req, 'id'),
      is_active,
      req.user!.schemaName,
      req.user!.id,
      getClientIp(req),
    );
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}
