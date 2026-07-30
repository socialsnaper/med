import type { Request, Response, NextFunction } from 'express';
import * as maintService from '../services/room-maintenance.service';
import {
  CreateMaintenanceSchema,
  StopMaintenanceSchema,
  ApproveMaintenanceSchema,
  RejectMaintenanceSchema,
} from '../validation/room-maintenance.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function ip(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress;
}

// GET /api/room-maintenance/types
export async function listMaintenanceTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.listMaintenanceTypes(req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/room-maintenance
export async function listMaintenanceLogsController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : undefined;
    const data   = await maintService.listMaintenanceLogs(req.user!.schemaName, {
      status,
      roomId,
      userRole: req.user!.roleName,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/room-maintenance/:id
export async function getMaintenanceLogController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.getMaintenanceLog(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-maintenance
export async function createMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateMaintenanceSchema.parse(req.body);
    const data = await maintService.createMaintenance(
      dto,
      req.user!.schemaName,
      req.user!.id,
      req.user!.roleName,
      (req.user as any).username ?? req.user!.id,
      ip(req),
    );
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-maintenance/:id/start
export async function startMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.startMaintenance(
      param(req, 'id'),
      req.user!.schemaName,
      req.user!.id,
      req.user!.roleName,
      (req.user as any).username ?? req.user!.id,
      ip(req),
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-maintenance/:id/stop
export async function stopMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = StopMaintenanceSchema.parse(req.body);
    const data = await maintService.stopMaintenance(
      param(req, 'id'),
      dto,
      req.user!.schemaName,
      req.user!.id,
      req.user!.roleName,
      (req.user as any).username ?? req.user!.id,
      ip(req),
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-maintenance/:id/approve
export async function approveMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = ApproveMaintenanceSchema.parse(req.body);
    const data = await maintService.approveMaintenance(
      param(req, 'id'),
      dto,
      req.user!.schemaName,
      req.user!.id,
      req.user!.roleName,
      (req.user as any).username ?? req.user!.id,
      ip(req),
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-maintenance/:id/reject
export async function rejectMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = RejectMaintenanceSchema.parse(req.body);
    const data = await maintService.rejectMaintenance(
      param(req, 'id'),
      dto,
      req.user!.schemaName,
      req.user!.id,
      req.user!.roleName,
      (req.user as any).username ?? req.user!.id,
      ip(req),
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
