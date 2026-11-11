import { z } from 'zod';

export const createReportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER']),
  targetId: z.string().uuid(),
  reason: z.enum(['SPAM', 'HARASSMENT', 'MISINFORMATION', 'INAPPROPRIATE', 'IMPERSONATION', 'OTHER']),
  details: z.string().trim().max(1000).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(500).optional(),
  action: z.enum(['NONE', 'HIDE_CONTENT', 'DELETE_CONTENT']).default('NONE'),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
