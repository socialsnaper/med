import type { Request, Response, NextFunction } from 'express';
import * as notifService from '../services/notification.service';

// GET /api/notifications
export async function listNotificationsController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const onlyUnread = req.query.unread === 'true';
    const data = await notifService.listNotifications(req.user!.schemaName, req.user!.id, onlyUnread);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/notifications/unread-count
export async function getUnreadCountController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const count = await notifService.getUnreadCount(req.user!.schemaName, req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
}

// POST /api/notifications/:id/read
export async function markReadController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await notifService.markNotificationRead(req.user!.schemaName, req.user!.id, id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// POST /api/notifications/read-all
export async function markAllReadController(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await notifService.markAllNotificationsRead(req.user!.schemaName, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
