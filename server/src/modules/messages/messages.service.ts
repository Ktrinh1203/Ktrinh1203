import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { userSummarySelect } from '../users/users.select.js';

export function computeDirectKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

export async function getOrCreateConversation(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) {
    throw badRequest('You cannot start a conversation with yourself');
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!target) throw notFound('Target user not found');

  const directKey = computeDirectKey(currentUserId, targetUserId);

  let conversation = await prisma.conversation.findUnique({
    where: { directKey },
    include: {
      participants: {
        include: {
          user: { select: userSummarySelect },
        },
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        directKey,
        participants: {
          create: [{ userId: currentUserId }, { userId: targetUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: userSummarySelect },
          },
        },
      },
    });
  }

  const otherParticipant = conversation.participants.find((p) => p.userId !== currentUserId);

  return {
    id: conversation.id,
    directKey: conversation.directKey,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    otherUser: otherParticipant?.user,
  };
}

export async function getUserConversations(userId: string) {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: { select: userSummarySelect },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: {
      conversation: {
        updatedAt: 'desc',
      },
    },
  });

  return memberships.map((m) => {
    const conv = m.conversation;
    const otherParticipant = conv.participants.find((p) => p.userId !== userId);
    const lastMessage = conv.messages[0] || null;
    const isUnread =
      lastMessage &&
      lastMessage.senderId !== userId &&
      (!m.lastReadAt || m.lastReadAt < lastMessage.createdAt);

    return {
      id: conv.id,
      lastMessageAt: conv.lastMessageAt || conv.createdAt,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          }
        : null,
      isUnread: Boolean(isUnread),
      otherUser: otherParticipant?.user || null,
    };
  });
}

export async function getConversationDetails(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: { select: userSummarySelect },
            },
          },
        },
      },
    },
  });

  if (!participant) {
    throw forbidden('You are not a participant in this conversation');
  }

  const otherParticipant = participant.conversation.participants.find((p) => p.userId !== userId);

  return {
    id: participant.conversation.id,
    lastMessageAt: participant.conversation.lastMessageAt,
    otherUser: otherParticipant?.user || null,
  };
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit = 50,
) {
  // 1. Authorize: Verify membership
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });

  if (!participant) {
    throw forbidden('You are not a participant in this conversation');
  }

  // 2. Fetch messages ordered by createdAt DESC for pagination, then reversed for timeline
  const messages = await prisma.message.findMany({
    where: { conversationId },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      sender: { select: userSummarySelect },
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

  // Mark conversation read for this user
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  }).catch(() => undefined);

  // Clear message notification if exists
  const dedupeKey = `message:${conversationId}`;
  await prisma.notification.deleteMany({
    where: { recipientId: userId, dedupeKey },
  }).catch(() => undefined);

  return {
    items: items.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      content: m.content,
      createdAt: m.createdAt,
      sender: m.sender,
      isSender: m.senderId === userId,
    })),
    nextCursor,
    hasMore,
  };
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  // 1. Authorize: Verify membership
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: senderId } },
    include: {
      conversation: {
        include: {
          participants: true,
        },
      },
    },
  });

  if (!participant) {
    throw forbidden('You are not a participant in this conversation');
  }

  const now = new Date();

  // 2. Create message and update conversation in transaction
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
      include: {
        sender: { select: userSummarySelect },
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, updatedAt: now },
    }),
    prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: now },
    }),
  ]);

  // 3. Notify the other participant
  const otherParticipant = participant.conversation.participants.find((p) => p.userId !== senderId);
  if (otherParticipant) {
    const dedupeKey = `message:${conversationId}`;
    await prisma.notification.upsert({
      where: { dedupeKey },
      create: {
        recipientId: otherParticipant.userId,
        actorId: senderId,
        type: 'NEW_MESSAGE',
        conversationId,
        dedupeKey,
      },
      update: {
        readAt: null,
        actorId: senderId,
        updatedAt: now,
      },
    }).catch(() => undefined);
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    createdAt: message.createdAt,
    sender: message.sender,
    isSender: true,
  };
}
