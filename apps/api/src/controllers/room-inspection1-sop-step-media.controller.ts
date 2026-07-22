import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/room-inspection1-sop-step-media.service';
import { AddInsp1MediaSchema } from '../validation/room-inspection1-sop-step-media.schemas';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/room-inspection1-sop-steps/:stepId/media
export async function listMediaController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await svc.listInsp1Media(param(req, 'stepId'), req.user!.schemaName);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// POST /api/room-inspection1-sop-steps/:stepId/media
export async function addMediaController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const dto  = AddInsp1MediaSchema.parse(req.body);
    const data = await svc.addInsp1Media(
      param(req, 'stepId'), dto, req.user!.schemaName, req.user!.id,
    );
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

// DELETE /api/room-inspection1-sop-steps/:stepId/media/:mediaId
export async function removeMediaController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await svc.removeInsp1Media(
      param(req, 'stepId'), param(req, 'mediaId'), req.user!.schemaName,
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}
