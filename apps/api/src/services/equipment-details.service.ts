import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateEquipmentDetailInput,
  UpdateEquipmentDetailInput,
  ImportEquipmentDetailRow,
} from '../validation/equipment-details.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class EquipmentDetailError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'EQUIPMENT_DETAIL_ERROR',
  ) {
    super(message);
    this.name = 'EquipmentDetailError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EquipmentDetailItem {
  id:                 string;
  equipmentId:        string;
  equipmentName:      string;
  serialNo:           string | null;
  supportedProcesses: string[];
  equipmentType:      string;
  manufacturer:       string | null;
  purchaseDate:       Date | null;
  commissionDate:     Date | null;
  decommissionDate:   Date | null;
  isActive:           boolean;
  createdAt:          Date;
  updatedAt:          Date;
}

// ── ID generator ───────────────────────────────────────────────────────────────

async function nextEquipmentId(schemaName: string): Promise<string> {
  const db = getPrismaClient(schemaName);
  const rows = await db.equipmentDetail.findMany({
    select: { equipmentId: true },
    orderBy: { equipmentId: 'desc' },
  });
  let max = 0;
  for (const row of rows) {
    const m = row.equipmentId.match(/^EQ-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return `EQ-${String(max + 1).padStart(3, '0')}`;
}

// ── Select projection ──────────────────────────────────────────────────────────

const SELECT = {
  id: true, equipmentId: true, equipmentName: true, serialNo: true,
  supportedProcesses: true, equipmentType: true, manufacturer: true,
  purchaseDate: true, commissionDate: true, decommissionDate: true,
  isActive: true, createdAt: true, updatedAt: true,
} as const;

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listEquipmentDetails(
  schemaName: string,
  search?: string,
  equipmentType?: string,
): Promise<EquipmentDetailItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await db.equipmentDetail.findMany({
    select: SELECT,
    where: {
      ...(equipmentType ? { equipmentType } : {}),
      ...(search
        ? {
            OR: [
              { equipmentId:   { contains: search, mode: 'insensitive' } },
              { equipmentName: { contains: search, mode: 'insensitive' } },
              { serialNo:      { contains: search, mode: 'insensitive' } },
              { manufacturer:  { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ equipmentId: 'asc' }],
  });
  return rows.map((r) => ({
    ...r,
    supportedProcesses: Array.isArray(r.supportedProcesses) ? (r.supportedProcesses as string[]) : [],
  }));
}

export async function getEquipmentDetail(
  id: string, schemaName: string,
): Promise<EquipmentDetailItem> {
  const db = getPrismaClient(schemaName);
  const row = await db.equipmentDetail.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new EquipmentDetailError('Equipment detail not found', 404, 'NOT_FOUND');
  return {
    ...row,
    supportedProcesses: Array.isArray(row.supportedProcesses) ? (row.supportedProcesses as string[]) : [],
  };
}

export async function createEquipmentDetail(
  dto: CreateEquipmentDetailInput,
  schemaName: string,
  userId: string,
): Promise<EquipmentDetailItem> {
  const db = getPrismaClient(schemaName);

  const nameclash = await db.equipmentDetail.findFirst({
    where: { equipmentName: { equals: dto.equipmentName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (nameclash) throw new EquipmentDetailError(`"${dto.equipmentName}" already exists`, 409, 'DUPLICATE_NAME');

  if (dto.serialNo) {
    const serialClash = await db.equipmentDetail.findFirst({
      where: { serialNo: { equals: dto.serialNo, mode: 'insensitive' } },
      select: { id: true },
    });
    if (serialClash) throw new EquipmentDetailError(`Serial number "${dto.serialNo}" already exists`, 409, 'DUPLICATE_SERIAL');
  }

  const equipmentId = await nextEquipmentId(schemaName);
  const row = await db.equipmentDetail.create({
    select: SELECT,
    data: {
      equipmentId,
      equipmentName:      dto.equipmentName,
      serialNo:           dto.serialNo           ?? null,
      supportedProcesses: dto.supportedProcesses ?? [],
      equipmentType:      dto.equipmentType      ?? 'fixed',
      manufacturer:       dto.manufacturer       ?? null,
      purchaseDate:       toDate(dto.purchaseDate ?? null),
      commissionDate:     toDate(dto.commissionDate ?? null),
      decommissionDate:   toDate(dto.decommissionDate ?? null),
      isActive:           dto.isActive           ?? true,
      createdBy:          userId,
      updatedBy:          userId,
    },
  });
  return {
    ...row,
    supportedProcesses: Array.isArray(row.supportedProcesses) ? (row.supportedProcesses as string[]) : [],
  };
}

export async function updateEquipmentDetail(
  id: string,
  dto: UpdateEquipmentDetailInput,
  schemaName: string,
  userId: string,
): Promise<EquipmentDetailItem> {
  const db = getPrismaClient(schemaName);
  const existing = await db.equipmentDetail.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new EquipmentDetailError('Equipment detail not found', 404, 'NOT_FOUND');

  if (dto.equipmentName) {
    const clash = await db.equipmentDetail.findFirst({
      where: { equipmentName: { equals: dto.equipmentName, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new EquipmentDetailError(`"${dto.equipmentName}" already exists`, 409, 'DUPLICATE_NAME');
  }

  if (dto.serialNo) {
    const serialClash = await db.equipmentDetail.findFirst({
      where: { serialNo: { equals: dto.serialNo, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (serialClash) throw new EquipmentDetailError(`Serial number "${dto.serialNo}" already exists`, 409, 'DUPLICATE_SERIAL');
  }

  const row = await db.equipmentDetail.update({
    select: SELECT,
    where: { id },
    data: {
      ...(dto.equipmentName      !== undefined && { equipmentName:      dto.equipmentName }),
      ...(dto.serialNo           !== undefined && { serialNo:           dto.serialNo }),
      ...(dto.supportedProcesses !== undefined && { supportedProcesses: dto.supportedProcesses }),
      ...(dto.equipmentType      !== undefined && { equipmentType:      dto.equipmentType }),
      ...(dto.manufacturer       !== undefined && { manufacturer:       dto.manufacturer }),
      ...(dto.purchaseDate       !== undefined && { purchaseDate:       toDate(dto.purchaseDate ?? null) }),
      ...(dto.commissionDate     !== undefined && { commissionDate:     toDate(dto.commissionDate ?? null) }),
      ...(dto.decommissionDate   !== undefined && { decommissionDate:   toDate(dto.decommissionDate ?? null) }),
      ...(dto.isActive           !== undefined && { isActive:           dto.isActive }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });
  return {
    ...row,
    supportedProcesses: Array.isArray(row.supportedProcesses) ? (row.supportedProcesses as string[]) : [],
  };
}

export async function deleteEquipmentDetail(id: string, schemaName: string): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await db.equipmentDetail.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new EquipmentDetailError('Equipment detail not found', 404, 'NOT_FOUND');
  await db.equipmentDetail.delete({ where: { id } });
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

const CSV_HEADER = csvRow([
  'equipment_id', 'equipment_name', 'serial_no', 'equipment_type',
  'manufacturer', 'purchase_date', 'commission_date', 'decommission_date', 'is_active',
]);

export async function streamEquipmentDetailsCsv(
  schemaName: string,
  res: Response,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  const rows = await db.equipmentDetail.findMany({
    select: SELECT,
    orderBy: [{ equipmentId: 'asc' }],
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="equipment_details.csv"');
  res.write(CSV_HEADER + '\n');

  for (const r of rows) {
    res.write(
      csvRow([
        r.equipmentId, r.equipmentName, r.serialNo,
        r.equipmentType, r.manufacturer,
        fmtDate(r.purchaseDate), fmtDate(r.commissionDate), fmtDate(r.decommissionDate),
        r.isActive,
      ]) + '\n',
    );
  }
  res.end();
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

export interface ImportResult {
  created: number;
  skipped: number;
  errors:  { row: number; message: string }[];
}

export async function importEquipmentDetails(
  rows: ImportEquipmentDetailRow[],
  schemaName: string,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createEquipmentDetail(
        {
          equipmentName:    row.equipmentName,
          serialNo:         row.serialNo,
          equipmentType:    row.equipmentType,
          manufacturer:     row.manufacturer,
          purchaseDate:     row.purchaseDate     ?? null,
          commissionDate:   row.commissionDate   ?? null,
          decommissionDate: row.decommissionDate ?? null,
        },
        schemaName,
        userId,
      );
      result.created++;
    } catch (err) {
      if (err instanceof EquipmentDetailError && err.code === 'DUPLICATE_NAME') {
        result.skipped++;
      } else {
        result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }
  return result;
}
