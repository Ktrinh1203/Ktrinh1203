import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  createDataBankListingSchema,
  listDataBankQuerySchema,
} from './databank.schemas.js';
import * as dataBankService from './databank.service.js';

export const databankRouter = Router();

databankRouter.use(requireAuth);

databankRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listDataBankQuerySchema.parse(req.query);
  const listings = await dataBankService.listDataBankListings(auth.userId, query);
  res.json({ listings });
});

databankRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const listingId = z.string().uuid().parse(req.params.id);
  const listing = await dataBankService.getDataBankListingById(listingId, auth.userId);
  res.json({ listing });
});

databankRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const input = createDataBankListingSchema.parse(req.body);
  const listing = await dataBankService.createDataBankListing(auth.userId, input);
  res.status(201).json({ listing });
});

databankRouter.post('/:id/purchase', async (req, res) => {
  const auth = getAuth(req);
  const listingId = z.string().uuid().parse(req.params.id);
  const result = await dataBankService.purchaseDataBankListing(auth.userId, listingId);
  res.json(result);
});
