import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/equipment-details.service';
import {
  CreateEquipmentDetailSchema,
  UpdateEquipmentDetailSchema,
  ImportEquipmentDetailPayloadSchema,
} from '../validation/equipment-details.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/equipment-details?search=&type=
export async function listController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const type   = typeof req.query.type   === 'string' ? req.query.type.trim()   : undefined;
    const data   = await svc.listEquipmentDetails(req.user!.schemaName, search || undefined, type || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/equipment-details/export
export async function exportController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.streamEquipmentDetailsCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
}

// POST /api/equipment-details/import
export async function importController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportEquipmentDetailPayloadSchema.parse(req.body);
    const result   = await svc.importEquipmentDetails(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/equipment-details/:id
export async function getController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getEquipmentDetail(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/equipment-details
export async function createController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateEquipmentDetailSchema.parse(req.body);
    const data = await svc.createEquipmentDetail(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/equipment-details/:id
export async function updateController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateEquipmentDetailSchema.parse(req.body);
    const data = await svc.updateEquipmentDetail(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/equipment-details/:id
export async function deleteController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteEquipmentDetail(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
