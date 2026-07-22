import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateRoomQacSopStepInput,
  UpdateRoomQacSopStepInput,
  QacImportRow,
} from '../validation/room-qac-sop-steps.schemas';

export class RoomQacSopStepError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ROOM_QAC_SOP_STEP_ERROR',
  ) {
    super(message);
    this.name = 'RoomQacSopStepError';
  }
}

export interface RoomQacSopStepMediaItem {
  id: string; sopStepId: string; displayOrder: number;
  fileUrl: string; fileName: string | null; fileType: string | null;
  caption: string | null; createdAt: Date;
}

export interface RoomQacSopStepItem {
  id: string; slid: number; cleaningTypeId: string;
  cleaningTypeName: string; cleaningTypeCode: string;
  stepNumber: number; procedureText: string; status: string;
  media: RoomQacSopStepMediaItem[];
  createdAt: Date; updatedAt: Date;
}

const SELECT = {
  id: true, slid: true, cleaningTypeId: true,
  stepNumber: true, procedureText: true, status: true,
  createdAt: true, updatedAt: true,
  cleaningType: { select: { cleaningTypeName: true, cleaningTypeCode: true } },
  media: {
    select: { id: true, fileUrl: true, fileName: true, fileType: true, caption: true, displayOrder: true, createdAt: true },
    orderBy: [{ displayOrder: 'asc' as const }],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): RoomQacSopStepItem {
  return {
    id: row.id, slid: row.slid, cleaningTypeId: row.cleaningTypeId,
    cleaningTypeName: row.cleaningType.cleaningTypeName,
    cleaningTypeCode: row.cleaningType.cleaningTypeCode,
    stepNumber: row.stepNumber, procedureText: row.procedureText, status: row.status,
    media: (row.media ?? []).map((m: any) => ({
      id: m.id, sopStepId: row.id, displayOrder: m.displayOrder,
      fileUrl: m.fileUrl, fileName: m.fileName ?? null, fileType: m.fileType ?? null,
      caption: m.caption ?? null, createdAt: m.createdAt,
    })),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

async function nextSlid(cleaningTypeId: string, schemaName: string): Promise<number> {
  const db  = getPrismaClient(schemaName);
  const agg = await db.roomQacSopStep.aggregate({ where: { cleaningTypeId }, _max: { slid: true } });
  return (agg._max.slid ?? 0) + 1;
}

async function renumberSlids(cleaningTypeId: string, schemaName: string): Promise<void> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomQacSopStep.findMany({ where: { cleaningTypeId }, select: { id: true }, orderBy: { stepNumber: 'asc' } });
  for (let i = 0; i < rows.length; i++) {
    await db.roomQacSopStep.update({ where: { id: rows[i].id }, data: { slid: i + 1 } });
  }
}

export async function listRoomQacSopSteps(schemaName: string, cleaningTypeId?: string, status?: string): Promise<RoomQacSopStepItem[]> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomQacSopStep.findMany({
    select: SELECT,
    where: { ...(cleaningTypeId ? { cleaningTypeId } : {}), ...(status ? { status } : {}) },
    orderBy: [{ cleaningTypeId: 'asc' }, { stepNumber: 'asc' }],
  });
  return rows.map(mapRow);
}

export async function getRoomQacSopStep(id: string, schemaName: string): Promise<RoomQacSopStepItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.roomQacSopStep.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new RoomQacSopStepError('QAC step not found', 404, 'NOT_FOUND');
  return mapRow(row);
}

