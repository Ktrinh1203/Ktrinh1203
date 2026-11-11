import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import * as communitiesService from './communities.service.js';

export const communitiesRouter = Router();

communitiesRouter.use(requireAuth);

const listQuerySchema = z.object({
  category: z.string().trim().max(40).optional(),
  q: z.string().trim().max(120).optional(),
});

/**
 * GET /api/communities
 * Shared API contract for both General Mode (Patient & Wellness Communities)
 * and Professional Mode (Specialty Boards & Research Consortia).
 */
communitiesRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listQuerySchema.parse(req.query);
  const communities = await communitiesService.listCommunities(auth.userId, query);
  res.json({ communities });
});

/**
 * POST /api/communities/:id/join
 * Joins a community; enforces backend `assertVerifiedProfessional` for `isVerifiedOnly` boards.
 */
communitiesRouter.post('/:id/join', async (req, res) => {
  const auth = getAuth(req);
  const id = z.string().trim().min(1).max(80).parse(req.params.id);
  const community = await communitiesService.joinCommunity(id, auth.userId);
  res.json({ community });
});

/**
 * DELETE /api/communities/:id/join
 * Leaves a community.
 */
communitiesRouter.delete('/:id/join', async (req, res) => {
  const auth = getAuth(req);
  const id = z.string().trim().min(1).max(80).parse(req.params.id);
  const community = await communitiesService.leaveCommunity(id, auth.userId);
  res.json({ community });
});
