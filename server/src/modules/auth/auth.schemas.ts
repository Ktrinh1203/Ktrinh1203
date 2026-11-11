import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Username may contain only letters, numbers and underscores');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain letters and numbers');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid e-mail address').max(254),
  username: usernameSchema,
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  password: passwordSchema,
});

export const loginSchema = z.object({
  /** E-mail or username */
  identifier: z.string().trim().toLowerCase().min(1, 'E-mail or username is required').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
