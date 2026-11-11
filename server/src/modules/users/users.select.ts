import type { Prisma } from '@prisma/client';
import { resolveUserExperience, type ExperienceResolution } from './experience.resolver.js';

/**
 * Explicit field selections. Never select passwordHash or session data into
 * API responses: every response that contains a user must use one of these.
 */
export const professionalProfileSelect = {
  id: true,
  type: true,
  title: true,
  specialty: true,
  institution: true,
  licenseOrOrcidNumber: true,
  researchInterests: true,
  verificationStatus: true,
  verificationNote: true,
  verifiedAt: true,
} satisfies Prisma.ProfessionalProfileSelect;

/** Minimal author/actor summary used in feeds, comments, messages. */
export const userSummarySelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  professionalProfiles: {
    select: { type: true, verificationStatus: true, title: true },
    orderBy: { type: 'asc' },
  },
} satisfies Prisma.UserSelect;

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  role: true,
  createdAt: true,
  professionalProfiles: { select: professionalProfileSelect, orderBy: { type: 'asc' } },
} satisfies Prisma.UserSelect;

/** Current user's own view: includes e-mail (private to the owner). */
export const selfUserSelect = {
  ...publicUserSelect,
  email: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;
export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type SelfUserPayload = Prisma.UserGetPayload<{ select: typeof selfUserSelect }>;
export type SelfUser = SelfUserPayload & { experienceResolution: ExperienceResolution };

export function withExperienceResolution(user: SelfUserPayload): SelfUser {
  return {
    ...user,
    experienceResolution: resolveUserExperience(user),
  };
}
