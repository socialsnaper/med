import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type { CreateWeightInput, UpdateWeightInput, ImportWeightRow } from '../validation/weights.schemas';

// ── Error ──────────────────────────────────────────────────────────────────────

export class WeightError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'WEIGHT_ERROR',
  ) {
    super(message);
    this.name = 'WeightError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StandardWeightItem {
  id:                      string;
  slid:                    number;
  weightSerialNo:          string;
  standardWeight:          string;
  weightValueGrams:        number;
  lastCalibratedOn:        string | null;
  nextCalibrationDue:      string | null;
  calibrationIntervalDays: number;
  toleranceLimit:          string | null;
  toleranceGrams:          number | null;
  calibrationLab:          string | null;
  certificateNumber:       string | null;
  certificateUrl:          string | null;
  material:                string | null;
  accuracyClass:           string | null;
  storageLocation:         string | null;
  isActive:                boolean;
  inactiveReason:          string | null;
  createdAt:               Date;
  updatedAt:               Date;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors:  { row: number; message: string }[];
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

// ── Date helper ────────────────────────────────────────────────────────────────

function toDateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function mapRow(r: StandardWeightRow): StandardWeightItem {
  return {
    id:                      r.id,
    slid:                    r.slid,
    weightSerialNo:          r.weightSerialNo,
    standardWeight:          r.standardWeight,
    weightValueGrams:        Number(r.weightValueGrams),
    lastCalibratedOn:        toDateStr(r.lastCalibratedOn),
    nextCalibrationDue:      toDateStr(r.nextCalibrationDue),
    calibrationIntervalDays: r.calibrationIntervalDays,
    toleranceLimit:          r.toleranceLimit ?? null,
    toleranceGrams:          r.toleranceGrams !== null && r.toleranceGrams !== undefined
      ? Number(r.toleranceGrams) : null,
    calibrationLab:          r.calibrationLab ?? null,
    certificateNumber:       r.certificateNumber ?? null,
    certificateUrl:          r.certificateUrl ?? null,
    material:                r.material ?? null,
    accuracyClass:           r.accuracyClass ?? null,
    storageLocation:         r.storageLocation ?? null,
    isActive:                r.isActive,
    inactiveReason:          r.inactiveReason ?? null,
    createdAt:               r.createdAt,
    updatedAt:               r.updatedAt,
  };
}

// ── Internal type matching Prisma model ───────────────────────────────────────

interface StandardWeightRow {
  id:                      string;
  slid:                    number;
  weightSerialNo:          string;
  standardWeight:          string;
  weightValueGrams:        unknown;
  lastCalibratedOn:        Date | null;
  nextCalibrationDue:      Date | null;
  calibrationIntervalDays: number;
  toleranceLimit:          string | null;
  toleranceGrams:          unknown | null;
  calibrationLab:          string | null;
  certificateNumber:       string | null;
  certificateUrl:          string | null;
  material:                string | null;
  accuracyClass:           string | null;
  storageLocation:         string | null;
  isActive:                boolean;
  inactiveReason:          string | null;
  createdAt:               Date;
  updatedAt:               Date;
}

const SELECT = {
  id: true, slid: true, weightSerialNo: true, standardWeight: true,
  weightValueGrams: true, lastCalibratedOn: true, nextCalibrationDue: true,
  calibrationIntervalDays: true, toleranceLimit: true, toleranceGrams: true,
  calibrationLab: true, certificateNumber: true, certificateUrl: true,
  material: true, accuracyClass: true, storageLocation: true,
  isActive: true, inactiveReason: true, createdAt: true, updatedAt: true,
} as const;

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listWeights(
  schemaName: string,
  search?: string,
): Promise<StandardWeightItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await (db as any).standardWeight.findMany({
    select: SELECT,
    where: search ? {
      OR: [
        { weightSerialNo: { contains: search, mode: 'insensitive' } },
        { standardWeight: { contains: search, mode: 'insensitive' } },
        { material:       { contains: search, mode: 'insensitive' } },
        { storageLocation:{ contains: search, mode: 'insensitive' } },
      ],
    } : {},
    orderBy: [{ slid: 'asc' }],
  }) as StandardWeightRow[];
  return rows.map(mapRow);
}

export async function getWeight(
  id: string, schemaName: string,
): Promise<StandardWeightItem> {
  const db = getPrismaClient(schemaName);
  const row = await (db as any).standardWeight.findUnique({
    select: SELECT, where: { id },
  }) as StandardWeightRow | null;
  if (!row) throw new WeightError('Standard weight not found', 404, 'NOT_FOUND');
  return mapRow(row);
}

export async function createWeight(
  dto: CreateWeightInput,
  schemaName: string,
  userId: string,
): Promise<StandardWeightItem> {
  const db = getPrismaClient(schemaName);
  const clash = await (db as any).standardWeight.findFirst({
    where: { weightSerialNo: { equals: dto.weightSerialNo, mode: 'insensitive' } },
    select: { id: true },
  });
  if (clash) throw new WeightError(`Serial number "${dto.weightSerialNo}" already exists`, 409, 'DUPLICATE_SERIAL');

  const row = await (db as any).standardWeight.create({
    select: SELECT,
    data: {
      weightSerialNo:          dto.weightSerialNo,
      standardWeight:          dto.standardWeight,
      weightValueGrams:        dto.weightValueGrams,
      lastCalibratedOn:        dto.lastCalibratedOn   ? new Date(dto.lastCalibratedOn)  : null,
      nextCalibrationDue:      dto.nextCalibrationDue ? new Date(dto.nextCalibrationDue) : null,
      calibrationIntervalDays: dto.calibrationIntervalDays ?? 365,
      toleranceLimit:          dto.toleranceLimit      ?? null,
      toleranceGrams:          dto.toleranceGrams      ?? null,
      calibrationLab:          dto.calibrationLab      ?? null,
      certificateNumber:       dto.certificateNumber   ?? null,
      certificateUrl:          dto.certificateUrl      ?? null,
      material:                dto.material            ?? null,
      accuracyClass:           dto.accuracyClass       ?? null,
      storageLocation:         dto.storageLocation     ?? null,
      isActive:                dto.isActive            ?? true,
      inactiveReason:          dto.inactiveReason      ?? null,
      createdBy:               userId,
      updatedBy:               userId,
    },
  }) as StandardWeightRow;
  return mapRow(row);
}

