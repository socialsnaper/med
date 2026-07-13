import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateFunctionTypeInput,
  UpdateFunctionTypeInput,
  ImportFunctionTypeRow,
} from '../validation/function-types.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class FunctionTypeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'FUNCTION_TYPE_ERROR',
  ) {
    super(message);
    this.name = 'FunctionTypeError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FunctionTypeItem {
  id:                    string;
  functionTypeId:        string;
  functionTypeName:      string;
  functionTypeDetails:   string | null;
  canSignOff:            boolean;
  canOperateBatch:       boolean;
  canPerformCleaning:    boolean;
  canPerformMaintenance: boolean;
  displayOrder:          number;
  isActive:              boolean;
  createdAt:             Date;
  updatedAt:             Date;
}

// ── ID generator ───────────────────────────────────────────────────────────────

async function nextFunctionTypeId(schemaName: string): Promise<string> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.functionType.findMany({
    select:  { functionTypeId: true },
    orderBy: { functionTypeId: 'desc' },
  });

  let max = 0;
  for (const row of rows) {
    const match = row.functionTypeId.match(/^FT-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `FT-${String(max + 1).padStart(3, '0')}`;
}

// ── Select shape ───────────────────────────────────────────────────────────────

const SELECT = {
  id:                    true,
  functionTypeId:        true,
  functionTypeName:      true,
  functionTypeDetails:   true,
  canSignOff:            true,
  canOperateBatch:       true,
  canPerformCleaning:    true,
  canPerformMaintenance: true,
  displayOrder:          true,
  isActive:              true,
  createdAt:             true,
  updatedAt:             true,
} as const;

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listFunctionTypes(
  schemaName: string,
  search?: string,
): Promise<FunctionTypeItem[]> {
  const db = getPrismaClient(schemaName);
  return db.functionType.findMany({
    select:  SELECT,
    where: search
      ? {
          OR: [
            { functionTypeId:   { contains: search, mode: 'insensitive' } },
            { functionTypeName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ displayOrder: 'asc' }, { functionTypeName: 'asc' }],
  });
}

export async function getFunctionType(
  id: string,
  schemaName: string,
): Promise<FunctionTypeItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.functionType.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new FunctionTypeError('Function type not found', 404, 'NOT_FOUND');
  return row;
}

export async function createFunctionType(
  dto: CreateFunctionTypeInput,
  schemaName: string,
  userId: string,
): Promise<FunctionTypeItem> {
  const db = getPrismaClient(schemaName);

  const existing = await db.functionType.findFirst({
    where:  { functionTypeName: { equals: dto.functionTypeName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw new FunctionTypeError(
      `A function type named "${dto.functionTypeName}" already exists`,
      409,
      'DUPLICATE_NAME',
    );
  }

  const functionTypeId = await nextFunctionTypeId(schemaName);

  return db.functionType.create({
    select: SELECT,
    data: {
      functionTypeId,
      functionTypeName:      dto.functionTypeName,
      functionTypeDetails:   dto.functionTypeDetails   ?? null,
      canSignOff:            dto.canSignOff            ?? false,
      canOperateBatch:       dto.canOperateBatch       ?? false,
      canPerformCleaning:    dto.canPerformCleaning    ?? false,
      canPerformMaintenance: dto.canPerformMaintenance ?? false,
      displayOrder:          dto.displayOrder          ?? 0,
      isActive:              dto.isActive              ?? true,
      createdBy:             userId,
      updatedBy:             userId,
    },
  });
}

export async function updateFunctionType(
  id: string,
  dto: UpdateFunctionTypeInput,
  schemaName: string,
  userId: string,
): Promise<FunctionTypeItem> {
  const db = getPrismaClient(schemaName);

  const existing = await db.functionType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new FunctionTypeError('Function type not found', 404, 'NOT_FOUND');

  if (dto.functionTypeName) {
    const clash = await db.functionType.findFirst({
      where: {
        functionTypeName: { equals: dto.functionTypeName, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) {
      throw new FunctionTypeError(
        `A function type named "${dto.functionTypeName}" already exists`,
        409,
        'DUPLICATE_NAME',
      );
    }
  }

  return db.functionType.update({
    select: SELECT,
    where:  { id },
    data: {
      ...(dto.functionTypeName      !== undefined && { functionTypeName:      dto.functionTypeName }),
      ...(dto.functionTypeDetails   !== undefined && { functionTypeDetails:   dto.functionTypeDetails }),
      ...(dto.canSignOff            !== undefined && { canSignOff:            dto.canSignOff }),
      ...(dto.canOperateBatch       !== undefined && { canOperateBatch:       dto.canOperateBatch }),
      ...(dto.canPerformCleaning    !== undefined && { canPerformCleaning:    dto.canPerformCleaning }),
      ...(dto.canPerformMaintenance !== undefined && { canPerformMaintenance: dto.canPerformMaintenance }),
      ...(dto.displayOrder          !== undefined && { displayOrder:          dto.displayOrder }),
      ...(dto.isActive              !== undefined && { isActive:              dto.isActive }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });
}

export async function deleteFunctionType(
  id: string,
  schemaName: string,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await db.functionType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new FunctionTypeError('Function type not found', 404, 'NOT_FOUND');
  await db.functionType.delete({ where: { id } });
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

// ── Export ─────────────────────────────────────────────────────────────────────

export async function streamFunctionTypesCsv(
  schemaName: string,
  res: Response,
): Promise<void> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.functionType.findMany({
    select:  SELECT,
    orderBy: [{ displayOrder: 'asc' }, { functionTypeName: 'asc' }],
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="function_types.csv"');
  res.write(
    csvRow([
      'function_type_name', 'function_type_details',
      'can_sign_off', 'can_operate_batch', 'can_perform_cleaning', 'can_perform_maintenance',
      'display_order',
    ]) + '\n',
  );
  for (const r of rows) {
    res.write(
      csvRow([
        r.functionTypeName, r.functionTypeDetails,
        r.canSignOff, r.canOperateBatch, r.canPerformCleaning, r.canPerformMaintenance,
        r.displayOrder,
      ]) + '\n',
    );
  }
  res.end();
}

// ── Import ─────────────────────────────────────────────────────────────────────

export interface ImportResult {
  created: number;
  skipped: number;
  errors:  { row: number; message: string }[];
}

export async function importFunctionTypes(
  rows: ImportFunctionTypeRow[],
  schemaName: string,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createFunctionType(
        {
          functionTypeName:      row.functionTypeName,
          functionTypeDetails:   row.functionTypeDetails,
          canSignOff:            row.canSignOff,
          canOperateBatch:       row.canOperateBatch,
          canPerformCleaning:    row.canPerformCleaning,
          canPerformMaintenance: row.canPerformMaintenance,
          displayOrder:          row.displayOrder,
        },
        schemaName,
        userId,
      );
      result.created++;
    } catch (err) {
      if (err instanceof FunctionTypeError && err.code === 'DUPLICATE_NAME') result.skipped++;
      else result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return result;
}
