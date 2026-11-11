import { z } from 'zod';

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required').max(80),
    bio: z
      .string()
      .trim()
      .max(1000)
      .transform((v) => (v === '' ? null : v))
      .nullable(),
  })
  .partial()
  // Unknown keys (e.g. role, verificationStatus, email) are rejected, not ignored silently.
  .strict();

export const userIdOrUsernameSchema = z.string().trim().min(1).max(64);

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
