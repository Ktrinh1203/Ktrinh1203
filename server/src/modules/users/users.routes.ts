import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { updateMeSchema, userIdOrUsernameSchema } from './users.schemas.js';
import * as usersService from './users.service.js';
import * as professionalService from './professional.service.js';
import { upsertProfessionalProfileSchema } from './professional.schemas.js';
import * as interactionsService from '../posts/interactions.service.js';
import * as postsService from '../posts/posts.service.js';
import { getPostsQuerySchema } from '../posts/posts.schemas.js';

export const usersRouter = Router();

// Follow / Unfollow
usersRouter.post('/:id/follow', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const followingId = z.string().uuid().parse(req.params.id);
  const result = await interactionsService.followUser(auth.userId, followingId);
  res.json(result);
});

usersRouter.delete('/:id/follow', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const followingId = z.string().uuid().parse(req.params.id);
  const result = await interactionsService.unfollowUser(auth.userId, followingId);
  res.json(result);
});

// User posts
usersRouter.get('/:id/posts', async (req, res) => {
  const authorId = z.string().uuid().parse(req.params.id);
  const query = getPostsQuerySchema.parse({ ...req.query, authorId });
  const result = await postsService.getPosts(query, req.auth?.userId);
  res.json(result);
});

// Professional capability management (doctors / researchers)
usersRouter.post('/me/professional', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const input = upsertProfessionalProfileSchema.parse(req.body);
  const profile = await professionalService.upsertProfessionalProfile(auth.userId, input);
  res.json({ profile });
});

usersRouter.delete('/me/professional/:type', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const type = z.enum(['HEALTHCARE_PROFESSIONAL', 'RESEARCHER']).parse(req.params.type);
  await professionalService.deleteProfessionalProfile(auth.userId, type);
  res.status(204).end();
});

// NOTE: /me routes must be declared before /:idOrUsername.
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const input = updateMeSchema.parse(req.body);
  const user = await usersService.updateMe(auth.userId, input);
  res.json({ user });
});

usersRouter.get('/:idOrUsername', requireAuth, async (req, res) => {
  const idOrUsername = userIdOrUsernameSchema.parse(req.params.idOrUsername);
  const user = await usersService.getProfile(idOrUsername, req.auth?.userId);
  res.json({ user });
});
