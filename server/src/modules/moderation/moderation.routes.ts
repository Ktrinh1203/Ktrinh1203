import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAdmin, requireAuth } from '../../middleware/auth.js';
import { createReportSchema, resolveReportSchema } from './moderation.schemas.js';
import * as moderationService from './moderation.service.js';
import * as professionalService from '../users/professional.service.js';
import { adminVerifyProfileSchema } from '../users/professional.schemas.js';

export const reportsRouter = Router();
export const adminRouter = Router();

// Any logged-in user can submit a report
reportsRouter.post('/', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const input = createReportSchema.parse(req.body);
  const report = await moderationService.createReport(auth.userId, input);
  res.status(201).json({ report });
});

// Admin-only endpoints
adminRouter.use(requireAdmin);

adminRouter.get('/reports', async (req, res) => {
  const status = req.query.status as any;
  const reports = await moderationService.getReports(status);
  res.json({ reports });
});

adminRouter.patch('/reports/:id', async (req, res) => {
  const auth = getAuth(req);
  const reportId = z.string().uuid().parse(req.params.id);
  const input = resolveReportSchema.parse(req.body);
  const report = await moderationService.resolveReport(reportId, auth.userId, input);
  res.json({ report });
});

adminRouter.get('/verifications', async (_req, res) => {
  const profiles = await professionalService.adminGetPendingVerifications();
  res.json({ profiles });
});

adminRouter.patch('/verifications/:id', async (req, res) => {
  const auth = getAuth(req);
  const profileId = z.string().uuid().parse(req.params.id);
  const input = adminVerifyProfileSchema.parse(req.body);
  const profile = await professionalService.adminVerifyProfile(profileId, auth.userId, input);
  res.json({ profile });
});
