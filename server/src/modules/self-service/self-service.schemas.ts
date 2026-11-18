import { z } from 'zod';

export const workBlockTypes = [
  'DEEP_WORK',
  'LIGHT_ADMIN',
  'NEURO_RECOVERY',
  'SLEEP_TARGET',
  'CLINICAL_CHECK',
] as const;

export const createCheckInSchema = z.object({
  neuralSampleId: z.string().uuid().optional(),
  focusScore: z.number().int().min(0).max(100),
  fatigueIndexTar: z.number().finite().min(0).max(50),
  hemisphericBsi: z.number().finite().min(0).max(1),
  alphaPeakHz: z.number().finite().min(4).max(20),
  sleepHours: z.number().finite().min(0).max(24),
  stressLevel: z.number().int().min(1).max(10),
  notes: z.string().trim().max(1000).default(''),
});

export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;

export const createWorkBlockSchema = z.object({
  dayOfWeek: z.string().trim().min(2).max(24),
  timeSlot: z.string().trim().min(2).max(40),
  title: z.string().trim().min(2, 'Tên khối công việc tối thiểu 2 ký tự').max(160),
  blockType: z.enum(workBlockTypes),
  eegRationale: z.string().trim().min(2, 'Cơ sở sinh lý EEG tối thiểu 2 ký tự').max(500),
});

export type CreateWorkBlockInput = z.infer<typeof createWorkBlockSchema>;

export const updateWorkBlockSchema = createWorkBlockSchema.partial().extend({
  completed: z.boolean().optional(),
});

export type UpdateWorkBlockInput = z.infer<typeof updateWorkBlockSchema>;
