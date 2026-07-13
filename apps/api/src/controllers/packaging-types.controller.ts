import type { Request, Response, NextFunction } from 'express';
import * as packagingTypesService from '../services/packaging-types.service';
import {
  CreatePackagingTypeSchema,
  UpdatePackagingTypeSchema,
  ImportPackagingTypePayloadSchema,
} from '../validation/packaging-types.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/packaging-types/export
export async function exportPackagingTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await packagingTypesService.streamPackagingTypesCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err); else res.end();
  }
}

// POST /api/packaging-types/import
export async function importPackagingTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportPackagingTypePayloadSchema.parse(req.body);
    const result   = await packagingTypesService.importPackagingTypes(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/packaging-types?search=xxx&category=xxx
export async function listPackagingTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search   = typeof req.query.search   === 'string' ? req.query.search.trim()   : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
    const data = await packagingTypesService.listPackagingTypes(req.user!.schemaName, search || undefined, category || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/packaging-types/:id
export async function getPackagingTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await packagingTypesService.getPackagingType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/packaging-types
export async function createPackagingTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreatePackagingTypeSchema.parse(req.body);
    const data = await packagingTypesService.createPackagingType(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/packaging-types/:id
export async function updatePackagingTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdatePackagingTypeSchema.parse(req.body);
    const data = await packagingTypesService.updatePackagingType(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/packaging-types/:id
export async function deletePackagingTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await packagingTypesService.deletePackagingType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
