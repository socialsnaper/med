import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateRoomCleaningSopStepInput,
  UpdateRoomCleaningSopStepInput,
  SopImportRow,
} from '../validation/room-cleaning-sop-steps.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class RoomCleaningSopStepError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ROOM_CLEANING_SOP_STEP_ERROR',
  ) {
    super(message);
    this.name = 'RoomCleaningSopStepError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoomCleaningSopStepItem {
  id:                        string;
  slid:                      number;
  cleaningTypeId:            string;
  cleaningTypeName:          string;
  cleaningTypeCode:          string;
  stepNumber:                number;
  timeAllottedDisplay:       string | null;
  cleaningMethod:            string;
  equipmentCleaningSequence: string;
  procedureText:             string;
  chemicalUsed:              string | null;
  status:                    string;
  createdAt:                 Date;
  updatedAt:                 Date;
}

// ── Select projection ──────────────────────────────────────────────────────────

const SELECT = {
  id: true, slid: true, cleaningTypeId: true,
  stepNumber: true, timeAllottedDisplay: true,
  cleaningMethod: true, equipmentCleaningSequence: true,
  procedureText: true, chemicalUsed: true, status: true,
  createdAt: true, updatedAt: true,
  cleaningType: { select: { cleaningTypeName: true, cleaningTypeCode: true } },
} as const;

// ── Map from DB row ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): RoomCleaningSopStepItem {
  return {
    id:                        row.id,
    slid:                      row.slid,
    cleaningTypeId:            row.cleaningTypeId,
    cleaningTypeName:          row.cleaningType.cleaningTypeName,
    cleaningTypeCode:          row.cleaningType.cleaningTypeCode,
    stepNumber:                row.stepNumber,
    timeAllottedDisplay:       row.timeAllottedDisplay,
    cleaningMethod:            row.cleaningMethod,
    equipmentCleaningSequence: row.equipmentCleaningSequence,
    procedureText:             row.procedureText,
    chemicalUsed:              row.chemicalUsed,
    status:                    row.status,
    createdAt:                 row.createdAt,
    updatedAt:                 row.updatedAt,
  };
}

// ── Slid generator ─────────────────────────────────────────────────────────────

async function nextSlid(cleaningTypeId: string, schemaName: string): Promise<number> {
  const db  = getPrismaClient(schemaName);
  const agg = await db.roomCleaningSopStep.aggregate({
    where: { cleaningTypeId },
    _max:  { slid: true },
  });
  return (agg._max.slid ?? 0) + 1;
}

// ── Renumber slids after delete ────────────────────────────────────────────────

async function renumberSlids(cleaningTypeId: string, schemaName: string): Promise<void> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomCleaningSopStep.findMany({
    where:   { cleaningTypeId },
    select:  { id: true },
    orderBy: { stepNumber: 'asc' },
  });
  for (let i = 0; i < rows.length; i++) {
    await db.roomCleaningSopStep.update({
      where: { id: rows[i].id },
      data:  { slid: i + 1 },
    });
  }
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listRoomCleaningSopSteps(
  schemaName: string,
  cleaningTypeId?: string,
  status?: string,
): Promise<RoomCleaningSopStepItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await db.roomCleaningSopStep.findMany({
    select: SELECT,
    where: {
      ...(cleaningTypeId ? { cleaningTypeId } : {}),
      ...(status         ? { status }         : {}),
    },
    orderBy: [{ cleaningTypeId: 'asc' }, { stepNumber: 'asc' }],
  });
  return rows.map(mapRow);
}

export async function getRoomCleaningSopStep(
  id: string, schemaName: string,
): Promise<RoomCleaningSopStepItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.roomCleaningSopStep.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new RoomCleaningSopStepError('SOP step not found', 404, 'NOT_FOUND');
  return mapRow(row);
}

export async function createRoomCleaningSopStep(
  dto: CreateRoomCleaningSopStepInput,
  schemaName: string,
  userId: string,
): Promise<RoomCleaningSopStepItem> {
  const db = getPrismaClient(schemaName);

  // Validate cleaning type exists
  const ct = await db.roomCleaningType.findUnique({
    where: { id: dto.cleaningTypeId }, select: { id: true },
  });
  if (!ct) throw new RoomCleaningSopStepError('Cleaning type not found', 404, 'CT_NOT_FOUND');

  // Check for duplicate step_number
  const clash = await db.roomCleaningSopStep.findFirst({
    where: { cleaningTypeId: dto.cleaningTypeId, stepNumber: dto.stepNumber },
    select: { id: true },
  });
  if (clash) throw new RoomCleaningSopStepError(
    `Step number ${dto.stepNumber} already exists for this cleaning type`,
    409,
    'DUPLICATE_STEP',
  );

  const slid = await nextSlid(dto.cleaningTypeId, schemaName);

  const row = await db.roomCleaningSopStep.create({
    select: SELECT,
    data: {
      slid,
      cleaningTypeId:            dto.cleaningTypeId,
      stepNumber:                dto.stepNumber,
      timeAllottedDisplay:       dto.timeAllottedDisplay       ?? null,
      cleaningMethod:            dto.cleaningMethod,
      equipmentCleaningSequence: dto.equipmentCleaningSequence ?? 'NA',
      procedureText:             dto.procedureText,
      chemicalUsed:              dto.chemicalUsed              ?? null,
      status:                    dto.status                    ?? 'approved',
      createdBy:                 userId,
      updatedBy:                 userId,
    },
  });
  return mapRow(row);
}

