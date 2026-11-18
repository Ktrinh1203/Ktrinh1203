import { z } from 'zod';
import { clinicalCategories } from '../neural-db/neural-db.schemas.js';

export const consultationStatuses = [
  'OPEN',
  'CLAIMED',
  'ANSWERED',
  'ACCEPTED',
  'CANCELLED',
] as const;

export const listConsultationsQuerySchema = z.object({
  scope: z.enum(['all', 'mine', 'queue']).optional().default('all'),
  clinicalCategory: z.enum(clinicalCategories).optional(),
  status: z.enum(consultationStatuses).optional(),
});

export const createConsultationSchema = z.object({
  title: z.string().trim().min(5, 'Tiêu đề ca tư vấn tối thiểu 5 ký tự').max(200),
  symptomSummary: z.string().trim().min(10, 'Mô tả triệu chứng tối thiểu 10 ký tự').max(2000),
  clinicalCategory: z.enum(clinicalCategories),
  bountyCredits: z.number().int().min(0).max(10000).default(50),
  datasetId: z.string().trim().min(1).max(80).optional(),
  neuralSampleId: z.string().uuid().optional(),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

export const createConsultationReplySchema = z.object({
  waveAnalysisText: z.string().trim().min(5, 'Phân tích sóng não tối thiểu 5 ký tự').max(5000),
  clinicalGuidanceText: z.string().trim().min(5, 'Hướng dẫn lâm sàng tối thiểu 5 ký tự').max(5000),
  recommendedFollowUp: z.string().trim().min(3, 'Khuyến nghị theo dõi tối thiểu 3 ký tự').max(500),
});

export type CreateConsultationReplyInput = z.infer<typeof createConsultationReplySchema>;

export const acceptConsultationReplySchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
});
