import type { ProfessionalType, Role, VerificationStatus } from '@prisma/client';

export type LogicalAccountRole =
  | 'GENERAL_USER'
  | 'DOCTOR'
  | 'HEALTHCARE_WORKER'
  | 'RESEARCHER'
  | 'RESEARCH_STUDENT';

export type ExperienceMode = 'GENERAL_MODE' | 'PROFESSIONAL_MODE';

export interface ProfileForResolution {
  id?: string;
  type: ProfessionalType;
  title: string;
  specialty: string;
  institution?: string | null;
  verificationStatus: VerificationStatus;
  verificationNote?: string | null;
}

export interface UserForResolution {
  id?: string;
  role?: Role;
  professionalProfiles: ProfileForResolution[];
}

export interface ExperienceResolution {
  experience: ExperienceMode;
  mode: 'general' | 'professional';
  accountRole: LogicalAccountRole;
  allRoles: LogicalAccountRole[];
  verificationStatus: VerificationStatus;
  canAccessProfessionalMode: boolean;
  enableVerificationCenter: boolean;
  enableResubmission: boolean;
  isDualRoleProfessional: boolean;
}

/**
 * Maps a single ProfessionalProfile into one of the canonical logical roles:
 * - HEALTHCARE_PROFESSIONAL -> DOCTOR or HEALTHCARE_WORKER
 * - RESEARCHER              -> RESEARCHER or RESEARCH_STUDENT
 *
 * This preserves the existing 2-enum schema (HEALTHCARE_PROFESSIONAL | RESEARCHER)
 * without creating duplicate database account types.
 */
export function classifyProfileLogicalRole(
  profile: Pick<ProfileForResolution, 'type' | 'title' | 'specialty'>,
): LogicalAccountRole {
  const combined = `${profile.title} ${profile.specialty}`.toLowerCase();

  if (profile.type === 'HEALTHCARE_PROFESSIONAL') {
    const isHealthcareWorker =
      /điều dưỡng|kỹ thuật viên|ktv|dược sĩ|nhân viên y tế|chuyên viên y tế|y sĩ|hộ sinh|phục hồi chức năng|nurse|technician|pharmacist|therapist|healthcare worker|clinical staff/i.test(
        combined,
      ) && !/bác sĩ|bs\.|bs |md|doctor|physician/i.test(profile.title.toLowerCase());

    return isHealthcareWorker ? 'HEALTHCARE_WORKER' : 'DOCTOR';
  }

  // profile.type === 'RESEARCHER'
  const isResearchStudent =
    /sinh viên|học viên|nghiên cứu sinh|\bncs\b|thực tập|student|undergraduate|master student|phd candidate|trainee|intern/i.test(
      combined,
    );

  return isResearchStudent ? 'RESEARCH_STUDENT' : 'RESEARCHER';
}

const ROLE_PRIORITY: Record<LogicalAccountRole, number> = {
  DOCTOR: 1,
  RESEARCHER: 2,
  HEALTHCARE_WORKER: 3,
  RESEARCH_STUDENT: 4,
  GENERAL_USER: 5,
};

/**
 * Deterministic Phase 3 Automatic Role & Experience Resolver.
 *
 * Rules:
 * 1. IF account_role = GENERAL_USER:
 *      experience = GENERAL_MODE
 * 2. IF account_role IN (DOCTOR, HEALTHCARE_WORKER, RESEARCHER, RESEARCH_STUDENT)
 *    AND verification_status = VERIFIED:
 *      experience = PROFESSIONAL_MODE
 * 3. IF verification_status = PENDING (and no VERIFIED profile):
 *      experience = GENERAL_MODE
 *      enable_verification_center = true
 * 4. IF verification_status = REJECTED (and no VERIFIED profile):
 *      experience = GENERAL_MODE
 *      enable_resubmission = true
 * 5. Multi-role consistency:
 *      If a user holds multiple professional profiles (e.g. both DOCTOR and RESEARCHER),
 *      verified profiles take precedence and all roles are preserved in `allRoles`
 *      without duplicating accounts.
 */
