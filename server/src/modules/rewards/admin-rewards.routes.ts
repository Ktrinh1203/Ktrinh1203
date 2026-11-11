import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAdmin } from '../../middleware/auth.js';
import { adminContributionsRouter } from '../contributions/contributions.routes.js';
import {
  adjustWalletSchema,
  createRewardCatalogSchema,
  reviewRedemptionSchema,
  updateRewardCatalogSchema,
} from './rewards.schemas.js';
import * as rewardsService from './rewards.service.js';

export const adminRewardsRouter = Router();

adminRewardsRouter.use(requireAdmin);

// Mount contributions queue under /api/admin/rewards/contributions
adminRewardsRouter.use('/contributions', adminContributionsRouter);

adminRewardsRouter.get('/overview', async (_req, res) => {
  const stats = await rewardsService.adminGetOverviewStats();
  res.json({ stats });
});

// Reward Catalog
adminRewardsRouter.get('/catalog', async (_req, res) => {
  const items = await rewardsService.adminGetCatalog();
  res.json({ items });
});

adminRewardsRouter.post('/catalog', async (req, res) => {
  const auth = getAuth(req);
  const input = createRewardCatalogSchema.parse(req.body);
  const reward = await rewardsService.adminCreateReward(auth.userId, input);
  res.status(201).json({ reward });
});

adminRewardsRouter.patch('/catalog/:id', async (req, res) => {
  const auth = getAuth(req);
  const rewardId = z.string().uuid().parse(req.params.id);
  const input = updateRewardCatalogSchema.parse(req.body);
  const reward = await rewardsService.adminUpdateReward(auth.userId, rewardId, input);
  res.json({ reward });
});

// Redemptions
adminRewardsRouter.get('/redemptions', async (req, res) => {
  const status = req.query.status as string | undefined;
  const redemptions = await rewardsService.adminGetRedemptions(status);
  res.json({ redemptions });
});

adminRewardsRouter.post('/redemptions/:id/decision', async (req, res) => {
  const auth = getAuth(req);
  const redemptionId = z.string().uuid().parse(req.params.id);
  const input = reviewRedemptionSchema.parse(req.body);
  const redemption = await rewardsService.adminReviewRedemption(auth.userId, redemptionId, input);
  res.json({ redemption });
});

// Wallets & Adjustments
adminRewardsRouter.get('/wallets', async (req, res) => {
  const search = req.query.search as string | undefined;
  const wallets = await rewardsService.adminGetWallets(search);
  res.json({ wallets });
});

adminRewardsRouter.post('/wallets/:id/adjust', async (req, res) => {
  const auth = getAuth(req);
  const walletId = z.string().uuid().parse(req.params.id);
  const input = adjustWalletSchema.parse(req.body);
  const result = await rewardsService.adminAdjustWallet(auth.userId, walletId, input);
  res.json(result);
});
