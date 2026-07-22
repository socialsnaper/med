import type { Request, Response, NextFunction } from 'express';
import { listQacMedia, addQacMedia, removeQacMedia } from '../services/room-qac-sop-step-media.service';
import { AddQacMediaSchema } from '../validation/room-qac-sop-step-media.schemas';

function param(req: Request, name: string): string { const v = req.params[name]; return Array.isArray(v) ? v[0] : v; }

export async function listMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await listQacMedia(param(req, 'stepId'), req.user!.schemaName) }); } catch (err) { next(err); }
}

export async function addMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = AddQacMediaSchema.parse(req.body);
    res.status(201).json({ success: true, data: await addQacMedia(param(req, 'stepId'), dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function removeMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await removeQacMedia(param(req, 'stepId'), param(req, 'mediaId'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); }
}
