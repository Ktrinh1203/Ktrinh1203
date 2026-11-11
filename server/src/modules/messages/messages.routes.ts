import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import {
  getMessagesQuerySchema,
  sendMessageSchema,
  startConversationSchema,
} from './messages.schemas.js';
import * as messagesService from './messages.service.js';

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

// GET /api/conversations - List conversations
conversationsRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const conversations = await messagesService.getUserConversations(auth.userId);
  res.json({ conversations });
});

// POST /api/conversations - Start or get direct conversation
conversationsRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const input = startConversationSchema.parse(req.body);
  const conversation = await messagesService.getOrCreateConversation(auth.userId, input.targetUserId);
  res.status(201).json({ conversation });
});

// GET /api/conversations/:id - Get conversation details
conversationsRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const conversationId = z.string().uuid().parse(req.params.id);
  const conversation = await messagesService.getConversationDetails(conversationId, auth.userId);
  res.json({ conversation });
});

// GET /api/conversations/:id/messages - List messages in conversation
conversationsRouter.get('/:id/messages', async (req, res) => {
  const auth = getAuth(req);
  const conversationId = z.string().uuid().parse(req.params.id);
  const query = getMessagesQuerySchema.parse(req.query);
  const result = await messagesService.getConversationMessages(
    conversationId,
    auth.userId,
    query.cursor,
    query.limit,
  );
  res.json(result);
});

// POST /api/conversations/:id/messages - Send message in conversation
conversationsRouter.post('/:id/messages', writeLimiter, async (req, res) => {
  const auth = getAuth(req);
  const conversationId = z.string().uuid().parse(req.params.id);
  const input = sendMessageSchema.parse(req.body);
  const message = await messagesService.sendMessage(conversationId, auth.userId, input.content);
  res.status(201).json({ message });
});
