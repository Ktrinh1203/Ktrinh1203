import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import * as notificationsService from './notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const result = await notificationsService.getNotifications(auth.userId, limit);
  res.json(result);
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  const auth = getAuth(req);
  const id = z.string().uuid().parse(req.params.id);
  const result = await notificationsService.markNotificationRead(id, auth.userId);
  res.json(result);
});

notificationsRouter.post('/read-all', async (req, res) => {
  const auth = getAuth(req);
  const result = await notificationsService.markAllNotificationsRead(auth.userId);
  res.json(result);
});
