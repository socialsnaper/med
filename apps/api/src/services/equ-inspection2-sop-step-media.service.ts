import { getPrismaClient } from '../../lib/prisma';
import type { AddEquInsp2MediaInput } from '../validation/equ-inspection2-sop-step-media.schemas';
import { EquInsp2SopStepError } from './equ-inspection2-sop-steps.service';

export interface EquInsp2MediaItemFull { id: string; sopStepId: string; displayOrder: number; fileUrl: string; fileName: string | null; fileType: string | null; caption: string | null; createdAt: Date; }
const SEL = { id: true, sopStepId: true, displayOrder: true, fileUrl: true, fileName: true, fileType: true, caption: true, createdAt: true } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = (r: any): EquInsp2MediaItemFull => ({ id: r.id, sopStepId: r.sopStepId, displayOrder: r.displayOrder, fileUrl: r.fileUrl, fileName: r.fileName ?? null, fileType: r.fileType ?? null, caption: r.caption ?? null, createdAt: r.createdAt });

export async function listEquInsp2Media(stepId: string, schemaName: string) { const db = getPrismaClient(schemaName); return (await db.equInspection2SopStepMedia.findMany({ select: SEL, where: { sopStepId: stepId }, orderBy: { displayOrder: 'asc' } })).map(m); }

export async function addEquInsp2Media(stepId: string, dto: AddEquInsp2MediaInput, schemaName: string, userId: string) {
  const db = getPrismaClient(schemaName);
  if (!await db.equInspection2SopStep.findUnique({ where: { id: stepId }, select: { id: true } })) throw new EquInsp2SopStepError('Step not found', 404, 'NOT_FOUND');
  let displayOrder = dto.displayOrder;
  if (!displayOrder) { const agg = await db.equInspection2SopStepMedia.aggregate({ where: { sopStepId: stepId }, _max: { displayOrder: true } }); displayOrder = (agg._max.displayOrder ?? 0) + 1; }
  return m(await db.equInspection2SopStepMedia.create({ select: SEL, data: { sopStepId: stepId, displayOrder, fileUrl: dto.fileUrl, fileName: dto.fileName ?? null, fileType: dto.fileType ?? null, caption: dto.caption ?? null, uploadedBy: userId } }));
}

export async function removeEquInsp2Media(stepId: string, mediaId: string, schemaName: string) {
  const db = getPrismaClient(schemaName);
  if (!await db.equInspection2SopStepMedia.findFirst({ where: { id: mediaId, sopStepId: stepId }, select: { id: true } })) throw new EquInsp2SopStepError('Picture not found', 404, 'NOT_FOUND');
  await db.equInspection2SopStepMedia.delete({ where: { id: mediaId } });
}
