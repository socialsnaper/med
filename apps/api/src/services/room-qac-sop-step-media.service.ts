import { getPrismaClient } from '../../lib/prisma';
import type { AddQacMediaInput } from '../validation/room-qac-sop-step-media.schemas';
import { RoomQacSopStepError } from './room-qac-sop-steps.service';

export interface QacMediaItem {
  id: string; sopStepId: string; displayOrder: number;
  fileUrl: string; fileName: string | null; fileType: string | null;
  caption: string | null; createdAt: Date;
}

const MEDIA_SELECT = { id: true, sopStepId: true, displayOrder: true, fileUrl: true, fileName: true, fileType: true, caption: true, createdAt: true } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMedia(row: any): QacMediaItem {
  return { id: row.id, sopStepId: row.sopStepId, displayOrder: row.displayOrder, fileUrl: row.fileUrl, fileName: row.fileName ?? null, fileType: row.fileType ?? null, caption: row.caption ?? null, createdAt: row.createdAt };
}

export async function listQacMedia(stepId: string, schemaName: string): Promise<QacMediaItem[]> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomQacSopStepMedia.findMany({ select: MEDIA_SELECT, where: { sopStepId: stepId }, orderBy: { displayOrder: 'asc' } });
  return rows.map(mapMedia);
}

export async function addQacMedia(stepId: string, dto: AddQacMediaInput, schemaName: string, userId: string): Promise<QacMediaItem> {
  const db   = getPrismaClient(schemaName);
  const step = await db.roomQacSopStep.findUnique({ where: { id: stepId }, select: { id: true } });
  if (!step) throw new RoomQacSopStepError('QAC step not found', 404, 'NOT_FOUND');
  let displayOrder = dto.displayOrder;
  if (!displayOrder) {
    const agg = await db.roomQacSopStepMedia.aggregate({ where: { sopStepId: stepId }, _max: { displayOrder: true } });
    displayOrder = (agg._max.displayOrder ?? 0) + 1;
  }
  const row = await db.roomQacSopStepMedia.create({
    select: MEDIA_SELECT,
    data: { sopStepId: stepId, displayOrder, fileUrl: dto.fileUrl, fileName: dto.fileName ?? null, fileType: dto.fileType ?? null, caption: dto.caption ?? null, uploadedBy: userId },
  });
  return mapMedia(row);
}

export async function removeQacMedia(stepId: string, mediaId: string, schemaName: string): Promise<void> {
  const db       = getPrismaClient(schemaName);
  const existing = await db.roomQacSopStepMedia.findFirst({ where: { id: mediaId, sopStepId: stepId }, select: { id: true } });
  if (!existing) throw new RoomQacSopStepError('Picture not found', 404, 'NOT_FOUND');
  await db.roomQacSopStepMedia.delete({ where: { id: mediaId } });
}