export async function createRoomQacSopStep(dto: CreateRoomQacSopStepInput, schemaName: string, userId: string): Promise<RoomQacSopStepItem> {
  const db = getPrismaClient(schemaName);
  const ct = await db.roomCleaningType.findUnique({ where: { id: dto.cleaningTypeId }, select: { id: true } });
  if (!ct) throw new RoomQacSopStepError('Cleaning type not found', 404, 'CT_NOT_FOUND');
  const clash = await db.roomQacSopStep.findFirst({ where: { cleaningTypeId: dto.cleaningTypeId, stepNumber: dto.stepNumber }, select: { id: true } });
  if (clash) throw new RoomQacSopStepError(`Step number ${dto.stepNumber} already exists for this cleaning type`, 409, 'DUPLICATE_STEP');
  const slid = await nextSlid(dto.cleaningTypeId, schemaName);
  const row  = await db.roomQacSopStep.create({
    select: SELECT,
    data: { slid, cleaningTypeId: dto.cleaningTypeId, stepNumber: dto.stepNumber, procedureText: dto.procedureText, status: dto.status ?? 'approved', createdBy: userId, updatedBy: userId },
  });
  return mapRow(row);
}

export async function updateRoomQacSopStep(id: string, dto: UpdateRoomQacSopStepInput, schemaName: string, userId: string): Promise<RoomQacSopStepItem> {
  const db       = getPrismaClient(schemaName);
  const existing = await db.roomQacSopStep.findUnique({ where: { id }, select: { id: true, cleaningTypeId: true } });
  if (!existing) throw new RoomQacSopStepError('QAC step not found', 404, 'NOT_FOUND');
  if (dto.stepNumber !== undefined) {
    const clash = await db.roomQacSopStep.findFirst({ where: { cleaningTypeId: existing.cleaningTypeId, stepNumber: dto.stepNumber, NOT: { id } }, select: { id: true } });
    if (clash) throw new RoomQacSopStepError(`Step number ${dto.stepNumber} already exists for this cleaning type`, 409, 'DUPLICATE_STEP');
  }
  const row = await db.roomQacSopStep.update({
    select: SELECT, where: { id },
    data: { ...(dto.stepNumber !== undefined && { stepNumber: dto.stepNumber }), ...(dto.procedureText !== undefined && { procedureText: dto.procedureText }), ...(dto.status !== undefined && { status: dto.status }), updatedBy: userId, updatedAt: new Date() },
  });
  return mapRow(row);
}

export async function deleteRoomQacSopStep(id: string, schemaName: string): Promise<void> {
  const db       = getPrismaClient(schemaName);
  const existing = await db.roomQacSopStep.findUnique({ where: { id }, select: { id: true, cleaningTypeId: true } });
  if (!existing) throw new RoomQacSopStepError('QAC step not found', 404, 'NOT_FOUND');
  await db.roomQacSopStep.delete({ where: { id } });
  await renumberSlids(existing.cleaningTypeId, schemaName);
}

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string { return cells.map(csvCell).join(','); }
const CSV_HEADER = csvRow(['cleaning_type_code', 'step_number', 'procedure_text', 'status']);

export async function streamRoomQacSopStepsCsv(schemaName: string, res: Response, cleaningTypeId?: string): Promise<void> {
  const rows = await listRoomQacSopSteps(schemaName, cleaningTypeId);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="room_qac_sop_steps.csv"');
  res.write(CSV_HEADER + '\n');
  for (const r of rows) res.write(csvRow([r.cleaningTypeCode, r.stepNumber, r.procedureText, r.status]) + '\n');
  res.end();
}

export async function importRoomQacSopSteps(rows: QacImportRow[], schemaName: string, userId: string) {
  let created = 0, skipped = 0;
  const errors: { row: number; message: string }[] = [];
  const db = getPrismaClient(schemaName);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const ct = await db.roomCleaningType.findFirst({ where: { cleaningTypeCode: { equals: row.cleaningTypeCode, mode: 'insensitive' } }, select: { id: true } });
      if (!ct) { errors.push({ row: i + 2, message: `Cleaning type "${row.cleaningTypeCode}" not found` }); continue; }
      const clash = await db.roomQacSopStep.findFirst({ where: { cleaningTypeId: ct.id, stepNumber: row.stepNumber }, select: { id: true } });
      if (clash) { skipped++; continue; }
      await createRoomQacSopStep({ cleaningTypeId: ct.id, stepNumber: row.stepNumber, procedureText: row.procedureText, status: 'approved' }, schemaName, userId);
      created++;
    } catch (err) {
      errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return { created, skipped, errors };
}
