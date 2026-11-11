import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { uploadMedia } from '../../middleware/upload.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import {
  createPostSchema,
  getPostsQuerySchema,
  updatePostSchema,
} from './posts.schemas.js';
import * as postsService from './posts.service.js';
import * as interactionsService from './interactions.service.js';

export const postsRouter = Router();

const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment exceeds 2000 characters'),
});

const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment exceeds 2000 characters'),
});

// GET /api/posts - Fetch feed
postsRouter.get('/', async (req, res) => {
  const query = getPostsQuerySchema.parse(req.query);
  const result = await postsService.getPosts(query, req.auth?.userId);
  res.json(result);
});

// POST /api/posts - Create post with optional media
postsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  uploadMedia.array('media', 4),
  async (req, res) => {
    const auth = getAuth(req);
    const input = createPostSchema.parse(req.body);
    const files = req.files as Express.Multer.File[] | undefined;

    const fileSummaries = files?.map((f) => ({
      filename: f.filename,
      mimetype: f.mimetype,
      size: f.size,
    }));

    const post = await postsService.createPost(auth.userId, input, fileSummaries);
    res.status(201).json({ post });
  },
);

// GET /api/posts/:id - Single post
postsRouter.get('/:id', async (req, res) => {
  const postId = z.string().uuid().parse(req.params.id);
  const post = await postsService.getPostById(postId, req.auth?.userId);
  res.json({ post });
});

// PATCH /api/posts/:id - Edit post
postsRouter.patch('/:id', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const postId = z.string().uuid().parse(req.params.id);
  const input = updatePostSchema.parse(req.body);
  const post = await postsService.updatePost(postId, auth.userId, input);
  res.json({ post });
});

// DELETE /api/posts/:id - Delete post
postsRouter.delete('/:id', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const postId = z.string().uuid().parse(req.params.id);
  const isAdmin = auth.role === 'ADMIN';
  await postsService.deletePost(postId, auth.userId, isAdmin);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

postsRouter.post('/:id/like', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const postId = z.string().uuid().parse(req.params.id);
  const result = await interactionsService.likePost(postId, auth.userId);
  res.json(result);
});

postsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const postId = z.string().uuid().parse(req.params.id);
  const result = await interactionsService.unlikePost(postId, auth.userId);
  res.json(result);
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

postsRouter.get('/:id/comments', async (req, res) => {
  const postId = z.string().uuid().parse(req.params.id);
  const comments = await interactionsService.getComments(postId, req.auth?.userId);
  res.json({ comments });
});

postsRouter.post('/:id/comments', requireAuth, writeLimiter, async (req, res) => {
  const auth = getAuth(req);
  const postId = z.string().uuid().parse(req.params.id);
  const input = createCommentSchema.parse(req.body);
  const comment = await interactionsService.createComment(postId, auth.userId, input.content);
  res.status(201).json({ comment });
});

postsRouter.patch('/comments/:commentId', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const commentId = z.string().uuid().parse(req.params.commentId);
  const input = updateCommentSchema.parse(req.body);
  const comment = await interactionsService.updateComment(commentId, auth.userId, input.content);
  res.json({ comment });
});

postsRouter.delete('/comments/:commentId', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const commentId = z.string().uuid().parse(req.params.commentId);
  const isAdmin = auth.role === 'ADMIN';
  await interactionsService.deleteComment(commentId, auth.userId, isAdmin);
  res.status(204).end();
});
