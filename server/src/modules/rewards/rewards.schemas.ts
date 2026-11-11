import { z } from 'zod';

export const rewardCategories = [
  'MONETARY_REWARD',
  'PROFESSIONAL_COURSE',
  'CONFERENCE_ACCESS',
  'ACADEMIC_RESOURCE',
  'MENTORING',
  'PROFESSIONAL_EVENT',
  'OTHER_BENEFIT',
] as const;

export const redeemRewardSchema = z.object({
  rewardId: z.string().uuid('ID phần thưởng không hợp lệ'),
  userNote: z.string().trim().max(1000).optional(),
});

export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;

export const createRewardCatalogSchema = z.object({
  name: z.string().trim().min(3, 'Tên phần thưởng tối thiểu 3 ký tự').max(160),
  description: z.string().trim().min(10, 'Mô tả phần thưởng tối thiểu 10 ký tự').max(2000),
  category: z.enum(rewardCategories),
  creditCost: z.number().int().min(1, 'Số tín chỉ quy đổi phải lớn hơn 0'),
  stockQuantity: z.number().int().min(1).nullable().optional(),
  eligibilityReq: z.string().trim().max(500).optional(),
  terms: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  isMonetary: z.boolean().default(false),
  payoutEnabled: z.boolean().default(false),
});

export type CreateRewardCatalogInput = z.infer<typeof createRewardCatalogSchema>;

export const updateRewardCatalogSchema = createRewardCatalogSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateRewardCatalogInput = z.infer<typeof updateRewardCatalogSchema>;

export const reviewRedemptionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FULFILL', 'CANCEL']),
  adminNote: z.string().trim().max(1000).optional(),
  fulfillmentInfo: z.string().trim().max(1500).optional(),
});

export type ReviewRedemptionInput = z.infer<typeof reviewRedemptionSchema>;

export const adjustWalletSchema = z.object({
  amount: z.number().int().refine((val) => val !== 0, 'Số lượng tín chỉ điều chỉnh phải khác 0'),
  reason: z.string().trim().min(5, 'Lý do điều chỉnh ví bắt buộc tối thiểu 5 ký tự').max(500),
});

export type AdjustWalletInput = z.infer<typeof adjustWalletSchema>;
