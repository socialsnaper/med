import type { Request, Response, NextFunction } from 'express';
import { listInsp2Media, addInsp2Media, removeInsp2Media } from '../services/room-inspection2-sop-step-media.service';
import { AddInsp2MediaSchema } from '../validation/room-inspection2-sop-step-media.schemas';

function param(req: Request, name: string): string { const v = req.params[name]; return Array.isArray(v) ? v[0] : v; }

export async function listMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await listInsp2Media(param(req, 'stepId'), req.user!.schemaName) }); } catch (err) { next(err); }
}

export async function addMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = AddInsp2MediaSchema.parse(req.body);
    res.status(201).json({ success: true, data: await addInsp2Media(param(req, 'stepId'), dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function removeMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await removeInsp2Media(param(req, 'stepId'), param(req, 'mediaId'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); }
}
