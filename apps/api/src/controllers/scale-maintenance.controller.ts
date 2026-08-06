import type { Request, Response, NextFunction } from 'express';
import * as maintService from '../services/scale-maintenance.service';
import {
  CreateScaleMaintenanceSchema,
  StopScaleMaintenanceSchema,
  ApproveScaleMaintenanceSchema,
  RejectScaleMaintenanceSchema,
} from '../validation/scale-maintenance.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function ip(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress;
}

// GET /api/scale-maintenance/types
export async function listScaleMaintenanceTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.listScaleMaintenanceTypes(req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/scale-maintenance/scales
export async function listScalesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.listScalesForMaintenance(req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/scale-maintenance
export async function listScaleMaintenanceLogsController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const status  = typeof req.query.status  === 'string' ? req.query.status  : undefined;
    const scaleId = typeof req.query.scaleId === 'string' ? req.query.scaleId : undefined;
    const data = await maintService.listScaleMaintenanceLogs(req.user!.schemaName, {
      status,
      scaleId,
      userRole: req.user!.roleName,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/scale-maintenance/:id
export async function getScaleMaintenanceLogController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.getScaleMaintenanceLog(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/scale-maintenance
export async function createScaleMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateScaleMaintenanceSchema.parse(req.body);
    const data = await maintService.createScaleMaintenance(
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

// POST /api/scale-maintenance/:id/start
export async function startScaleMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.startScaleMaintenance(
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

// POST /api/scale-maintenance/:id/stop
export async function stopScaleMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = StopScaleMaintenanceSchema.parse(req.body);
    const data = await maintService.stopScaleMaintenance(
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

// POST /api/scale-maintenance/:id/approve
export async function approveScaleMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = ApproveScaleMaintenanceSchema.parse(req.body);
    const data = await maintService.approveScaleMaintenance(
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

// POST /api/scale-maintenance/:id/reject
export async function rejectScaleMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = RejectScaleMaintenanceSchema.parse(req.body);
    const data = await maintService.rejectScaleMaintenance(
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
