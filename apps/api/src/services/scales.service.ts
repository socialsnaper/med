import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type { CreateScaleInput, UpdateScaleInput, ImportScaleRow } from '../validation/scales.schemas';

// ── Error ──────────────────────────────────────────────────────────────────────

export class ScaleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'SCALE_ERROR',
  ) {
    super(message);
    this.name = 'ScaleError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScaleItem {
  id:                       string;
  slid:                     number;
  scaleId:                  string;
  scaleNumber:              string;
  minRange:                 string | null;
  minRangeGrams:            number | null;
  maxRange:                 string | null;
  maxRangeGrams:            number | null;
  capacity:                 string | null;
  capacityGrams:            number | null;
  leastCount:               string | null;
  leastCountGrams:          number | null;
  lastVerifiedOn:           string | null;
  nextVerificationDue:      string | null;
  verificationIntervalDays: number;
  formVerificationNo:       string | null;
  nextCalibrationDue:       string | null;
  calibrationIntervalDays:  number;
  formCalibrationNo:        string | null;
  manufacturer:             string | null;
  modelNumber:              string | null;
  scaleType:                string | null;
  status:                   string;
  statusReason:             string | null;
  isActive:                 boolean;
  createdAt:                Date;
  updatedAt:                Date;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors:  { row: number; message: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}
function toDateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}
function dec(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ── Internal prisma row type ───────────────────────────────────────────────────

interface ScaleRow {
  id: string; slid: number; scaleId: string; scaleNumber: string;
  minRange: string | null; minRangeGrams: unknown | null;
  maxRange: string | null; maxRangeGrams: unknown | null;
  capacity: string | null; capacityGrams: unknown | null;
  leastCount: string | null; leastCountGrams: unknown | null;
  lastVerifiedOn: Date | null; nextVerificationDue: Date | null;
  verificationIntervalDays: number; formVerificationNo: string | null;
  nextCalibrationDue: Date | null; calibrationIntervalDays: number;
  formCalibrationNo: string | null; manufacturer: string | null;
  modelNumber: string | null; scaleType: string | null;
  status: string; statusReason: string | null; isActive: boolean;
  createdAt: Date; updatedAt: Date;
}

const SELECT = {
  id: true, slid: true, scaleId: true, scaleNumber: true,
  minRange: true, minRangeGrams: true, maxRange: true, maxRangeGrams: true,
  capacity: true, capacityGrams: true, leastCount: true, leastCountGrams: true,
  lastVerifiedOn: true, nextVerificationDue: true, verificationIntervalDays: true,
  formVerificationNo: true, nextCalibrationDue: true, calibrationIntervalDays: true,
  formCalibrationNo: true, manufacturer: true, modelNumber: true,
  scaleType: true, status: true, statusReason: true, isActive: true,
  createdAt: true, updatedAt: true,
} as const;

function mapRow(r: ScaleRow): ScaleItem {
  return {
    id: r.id, slid: r.slid, scaleId: r.scaleId, scaleNumber: r.scaleNumber,
    minRange: r.minRange, minRangeGrams: dec(r.minRangeGrams),
    maxRange: r.maxRange, maxRangeGrams: dec(r.maxRangeGrams),
    capacity: r.capacity, capacityGrams: dec(r.capacityGrams),
    leastCount: r.leastCount, leastCountGrams: dec(r.leastCountGrams),
    lastVerifiedOn: toDateStr(r.lastVerifiedOn),
    nextVerificationDue: toDateStr(r.nextVerificationDue),
    verificationIntervalDays: r.verificationIntervalDays,
    formVerificationNo: r.formVerificationNo,
    nextCalibrationDue: toDateStr(r.nextCalibrationDue),
    calibrationIntervalDays: r.calibrationIntervalDays,
    formCalibrationNo: r.formCalibrationNo,
    manufacturer: r.manufacturer, modelNumber: r.modelNumber,
    scaleType: r.scaleType, status: r.status, statusReason: r.statusReason,
    isActive: r.isActive, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

// ── Auto-generate scale_id ────────────────────────────────────────────────────

async function nextScaleId(schemaName: string): Promise<string> {
  const db = getPrismaClient(schemaName);
  const rows = await (db as any).scale.findMany({
    select: { scaleId: true },
    orderBy: { scaleId: 'desc' },
  });
  let max = 0;
  for (const row of rows) {
    const m = (row.scaleId as string).match(/^SC-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return `SC-${String(max + 1).padStart(3, '0')}`;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listScales(
  schemaName: string,
  search?: string,
  scaleType?: string,
  status?: string,
): Promise<ScaleItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await (db as any).scale.findMany({
    select: SELECT,
    where: {
      ...(scaleType ? { scaleType } : {}),
      ...(status    ? { status }    : {}),
      ...(search ? {
        OR: [
          { scaleId:     { contains: search, mode: 'insensitive' } },
          { scaleNumber: { contains: search, mode: 'insensitive' } },
          { manufacturer:{ contains: search, mode: 'insensitive' } },
          { modelNumber: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: [{ slid: 'asc' }],
  }) as ScaleRow[];
  return rows.map(mapRow);
}

export async function getScale(id: string, schemaName: string): Promise<ScaleItem> {
  const db = getPrismaClient(schemaName);
  const row = await (db as any).scale.findUnique({ select: SELECT, where: { id } }) as ScaleRow | null;
  if (!row) throw new ScaleError('Scale not found', 404, 'NOT_FOUND');
  return mapRow(row);
}

function buildDates(dto: Partial<CreateScaleInput>) {
  return {
    lastVerifiedOn:      dto.lastVerifiedOn      ? new Date(dto.lastVerifiedOn)      : null,
    nextVerificationDue: dto.nextVerificationDue  ? new Date(dto.nextVerificationDue) : null,
    nextCalibrationDue:  dto.nextCalibrationDue   ? new Date(dto.nextCalibrationDue)  : null,
  };
}

export async function createScale(
  dto: CreateScaleInput,
  schemaName: string,
  userId: string,
): Promise<ScaleItem> {
  const db = getPrismaClient(schemaName);
  const clash = await (db as any).scale.findFirst({
    where: { scaleNumber: { equals: dto.scaleNumber, mode: 'insensitive' } },
    select: { id: true },
  });
  if (clash) throw new ScaleError(`Scale number "${dto.scaleNumber}" already exists`, 409, 'DUPLICATE_NUMBER');

  const scaleId = await nextScaleId(schemaName);
  const row = await (db as any).scale.create({
    select: SELECT,
    data: {
      scaleId,
      scaleNumber:              dto.scaleNumber,
      minRange:                 dto.minRange                ?? null,
      minRangeGrams:            dto.minRangeGrams           ?? null,
      maxRange:                 dto.maxRange                ?? null,
      maxRangeGrams:            dto.maxRangeGrams           ?? null,
      capacity:                 dto.capacity                ?? null,
      capacityGrams:            dto.capacityGrams           ?? null,
      leastCount:               dto.leastCount              ?? null,
      leastCountGrams:          dto.leastCountGrams         ?? null,
      ...buildDates(dto),
      verificationIntervalDays: dto.verificationIntervalDays  ?? 1,
      formVerificationNo:       dto.formVerificationNo      ?? null,
      calibrationIntervalDays:  dto.calibrationIntervalDays ?? 365,
      formCalibrationNo:        dto.formCalibrationNo       ?? null,
      manufacturer:             dto.manufacturer            ?? null,
      modelNumber:              dto.modelNumber             ?? null,
      scaleType:                dto.scaleType               ?? null,
      status:                   dto.status                  ?? 'active',
      statusReason:             dto.statusReason            ?? null,
      isActive:                 dto.isActive                ?? true,
      createdBy:                userId,
      updatedBy:                userId,
    },
  }) as ScaleRow;
  return mapRow(row);
}

export async function updateScale(
  id: string,
  dto: UpdateScaleInput,
  schemaName: string,
  userId: string,
): Promise<ScaleItem> {
  const db = getPrismaClient(schemaName);
  const existing = await (db as any).scale.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ScaleError('Scale not found', 404, 'NOT_FOUND');

  if (dto.scaleNumber) {
    const clash = await (db as any).scale.findFirst({
      where: { scaleNumber: { equals: dto.scaleNumber, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new ScaleError(`Scale number "${dto.scaleNumber}" already exists`, 409, 'DUPLICATE_NUMBER');
  }

  const row = await (db as any).scale.update({
    select: SELECT,
    where: { id },
    data: {
      ...(dto.scaleNumber              !== undefined && { scaleNumber:              dto.scaleNumber }),
      ...(dto.minRange                 !== undefined && { minRange:                 dto.minRange }),
      ...(dto.minRangeGrams            !== undefined && { minRangeGrams:            dto.minRangeGrams }),
      ...(dto.maxRange                 !== undefined && { maxRange:                 dto.maxRange }),
      ...(dto.maxRangeGrams            !== undefined && { maxRangeGrams:            dto.maxRangeGrams }),
      ...(dto.capacity                 !== undefined && { capacity:                 dto.capacity }),
      ...(dto.capacityGrams            !== undefined && { capacityGrams:            dto.capacityGrams }),
      ...(dto.leastCount               !== undefined && { leastCount:               dto.leastCount }),
      ...(dto.leastCountGrams          !== undefined && { leastCountGrams:          dto.leastCountGrams }),
      ...(dto.lastVerifiedOn           !== undefined && { lastVerifiedOn:           dto.lastVerifiedOn   ? new Date(dto.lastVerifiedOn)   : null }),
      ...(dto.nextVerificationDue      !== undefined && { nextVerificationDue:      dto.nextVerificationDue ? new Date(dto.nextVerificationDue) : null }),
      ...(dto.verificationIntervalDays !== undefined && { verificationIntervalDays: dto.verificationIntervalDays }),
      ...(dto.formVerificationNo       !== undefined && { formVerificationNo:       dto.formVerificationNo }),
      ...(dto.nextCalibrationDue       !== undefined && { nextCalibrationDue:       dto.nextCalibrationDue ? new Date(dto.nextCalibrationDue) : null }),
      ...(dto.calibrationIntervalDays  !== undefined && { calibrationIntervalDays:  dto.calibrationIntervalDays }),
      ...(dto.formCalibrationNo        !== undefined && { formCalibrationNo:        dto.formCalibrationNo }),
      ...(dto.manufacturer             !== undefined && { manufacturer:             dto.manufacturer }),
      ...(dto.modelNumber              !== undefined && { modelNumber:              dto.modelNumber }),
      ...(dto.scaleType                !== undefined && { scaleType:                dto.scaleType }),
      ...(dto.status                   !== undefined && { status:                   dto.status }),
      ...(dto.statusReason             !== undefined && { statusReason:             dto.statusReason }),
      ...(dto.isActive                 !== undefined && { isActive:                 dto.isActive }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  }) as ScaleRow;
  return mapRow(row);
}

export async function deleteScale(id: string, schemaName: string): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await (db as any).scale.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ScaleError('Scale not found', 404, 'NOT_FOUND');
  await (db as any).scale.delete({ where: { id } });
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

const CSV_HEADER = csvRow([
  'scale_id', 'scale_number', 'scale_type', 'status',
  'min_range', 'max_range', 'capacity', 'least_count',
  'last_verified_on', 'next_verification_due', 'verification_interval_days', 'form_verification_no',
  'next_calibration_due', 'calibration_interval_days', 'form_calibration_no',
  'manufacturer', 'model_number', 'is_active',
]);

export async function streamScalesCsv(schemaName: string, res: Response): Promise<void> {
  const db = getPrismaClient(schemaName);
  const rows = await (db as any).scale.findMany({
    select: SELECT,
    orderBy: [{ slid: 'asc' }],
  }) as ScaleRow[];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="scales.csv"');
  res.write(CSV_HEADER + '\n');

  for (const r of rows) {
    res.write(csvRow([
      r.scaleId, r.scaleNumber, r.scaleType, r.status,
      r.minRange, r.maxRange, r.capacity, r.leastCount,
      toDateStr(r.lastVerifiedOn), toDateStr(r.nextVerificationDue),
      r.verificationIntervalDays, r.formVerificationNo,
      toDateStr(r.nextCalibrationDue), r.calibrationIntervalDays, r.formCalibrationNo,
      r.manufacturer, r.modelNumber, r.isActive,
    ]) + '\n');
  }
  res.end();
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

export async function importScales(
  rows: ImportScaleRow[],
  schemaName: string,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createScale(
        {
          scaleNumber:              row.scaleNumber,
          minRange:                 row.minRange                ?? null,
          minRangeGrams:            row.minRangeGrams           ?? null,
          maxRange:                 row.maxRange                ?? null,
          maxRangeGrams:            row.maxRangeGrams           ?? null,
          capacity:                 row.capacity                ?? null,
          capacityGrams:            row.capacityGrams           ?? null,
          leastCount:               row.leastCount              ?? null,
          leastCountGrams:          row.leastCountGrams         ?? null,
          lastVerifiedOn:           row.lastVerifiedOn          ?? null,
          nextVerificationDue:      row.nextVerificationDue     ?? null,
          verificationIntervalDays: row.verificationIntervalDays ?? 1,
          formVerificationNo:       row.formVerificationNo      ?? null,
          nextCalibrationDue:       row.nextCalibrationDue      ?? null,
          calibrationIntervalDays:  row.calibrationIntervalDays ?? 365,
          formCalibrationNo:        row.formCalibrationNo       ?? null,
          manufacturer:             row.manufacturer            ?? null,
          modelNumber:              row.modelNumber             ?? null,
          scaleType:                row.scaleType               ?? null,
        },
        schemaName,
        userId,
      );
      result.created++;
    } catch (err) {
      if (err instanceof ScaleError && err.code === 'DUPLICATE_NUMBER') {
        result.skipped++;
      } else {
        result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }

  return result;
}