export async function updateWeight(
  id: string,
  dto: UpdateWeightInput,
  schemaName: string,
  userId: string,
): Promise<StandardWeightItem> {
  const db = getPrismaClient(schemaName);
  const existing = await (db as any).standardWeight.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new WeightError('Standard weight not found', 404, 'NOT_FOUND');

  if (dto.weightSerialNo) {
    const clash = await (db as any).standardWeight.findFirst({
      where: { weightSerialNo: { equals: dto.weightSerialNo, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new WeightError(`Serial number "${dto.weightSerialNo}" already exists`, 409, 'DUPLICATE_SERIAL');
  }

  const row = await (db as any).standardWeight.update({
    select: SELECT,
    where: { id },
    data: {
      ...(dto.weightSerialNo          !== undefined && { weightSerialNo:          dto.weightSerialNo }),
      ...(dto.standardWeight          !== undefined && { standardWeight:          dto.standardWeight }),
      ...(dto.weightValueGrams        !== undefined && { weightValueGrams:        dto.weightValueGrams }),
      ...(dto.lastCalibratedOn        !== undefined && { lastCalibratedOn:        dto.lastCalibratedOn   ? new Date(dto.lastCalibratedOn)  : null }),
      ...(dto.nextCalibrationDue      !== undefined && { nextCalibrationDue:      dto.nextCalibrationDue ? new Date(dto.nextCalibrationDue) : null }),
      ...(dto.calibrationIntervalDays !== undefined && { calibrationIntervalDays: dto.calibrationIntervalDays }),
      ...(dto.toleranceLimit          !== undefined && { toleranceLimit:          dto.toleranceLimit }),
      ...(dto.toleranceGrams          !== undefined && { toleranceGrams:          dto.toleranceGrams }),
      ...(dto.calibrationLab          !== undefined && { calibrationLab:          dto.calibrationLab }),
      ...(dto.certificateNumber       !== undefined && { certificateNumber:       dto.certificateNumber }),
      ...(dto.certificateUrl          !== undefined && { certificateUrl:          dto.certificateUrl }),
      ...(dto.material                !== undefined && { material:                dto.material }),
      ...(dto.accuracyClass           !== undefined && { accuracyClass:           dto.accuracyClass }),
      ...(dto.storageLocation         !== undefined && { storageLocation:         dto.storageLocation }),
      ...(dto.isActive                !== undefined && { isActive:                dto.isActive }),
      ...(dto.inactiveReason          !== undefined && { inactiveReason:          dto.inactiveReason }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  }) as StandardWeightRow;
  return mapRow(row);
}

export async function deleteWeight(id: string, schemaName: string): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await (db as any).standardWeight.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new WeightError('Standard weight not found', 404, 'NOT_FOUND');
  await (db as any).standardWeight.delete({ where: { id } });
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

const CSV_HEADER = csvRow([
  'slid', 'weight_serial_no', 'standard_weight', 'weight_value_grams',
  'last_calibrated_on', 'next_calibration_due', 'calibration_interval_days',
  'tolerance_limit', 'tolerance_grams', 'material', 'accuracy_class',
  'storage_location', 'calibration_lab', 'certificate_number', 'is_active',
]);

export async function streamWeightsCsv(
  schemaName: string,
  res: Response,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  const rows = await (db as any).standardWeight.findMany({
    select: SELECT,
    orderBy: [{ slid: 'asc' }],
  }) as StandardWeightRow[];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="standard_weights.csv"');
  res.write(CSV_HEADER + '\n');

  for (const r of rows) {
    res.write(
      csvRow([
        r.slid, r.weightSerialNo, r.standardWeight, Number(r.weightValueGrams),
        toDateStr(r.lastCalibratedOn), toDateStr(r.nextCalibrationDue),
        r.calibrationIntervalDays, r.toleranceLimit,
        r.toleranceGrams !== null ? Number(r.toleranceGrams) : null,
        r.material, r.accuracyClass, r.storageLocation,
        r.calibrationLab, r.certificateNumber, r.isActive,
      ]) + '\n',
    );
  }
  res.end();
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

export async function importWeights(
  rows: ImportWeightRow[],
  schemaName: string,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createWeight(
        {
          weightSerialNo:          row.weightSerialNo,
          standardWeight:          row.standardWeight,
          weightValueGrams:        row.weightValueGrams,
          lastCalibratedOn:        row.lastCalibratedOn        ?? null,
          nextCalibrationDue:      row.nextCalibrationDue      ?? null,
          calibrationIntervalDays: row.calibrationIntervalDays ?? 365,
          toleranceLimit:          row.toleranceLimit          ?? null,
          material:                row.material                ?? null,
          accuracyClass:           row.accuracyClass           ?? null,
          storageLocation:         row.storageLocation         ?? null,
          calibrationLab:          row.calibrationLab          ?? null,
          certificateNumber:       row.certificateNumber       ?? null,
        },
        schemaName,
        userId,
      );
      result.created++;
    } catch (err) {
      if (err instanceof WeightError && err.code === 'DUPLICATE_SERIAL') {
        result.skipped++;
      } else {
        result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }

  return result;
}
