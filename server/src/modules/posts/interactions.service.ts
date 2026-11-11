import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { userSummarySelect } from '../users/users.select.js';

export async function createComment(
  postId: string,
  authorId: string,
  content: string,
) {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { id: true, authorId: true },
  });

  if (!post) throw notFound('Post not found');

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId,
      content,
    },
    include: {
      author: { select: userSummarySelect },
    },
  });

  // Notify post author (if not self)
  if (post.authorId !== authorId) {
    const dedupeKey = `comment:${comment.id}`;
    await prisma.notification.upsert({
      where: { dedupeKey },
      create: {
        recipientId: post.authorId,
        actorId: authorId,
        type: 'POST_COMMENTED',
        postId,
        commentId: comment.id,
        dedupeKey,
      },
      update: {
        readAt: null,
        updatedAt: new Date(),
      },
    }).catch(() => undefined);
  }

  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.author,
    isAuthor: true,
  };
}

export async function getComments(postId: string, viewerId?: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!post) throw notFound('Post not found');

  const comments = await prisma.comment.findMany({
    where: { postId, status: 'PUBLISHED' },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: userSummarySelect },
    },
  });

  return comments.map((c) => ({
    id: c.id,
    postId: c.postId,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: c.author,
    isAuthor: viewerId === c.author.id,
  }));
}

export async function updateComment(
  commentId: string,
  userId: string,
  content: string,
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true },
  });

  if (!comment || comment.status !== 'PUBLISHED') throw notFound('Comment not found');
  if (comment.authorId !== userId) throw forbidden('You can only edit your own comments');

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      author: { select: userSummarySelect },
    },
  });

  return {
    id: updated.id,
    postId: updated.postId,
    content: updated.content,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    author: updated.author,
    isAuthor: true,
  };
}

export async function deleteComment(
  commentId: string,
  userId: string,
  isAdmin = false,
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { post: { select: { authorId: true } } },
  });

  if (!comment) throw notFound('Comment not found');
  const isCommentAuthor = comment.authorId === userId;
  const isPostAuthor = comment.post.authorId === userId;

  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    throw forbidden('You do not have permission to delete this comment');
  }

  await prisma.comment.delete({ where: { id: commentId } });
}

export async function likePost(postId: string, userId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { id: true, authorId: true },
  });
  if (!post) throw notFound('Post not found');

  // Upsert like to handle duplicate requests safely
  await prisma.postLike.upsert({
    where: { userId_postId: { userId, postId } },
    create: { userId, postId },
    update: {},
  });

  // Notify post author (if not self)
  if (post.authorId !== userId) {
    const dedupeKey = `like:${postId}:${userId}`;
    await prisma.notification.upsert({
      where: { dedupeKey },
      create: {
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKED',
        postId,
        dedupeKey,
      },
      update: {
        readAt: null,
        updatedAt: new Date(),
      },
    }).catch(() => undefined);
  }

  const count = await prisma.postLike.count({ where: { postId } });
  return { liked: true, likesCount: count };
}

export async function unlikePost(postId: string, userId: string) {
  await prisma.postLike.deleteMany({
    where: { postId, userId },
  });

  // Clean up like notification if not yet read
  const dedupeKey = `like:${postId}:${userId}`;
  await prisma.notification.deleteMany({
    where: { dedupeKey, readAt: null },
  }).catch(() => undefined);

  const count = await prisma.postLike.count({ where: { postId } });
  return { liked: false, likesCount: count };
}

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw badRequest('You cannot follow yourself');
  }

  const target = await prisma.user.findFirst({
    where: { id: followingId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!target) throw notFound('User not found');

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });

  const dedupeKey = `follow:${followingId}:${followerId}`;
  await prisma.notification.upsert({
    where: { dedupeKey },
    create: {
      recipientId: followingId,
      actorId: followerId,
      type: 'NEW_FOLLOWER',
      dedupeKey,
    },
    update: {
      readAt: null,
      updatedAt: new Date(),
    },
  }).catch(() => undefined);

  return { following: true };
}

export async function unfollowUser(followerId: string, followingId: string) {
  await prisma.follow.deleteMany({
    where: { followerId, followingId },
  });

  const dedupeKey = `follow:${followingId}:${followerId}`;
  await prisma.notification.deleteMany({
    where: { dedupeKey, readAt: null },
  }).catch(() => undefined);

  return { following: false };
}
