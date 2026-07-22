import type { Request, Response, NextFunction } from 'express';
import { listEquQacMedia, addEquQacMedia, removeEquQacMedia } from '../services/equ-qac-sop-step-media.service';
import { AddEquQacMediaSchema } from '../validation/equ-qac-sop-step-media.schemas';
const p = (req: Request, n: string) => { const v = req.params[n]; return Array.isArray(v) ? v[0] : v; };
export async function listMediaController(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.json({ success: true, data: await listEquQacMedia(p(req, 'stepId'), req.user!.schemaName) }); } catch (err) { next(err); } }
export async function addMediaController(req: Request, res: Response, next: NextFunction): Promise<void> { try { const dto = AddEquQacMediaSchema.parse(req.body); res.status(201).json({ success: true, data: await addEquQacMedia(p(req, 'stepId'), dto, req.user!.schemaName, req.user!.id) }); } catch (err) { next(err); } }
export async function removeMediaController(req: Request, res: Response, next: NextFunction): Promise<void> { try { await removeEquQacMedia(p(req, 'stepId'), p(req, 'mediaId'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); } }
