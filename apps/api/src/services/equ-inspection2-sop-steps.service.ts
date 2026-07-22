import type { Response } from 'express';
import { getPrismaClient } from '../../lib/prisma';
import type { CreateEquInsp2SopStepInput, UpdateEquInsp2SopStepInput, EquInsp2ImportRow } from '../validation/equ-inspection2-sop-steps.schemas';

export class EquInsp2SopStepError extends Error {
  constructor(message: string, public readonly statusCode = 400, public readonly code = 'EQU_INSP2_SOP_STEP_ERROR') { super(message); this.name = 'EquInsp2SopStepError'; }
}

export interface EquInsp2MediaItem { id: string; sopStepId: string; displayOrder: number; fileUrl: string; fileName: string | null; fileType: string | null; caption: string | null; createdAt: Date; }
export interface EquInsp2SopStepItem { id: string; slid: number; cleaningTypeId: string; cleaningTypeName: string; cleaningTypeCode: string; stepNumber: number; procedureText: string; status: string; media: EquInsp2MediaItem[]; createdAt: Date; updatedAt: Date; }

const SELECT = { id: true, slid: true, cleaningTypeId: true, stepNumber: true, procedureText: true, status: true, createdAt: true, updatedAt: true, cleaningType: { select: { cleaningTypeName: true, cleaningTypeCode: true } }, media: { select: { id: true, fileUrl: true, fileName: true, fileType: true, caption: true, displayOrder: true, createdAt: true }, orderBy: [{ displayOrder: 'asc' as const }] } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): EquInsp2SopStepItem { return { id: row.id, slid: row.slid, cleaningTypeId: row.cleaningTypeId, cleaningTypeName: row.cleaningType.cleaningTypeName, cleaningTypeCode: row.cleaningType.cleaningTypeCode, stepNumber: row.stepNumber, procedureText: row.procedureText, status: row.status, media: (row.media ?? []).map((m: any) => ({ id: m.id, sopStepId: row.id, displayOrder: m.displayOrder, fileUrl: m.fileUrl, fileName: m.fileName ?? null, fileType: m.fileType ?? null, caption: m.caption ?? null, createdAt: m.createdAt })), createdAt: row.createdAt, updatedAt: row.updatedAt }; }

async function nextSlid(cleaningTypeId: string, schemaName: string) { const db = getPrismaClient(schemaName); const agg = await db.equInspection2SopStep.aggregate({ where: { cleaningTypeId }, _max: { slid: true } }); return (agg._max.slid ?? 0) + 1; }
async function renumberSlids(cleaningTypeId: string, schemaName: string) { const db = getPrismaClient(schemaName); const rows = await db.equInspection2SopStep.findMany({ where: { cleaningTypeId }, select: { id: true }, orderBy: { stepNumber: 'asc' } }); for (let i = 0; i < rows.length; i++) await db.equInspection2SopStep.update({ where: { id: rows[i].id }, data: { slid: i + 1 } }); }

export async function listEquInsp2SopSteps(schemaName: string, cleaningTypeId?: string, status?: string) { const db = getPrismaClient(schemaName); return (await db.equInspection2SopStep.findMany({ select: SELECT, where: { ...(cleaningTypeId ? { cleaningTypeId } : {}), ...(status ? { status } : {}) }, orderBy: [{ cleaningTypeId: 'asc' }, { stepNumber: 'asc' }] })).map(mapRow); }
export async function getEquInsp2SopStep(id: string, schemaName: string) { const db = getPrismaClient(schemaName); const row = await db.equInspection2SopStep.findUnique({ select: SELECT, where: { id } }); if (!row) throw new EquInsp2SopStepError('Step not found', 404, 'NOT_FOUND'); return mapRow(row); }

