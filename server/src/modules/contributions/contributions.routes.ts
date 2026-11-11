import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAdmin, requireAuth } from '../../middleware/auth.js';
import {
  createContributionSchema,
  resubmitContributionSchema,
  reviewContributionSchema,
} from './contributions.schemas.js';
import * as contributionService from './contributions.service.js';

export const contributionsRouter = Router();
export const adminContributionsRouter = Router();

// ============================================================================
// User Endpoints (/api/contributions)
// ============================================================================

contributionsRouter.use(requireAuth);

contributionsRouter.get('/eligible-posts', async (req, res) => {
  const auth = getAuth(req);
  const posts = await contributionService.getEligiblePostsForContribution(auth.userId);
  res.json({ posts });
});

contributionsRouter.get('/my', async (req, res) => {
  const auth = getAuth(req);
  const contributions = await contributionService.getMyContributions(auth.userId);
  res.json({ contributions });
});

contributionsRouter.get('/publications', async (_req, res) => {
  const contributions = await contributionService.listPublicContributions();
  res.json({ contributions });
});

contributionsRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const contributionId = z.string().uuid().parse(req.params.id);
  const contribution = await contributionService.getContributionById(
    contributionId,
    auth.userId,
    auth.role,
  );
  res.json({ contribution });
});

contributionsRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const input = createContributionSchema.parse(req.body);
  const contribution = await contributionService.createContribution(auth.userId, input);
  res.status(201).json({ contribution });
});

contributionsRouter.patch('/:id/resubmit', async (req, res) => {
  const auth = getAuth(req);
  const contributionId = z.string().uuid().parse(req.params.id);
  const input = resubmitContributionSchema.parse(req.body);
  const contribution = await contributionService.resubmitContribution(
    auth.userId,
    contributionId,
    input,
  );
  res.json({ contribution });
});

contributionsRouter.post('/:id/withdraw', async (req, res) => {
  const auth = getAuth(req);
  const contributionId = z.string().uuid().parse(req.params.id);
  const contribution = await contributionService.withdrawContribution(auth.userId, contributionId);
  res.json({ contribution });
});

// ============================================================================
// Admin Endpoints (/api/admin/rewards/contributions)
// ============================================================================

adminContributionsRouter.use(requireAdmin);

adminContributionsRouter.get('/', async (req, res) => {
  const status = req.query.status as any;
  const category = req.query.category as any;
  const contributions = await contributionService.adminListContributions({ status, category });
  res.json({ contributions });
});

adminContributionsRouter.post('/:id/claim', async (req, res) => {
  const auth = getAuth(req);
  const contributionId = z.string().uuid().parse(req.params.id);
  const contribution = await contributionService.adminClaimContribution(auth.userId, contributionId);
  res.json({ contribution });
});

adminContributionsRouter.post('/:id/review', async (req, res) => {
  const auth = getAuth(req);
  const contributionId = z.string().uuid().parse(req.params.id);
  const input = reviewContributionSchema.parse(req.body);
  const contribution = await contributionService.adminReviewContribution(
    auth.userId,
    contributionId,
    input,
  );
  res.json({ contribution });
});
