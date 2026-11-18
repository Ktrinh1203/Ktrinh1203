import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  createNeuralSampleSchema,
  exportNeuralDbQuerySchema,
  listNeuralSamplesQuerySchema,
  verifyNeuralSampleSchema,
} from './neural-db.schemas.js';
import * as neuralDbService from './neural-db.service.js';

export const neuralDbRouter = Router();

neuralDbRouter.use(requireAuth);

neuralDbRouter.get('/stats', async (_req, res) => {
  const stats = await neuralDbService.getNeuralDbStats();
  res.json(stats);
});

neuralDbRouter.get('/samples', async (req, res) => {
  const query = listNeuralSamplesQuerySchema.parse(req.query);
  const samples = await neuralDbService.listNeuralSamples(query);
  res.json({ samples });
});

neuralDbRouter.post('/samples', async (req, res) => {
  const auth = getAuth(req);
  const input = createNeuralSampleSchema.parse(req.body);
  const sample = await neuralDbService.createNeuralSample(auth.userId, input);
  res.status(201).json({ sample });
});

neuralDbRouter.patch('/samples/:id/verify', async (req, res) => {
  const auth = getAuth(req);
  const sampleId = z.string().uuid().parse(req.params.id);
  const input = verifyNeuralSampleSchema.parse(req.body ?? {});
  const sample = await neuralDbService.verifyNeuralSample(auth.userId, sampleId, input);
  res.json({ sample });
});

neuralDbRouter.get('/export', async (req, res) => {
  const query = exportNeuralDbQuerySchema.parse(req.query);
  const exported = await neuralDbService.exportNeuralDataset(query);
  res.setHeader('Content-Type', exported.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
  res.send(exported.body);
});
