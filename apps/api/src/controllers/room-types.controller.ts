import type { Request, Response, NextFunction } from 'express';
import * as roomTypesService from '../services/room-types.service';
import { CreateRoomTypeSchema, UpdateRoomTypeSchema } from '../validation/room-types.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/room-types?search=xxx
export async function listRoomTypesController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const data = await roomTypesService.listRoomTypes(req.user!.schemaName, search || undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/room-types/:id
export async function getRoomTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await roomTypesService.getRoomType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-types
export async function createRoomTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateRoomTypeSchema.parse(req.body);
    const data = await roomTypesService.createRoomType(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/room-types/:id
export async function updateRoomTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateRoomTypeSchema.parse(req.body);
    const data = await roomTypesService.updateRoomType(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/room-types/:id
export async function deleteRoomTypeController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await roomTypesService.deleteRoomType(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
