import type { Request, Response, NextFunction } from 'express';
import * as maintService from '../services/equipment-maintenance.service';
import {
  CreateEquipmentMaintenanceSchema,
  StopEquipmentMaintenanceSchema,
  ApproveEquipmentMaintenanceSchema,
  RejectEquipmentMaintenanceSchema,
} from '../validation/equipment-maintenance.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function ip(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress;
}

// GET /api/equipment-maintenance/types
export async function listEquipmentMaintenanceTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.listEquipmentMaintenanceTypes(req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/equipment-maintenance/equipment
export async function listEquipmentController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.listEquipment(req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/equipment-maintenance
export async function listEquipmentMaintenanceLogsController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const status      = typeof req.query.status      === 'string' ? req.query.status      : undefined;
    const equipmentId = typeof req.query.equipmentId === 'string' ? req.query.equipmentId : undefined;
    const data = await maintService.listEquipmentMaintenanceLogs(req.user!.schemaName, {
      status,
      equipmentId,
      userRole: req.user!.roleName,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/equipment-maintenance/:id
export async function getEquipmentMaintenanceLogController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.getEquipmentMaintenanceLog(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/equipment-maintenance
export async function createEquipmentMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateEquipmentMaintenanceSchema.parse(req.body);
    const data = await maintService.createEquipmentMaintenance(
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

// POST /api/equipment-maintenance/:id/start
export async function startEquipmentMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await maintService.startEquipmentMaintenance(
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

// POST /api/equipment-maintenance/:id/stop
export async function stopEquipmentMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = StopEquipmentMaintenanceSchema.parse(req.body);
    const data = await maintService.stopEquipmentMaintenance(
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

// POST /api/equipment-maintenance/:id/approve
export async function approveEquipmentMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = ApproveEquipmentMaintenanceSchema.parse(req.body);
    const data = await maintService.approveEquipmentMaintenance(
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

// POST /api/equipment-maintenance/:id/reject
export async function rejectEquipmentMaintenanceController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = RejectEquipmentMaintenanceSchema.parse(req.body);
    const data = await maintService.rejectEquipmentMaintenance(
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
