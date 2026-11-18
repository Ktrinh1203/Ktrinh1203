import { z } from 'zod';

export const clinicalCategories = [
  'VASCULAR_STROKE',
  'EPILEPSY_ICU',
  'SLEEP_COGNITIVE',
  'HARDWARE_BCI',
] as const;

export const neuralLabels = [
  'CONTROL',
  'ISCHEMIC_STROKE',
  'HEMORRHAGIC_STROKE',
  'EPILEPTIFORM_SLOWING',
  'COGNITIVE_FATIGUE',
] as const;

export const datasetSplits = ['TRAIN', 'VALIDATION', 'TEST', 'EXTERNAL_HOLDOUT'] as const;

export const createNeuralSampleSchema = z.object({
  datasetId: z.string().trim().min(1).max(80).optional(),
  subjectCode: z.string().trim().min(2, 'Mã định danh ẩn danh tối thiểu 2 ký tự').max(60),
  clinicalCategory: z.enum(clinicalCategories),
  groundTruthLabel: z.enum(neuralLabels),
  split: z.enum(datasetSplits).default('TRAIN'),
  samplingRateHz: z.number().int().min(50).max(4000).default(500),
  channelsCount: z.number().int().min(1).max(256).default(6),
  montage: z.string().trim().min(2).max(200).default('F3, F4, C3, C4, O1, O2 (10-20)'),
  signalQualityScore: z.number().finite().min(0).max(1).default(0.95),
  dar: z.number().finite().min(0).max(500),
  bsi: z.number().finite().min(0).max(1),
  tar: z.number().finite().min(0).max(500),
  pri: z.number().finite().min(0).max(500).default(0),
  wpli: z.number().finite().min(0).max(1).default(0.3),
  tpaLockoutTriggered: z.boolean().default(false),
  spectralBands: z.object({
    delta: z.number().finite().min(0),
    theta: z.number().finite().min(0),
    alpha: z.number().finite().min(0),
    beta: z.number().finite().min(0),
  }),
  featureVector: z.array(z.number().finite()).min(1, 'Thiếu vector đặc trưng').max(256),
  waveformPreview: z.object({
    time: z.array(z.number().finite()).max(1000),
    channels: z.array(z.string().trim().min(1)).max(32),
    filtered: z.record(z.string(), z.array(z.number().finite()).max(1000)),
  }),
  deidentifiedConfirmed: z.boolean().refine((val) => val === true, {
    message: 'Bắt buộc xác nhận bản ghi đã khử danh tính cá nhân (deidentifiedConfirmed = true).',
  }),
});

export type CreateNeuralSampleInput = z.infer<typeof createNeuralSampleSchema>;

export const listNeuralSamplesQuerySchema = z.object({
  clinicalCategory: z.enum(clinicalCategories).optional(),
  groundTruthLabel: z.enum(neuralLabels).optional(),
  split: z.enum(datasetSplits).optional(),
  verifiedOnly: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export const verifyNeuralSampleSchema = z.object({
  groundTruthLabel: z.enum(neuralLabels).optional(),
  split: z.enum(datasetSplits).optional(),
});

export const exportNeuralDbQuerySchema = z.object({
  format: z.enum(['csv', 'jsonl']).default('csv'),
  clinicalCategory: z.enum(clinicalCategories).optional(),
  split: z.enum(datasetSplits).optional(),
});
