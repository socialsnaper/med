import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateRoomCleaningTypeInput,
  UpdateRoomCleaningTypeInput,
  RoomCleaningTypeImportRow,
} from '../validation/room-cleaning-types.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class RoomCleaningTypeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ROOM_CLEANING_TYPE_ERROR',
  ) {
    super(message);
    this.name = 'RoomCleaningTypeError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoomCleaningTypeItem {
  id:                  string;
  cleaningTypeCode:    string;
  cleaningTypeName:    string;
  cleaningTypeDetails: string | null;
  defaultMethod:       string | null;
  displayOrder:        number;
  isActive:            boolean;
  createdAt:           Date;
  updatedAt:           Date;
}

// ── Code generator ─────────────────────────────────────────────────────────────

async function nextCleaningTypeCode(schemaName: string): Promise<string> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomCleaningType.findMany({
    select:  { cleaningTypeCode: true },
    orderBy: { cleaningTypeCode: 'desc' },
  });
  let max = 0;
  for (const row of rows) {
    const m = row.cleaningTypeCode.match(/^RCT-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return `RCT-${String(max + 1).padStart(3, '0')}`;
}

// ── Select projection ──────────────────────────────────────────────────────────

const SELECT = {
  id: true, cleaningTypeCode: true, cleaningTypeName: true,
  cleaningTypeDetails: true, defaultMethod: true,
  displayOrder: true, isActive: true, createdAt: true, updatedAt: true,
} as const;

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listRoomCleaningTypes(
  schemaName: string,
  search?: string,
): Promise<RoomCleaningTypeItem[]> {
  const db = getPrismaClient(schemaName);
  return db.roomCleaningType.findMany({
    select: SELECT,
    where: search
      ? {
          OR: [
            { cleaningTypeCode: { contains: search, mode: 'insensitive' } },
            { cleaningTypeName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ displayOrder: 'asc' }, { cleaningTypeName: 'asc' }],
  });
}

export async function getRoomCleaningType(
  id: string, schemaName: string,
): Promise<RoomCleaningTypeItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.roomCleaningType.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new RoomCleaningTypeError('Room cleaning type not found', 404, 'NOT_FOUND');
  return row;
}

export async function createRoomCleaningType(
  dto: CreateRoomCleaningTypeInput,
  schemaName: string,
  userId: string,
): Promise<RoomCleaningTypeItem> {
  const db = getPrismaClient(schemaName);
  const clash = await db.roomCleaningType.findFirst({
    where: { cleaningTypeName: { equals: dto.cleaningTypeName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (clash) throw new RoomCleaningTypeError(`"${dto.cleaningTypeName}" already exists`, 409, 'DUPLICATE_NAME');

  const cleaningTypeCode = await nextCleaningTypeCode(schemaName);
  return db.roomCleaningType.create({
    select: SELECT,
    data: {
      cleaningTypeCode,
      cleaningTypeName:    dto.cleaningTypeName,
      cleaningTypeDetails: dto.cleaningTypeDetails ?? null,
      defaultMethod:       dto.defaultMethod       ?? null,
      displayOrder:        dto.displayOrder         ?? 0,
      isActive:            dto.isActive             ?? true,
      createdBy:           userId,
      updatedBy:           userId,
    },
  });
}

export async function updateRoomCleaningType(
  id: string,
  dto: UpdateRoomCleaningTypeInput,
  schemaName: string,
  userId: string,
): Promise<RoomCleaningTypeItem> {
  const db = getPrismaClient(schemaName);
  const existing = await db.roomCleaningType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new RoomCleaningTypeError('Room cleaning type not found', 404, 'NOT_FOUND');

  if (dto.cleaningTypeName) {
    const clash = await db.roomCleaningType.findFirst({
      where: { cleaningTypeName: { equals: dto.cleaningTypeName, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new RoomCleaningTypeError(`"${dto.cleaningTypeName}" already exists`, 409, 'DUPLICATE_NAME');
  }

  return db.roomCleaningType.update({
    select: SELECT,
    where: { id },
    data: {
      ...(dto.cleaningTypeName    !== undefined && { cleaningTypeName:    dto.cleaningTypeName }),
      ...(dto.cleaningTypeDetails !== undefined && { cleaningTypeDetails: dto.cleaningTypeDetails }),
      ...(dto.defaultMethod       !== undefined && { defaultMethod:       dto.defaultMethod }),
      ...(dto.displayOrder        !== undefined && { displayOrder:        dto.displayOrder }),
      ...(dto.isActive            !== undefined && { isActive:            dto.isActive }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });
}

export async function deleteRoomCleaningType(id: string, schemaName: string): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await db.roomCleaningType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new RoomCleaningTypeError('Room cleaning type not found', 404, 'NOT_FOUND');

  // Check if any SOP steps reference this cleaning type
  const inUse = await db.roomCleaningSopStep.findFirst({
    where: { cleaningTypeId: id },
    select: { id: true },
  });
  if (inUse) throw new RoomCleaningTypeError(
    'Cannot delete — SOP steps are linked to this cleaning type',
    409,
    'IN_USE',
  );

  await db.roomCleaningType.delete({ where: { id } });
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

const CSV_HEADER = csvRow([
  'cleaning_type_code', 'cleaning_type_name', 'cleaning_type_details',
  'default_method', 'display_order', 'is_active',
]);

export async function streamRoomCleaningTypesCsv(
  schemaName: string,
  res: Response,
): Promise<void> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomCleaningType.findMany({
    select:  SELECT,
    orderBy: [{ displayOrder: 'asc' }, { cleaningTypeName: 'asc' }],
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="room_cleaning_types.csv"');
  res.write(CSV_HEADER + '\n');
  for (const r of rows) {
    res.write(csvRow([
      r.cleaningTypeCode, r.cleaningTypeName, r.cleaningTypeDetails,
      r.defaultMethod, r.displayOrder, r.isActive,
    ]) + '\n');
  }
  res.end();
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

export async function importRoomCleaningTypes(
  rows: RoomCleaningTypeImportRow[],
  schemaName: string,
  userId: string,
): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> {
  let created = 0, skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const clash = await getPrismaClient(schemaName).roomCleaningType.findFirst({
        where: { cleaningTypeName: { equals: row.cleaningTypeName, mode: 'insensitive' } },
        select: { id: true },
      });
      if (clash) { skipped++; continue; }
      await createRoomCleaningType(row, schemaName, userId);
      created++;
    } catch (err) {
      errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return { created, skipped, errors };
}
