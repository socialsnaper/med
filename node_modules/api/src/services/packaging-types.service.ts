import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type {
  CreatePackagingTypeInput,
  UpdatePackagingTypeInput,
  ImportPackagingTypeRow,
} from '../validation/packaging-types.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class PackagingTypeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'PACKAGING_TYPE_ERROR',
  ) {
    super(message);
    this.name = 'PackagingTypeError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PackagingTypeItem {
  id:                   string;
  packagingTypeId:      string;
  packagingTypeName:    string;
  packagingTypeDetails: string | null;
  packagingCategory:    string | null;
  primaryMaterial:      string | null;
  packUnit:             string | null;
  standardPackSize:     number | null;
  storageConditions:    string | null;
  displayOrder:         number;
  isActive:             boolean;
  createdAt:            Date;
  updatedAt:            Date;
}

// ── ID generator ───────────────────────────────────────────────────────────────

async function nextPackagingTypeId(schemaName: string): Promise<string> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.packagingType.findMany({
    select:  { packagingTypeId: true },
    orderBy: { packagingTypeId: 'desc' },
  });

  let max = 0;
  for (const row of rows) {
    const match = row.packagingTypeId.match(/^PT-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `PT-${String(max + 1).padStart(3, '0')}`;
}

// ── Select shape ───────────────────────────────────────────────────────────────

const SELECT = {
  id:                   true,
  packagingTypeId:      true,
  packagingTypeName:    true,
  packagingTypeDetails: true,
  packagingCategory:    true,
  primaryMaterial:      true,
  packUnit:             true,
  standardPackSize:     true,
  storageConditions:    true,
  displayOrder:         true,
  isActive:             true,
  createdAt:            true,
  updatedAt:            true,
} as const;

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listPackagingTypes(
  schemaName: string,
  search?: string,
  category?: string,
): Promise<PackagingTypeItem[]> {
  const db = getPrismaClient(schemaName);

  const andClauses: object[] = [];
  if (search) {
    andClauses.push({
      OR: [
        { packagingTypeId:   { contains: search, mode: 'insensitive' } },
        { packagingTypeName: { contains: search, mode: 'insensitive' } },
      ],
    });
  }
  if (category) {
    andClauses.push({ packagingCategory: category });
  }

  return db.packagingType.findMany({
    select:  SELECT,
    where:   andClauses.length ? { AND: andClauses } : undefined,
    orderBy: [{ displayOrder: 'asc' }, { packagingTypeName: 'asc' }],
  });
}

export async function getPackagingType(
  id: string,
  schemaName: string,
): Promise<PackagingTypeItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.packagingType.findUnique({ select: SELECT, where: { id } });
  if (!row) throw new PackagingTypeError('Packaging type not found', 404, 'NOT_FOUND');
  return row;
}

export async function createPackagingType(
  dto: CreatePackagingTypeInput,
  schemaName: string,
  userId: string,
): Promise<PackagingTypeItem> {
  const db = getPrismaClient(schemaName);

  const existing = await db.packagingType.findFirst({
    where:  { packagingTypeName: { equals: dto.packagingTypeName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw new PackagingTypeError(
      `A packaging type named "${dto.packagingTypeName}" already exists`,
      409,
      'DUPLICATE_NAME',
    );
  }

  const packagingTypeId = await nextPackagingTypeId(schemaName);

  return db.packagingType.create({
    select: SELECT,
    data: {
      packagingTypeId,
      packagingTypeName:    dto.packagingTypeName,
      packagingTypeDetails: dto.packagingTypeDetails ?? null,
      packagingCategory:    dto.packagingCategory    ?? null,
      primaryMaterial:      dto.primaryMaterial      ?? null,
      packUnit:             dto.packUnit             ?? null,
      standardPackSize:     dto.standardPackSize     ?? null,
      storageConditions:    dto.storageConditions    ?? null,
      displayOrder:         dto.displayOrder         ?? 0,
      isActive:             dto.isActive             ?? true,
      createdBy:            userId,
      updatedBy:            userId,
    },
  });
}

export async function updatePackagingType(
  id: string,
  dto: UpdatePackagingTypeInput,
  schemaName: string,
  userId: string,
): Promise<PackagingTypeItem> {
  const db = getPrismaClient(schemaName);

  const existing = await db.packagingType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PackagingTypeError('Packaging type not found', 404, 'NOT_FOUND');

  if (dto.packagingTypeName) {
    const clash = await db.packagingType.findFirst({
      where: {
        packagingTypeName: { equals: dto.packagingTypeName, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) {
      throw new PackagingTypeError(
        `A packaging type named "${dto.packagingTypeName}" already exists`,
        409,
        'DUPLICATE_NAME',
      );
    }
  }

  return db.packagingType.update({
    select: SELECT,
    where:  { id },
    data: {
      ...(dto.packagingTypeName    !== undefined && { packagingTypeName:    dto.packagingTypeName }),
      ...(dto.packagingTypeDetails !== undefined && { packagingTypeDetails: dto.packagingTypeDetails }),
      ...(dto.packagingCategory    !== undefined && { packagingCategory:    dto.packagingCategory }),
      ...(dto.primaryMaterial      !== undefined && { primaryMaterial:      dto.primaryMaterial }),
      ...(dto.packUnit             !== undefined && { packUnit:             dto.packUnit }),
      ...(dto.standardPackSize     !== undefined && { standardPackSize:     dto.standardPackSize }),
      ...(dto.storageConditions    !== undefined && { storageConditions:    dto.storageConditions }),
      ...(dto.displayOrder         !== undefined && { displayOrder:         dto.displayOrder }),
      ...(dto.isActive             !== undefined && { isActive:             dto.isActive }),
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });
}

export async function deletePackagingType(
  id: string,
  schemaName: string,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  const existing = await db.packagingType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PackagingTypeError('Packaging type not found', 404, 'NOT_FOUND');
  await db.packagingType.delete({ where: { id } });
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

export async function streamPackagingTypesCsv(
  schemaName: string,
  res: Response,
): Promise<void> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.packagingType.findMany({
    select:  SELECT,
    orderBy: [{ displayOrder: 'asc' }, { packagingTypeName: 'asc' }],
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="packaging_types.csv"');
  res.write(
    csvRow([
      'packaging_type_name', 'packaging_type_details', 'packaging_category',
      'primary_material', 'pack_unit', 'standard_pack_size', 'storage_conditions', 'display_order',
    ]) + '\n',
  );
  for (const r of rows) {
    res.write(
      csvRow([
        r.packagingTypeName, r.packagingTypeDetails, r.packagingCategory,
        r.primaryMaterial, r.packUnit, r.standardPackSize, r.storageConditions, r.displayOrder,
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

export async function importPackagingTypes(
  rows: ImportPackagingTypeRow[],
  schemaName: string,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createPackagingType(
        {
          packagingTypeName:    row.packagingTypeName,
          packagingTypeDetails: row.packagingTypeDetails,
          packagingCategory:    row.packagingCategory,
          primaryMaterial:      row.primaryMaterial,
          packUnit:             row.packUnit,
          standardPackSize:     row.standardPackSize,
          storageConditions:    row.storageConditions,
          displayOrder:         row.displayOrder,
        },
        schemaName,
        userId,
      );
      result.created++;
    } catch (err) {
      if (err instanceof PackagingTypeError && err.code === 'DUPLICATE_NAME') result.skipped++;
      else result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return result;
}
