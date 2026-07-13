import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/process-types.service';
import {
  CreateProcessTypeSchema,
  UpdateProcessTypeSchema,
  ImportProcessTypePayloadSchema,
} from '../validation/process-types.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/process-types?search=&group=
export async function listProcessTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const group  = typeof req.query.group  === 'string' ? req.query.group.trim()  : undefined;
    const data   = await svc.listProcessTypes(req.user!.schemaName, search || undefined, group || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/process-types/groups
export async function listProcessGroupsController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.listProcessGroups(req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/process-types/export
export async function exportProcessTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.streamProcessTypesCsv(req.user!.schemaName, res);
  } catch (err) {
    if (!res.headersSent) next(err); else res.end();
  }
}

// POST /api/process-types/import
export async function importProcessTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { rows } = ImportProcessTypePayloadSchema.parse(req.body);
    const result   = await svc.importProcessTypes(rows, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/process-types/:id
export async function getProcessTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.getProcessType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/process-types
export async function createProcessTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateProcessTypeSchema.parse(req.body);
    const data = await svc.createProcessType(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/process-types/:id
export async function updateProcessTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateProcessTypeSchema.parse(req.body);
    const data = await svc.updateProcessType(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/process-types/:id
export async function deleteProcessTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.deleteProcessType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
