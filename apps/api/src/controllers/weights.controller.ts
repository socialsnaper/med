import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/weights.service';
import {
  CreateWeightSchema,
  UpdateWeightSchema,
  ImportWeightPayloadSchema,
} from '../validation/weights.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/weights?search=
export async function listController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const data   = await svc.listWeights(req.user!.schemaName, search || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/weights/export
export async function exportController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.streamWeightsCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
}

// POST /api/weights/import
export async function importController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportWeightPayloadSchema.parse(req.body);
    const result   = await svc.importWeights(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/weights/:id
export async function getController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getWeight(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/weights
export async function createController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateWeightSchema.parse(req.body);
    const data = await svc.createWeight(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/weights/:id
export async function updateController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateWeightSchema.parse(req.body);
    const data = await svc.updateWeight(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/weights/:id
export async function deleteController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteWeight(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
