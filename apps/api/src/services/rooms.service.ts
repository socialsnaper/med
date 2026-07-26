import { getPrismaClient } from '../../lib/prisma';
import type { CreateRoomInput, UpdateRoomInput } from '../validation/rooms.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class RoomError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ROOM_ERROR',
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoomItem {
  id:                     string;
  roomId:                 string;
  roomName:               string;
  roomTypeId:             string | null;
  roomTypeName:           string | null;
  floor:                  string | null;
  building:               string | null;
  roomDetails:            string | null;
  status:                 string;
  statusReason:           string | null;
  currentMaintenanceLogId: string | null;
  isActive:               boolean;
  createdAt:              Date;
  updatedAt:              Date;
}

// ── ID generator ───────────────────────────────────────────────────────────────

async function nextRoomId(schemaName: string): Promise<string> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.room.findMany({ select: { roomId: true } });
  let max = 0;
  for (const row of rows) {
    const m = row.roomId.match(/^RM-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return `RM-${String(max + 1).padStart(3, '0')}`;
}

// ── Select projection ──────────────────────────────────────────────────────────

const SELECT = {
  id: true, roomId: true, roomName: true, roomTypeId: true,
  floor: true, building: true, roomDetails: true,
  status: true, statusReason: true, currentMaintenanceLogId: true,
  isActive: true, createdAt: true, updatedAt: true,
  roomType: { select: { roomTypeName: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoom(row: any): RoomItem {
  return {
    id:                      row.id,
    roomId:                  row.roomId,
    roomName:                row.roomName,
    roomTypeId:              row.roomTypeId,
    roomTypeName:            row.roomType?.roomTypeName ?? null,
    floor:                   row.floor,
    building:                row.building,
    roomDetails:             row.roomDetails,
    status:                  row.status,
    statusReason:            row.statusReason,
    currentMaintenanceLogId: row.currentMaintenanceLogId,
    isActive:                row.isActive,
    createdAt:               row.createdAt,
    updatedAt:               row.updatedAt,
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listRooms(
  schemaName: string,
  search?: string,
  activeOnly = true,
): Promise<RoomItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await db.room.findMany({
    select: SELECT,
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(search ? {
        OR: [
          { roomId:   { contains: search, mode: 'insensitive' } },
          { roomName: { contains: search, mode: 'insensitive' } },
          { floor:    { contains: search, mode: 'insensitive' } },
          { building: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: [{ roomId: 'asc' }],
  });
  return rows.map(mapRoom);
}

export async function getRoom(id: string, schemaName: string): Promise<RoomItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.room.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new RoomError('Room not found', 404, 'NOT_FOUND');
  return mapRoom(row);
}

export async function createRoom(
  dto:        CreateRoomInput,
  schemaName: string,
  userId:     string,
): Promise<RoomItem> {
  const db = getPrismaClient(schemaName);

  const existing = await db.room.findFirst({
    where: { roomName: { equals: dto.roomName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw new RoomError(`A room named "${dto.roomName}" already exists`, 409, 'DUPLICATE_NAME');

  const roomId = await nextRoomId(schemaName);

  const created = await db.room.create({
    select: SELECT,
    data: {
      roomId,
      roomName:    dto.roomName,
      roomTypeId:  dto.roomTypeId ?? null,
      floor:       dto.floor       ?? null,
      building:    dto.building    ?? null,
      roomDetails: dto.roomDetails ?? null,
      isActive:    dto.isActive    ?? true,
      createdBy:   userId,
      updatedBy:   userId,
    },
  });
  return mapRoom(created);
}

export async function updateRoom(
  id:         string,
  dto:        UpdateRoomInput,
  schemaName: string,
  userId:     string,
): Promise<RoomItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.room.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new RoomError('Room not found', 404, 'NOT_FOUND');

  if (dto.roomName) {
    const dup = await db.room.findFirst({
      where: { roomName: { equals: dto.roomName, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (dup) throw new RoomError(`A room named "${dto.roomName}" already exists`, 409, 'DUPLICATE_NAME');
  }

  const updated = await db.room.update({
    select: SELECT,
    where: { id },
    data: {
      ...(dto.roomName    !== undefined && { roomName:    dto.roomName }),
      ...(dto.roomTypeId  !== undefined && { roomTypeId:  dto.roomTypeId }),
      ...(dto.floor       !== undefined && { floor:       dto.floor }),
      ...(dto.building    !== undefined && { building:    dto.building }),
      ...(dto.roomDetails !== undefined && { roomDetails: dto.roomDetails }),
      ...(dto.isActive    !== undefined && { isActive:    dto.isActive }),
      updatedBy: userId,
    },
  });
  return mapRoom(updated);
}

export async function deleteRoom(id: string, schemaName: string): Promise<void> {
  const db  = getPrismaClient(schemaName);
  const row = await db.room.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!row) throw new RoomError('Room not found', 404, 'NOT_FOUND');
  if (row.status !== 'active') {
    throw new RoomError('Cannot delete a room that is not in active status', 409, 'ROOM_NOT_ACTIVE');
  }
  // Soft delete
  await db.room.update({ where: { id }, data: { isActive: false } });
}
