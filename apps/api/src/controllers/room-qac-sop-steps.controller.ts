import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/room-qac-sop-steps.service';
import { CreateRoomQacSopStepSchema, UpdateRoomQacSopStepSchema, QacImportPayloadSchema } from '../validation/room-qac-sop-steps.schemas';

function param(req: Request, name: string): string { const v = req.params[name]; return Array.isArray(v) ? v[0] : v; }

export async function listController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cleaningTypeId = typeof req.query.cleaningTypeId === 'string' ? req.query.cleaningTypeId.trim() : undefined;
    const status         = typeof req.query.status         === 'string' ? req.query.status.trim()         : undefined;
    res.json({ success: true, data: await svc.listRoomQacSopSteps(req.user!.schemaName, cleaningTypeId || undefined, status || undefined) });
  } catch (err) { next(err); }
}

export async function exportController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cleaningTypeId = typeof req.query.cleaningTypeId === 'string' ? req.query.cleaningTypeId.trim() : undefined;
    await svc.streamRoomQacSopStepsCsv(req.user!.schemaName, res, cleaningTypeId || undefined);
  } catch (err) { if (!res.headersSent) next(err); else res.end(); }
}

export async function importController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = QacImportPayloadSchema.parse(req.body);
    res.json({ success: true, data: await svc.importRoomQacSopSteps(rows, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function getController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await svc.getRoomQacSopStep(param(req, 'id'), req.user!.schemaName) }); } catch (err) { next(err); }
}

export async function createController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = CreateRoomQacSopStepSchema.parse(req.body);
    res.status(201).json({ success: true, data: await svc.createRoomQacSopStep(dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function updateController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = UpdateRoomQacSopStepSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateRoomQacSopStep(param(req, 'id'), dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function deleteController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await svc.deleteRoomQacSopStep(param(req, 'id'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); }
}