export async function updateRoomCleaningSopStep(
  id: string,
  dto: UpdateRoomCleaningSopStepInput,
  schemaName: string,
  userId: string,
): Promise<RoomCleaningSopStepItem> {
  const db       = getPrismaClient(schemaName);
  const existing = await db.roomCleaningSopStep.findUnique({
    where: { id }, select: { id: true, cleaningTypeId: true },
  });
  if (!existing) throw new RoomCleaningSopStepError('SOP step not found', 404, 'NOT_FOUND');

  // Check duplicate step number if changing
  if (dto.stepNumber !== undefined) {
    const clash = await db.roomCleaningSopStep.findFirst({
      where: {
        cleaningTypeId: existing.cleaningTypeId,
        stepNumber:     dto.stepNumber,
        NOT:            { id },
      },
      select: { id: true },
    });
    if (clash) throw new RoomCleaningSopStepError(
      `Step number ${dto.stepNumber} already exists for this cleaning type`,
      409,
      'DUPLICATE_STEP',
    );
  }

  const row = await db.roomCleaningSopStep.update({
    select: SELECT,
    where:  { id },
    data: {
      ...(dto.stepNumber                !== undefined && { stepNumber:                dto.stepNumber }),
      ...(dto.timeAllottedDisplay       !== undefined && { timeAllottedDisplay:       dto.timeAllottedDisplay }),
      ...(dto.cleaningMethod            !== undefined && { cleaningMethod:            dto.cleaningMethod }),
      ...(dto.equipmentCleaningSequence !== undefined && { equipmentCleaningSequence: dto.equipmentCleaningSequence }),
      ...(dto.procedureText             !== undefined && { procedureText:             dto.procedureText }),
      ...(dto.chemicalUsed              !== undefined && { chemicalUsed:              dto.chemicalUsed }),
      ...(dto.status                    !== undefined && { status:                    dto.status }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });
  return mapRow(row);
}

export async function deleteRoomCleaningSopStep(id: string, schemaName: string): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await db.roomCleaningSopStep.findUnique({
    where: { id }, select: { id: true, cleaningTypeId: true },
  });
  if (!existing) throw new RoomCleaningSopStepError('SOP step not found', 404, 'NOT_FOUND');
  await db.roomCleaningSopStep.delete({ where: { id } });
  // Renumber remaining slids for this cleaning type
  await renumberSlids(existing.cleaningTypeId, schemaName);
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

const CSV_HEADER = csvRow([
  'cleaning_type_code', 'step_number', 'time_allotted',
  'cleaning_method', 'equipment_cleaning_sequence',
  'procedure_text', 'chemical_used', 'status',
]);

export async function streamRoomCleaningSopStepsCsv(
  schemaName: string,
  res: Response,
  cleaningTypeId?: string,
): Promise<void> {
  const rows = await listRoomCleaningSopSteps(schemaName, cleaningTypeId);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="room_cleaning_sop_steps.csv"');
  res.write(CSV_HEADER + '\n');
  for (const r of rows) {
    res.write(csvRow([
      r.cleaningTypeCode, r.stepNumber, r.timeAllottedDisplay,
      r.cleaningMethod, r.equipmentCleaningSequence,
      r.procedureText, r.chemicalUsed, r.status,
    ]) + '\n');
  }
  res.end();
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

export async function importRoomCleaningSopSteps(
  rows: SopImportRow[],
  schemaName: string,
  userId: string,
): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> {
  let created = 0, skipped = 0;
  const errors: { row: number; message: string }[] = [];
  const db = getPrismaClient(schemaName);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const ct = await db.roomCleaningType.findFirst({
        where: { cleaningTypeCode: { equals: row.cleaningTypeCode, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!ct) {
        errors.push({ row: i + 2, message: `Cleaning type "${row.cleaningTypeCode}" not found` });
        continue;
      }

      const clash = await db.roomCleaningSopStep.findFirst({
        where: { cleaningTypeId: ct.id, stepNumber: row.stepNumber },
        select: { id: true },
      });
      if (clash) { skipped++; continue; }

      await createRoomCleaningSopStep(
        {
          cleaningTypeId:            ct.id,
          stepNumber:                row.stepNumber,
          timeAllottedDisplay:       row.timeAllottedDisplay,
          cleaningMethod:            row.cleaningMethod,
          equipmentCleaningSequence: row.equipmentCleaningSequence,
          procedureText:             row.procedureText,
          chemicalUsed:              row.chemicalUsed,
          status:                    'approved',
        },
        schemaName,
        userId,
      );
      created++;
    } catch (err) {
      errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return { created, skipped, errors };
}
