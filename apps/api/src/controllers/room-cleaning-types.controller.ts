import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/room-cleaning-types.service';
import {
  CreateRoomCleaningTypeSchema,
  UpdateRoomCleaningTypeSchema,
  ImportPayloadSchema,
} from '../validation/room-cleaning-types.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/room-cleaning-types?search=
export async function listController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const data   = await svc.listRoomCleaningTypes(req.user!.schemaName, search || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/room-cleaning-types/export
export async function exportController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.streamRoomCleaningTypesCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
}

// POST /api/room-cleaning-types/import
export async function importController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportPayloadSchema.parse(req.body);
    const result   = await svc.importRoomCleaningTypes(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/room-cleaning-types/:id
export async function getController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getRoomCleaningType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-cleaning-types
export async function createController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateRoomCleaningTypeSchema.parse(req.body);
    const data = await svc.createRoomCleaningType(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/room-cleaning-types/:id
export async function updateController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateRoomCleaningTypeSchema.parse(req.body);
    const data = await svc.updateRoomCleaningType(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/room-cleaning-types/:id
export async function deleteController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteRoomCleaningType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
