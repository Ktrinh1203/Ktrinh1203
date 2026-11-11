import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import * as eegAccessService from './eeg-access.service.js';

export const eegDatasetsRouter = Router();

eegDatasetsRouter.use(requireAuth);

const createDatasetSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề bản ghi tối thiểu 3 ký tự').max(200),
  duration: z.string().trim().max(60).optional(),
  samplingRate: z.string().trim().max(40).optional(),
  channelsCount: z.number().int().min(1).max(256).optional(),
  montage: z.string().trim().max(200).optional(),
  filter: z.string().trim().max(160).optional(),
  clinicalNote: z.string().trim().max(1000).optional(),
});

const grantConsentSchema = z
  .object({
    professionalUsernameOrId: z.string().trim().min(1).optional(),
    professionalUsername: z.string().trim().min(1).optional(),
  })
  .refine((d) => Boolean(d.professionalUsernameOrId || d.professionalUsername), {
    message: 'Vui lòng nhập username hoặc ID chuyên gia',
  });

/**
 * GET /api/eeg-datasets/my
 * Lists personal EEG datasets owned by the authenticated user (General Mode: My EEG).
 */
eegDatasetsRouter.get('/my', async (req, res) => {
  const auth = getAuth(req);
  const datasets = await eegAccessService.getMyPersonalDatasets(auth.userId);
  res.json({ datasets });
});

/**
 * POST /api/eeg-datasets
 * Creates a new personal EEG dataset record owned by the authenticated user.
 */
eegDatasetsRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const input = createDatasetSchema.parse(req.body);
  const dataset = await eegAccessService.createPersonalDataset(auth.userId, input);
  res.status(201).json({ dataset });
});

/**
 * GET /api/eeg-datasets/workspace
 * Lists EEG datasets accessible to a verified professional in the EEG Workspace.
 * Independently enforces backend professional verification and explicit data-owner consent.
 */
eegDatasetsRouter.get('/workspace', async (req, res) => {
  const auth = getAuth(req);
  const datasets = await eegAccessService.getWorkspaceDatasetsForProfessional(auth.userId);
  res.json({ datasets });
});

/**
 * GET /api/eeg-datasets/:id
 * Retrieves a single EEG dataset record with strict ownership or verified professional + consent check.
 */
eegDatasetsRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const datasetId = z.string().trim().min(1).max(80).parse(req.params.id);
  const dataset = await eegAccessService.getDatasetByIdWithConsentCheck(datasetId, auth.userId);
  res.json({ dataset });
});

/**
 * POST /api/eeg-datasets/:id/consent
 * Grants explicit data-owner consent to a verified professional.
 */
eegDatasetsRouter.post('/:id/consent', async (req, res) => {
  const auth = getAuth(req);
  const datasetId = z.string().trim().min(1).max(80).parse(req.params.id);
  const input = grantConsentSchema.parse(req.body);
  const target = (input.professionalUsernameOrId ?? input.professionalUsername)!;
  const dataset = await eegAccessService.grantDatasetConsent(
    datasetId,
    auth.userId,
    target,
  );
  res.json({ dataset });
});

/**
 * DELETE /api/eeg-datasets/:id/consent/:professionalIdOrUsername
 * Revokes a professional's consent to access the patient's EEG dataset.
 */
eegDatasetsRouter.delete('/:id/consent/:professionalIdOrUsername', async (req, res) => {
  const auth = getAuth(req);
  const datasetId = z.string().trim().min(1).max(80).parse(req.params.id);
  const target = z.string().trim().min(1).max(80).parse(req.params.professionalIdOrUsername);
  const dataset = await eegAccessService.revokeDatasetConsent(datasetId, auth.userId, target);
  res.json({ dataset });
});
