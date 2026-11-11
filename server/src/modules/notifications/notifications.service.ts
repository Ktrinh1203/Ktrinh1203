import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { userSummarySelect } from '../users/users.select.js';

export async function getNotifications(recipientId: string, limit = 30) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: {
      actor: { select: userSummarySelect },
      post: {
        select: {
          id: true,
          content: true,
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
        },
      },
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { recipientId, readAt: null },
  });

  return {
    items: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      actor: n.actor,
      postId: n.postId,
      postSnippet: n.post?.content ? n.post.content.slice(0, 100) : null,
      commentId: n.commentId,
      commentSnippet: n.comment?.content ? n.comment.content.slice(0, 100) : null,
      conversationId: n.conversationId,
      read: Boolean(n.readAt),
      readAt: n.readAt,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    unreadCount,
  };
}

export async function markNotificationRead(id: string, recipientId: string) {
  const notif = await prisma.notification.findFirst({
    where: { id, recipientId },
  });
  if (!notif) throw notFound('Notification not found');

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return { id: updated.id, read: true, readAt: updated.readAt };
}

export async function markAllNotificationsRead(recipientId: string) {
  await prisma.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
  return { success: true };
}
