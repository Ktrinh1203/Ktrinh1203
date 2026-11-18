import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  acceptConsultationReplySchema,
  createConsultationReplySchema,
  createConsultationSchema,
  listConsultationsQuerySchema,
} from './consultations.schemas.js';
import * as consultationsService from './consultations.service.js';

export const consultationsRouter = Router();

consultationsRouter.use(requireAuth);

consultationsRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listConsultationsQuerySchema.parse(req.query);
  const tickets = await consultationsService.listConsultations(auth.userId, query);
  res.json({ tickets });
});

consultationsRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const input = createConsultationSchema.parse(req.body);
  const result = await consultationsService.createConsultation(auth.userId, input);
  res.status(201).json(result);
});

consultationsRouter.post('/:id/claim', async (req, res) => {
  const auth = getAuth(req);
  const ticketId = z.string().uuid().parse(req.params.id);
  const ticket = await consultationsService.claimConsultation(auth.userId, ticketId);
  res.json({ ticket });
});

consultationsRouter.post('/:id/replies', async (req, res) => {
  const auth = getAuth(req);
  const ticketId = z.string().uuid().parse(req.params.id);
  const input = createConsultationReplySchema.parse(req.body);
  const result = await consultationsService.replyToConsultation(auth.userId, ticketId, input);
  res.status(201).json(result);
});

consultationsRouter.post('/:id/accept/:replyId', async (req, res) => {
  const auth = getAuth(req);
  const ticketId = z.string().uuid().parse(req.params.id);
  const replyId = z.string().uuid().parse(req.params.replyId);
  const input = acceptConsultationReplySchema.parse(req.body ?? {});
  const ticket = await consultationsService.acceptConsultationReply(
    auth.userId,
    ticketId,
    replyId,
    input.rating,
  );
  res.json({ ticket });
});