export function resolveUserExperience(user: UserForResolution): ExperienceResolution {
  const profiles = user.professionalProfiles ?? [];

  if (profiles.length === 0) {
    return {
      experience: 'GENERAL_MODE',
      mode: 'general',
      accountRole: 'GENERAL_USER',
      allRoles: ['GENERAL_USER'],
      verificationStatus: 'UNVERIFIED',
      canAccessProfessionalMode: false,
      enableVerificationCenter: false,
      enableResubmission: false,
      isDualRoleProfessional: false,
    };
  }

  const verifiedProfiles = profiles.filter((p) => p.verificationStatus === 'VERIFIED');
  const pendingProfiles = profiles.filter((p) => p.verificationStatus === 'PENDING');
  const rejectedProfiles = profiles.filter((p) => p.verificationStatus === 'REJECTED');

  const allLogicalRoles = Array.from(
    new Set(profiles.map((p) => classifyProfileLogicalRole(p))),
  ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

  const hasHealthcare = profiles.some((p) => p.type === 'HEALTHCARE_PROFESSIONAL');
  const hasResearcher = profiles.some((p) => p.type === 'RESEARCHER');
  const isDualRoleProfessional = hasHealthcare && hasResearcher;

  // CASE 1: At least one profile is VERIFIED -> PROFESSIONAL_MODE
  if (verifiedProfiles.length > 0) {
    const verifiedRoles = Array.from(
      new Set(verifiedProfiles.map((p) => classifyProfileLogicalRole(p))),
    ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

    return {
      experience: 'PROFESSIONAL_MODE',
      mode: 'professional',
      accountRole: verifiedRoles[0] ?? 'DOCTOR',
      allRoles: allLogicalRoles,
      verificationStatus: 'VERIFIED',
      canAccessProfessionalMode: true,
      // If a dual-role user has a second profile that is PENDING or REJECTED, keep helpers available
      enableVerificationCenter: pendingProfiles.length > 0 || rejectedProfiles.length > 0,
      enableResubmission: rejectedProfiles.length > 0,
      isDualRoleProfessional,
    };
  }

  // CASE 2: No VERIFIED profile, at least one PENDING profile -> GENERAL_MODE + Verification Center
  if (pendingProfiles.length > 0) {
    const pendingRoles = Array.from(
      new Set(pendingProfiles.map((p) => classifyProfileLogicalRole(p))),
    ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

    return {
      experience: 'GENERAL_MODE',
      mode: 'general',
      accountRole: pendingRoles[0] ?? allLogicalRoles[0] ?? 'GENERAL_USER',
      allRoles: allLogicalRoles,
      verificationStatus: 'PENDING',
      canAccessProfessionalMode: false,
      enableVerificationCenter: true,
      enableResubmission: rejectedProfiles.length > 0,
      isDualRoleProfessional,
    };
  }

  // CASE 3: No VERIFIED or PENDING profile, at least one REJECTED profile -> GENERAL_MODE + Resubmission
  if (rejectedProfiles.length > 0) {
    const rejectedRoles = Array.from(
      new Set(rejectedProfiles.map((p) => classifyProfileLogicalRole(p))),
    ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

    return {
      experience: 'GENERAL_MODE',
      mode: 'general',
      accountRole: rejectedRoles[0] ?? allLogicalRoles[0] ?? 'GENERAL_USER',
      allRoles: allLogicalRoles,
      verificationStatus: 'REJECTED',
      canAccessProfessionalMode: false,
      enableVerificationCenter: true,
      enableResubmission: true,
      isDualRoleProfessional,
    };
  }

  // CASE 4: Only UNVERIFIED profiles exist -> GENERAL_MODE
  return {
    experience: 'GENERAL_MODE',
    mode: 'general',
    accountRole: 'GENERAL_USER',
    allRoles: allLogicalRoles.length > 0 ? allLogicalRoles : ['GENERAL_USER'],
    verificationStatus: 'UNVERIFIED',
    canAccessProfessionalMode: false,
    enableVerificationCenter: true,
    enableResubmission: false,
    isDualRoleProfessional,
  };
}
