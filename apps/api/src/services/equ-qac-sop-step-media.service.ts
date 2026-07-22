import { getPrismaClient } from '../../lib/prisma';
import type { AddEquQacMediaInput } from '../validation/equ-qac-sop-step-media.schemas';
import { EquQacSopStepError } from './equ-qac-sop-steps.service';

export interface EquQacMediaItemFull { id: string; sopStepId: string; displayOrder: number; fileUrl: string; fileName: string | null; fileType: string | null; caption: string | null; createdAt: Date; }
const SEL = { id: true, sopStepId: true, displayOrder: true, fileUrl: true, fileName: true, fileType: true, caption: true, createdAt: true } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = (r: any): EquQacMediaItemFull => ({ id: r.id, sopStepId: r.sopStepId, displayOrder: r.displayOrder, fileUrl: r.fileUrl, fileName: r.fileName ?? null, fileType: r.fileType ?? null, caption: r.caption ?? null, createdAt: r.createdAt });

export async function listEquQacMedia(stepId: string, schemaName: string) { const db = getPrismaClient(schemaName); return (await db.equQacSopStepMedia.findMany({ select: SEL, where: { sopStepId: stepId }, orderBy: { displayOrder: 'asc' } })).map(m); }

export async function addEquQacMedia(stepId: string, dto: AddEquQacMediaInput, schemaName: string, userId: string) {
  const db = getPrismaClient(schemaName);
  if (!await db.equQacSopStep.findUnique({ where: { id: stepId }, select: { id: true } })) throw new EquQacSopStepError('Step not found', 404, 'NOT_FOUND');
  let displayOrder = dto.displayOrder;
  if (!displayOrder) { const agg = await db.equQacSopStepMedia.aggregate({ where: { sopStepId: stepId }, _max: { displayOrder: true } }); displayOrder = (agg._max.displayOrder ?? 0) + 1; }
  return m(await db.equQacSopStepMedia.create({ select: SEL, data: { sopStepId: stepId, displayOrder, fileUrl: dto.fileUrl, fileName: dto.fileName ?? null, fileType: dto.fileType ?? null, caption: dto.caption ?? null, uploadedBy: userId } }));
}

export async function removeEquQacMedia(stepId: string, mediaId: string, schemaName: string) {
  const db = getPrismaClient(schemaName);
  if (!await db.equQacSopStepMedia.findFirst({ where: { id: mediaId, sopStepId: stepId }, select: { id: true } })) throw new EquQacSopStepError('Picture not found', 404, 'NOT_FOUND');
  await db.equQacSopStepMedia.delete({ where: { id: mediaId } });
}
