import type { Request, Response, NextFunction } from 'express';
import * as functionTypesService from '../services/function-types.service';
import {
  CreateFunctionTypeSchema,
  UpdateFunctionTypeSchema,
  ImportFunctionTypePayloadSchema,
} from '../validation/function-types.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/function-types/export
export async function exportFunctionTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await functionTypesService.streamFunctionTypesCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err); else res.end();
  }
}

// POST /api/function-types/import
export async function importFunctionTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportFunctionTypePayloadSchema.parse(req.body);
    const result   = await functionTypesService.importFunctionTypes(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/function-types?search=xxx
export async function listFunctionTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const data   = await functionTypesService.listFunctionTypes(req.user!.schemaName, search || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/function-types/:id
export async function getFunctionTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await functionTypesService.getFunctionType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/function-types
export async function createFunctionTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateFunctionTypeSchema.parse(req.body);
    const data = await functionTypesService.createFunctionType(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/function-types/:id
export async function updateFunctionTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateFunctionTypeSchema.parse(req.body);
    const data = await functionTypesService.updateFunctionType(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/function-types/:id
export async function deleteFunctionTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await functionTypesService.deleteFunctionType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
