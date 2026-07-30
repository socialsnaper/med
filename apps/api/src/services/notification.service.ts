import { getPrismaClient } from '../../lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id:        string;
  title:     string;
  message:   string;
  type:      string;
  relatedId: string | null;
  isRead:    boolean;
  createdAt: Date;
}

// ── List notifications for current user ───────────────────────────────────────

export async function listNotifications(
  schemaName: string,
  userId:     string,
  onlyUnread?: boolean,
): Promise<NotificationItem[]> {
  const db   = getPrismaClient(schemaName);
  const rows = await db.inAppNotification.findMany({
    where: {
      recipientId: userId,
      ...(onlyUnread ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select:  { id: true, title: true, message: true, type: true, relatedId: true, isRead: true, createdAt: true },
  });
  return rows;
}

// ── Mark single notification as read ──────────────────────────────────────────

export async function markNotificationRead(
  schemaName: string,
  userId:     string,
  id:         string,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  await db.inAppNotification.updateMany({
    where: { id, recipientId: userId },
    data:  { isRead: true },
  });
}

// ── Mark all notifications as read for this user ──────────────────────────────

export async function markAllNotificationsRead(
  schemaName: string,
  userId:     string,
): Promise<void> {
  const db = getPrismaClient(schemaName);
  await db.inAppNotification.updateMany({
    where: { recipientId: userId, isRead: false },
    data:  { isRead: true },
  });
}

// ── Unread count ──────────────────────────────────────────────────────────────

export async function getUnreadCount(
  schemaName: string,
  userId:     string,
): Promise<number> {
  const db = getPrismaClient(schemaName);
  return db.inAppNotification.count({
    where: { recipientId: userId, isRead: false },
  });
}
