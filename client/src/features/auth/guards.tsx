import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Spinner } from '../../components/ui';
import { useAuth } from './AuthContext';
import { useMode } from '../../context/ModeContext';

/** Renders children only for authenticated users (UX guard; the API enforces access). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/** Redirects already-authenticated users away from login/register. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (user) return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

/**
 * Renders children only for verified professionals (DOCTOR, HEALTHCARE_WORKER, RESEARCHER, RESEARCH_STUDENT
 * with verificationStatus === 'VERIFIED'). Pending/Rejected applicants are directed to the Verification Center.
 */
export function RequireVerifiedProfessional({ children }: { children: ReactNode }) {
  const { canAccessProfessionalMode, enableVerificationCenter, enableResubmission } = useMode();
  if (!canAccessProfessionalMode) {
    if (enableResubmission) {
      return <Navigate to="/settings?resubmit=true#verification-center" replace />;
    }
    if (enableVerificationCenter) {
      return <Navigate to="/settings#verification-center" replace />;
    }
    return <Navigate to="/feed" replace />;
  }
  return <>{children}</>;
}
