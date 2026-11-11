import { z } from 'zod';

export const upsertProfessionalProfileSchema = z.object({
  type: z.enum(['HEALTHCARE_PROFESSIONAL', 'RESEARCHER']),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120),
  specialty: z.string().trim().min(2, 'Specialty/Field must be at least 2 characters').max(120),
  institution: z.string().trim().max(160).optional().nullable(),
  licenseOrOrcidNumber: z.string().trim().max(100).optional().nullable(),
  researchInterests: z.array(z.string().trim().min(1).max(50)).max(15).default([]),
  requestVerification: z.boolean().default(false),
});

export const adminVerifyProfileSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'PENDING']),
  note: z.string().trim().max(500).optional(),
});

export type UpsertProfessionalProfileInput = z.infer<typeof upsertProfessionalProfileSchema>;
export type AdminVerifyProfileInput = z.infer<typeof adminVerifyProfileSchema>;
