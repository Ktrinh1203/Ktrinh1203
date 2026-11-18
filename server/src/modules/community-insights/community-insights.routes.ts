import { Router } from 'express';
import * as communityInsightsService from './community-insights.service.js';

export const communityInsightsRouter = Router();

communityInsightsRouter.get('/spotlight', async (_req, res) => {
  const professionals = await communityInsightsService.getCommunitySpotlight();
  res.json({ professionals });
});
