import type { Request, Response, NextFunction } from 'express';
import { listEquInsp2Media, addEquInsp2Media, removeEquInsp2Media } from '../services/equ-inspection2-sop-step-media.service';
import { AddEquInsp2MediaSchema } from '../validation/equ-inspection2-sop-step-media.schemas';
const p = (req: Request, n: string) => { const v = req.params[n]; return Array.isArray(v) ? v[0] : v; };
export async function listMediaController(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.json({ success: true, data: await listEquInsp2Media(p(req, 'stepId'), req.user!.schemaName) }); } catch (err) { next(err); } }
export async function addMediaController(req: Request, res: Response, next: NextFunction): Promise<void> { try { const dto = AddEquInsp2MediaSchema.parse(req.body); res.status(201).json({ success: true, data: await addEquInsp2Media(p(req, 'stepId'), dto, req.user!.schemaName, req.user!.id) }); } catch (err) { next(err); } }
export async function removeMediaController(req: Request, res: Response, next: NextFunction): Promise<void> { try { await removeEquInsp2Media(p(req, 'stepId'), p(req, 'mediaId'), req.user!.schemaName); res.json({ success: true }); } catch (err) { next(err); } }
