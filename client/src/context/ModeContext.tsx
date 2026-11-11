import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import type {
  ExperienceMode,
  ExperienceResolution,
  LogicalAccountRole,
  ProfessionalProfile,
  SelfUser,
  VerificationStatus,
} from '../api/types';

export type AppMode = 'general' | 'professional';

export const ACCOUNT_ROLE_LABELS: Record<LogicalAccountRole, string> = {
  GENERAL_USER: 'Thành viên Cộng đồng (General User)',
  DOCTOR: 'Bác sĩ Lâm sàng (Doctor)',
  HEALTHCARE_WORKER: 'Nhân viên Y tế / KTV (Healthcare Worker)',
  RESEARCHER: 'Nhà Nghiên cứu Khoa học (Researcher)',
  RESEARCH_STUDENT: 'Sinh viên Nghiên cứu / NCS (Research Student)',
};

export function classifyProfileLogicalRole(
  profile: Pick<ProfessionalProfile, 'type' | 'title' | 'specialty'>,
): LogicalAccountRole {
  const combined = `${profile.title} ${profile.specialty}`.toLowerCase();

  if (profile.type === 'HEALTHCARE_PROFESSIONAL') {
    const isHealthcareWorker =
      /điều dưỡng|kỹ thuật viên|ktv|dược sĩ|nhân viên y tế|chuyên viên y tế|y sĩ|hộ sinh|phục hồi chức năng|nurse|technician|pharmacist|therapist|healthcare worker|clinical staff/i.test(
        combined,
      ) && !/bác sĩ|bs\.|bs |md|doctor|physician/i.test(profile.title.toLowerCase());

    return isHealthcareWorker ? 'HEALTHCARE_WORKER' : 'DOCTOR';
  }

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

export function resolveClientUserExperience(user: SelfUser | null): ExperienceResolution {
  if (!user) {
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

  if (user.experienceResolution) {
    return user.experienceResolution;
  }

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

  const allRoles = Array.from(
    new Set(profiles.map((p) => classifyProfileLogicalRole(p))),
  ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

  const hasHealthcare = profiles.some((p) => p.type === 'HEALTHCARE_PROFESSIONAL');
  const hasResearcher = profiles.some((p) => p.type === 'RESEARCHER');
  const isDualRoleProfessional = hasHealthcare && hasResearcher;

  if (verifiedProfiles.length > 0) {
    const verifiedRoles = Array.from(
      new Set(verifiedProfiles.map((p) => classifyProfileLogicalRole(p))),
    ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

    return {
      experience: 'PROFESSIONAL_MODE',
      mode: 'professional',
      accountRole: verifiedRoles[0] ?? 'DOCTOR',
      allRoles,
      verificationStatus: 'VERIFIED',
      canAccessProfessionalMode: true,
      enableVerificationCenter: pendingProfiles.length > 0 || rejectedProfiles.length > 0,
      enableResubmission: rejectedProfiles.length > 0,
      isDualRoleProfessional:
        verifiedProfiles.some((p) => p.type === 'HEALTHCARE_PROFESSIONAL') &&
        verifiedProfiles.some((p) => p.type === 'RESEARCHER'),
    };
  }

  if (pendingProfiles.length > 0) {
    const pendingRoles = Array.from(
      new Set(pendingProfiles.map((p) => classifyProfileLogicalRole(p))),
    ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

    return {
      experience: 'GENERAL_MODE',
      mode: 'general',
      accountRole: pendingRoles[0] ?? allRoles[0] ?? 'GENERAL_USER',
      allRoles,
      verificationStatus: 'PENDING',
      canAccessProfessionalMode: false,
      enableVerificationCenter: true,
      enableResubmission: rejectedProfiles.length > 0,
      isDualRoleProfessional,
    };
  }

  if (rejectedProfiles.length > 0) {
    const rejectedRoles = Array.from(
      new Set(rejectedProfiles.map((p) => classifyProfileLogicalRole(p))),
    ).sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);

    return {
      experience: 'GENERAL_MODE',
      mode: 'general',
      accountRole: rejectedRoles[0] ?? allRoles[0] ?? 'GENERAL_USER',
      allRoles,
      verificationStatus: 'REJECTED',
      canAccessProfessionalMode: false,
      enableVerificationCenter: true,
      enableResubmission: true,
      isDualRoleProfessional,
    };
  }

  return {
    experience: 'GENERAL_MODE',
    mode: 'general',
    accountRole: 'GENERAL_USER',
    allRoles: allRoles.length > 0 ? allRoles : ['GENERAL_USER'],
    verificationStatus: 'UNVERIFIED',
    canAccessProfessionalMode: false,
    enableVerificationCenter: true,
    enableResubmission: false,
    isDualRoleProfessional,
  };
}

interface ModeContextValue {
  mode: AppMode;
  experience: ExperienceMode;
  accountRole: LogicalAccountRole;
  allRoles: LogicalAccountRole[];
  verificationStatus: VerificationStatus;
  canAccessProfessionalMode: boolean;
  enableVerificationCenter: boolean;
  enableResubmission: boolean;
  isDualRoleProfessional: boolean;
  resolution: ExperienceResolution;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  isProfessional: boolean;
  isGeneral: boolean;
  isVerifiedHCP: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = 'neurolink_app_mode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const resolution = useMemo(() => resolveClientUserExperience(user), [user]);
  const isVerifiedHCP = resolution.canAccessProfessionalMode;

  const [manualOverride, setManualOverride] = useState<{
    userId: string;
    mode: AppMode;
  } | null>(null);

  // Automatic mode resolution when user changes or verification status changes
  useEffect(() => {
    if (!user) {
      setManualOverride(null);
      return;
    }

    // SECURITY INVARIANT: Non-verified accounts (GENERAL_USER, PENDING, REJECTED)
    // MUST ALWAYS resolve to GENERAL_MODE ('general').
    if (!resolution.canAccessProfessionalMode) {
      setManualOverride(null);
      try {
        localStorage.setItem(STORAGE_KEY, 'general');
      } catch {
        // Ignore storage errors
      }
      return;
    }

    // For VERIFIED professionals, automatic default is PROFESSIONAL_MODE ('professional'),
    // unless an explicit user-scoped or global preview mode was chosen by this verified user.
    try {
      const userScoped = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      const globalSaved = localStorage.getItem(STORAGE_KEY);
      if (userScoped === 'general' || userScoped === 'professional') {
        setManualOverride({ userId: user.id, mode: userScoped });
      } else if (globalSaved === 'general') {
        setManualOverride({ userId: user.id, mode: 'general' });
      } else {
        setManualOverride({ userId: user.id, mode: 'professional' });
        localStorage.setItem(STORAGE_KEY, 'professional');
      }
    } catch {
      setManualOverride({ userId: user.id, mode: 'professional' });
    }
  }, [user?.id, resolution.canAccessProfessionalMode]);

  const effectiveMode: AppMode = useMemo(() => {
    if (!resolution.canAccessProfessionalMode) {
      return 'general';
    }
    if (user && manualOverride && manualOverride.userId === user.id) {
      return manualOverride.mode;
    }
    return resolution.mode;
  }, [resolution.canAccessProfessionalMode, resolution.mode, user, manualOverride]);

  const setMode = (newMode: AppMode) => {
    // Strictly prevent non-verified accounts from activating Professional Mode
    if (newMode === 'professional' && !resolution.canAccessProfessionalMode) {
      return;
    }
    if (user) {
      setManualOverride({ userId: user.id, mode: newMode });
      try {
        localStorage.setItem(`${STORAGE_KEY}_${user.id}`, newMode);
        localStorage.setItem(STORAGE_KEY, newMode);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const toggleMode = () => {
    if (!resolution.canAccessProfessionalMode) return;
    setMode(effectiveMode === 'general' ? 'professional' : 'general');
  };

  return (
    <ModeContext.Provider
      value={{
        mode: effectiveMode,
        experience: effectiveMode === 'professional' ? 'PROFESSIONAL_MODE' : 'GENERAL_MODE',
        accountRole: resolution.accountRole,
        allRoles: resolution.allRoles,
        verificationStatus: resolution.verificationStatus,
        canAccessProfessionalMode: resolution.canAccessProfessionalMode,
        enableVerificationCenter: resolution.enableVerificationCenter,
        enableResubmission: resolution.enableResubmission,
        isDualRoleProfessional: resolution.isDualRoleProfessional,
        resolution,
        setMode,
        toggleMode,
        isProfessional: effectiveMode === 'professional',
        isGeneral: effectiveMode === 'general',
        isVerifiedHCP,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return ctx;
}
