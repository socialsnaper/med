import type { Request, Response, NextFunction } from 'express';
import { listEquSopMedia, addEquSopMedia, removeEquSopMedia } from '../services/equ-cleaning-sop-step-media.service';
import { AddEquSopMediaSchema } from '../validation/equ-cleaning-sop-step-media.schemas';

function param(req: Request, name: string): string { const v = req.params[name]; return Array.isArray(v) ? v[0] : v; }

export async function listMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await listEquSopMedia(param(req, 'stepId'), req.user!.schemaName) }); } catch (err) { next(err); }
}

export async function addMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = AddEquSopMediaSchema.parse(req.body);
    res.status(201).json({ success: true, data: await addEquSopMedia(param(req, 'stepId'), dto, req.user!.schemaName, req.user!.id) });
  } catch (err) { next(err); }
}

export async function removeMediaController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await removeEquSopMedia(param(req, 'stepId'), param(req, 'mediaId'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); }
}
