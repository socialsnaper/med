import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/cleaning-equipment.service';
import {
  CreateCleaningEquipmentSchema,
  UpdateCleaningEquipmentSchema,
  ImportPayloadSchema,
} from '../validation/cleaning-equipment.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/cleaning-equipment?search=&type=
export async function listController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const type   = typeof req.query.type   === 'string' ? req.query.type.trim()   : undefined;
    const data   = await svc.listCleaningEquipment(req.user!.schemaName, search || undefined, type || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/cleaning-equipment/export
export async function exportController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.streamCleaningEquipmentCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
}

// POST /api/cleaning-equipment/import
export async function importController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportPayloadSchema.parse(req.body);
    const result   = await svc.importCleaningEquipment(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/cleaning-equipment/:id
export async function getController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getCleaningEquipment(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/cleaning-equipment
export async function createController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateCleaningEquipmentSchema.parse(req.body);
    const data = await svc.createCleaningEquipment(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/cleaning-equipment/:id
export async function updateController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateCleaningEquipmentSchema.parse(req.body);
    const data = await svc.updateCleaningEquipment(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/cleaning-equipment/:id
export async function deleteController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteCleaningEquipment(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
