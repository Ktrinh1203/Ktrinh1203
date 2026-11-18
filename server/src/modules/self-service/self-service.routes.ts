import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  createCheckInSchema,
  createWorkBlockSchema,
  updateWorkBlockSchema,
} from './self-service.schemas.js';
import * as selfService from './self-service.service.js';

export const selfServiceRouter = Router();

selfServiceRouter.use(requireAuth);

selfServiceRouter.get('/overview', async (req, res) => {
  const auth = getAuth(req);
  const overview = await selfService.getSelfServiceOverview(auth.userId);
  res.json(overview);
});

selfServiceRouter.post('/check-ins', async (req, res) => {
  const auth = getAuth(req);
  const input = createCheckInSchema.parse(req.body);
  const checkIn = await selfService.addHealthCheckIn(auth.userId, input);
  res.status(201).json({ checkIn });
});

selfServiceRouter.post('/work-plan', async (req, res) => {
  const auth = getAuth(req);
  const input = createWorkBlockSchema.parse(req.body);
  const block = await selfService.addWorkPlanBlock(auth.userId, input);
  res.status(201).json({ block });
});

selfServiceRouter.patch('/work-plan/:id', async (req, res) => {
  const auth = getAuth(req);
  const blockId = z.string().uuid().parse(req.params.id);
  const input = updateWorkBlockSchema.parse(req.body);
  const block = await selfService.updateWorkPlanBlock(auth.userId, blockId, input);
  res.json({ block });
});

selfServiceRouter.delete('/work-plan/:id', async (req, res) => {
  const auth = getAuth(req);
  const blockId = z.string().uuid().parse(req.params.id);
  await selfService.deleteWorkPlanBlock(auth.userId, blockId);
  res.status(204).end();
});
