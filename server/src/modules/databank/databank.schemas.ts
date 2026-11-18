import { z } from 'zod';
import { clinicalCategories } from '../neural-db/neural-db.schemas.js';

export const listDataBankQuerySchema = z.object({
  clinicalCategory: z.enum(clinicalCategories).optional(),
  q: z.string().trim().max(120).optional(),
});

export const createDataBankListingSchema = z.object({
  datasetId: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(5, 'Tiêu đề gói dữ liệu tối thiểu 5 ký tự').max(220),
  summary: z.string().trim().min(10, 'Mô tả tóm tắt tối thiểu 10 ký tự').max(2000),
  clinicalCategory: z.enum(clinicalCategories),
  methodologyNote: z.string().trim().min(10, 'Ghi chú phương pháp thu thập tối thiểu 10 ký tự').max(10000),
  sampleCount: z.number().int().min(1).max(1_000_000),
  channelsSpec: z.string().trim().min(2).max(160),
  samplingRateHz: z.number().int().min(50).max(10000),
  priceCredits: z.number().int().min(0).max(100000),
  previewMetrics: z.object({
    meanDar: z.number().finite(),
    meanBsi: z.number().finite(),
    meanTar: z.number().finite(),
    meanWpli: z.number().finite(),
    dominantBand: z.string().trim().min(1).max(60),
  }),
  payloadCsv: z.string().min(5, 'Nội dung CSV dữ liệu không được để trống').max(1_800_000),
});

export type CreateDataBankListingInput = z.infer<typeof createDataBankListingSchema>;
