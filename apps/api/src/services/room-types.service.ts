import { getPrismaClient } from '../../lib/prisma';
import type { CreateRoomTypeInput, UpdateRoomTypeInput } from '../validation/room-types.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class RoomTypeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ROOM_TYPE_ERROR',
  ) {
    super(message);
    this.name = 'RoomTypeError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoomTypeItem {
  id:              string;
  roomTypeId:      string;
  roomTypeName:    string;
  roomTypeDetails: string | null;
  displayOrder:    number;
  isActive:        boolean;
  createdAt:       Date;
  updatedAt:       Date;
}

// ── ID generator ───────────────────────────────────────────────────────────────

/**
 * Generates the next room_type_id in the format RT-NNN.
 * Looks at ALL existing IDs (including inactive) to avoid reuse.
 */
async function nextRoomTypeId(schemaName: string): Promise<string> {
  const db = getPrismaClient(schemaName);
  const rows = await db.roomType.findMany({
    select: { roomTypeId: true },
    orderBy: { roomTypeId: 'desc' },
  });

  let max = 0;
  for (const row of rows) {
    const match = row.roomTypeId.match(/^RT-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  return `RT-${String(max + 1).padStart(3, '0')}`;
}

// ── Queries ────────────────────────────────────────────────────────────────────

const SELECT = {
  id:              true,
  roomTypeId:      true,
  roomTypeName:    true,
  roomTypeDetails: true,
  displayOrder:    true,
  isActive:        true,
  createdAt:       true,
  updatedAt:       true,
} as const;

export async function listRoomTypes(
  schemaName: string,
  search?: string,
): Promise<RoomTypeItem[]> {
  const db = getPrismaClient(schemaName);
  return db.roomType.findMany({
    select: SELECT,
    where: search
      ? {
          OR: [
            { roomTypeId:   { contains: search, mode: 'insensitive' } },
            { roomTypeName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ displayOrder: 'asc' }, { roomTypeName: 'asc' }],
  });
}

export async function getRoomType(
  id: string,
  schemaName: string,
): Promise<RoomTypeItem> {
  const db = getPrismaClient(schemaName);
  const row = await db.roomType.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new RoomTypeError('Room type not found', 404, 'NOT_FOUND');
  return row;
}

export async function createRoomType(
  dto: CreateRoomTypeInput,
  schemaName: string,
  userId: string,
): Promise<RoomTypeItem> {
  const db = getPrismaClient(schemaName);

  // Unique name check
  const existing = await db.roomType.findFirst({
    where: { roomTypeName: { equals: dto.roomTypeName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw new RoomTypeError(
      `A room type named "${dto.roomTypeName}" already exists`,
      409,
      'DUPLICATE_NAME',
    );
  }

  const roomTypeId = await nextRoomTypeId(schemaName);

  return db.roomType.create({
    select: SELECT,
    data: {
      roomTypeId,
      roomTypeName:    dto.roomTypeName,
      roomTypeDetails: dto.roomTypeDetails ?? null,
      displayOrder:    dto.displayOrder ?? 0,
      isActive:        dto.isActive ?? true,
      createdBy:       userId,
      updatedBy:       userId,
    },
  });
}

export async function updateRoomType(
  id: string,
  dto: UpdateRoomTypeInput,
  schemaName: string,
  userId: string,
): Promise<RoomTypeItem> {
  const db = getPrismaClient(schemaName);

  const existing = await db.roomType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new RoomTypeError('Room type not found', 404, 'NOT_FOUND');

  // Unique name check (excluding self)
  if (dto.roomTypeName) {
    const clash = await db.roomType.findFirst({
      where: {
        roomTypeName: { equals: dto.roomTypeName, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) {
      throw new RoomTypeError(
        `A room type named "${dto.roomTypeName}" already exists`,
        409,
        'DUPLICATE_NAME',
      );
    }
  }

  return db.roomType.update({
    select: SELECT,
    where: { id },
    data: {
      ...(dto.roomTypeName    !== undefined && { roomTypeName:    dto.roomTypeName }),
      ...(dto.roomTypeDetails !== undefined && { roomTypeDetails: dto.roomTypeDetails }),
      ...(dto.displayOrder    !== undefined && { displayOrder:    dto.displayOrder }),
      ...(dto.isActive        !== undefined && { isActive:        dto.isActive }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });
}

export async function deleteRoomType(
  id: string,
  schemaName: string,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await db.roomType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new RoomTypeError('Room type not found', 404, 'NOT_FOUND');
  await db.roomType.delete({ where: { id } });
}
