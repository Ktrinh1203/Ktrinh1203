import { prisma } from '../../lib/prisma.js';
import { AppError, forbidden, notFound } from '../../lib/errors.js';
import { professionalProfileSelect } from './users.select.js';
import type { AdminVerifyProfileInput, UpsertProfessionalProfileInput } from './professional.schemas.js';

export async function upsertProfessionalProfile(
  userId: string,
  input: UpsertProfessionalProfileInput,
) {
  // Existing profile check
  const existing = await prisma.professionalProfile.findUnique({
    where: { userId_type: { userId, type: input.type } },
  });

  const nextInstitution = input.institution || null;
  const nextLicense =
    input.licenseOrOrcidNumber !== undefined
      ? input.licenseOrOrcidNumber || null
      : (existing?.licenseOrOrcidNumber ?? null);

  // Check if core credential claims changed on an already-verified profile
  const credentialsChanged =
    Boolean(existing) &&
    (existing!.title !== input.title ||
      existing!.specialty !== input.specialty ||
      (existing!.institution ?? null) !== nextInstitution ||
      (existing!.licenseOrOrcidNumber ?? null) !== nextLicense);

  // SECURITY INVARIANT: Users can never self-approve or retain VERIFIED status if core credentials are changed
  let verificationStatus = existing?.verificationStatus ?? 'UNVERIFIED';
  let resetVerificationMeta = false;

  if (existing?.verificationStatus === 'VERIFIED' && credentialsChanged) {
    verificationStatus = 'PENDING';
    resetVerificationMeta = true;
  } else if (input.requestVerification && verificationStatus !== 'VERIFIED') {
    verificationStatus = 'PENDING';
  }

  const profile = await prisma.professionalProfile.upsert({
    where: { userId_type: { userId, type: input.type } },
    create: {
      userId,
      type: input.type,
      title: input.title,
      specialty: input.specialty,
      institution: nextInstitution,
      licenseOrOrcidNumber: nextLicense,
      researchInterests: input.researchInterests,
      verificationStatus,
    },
    update: {
      title: input.title,
      specialty: input.specialty,
      institution: nextInstitution,
      licenseOrOrcidNumber: nextLicense,
      researchInterests: input.researchInterests,
      verificationStatus,
      ...(resetVerificationMeta ? { verifiedAt: null, verifiedById: null } : {}),
    },
    select: professionalProfileSelect,
  });

  return profile;
}

export async function deleteProfessionalProfile(userId: string, type: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER') {
  const existing = await prisma.professionalProfile.findUnique({
    where: { userId_type: { userId, type } },
  });
  if (!existing) throw notFound('Professional profile not found');

  await prisma.professionalProfile.delete({
    where: { userId_type: { userId, type } },
  });
}

export async function adminVerifyProfile(
  profileId: string,
  adminId: string,
  input: AdminVerifyProfileInput,
) {
  const existing = await prisma.professionalProfile.findUnique({
    where: { id: profileId },
  });
  if (!existing) throw notFound('Professional profile not found');

  if (existing.userId === adminId) {
    throw new AppError(
      403,
      'SELF_VERIFICATION_PROHIBITED',
      'Administrators cannot verify their own professional profiles',
    );
  }

  const updated = await prisma.professionalProfile.update({
    where: { id: profileId },
    data: {
      verificationStatus: input.status,
      verificationNote: input.note || null,
      verifiedById: input.status === 'VERIFIED' ? adminId : null,
      verifiedAt: input.status === 'VERIFIED' ? new Date() : null,
    },
    select: {
      ...professionalProfileSelect,
      verificationNote: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return updated;
}

export async function adminGetPendingVerifications() {
  const list = await prisma.professionalProfile.findMany({
    where: { verificationStatus: { in: ['PENDING', 'UNVERIFIED'] } },
    orderBy: { updatedAt: 'desc' },
    select: {
      ...professionalProfileSelect,
      verificationNote: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
    },
  });

  return list;
}
