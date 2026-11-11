import { z } from 'zod';

export const contributionCategories = [
  'HEALTHCARE_EDUCATION',
  'RESEARCH_CONTRIBUTION',
  'EXPERT_QA',
  'RESEARCH_DISCUSSION',
  'EDUCATIONAL_RESOURCE',
] as const;

export const createContributionSchema = z.object({
  postId: z.string().uuid('ID bài viết không hợp lệ'),
  category: z.enum(contributionCategories, {
    errorMap: () => ({ message: 'Vui lòng chọn danh mục đóng góp chuyên môn hợp lệ' }),
  }),
  summary: z
    .string()
    .trim()
    .min(10, 'Mô tả tóm tắt giá trị đóng góp tối thiểu 10 ký tự')
    .max(1000, 'Mô tả tối đa 1000 ký tự'),
});

export type CreateContributionInput = z.infer<typeof createContributionSchema>;

export const resubmitContributionSchema = z.object({
  category: z.enum(contributionCategories).optional(),
  summary: z
    .string()
    .trim()
    .min(10, 'Mô tả tóm tắt giá trị đóng góp tối thiểu 10 ký tự')
    .max(1000, 'Mô tả tối đa 1000 ký tự'),
});

export type ResubmitContributionInput = z.infer<typeof resubmitContributionSchema>;

export const reviewContributionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_REVISION'], {
      errorMap: () => ({ message: 'Quyết định xét duyệt phải là APPROVE, REJECT hoặc REQUEST_REVISION' }),
    }),
    scoreAccuracy: z.number().int().min(1).max(5).default(1),
    scoreRelevance: z.number().int().min(1).max(5).default(1),
    scoreUsefulness: z.number().int().min(1).max(5).default(1),
    scoreOriginality: z.number().int().min(1).max(5).default(1),
    scoreImpact: z.number().int().min(1).max(5).default(1),
    awardedCredits: z.number().int().min(0).max(10000).default(0),
    feedback: z
      .string()
      .trim()
      .min(5, 'Phản hồi đánh giá tối thiểu 5 ký tự')
      .max(1500, 'Phản hồi tối đa 1500 ký tự'),
    supportingEvidence: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'APPROVE' && data.awardedCredits <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['awardedCredits'],
        message: 'Khi phê duyệt đóng góp, số tín chỉ khen thưởng phải lớn hơn 0',
      });
    }
  });

export type ReviewContributionInput = z.infer<typeof reviewContributionSchema>;
