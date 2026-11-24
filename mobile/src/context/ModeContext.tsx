import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type {
  ExperienceMode,
  ExperienceResolution,
  LogicalAccountRole,
  ProfessionalProfile,
  SelfUser,
  VerificationStatus,
} from '../api/types';

export type AppMode = 'general' | 'professional';

const STORAGE_KEY = 'neurolink_mobile_mode';

function classifyRole(profile: Pick<ProfessionalProfile, 'type' | 'title' | 'specialty'>): LogicalAccountRole {
  const combined = `${profile.title} ${profile.specialty}`.toLowerCase();
  if (profile.type === 'HEALTHCARE_PROFESSIONAL') {
    const isWorker =
      /điều dưỡng|kỹ thuật viên|ktv|dược sĩ|nhân viên y tế|nurse|technician|pharmacist/i.test(combined) &&
      !/bác sĩ|bs\.|bs |md|doctor|physician/i.test(profile.title.toLowerCase());
    return isWorker ? 'HEALTHCARE_WORKER' : 'DOCTOR';
  }
  return /sinh viên|học viên|nghiên cứu sinh|\bncs\b|student|trainee/i.test(combined)
    ? 'RESEARCH_STUDENT'
    : 'RESEARCHER';
}

function resolveExperience(user: SelfUser | null): ExperienceResolution {
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
  if (user.experienceResolution) return user.experienceResolution;

  const profiles = user.professionalProfiles ?? [];
  const verified = profiles.filter((p) => p.verificationStatus === 'VERIFIED');
  const pending = profiles.filter((p) => p.verificationStatus === 'PENDING');
  const rejected = profiles.filter((p) => p.verificationStatus === 'REJECTED');

  if (verified.length > 0) {
    return {
      experience: 'PROFESSIONAL_MODE',
      mode: 'professional',
      accountRole: classifyRole(verified[0]!),
      allRoles: Array.from(new Set(profiles.map(classifyRole))),
      verificationStatus: 'VERIFIED',
      canAccessProfessionalMode: true,
      enableVerificationCenter: pending.length > 0 || rejected.length > 0,
      enableResubmission: rejected.length > 0,
      isDualRoleProfessional:
        verified.some((p) => p.type === 'HEALTHCARE_PROFESSIONAL') &&
        verified.some((p) => p.type === 'RESEARCHER'),
    };
  }

  const status: VerificationStatus =
    pending.length > 0 ? 'PENDING' : rejected.length > 0 ? 'REJECTED' : 'UNVERIFIED';

  return {
    experience: 'GENERAL_MODE',
    mode: 'general',
    accountRole: profiles[0] ? classifyRole(profiles[0]) : 'GENERAL_USER',
    allRoles: profiles.length ? Array.from(new Set(profiles.map(classifyRole))) : ['GENERAL_USER'],
    verificationStatus: status,
    canAccessProfessionalMode: false,
    enableVerificationCenter: profiles.length > 0,
    enableResubmission: rejected.length > 0,
    isDualRoleProfessional: false,
  };
}

interface ModeContextValue {
  mode: AppMode;
  experience: ExperienceMode;
  canAccessProfessionalMode: boolean;
  verificationStatus: VerificationStatus;
  isProfessional: boolean;
  isGeneral: boolean;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const resolution = useMemo(() => resolveExperience(user), [user]);
  const [override, setOverride] = useState<{ userId: string; mode: AppMode } | null>(null);

  useEffect(() => {
    if (!user || !resolution.canAccessProfessionalMode) {
      setOverride(null);
    }
  }, [user?.id, resolution.canAccessProfessionalMode]);

  const effectiveMode: AppMode = useMemo(() => {
    if (!user || !resolution.canAccessProfessionalMode) return 'general';
    if (override && override.userId === user.id) return override.mode;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      if (saved === 'general' || saved === 'professional') return saved;
    } catch {
      // ignore storage read errors
    }
    return resolution.mode;
  }, [resolution.canAccessProfessionalMode, resolution.mode, user, override]);

  const setMode = (next: AppMode) => {
    if (next === 'professional' && !resolution.canAccessProfessionalMode) return;
    if (!user) return;
    setOverride({ userId: user.id, mode: next });
    try {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, next);
    } catch {
      // ignore storage quota errors
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
        canAccessProfessionalMode: resolution.canAccessProfessionalMode,
        verificationStatus: resolution.verificationStatus,
        isProfessional: effectiveMode === 'professional',
        isGeneral: effectiveMode === 'general',
        setMode,
        toggleMode,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used inside ModeProvider');
  return ctx;
}