export async function createEquInsp2SopStep(dto: CreateEquInsp2SopStepInput, schemaName: string, userId: string) {
  const db = getPrismaClient(schemaName);
  if (!await db.roomCleaningType.findUnique({ where: { id: dto.cleaningTypeId }, select: { id: true } })) throw new EquInsp2SopStepError('Cleaning type not found', 404, 'CT_NOT_FOUND');
  if (await db.equInspection2SopStep.findFirst({ where: { cleaningTypeId: dto.cleaningTypeId, stepNumber: dto.stepNumber }, select: { id: true } })) throw new EquInsp2SopStepError(`Step number ${dto.stepNumber} already exists`, 409, 'DUPLICATE_STEP');
  const slid = await nextSlid(dto.cleaningTypeId, schemaName);
  return mapRow(await db.equInspection2SopStep.create({ select: SELECT, data: { slid, cleaningTypeId: dto.cleaningTypeId, stepNumber: dto.stepNumber, procedureText: dto.procedureText, status: dto.status ?? 'approved', createdBy: userId, updatedBy: userId } }));
}

export async function updateEquInsp2SopStep(id: string, dto: UpdateEquInsp2SopStepInput, schemaName: string, userId: string) {
  const db = getPrismaClient(schemaName);
  const ex = await db.equInspection2SopStep.findUnique({ where: { id }, select: { id: true, cleaningTypeId: true } });
  if (!ex) throw new EquInsp2SopStepError('Step not found', 404, 'NOT_FOUND');
  if (dto.stepNumber !== undefined && await db.equInspection2SopStep.findFirst({ where: { cleaningTypeId: ex.cleaningTypeId, stepNumber: dto.stepNumber, NOT: { id } }, select: { id: true } })) throw new EquInsp2SopStepError(`Step number ${dto.stepNumber} already exists`, 409, 'DUPLICATE_STEP');
  return mapRow(await db.equInspection2SopStep.update({ select: SELECT, where: { id }, data: { ...(dto.stepNumber !== undefined && { stepNumber: dto.stepNumber }), ...(dto.procedureText !== undefined && { procedureText: dto.procedureText }), ...(dto.status !== undefined && { status: dto.status }), updatedBy: userId, updatedAt: new Date() } }));
}

export async function deleteEquInsp2SopStep(id: string, schemaName: string) {
  const db = getPrismaClient(schemaName);
  const ex = await db.equInspection2SopStep.findUnique({ where: { id }, select: { id: true, cleaningTypeId: true } });
  if (!ex) throw new EquInsp2SopStepError('Step not found', 404, 'NOT_FOUND');
  await db.equInspection2SopStep.delete({ where: { id } }); await renumberSlids(ex.cleaningTypeId, schemaName);
}

function csv(v: unknown) { if (v === null || v === undefined) return '""'; return `"${String(v).replace(/"/g, '""')}"`; }
function csvRow(cells: unknown[]) { return cells.map(csv).join(','); }

export async function streamEquInsp2SopStepsCsv(schemaName: string, res: Response, cleaningTypeId?: string) {
  const rows = await listEquInsp2SopSteps(schemaName, cleaningTypeId);
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="equ_inspection2_sop_steps.csv"');
  res.write(csvRow(['cleaning_type_code', 'step_number', 'procedure_text', 'status']) + '\n');
  for (const r of rows) res.write(csvRow([r.cleaningTypeCode, r.stepNumber, r.procedureText, r.status]) + '\n');
  res.end();
}

export async function importEquInsp2SopSteps(rows: EquInsp2ImportRow[], schemaName: string, userId: string) {
  let created = 0, skipped = 0; const errors: { row: number; message: string }[] = []; const db = getPrismaClient(schemaName);
  for (let i = 0; i < rows.length; i++) {
    try {
      const ct = await db.roomCleaningType.findFirst({ where: { cleaningTypeCode: { equals: rows[i].cleaningTypeCode, mode: 'insensitive' } }, select: { id: true } });
      if (!ct) { errors.push({ row: i + 2, message: `Cleaning type "${rows[i].cleaningTypeCode}" not found` }); continue; }
      if (await db.equInspection2SopStep.findFirst({ where: { cleaningTypeId: ct.id, stepNumber: rows[i].stepNumber }, select: { id: true } })) { skipped++; continue; }
      await createEquInsp2SopStep({ cleaningTypeId: ct.id, stepNumber: rows[i].stepNumber, procedureText: rows[i].procedureText, status: 'approved' }, schemaName, userId); created++;
    } catch (err) { errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  return { created, skipped, errors };
}
