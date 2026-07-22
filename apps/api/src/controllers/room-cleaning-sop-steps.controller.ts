import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/room-cleaning-sop-steps.service';
import {
  CreateRoomCleaningSopStepSchema,
  UpdateRoomCleaningSopStepSchema,
  SopImportPayloadSchema,
} from '../validation/room-cleaning-sop-steps.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/room-cleaning-sop-steps?cleaningTypeId=&status=
export async function listController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const cleaningTypeId = typeof req.query.cleaningTypeId === 'string' ? req.query.cleaningTypeId.trim() : undefined;
    const status         = typeof req.query.status         === 'string' ? req.query.status.trim()         : undefined;
    const data = await svc.listRoomCleaningSopSteps(
      req.user!.schemaName, cleaningTypeId || undefined, status || undefined,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/room-cleaning-sop-steps/export?cleaningTypeId=
export async function exportController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const cleaningTypeId = typeof req.query.cleaningTypeId === 'string' ? req.query.cleaningTypeId.trim() : undefined;
    await svc.streamRoomCleaningSopStepsCsv(req.user!.schemaName, res, cleaningTypeId || undefined);
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
}

// POST /api/room-cleaning-sop-steps/import
export async function importController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = SopImportPayloadSchema.parse(req.body);
    const result   = await svc.importRoomCleaningSopSteps(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/room-cleaning-sop-steps/:id
export async function getController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getRoomCleaningSopStep(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-cleaning-sop-steps
export async function createController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateRoomCleaningSopStepSchema.parse(req.body);
    const data = await svc.createRoomCleaningSopStep(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/room-cleaning-sop-steps/:id
export async function updateController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateRoomCleaningSopStepSchema.parse(req.body);
    const data = await svc.updateRoomCleaningSopStep(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/room-cleaning-sop-steps/:id
export async function deleteController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteRoomCleaningSopStep(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
