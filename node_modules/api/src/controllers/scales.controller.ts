import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/scales.service';
import {
  CreateScaleSchema,
  UpdateScaleSchema,
  ImportScalePayloadSchema,
} from '../validation/scales.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/scales?search=&type=&status=
export async function listController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search    = typeof req.query.search === 'string' ? req.query.search.trim()    : undefined;
    const scaleType = typeof req.query.type   === 'string' ? req.query.type.trim()      : undefined;
    const status    = typeof req.query.status === 'string' ? req.query.status.trim()    : undefined;
    const data = await svc.listScales(
      req.user!.schemaName,
      search    || undefined,
      scaleType || undefined,
      status    || undefined,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/scales/export
export async function exportController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.streamScalesCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
}

// POST /api/scales/import
export async function importController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportScalePayloadSchema.parse(req.body);
    const result   = await svc.importScales(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/scales/:id
export async function getController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getScale(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/scales
export async function createController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateScaleSchema.parse(req.body);
    const data = await svc.createScale(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/scales/:id
export async function updateController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateScaleSchema.parse(req.body);
    const data = await svc.updateScale(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/scales/:id
export async function deleteController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteScale(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
