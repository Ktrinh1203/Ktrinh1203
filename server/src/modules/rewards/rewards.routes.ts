import { Router } from 'express';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { redeemRewardSchema } from './rewards.schemas.js';
import * as rewardsService from './rewards.service.js';

export const rewardsRouter = Router();

rewardsRouter.use(requireAuth);

rewardsRouter.get('/wallet', async (req, res) => {
  const auth = getAuth(req);
  const data = await rewardsService.getUserWalletWithHistory(auth.userId);
  res.json(data);
});

rewardsRouter.get('/catalog', async (req, res) => {
  const category = req.query.category as string | undefined;
  const items = await rewardsService.getActiveRewardCatalog(category);
  res.json({ items });
});

rewardsRouter.post('/redeem', async (req, res) => {
  const auth = getAuth(req);
  const input = redeemRewardSchema.parse(req.body);
  const result = await rewardsService.redeemReward(auth.userId, input);
  res.status(201).json(result);
});

rewardsRouter.get('/my-redemptions', async (req, res) => {
  const auth = getAuth(req);
  const redemptions = await rewardsService.getUserRedemptions(auth.userId);
  res.json({ redemptions });
});
