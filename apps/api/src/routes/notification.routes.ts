import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import {
  listNotificationsController,
  getUnreadCountController,
  markReadController,
  markAllReadController,
} from '../controllers/notification.controller';

export const notificationRouter = Router();

const auth = [requireAccessToken];

notificationRouter.get('/',                 ...auth, listNotificationsController);   // GET  /api/notifications
notificationRouter.get('/unread-count',     ...auth, getUnreadCountController);       // GET  /api/notifications/unread-count
notificationRouter.post('/read-all',        ...auth, markAllReadController);           // POST /api/notifications/read-all
notificationRouter.post('/:id/read',        ...auth, markReadController);              // POST /api/notifications/:id/read
