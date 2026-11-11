import { prisma } from '../../lib/prisma.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { userSummarySelect } from '../users/users.select.js';
import type { CreatePostInput, GetPostsQuery, UpdatePostInput } from './posts.schemas.js';

interface UploadedFileSummary {
  filename: string;
  mimetype: string;
  size: number;
}

export function formatPost(
  post: {
    id: string;
    content: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    author: any;
    media: any[];
    _count: { likes: number; comments: number };
    likes?: { userId: string }[];
  },
  viewerId?: string,
) {
  const isLiked = post.likes ? post.likes.length > 0 : false;
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    media: post.media,
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    isLiked,
    isAuthor: viewerId === post.author.id,
  };
}

export async function createPost(
  authorId: string,
  input: CreatePostInput,
  files?: UploadedFileSummary[],
) {
  const post = await prisma.post.create({
    data: {
      authorId,
      content: input.content,
      media: files?.length
        ? {
            create: files.map((file, idx) => ({
              url: `/uploads/${file.filename}`,
              mimeType: file.mimetype,
              sizeBytes: file.size,
              position: idx,
            })),
          }
        : undefined,
    },
    include: {
      author: { select: userSummarySelect },
      media: {
        select: { id: true, url: true, mimeType: true, position: true },
        orderBy: { position: 'asc' },
      },
      _count: {
        select: {
          likes: true,
          comments: { where: { status: 'PUBLISHED' } },
        },
      },
    },
  });

  return formatPost(post, authorId);
}

export async function getPosts(query: GetPostsQuery, viewerId?: string) {
  const { cursor, limit, feedType, authorId } = query;

  let where: any = {
    status: 'PUBLISHED',
  };

  if (authorId) {
    where.authorId = authorId;
  } else if (feedType === 'following' && viewerId) {
    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    // Include user's own posts and following accounts
    where.authorId = { in: [...followingIds, viewerId] };
  }

  // Cursor-based pagination using Post.id (ordered by createdAt DESC, id DESC)
  let cursorObj: any = undefined;
  if (cursor) {
    cursorObj = { id: cursor };
  }

  const posts = await prisma.post.findMany({
    where,
    take: limit + 1, // Fetch +1 to check hasMore
    cursor: cursorObj,
    skip: cursor ? 1 : 0,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      author: { select: userSummarySelect },
      media: {
        select: { id: true, url: true, mimeType: true, position: true },
        orderBy: { position: 'asc' },
      },
      _count: {
        select: {
          likes: true,
          comments: { where: { status: 'PUBLISHED' } },
        },
      },
      likes: viewerId
        ? {
            where: { userId: viewerId },
            select: { userId: true },
          }
        : false,
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

  return {
    items: items.map((p) => formatPost(p, viewerId)),
    nextCursor,
    hasMore,
  };
}

export async function getPostById(postId: string, viewerId?: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    include: {
      author: { select: userSummarySelect },
      media: {
        select: { id: true, url: true, mimeType: true, position: true },
        orderBy: { position: 'asc' },
      },
      _count: {
        select: {
          likes: true,
          comments: { where: { status: 'PUBLISHED' } },
        },
      },
      likes: viewerId
        ? {
            where: { userId: viewerId },
            select: { userId: true },
          }
        : false,
    },
  });

  if (!post) throw notFound('Post not found');
  return formatPost(post, viewerId);
}

export async function updatePost(
  postId: string,
  userId: string,
  input: UpdatePostInput,
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true },
  });

  if (!post || post.status !== 'PUBLISHED') throw notFound('Post not found');
  if (post.authorId !== userId) throw forbidden('You can only edit your own posts');

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { content: input.content },
    include: {
      author: { select: userSummarySelect },
      media: {
        select: { id: true, url: true, mimeType: true, position: true },
        orderBy: { position: 'asc' },
      },
      _count: {
        select: {
          likes: true,
          comments: { where: { status: 'PUBLISHED' } },
        },
      },
      likes: {
        where: { userId },
        select: { userId: true },
      },
    },
  });

  return formatPost(updated, userId);
}

export async function deletePost(
  postId: string,
  userId: string,
  isAdmin = false,
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });

  if (!post) throw notFound('Post not found');
  if (post.authorId !== userId && !isAdmin) {
    throw forbidden('You can only delete your own posts');
  }

  await prisma.post.delete({ where: { id: postId } });
}
