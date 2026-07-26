import type { Request, Response, NextFunction } from 'express';
import * as roomsService from '../services/rooms.service';
import { CreateRoomSchema, UpdateRoomSchema } from '../validation/rooms.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/rooms
export async function listRoomsController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const search     = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const activeOnly = req.query.active !== 'false';
    const data = await roomsService.listRooms(req.user!.schemaName, search || undefined, activeOnly);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/rooms/:id
export async function getRoomController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await roomsService.getRoom(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/rooms
export async function createRoomController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = CreateRoomSchema.parse(req.body);
    const data = await roomsService.createRoom(dto, req.user!.schemaName, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// PATCH /api/rooms/:id
export async function updateRoomController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = UpdateRoomSchema.parse(req.body);
    const data = await roomsService.updateRoom(param(req, 'id'), dto, req.user!.schemaName, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/rooms/:id
export async function deleteRoomController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await roomsService.deleteRoom(param(req, 'id'), req.user!.schemaName);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
