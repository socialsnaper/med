import { getPrismaClient } from '../../lib/prisma';
import type { AddInsp2MediaInput } from '../validation/room-inspection2-sop-step-media.schemas';
import { RoomInspection2SopStepError } from './room-inspection2-sop-steps.service';

export interface Insp2MediaItem {
  id: string; sopStepId: string; displayOrder: number;
  fileUrl: string; fileName: string | null; fileType: string | null;
  caption: string | null; createdAt: Date;
}

const MEDIA_SELECT = { id: true, sopStepId: true, displayOrder: true, fileUrl: true, fileName: true, fileType: true, caption: true, createdAt: true } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMedia(row: any): Insp2MediaItem {
  return { id: row.id, sopStepId: row.sopStepId, displayOrder: row.displayOrder, fileUrl: row.fileUrl, fileName: row.fileName ?? null, fileType: row.fileType ?? null, caption: row.caption ?? null, createdAt: row.createdAt };
}

export async function listInsp2Media(stepId: string, schemaName: string): Promise<Insp2MediaItem[]> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.roomInspection2SopStepMedia.findMany({ select: MEDIA_SELECT, where: { sopStepId: stepId }, orderBy: { displayOrder: 'asc' } });
  return rows.map(mapMedia);
}

export async function addInsp2Media(stepId: string, dto: AddInsp2MediaInput, schemaName: string, userId: string): Promise<Insp2MediaItem> {
  const db   = getPrismaClient(schemaName);
  const step = await db.roomInspection2SopStep.findUnique({ where: { id: stepId }, select: { id: true } });
  if (!step) throw new RoomInspection2SopStepError('Inspection 2 step not found', 404, 'NOT_FOUND');
  let displayOrder = dto.displayOrder;
  if (!displayOrder) {
    const agg = await db.roomInspection2SopStepMedia.aggregate({ where: { sopStepId: stepId }, _max: { displayOrder: true } });
    displayOrder = (agg._max.displayOrder ?? 0) + 1;
  }
  const row = await db.roomInspection2SopStepMedia.create({
    select: MEDIA_SELECT,
    data: { sopStepId: stepId, displayOrder, fileUrl: dto.fileUrl, fileName: dto.fileName ?? null, fileType: dto.fileType ?? null, caption: dto.caption ?? null, uploadedBy: userId },
  });
  return mapMedia(row);
}

export async function removeInsp2Media(stepId: string, mediaId: string, schemaName: string): Promise<void> {
  const db       = getPrismaClient(schemaName);
  const existing = await db.roomInspection2SopStepMedia.findFirst({ where: { id: mediaId, sopStepId: stepId }, select: { id: true } });
  if (!existing) throw new RoomInspection2SopStepError('Picture not found', 404, 'NOT_FOUND');
  await db.roomInspection2SopStepMedia.delete({ where: { id: mediaId } });
}
