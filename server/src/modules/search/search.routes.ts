import { Router } from 'express';
import { z } from 'zod';
import * as searchService from './search.service.js';

export const searchRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(['HEALTHCARE_PROFESSIONAL', 'RESEARCHER']).optional(),
  specialty: z.string().trim().max(100).optional(),
  category: z.enum(['all', 'users', 'professionals', 'posts']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

searchRouter.get('/', async (req, res) => {
  const filter = searchQuerySchema.parse(req.query);
  const results = await searchService.search(filter, req.auth?.userId);
  res.json(results);
});
