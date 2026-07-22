import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/room-inspection2-sop-steps.service';
import { CreateRoomInspection2SopStepSchema, UpdateRoomInspection2SopStepSchema, Insp2ImportPayloadSchema } from '../validation/room-inspection2-sop-steps.schemas';

function param(req: Request, name: string): string { const v = req.params[name]; return Array.isArray(v) ? v[0] : v; }

export async function listController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cleaningTypeId = typeof req.query.cleaningTypeId === 'string' ? req.query.cleaningTypeId.trim() : undefined;
    const status         = typeof req.query.status         === 'string' ? req.query.status.trim()         : undefined;
    res.json({ success: true, data: await svc.listRoomInspection2SopSteps(req.user!.schemaName, cleaningTypeId || undefined, status || undefined) });
  } catch (err) { next(err); }
}

export async function exportController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cleaningTypeId = typeof req.query.cleaningTypeId === 'string' ? req.query.cleaningTypeId.trim() : undefined;
    await svc.streamRoomInspection2SopStepsCsv(req.user!.schemaName, res, cleaningTypeId || undefined);
  } catch (err) { if (!res.headersSent) next(err); else res.end(); }
}

export async function importController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = Insp2ImportPayloadSchema.parse(req.body);
    res.json({ success: true, data: await svc.importRoomInspection2SopSteps(rows, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function getController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await svc.getRoomInspection2SopStep(param(req, 'id'), req.user!.schemaName) }); } catch (err) { next(err); }
}

export async function createController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto  = CreateRoomInspection2SopStepSchema.parse(req.body);
    res.status(201).json({ success: true, data: await svc.createRoomInspection2SopStep(dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function updateController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto  = UpdateRoomInspection2SopStepSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateRoomInspection2SopStep(param(req, 'id'), dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function deleteController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await svc.deleteRoomInspection2SopStep(param(req, 'id'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); }
}
