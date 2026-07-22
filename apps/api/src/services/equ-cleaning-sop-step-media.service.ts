import { getPrismaClient } from '../../lib/prisma';
import type { AddEquSopMediaInput } from '../validation/equ-cleaning-sop-step-media.schemas';
import { EquCleaningSopStepError } from './equ-cleaning-sop-steps.service';

const MAX_MEDIA = 3;

export interface EquSopMediaItem {
  id: string; sopStepId: string; displayOrder: number;
  fileUrl: string; fileName: string | null; fileType: string | null;
  caption: string | null; createdAt: Date;
}

const MEDIA_SELECT = { id: true, sopStepId: true, displayOrder: true, fileUrl: true, fileName: true, fileType: true, caption: true, createdAt: true } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMedia(row: any): EquSopMediaItem {
  return { id: row.id, sopStepId: row.sopStepId, displayOrder: row.displayOrder, fileUrl: row.fileUrl, fileName: row.fileName ?? null, fileType: row.fileType ?? null, caption: row.caption ?? null, createdAt: row.createdAt };
}

export async function listEquSopMedia(stepId: string, schemaName: string): Promise<EquSopMediaItem[]> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.equCleaningSopStepMedia.findMany({ select: MEDIA_SELECT, where: { sopStepId: stepId }, orderBy: { displayOrder: 'asc' } });
  return rows.map(mapMedia);
}

export async function addEquSopMedia(stepId: string, dto: AddEquSopMediaInput, schemaName: string, userId: string): Promise<EquSopMediaItem> {
  const db   = getPrismaClient(schemaName);
  const step = await db.equCleaningSopStep.findUnique({ where: { id: stepId }, select: { id: true } });
  if (!step) throw new EquCleaningSopStepError('Equipment cleaning step not found', 404, 'NOT_FOUND');

  // Enforce max 3 pictures
  const count = await db.equCleaningSopStepMedia.count({ where: { sopStepId: stepId } });
  if (count >= MAX_MEDIA) throw new EquCleaningSopStepError(`Maximum ${MAX_MEDIA} pictures allowed per step`, 422, 'MAX_MEDIA_REACHED');

  let displayOrder = dto.displayOrder;
  if (!displayOrder) {
    const agg = await db.equCleaningSopStepMedia.aggregate({ where: { sopStepId: stepId }, _max: { displayOrder: true } });
    displayOrder = (agg._max.displayOrder ?? 0) + 1;
  }
  const row = await db.equCleaningSopStepMedia.create({
    select: MEDIA_SELECT,
    data: { sopStepId: stepId, displayOrder, fileUrl: dto.fileUrl, fileName: dto.fileName ?? null, fileType: dto.fileType ?? null, caption: dto.caption ?? null, uploadedBy: userId },
  });
  return mapMedia(row);
}

export async function removeEquSopMedia(stepId: string, mediaId: string, schemaName: string): Promise<void> {
  const db       = getPrismaClient(schemaName);
  const existing = await db.equCleaningSopStepMedia.findFirst({ where: { id: mediaId, sopStepId: stepId }, select: { id: true } });
  if (!existing) throw new EquCleaningSopStepError('Picture not found', 404, 'NOT_FOUND');
  await db.equCleaningSopStepMedia.delete({ where: { id: mediaId } });
}
