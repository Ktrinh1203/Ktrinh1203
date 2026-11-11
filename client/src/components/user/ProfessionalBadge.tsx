import { BadgeCheck, FlaskConical, Stethoscope } from 'lucide-react';
import type { ProfessionalType, VerificationStatus } from '../../api/types';
import { cn } from '../ui';

export const PROFESSIONAL_LABEL: Record<ProfessionalType, string> = {
  HEALTHCARE_PROFESSIONAL: 'Y tế & Thần kinh',
  RESEARCHER: 'Nhà nghiên cứu BCI',
};

/**
 * Shows the professional capability. The "verified" check mark is rendered
 * ONLY when an administrator has set verificationStatus = VERIFIED.
 */
export function ProfessionalBadge({
  type,
  status,
  compact = false,
  showStatus = false,
}: {
  type: ProfessionalType;
  status: VerificationStatus;
  compact?: boolean;
  showStatus?: boolean;
}) {
  const isDoctor = type === 'HEALTHCARE_PROFESSIONAL';
  const Icon = isDoctor ? Stethoscope : FlaskConical;
  const verified = status === 'VERIFIED';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium transition-colors select-none',
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        isDoctor
          ? 'bg-brand-50 text-brand-800 border border-brand-200/70'
          : 'bg-accent-50 text-accent-800 border border-accent-200/70',
      )}
      title={
        verified
          ? 'Hồ sơ đã được Quản trị viên xác minh năng lực chuyên môn'
          : 'Hồ sơ tự khai báo chuyên môn (chưa xác minh)'
      }
    >
      <Icon className={cn(compact ? 'size-3' : 'size-3.5', isDoctor ? 'text-brand-600' : 'text-accent-600')} aria-hidden />
      <span>{PROFESSIONAL_LABEL[type]}</span>
      {verified ? (
        <BadgeCheck className="size-3.5 text-brand-600 shrink-0" aria-label="Đã xác minh" />
      ) : showStatus ? (
        <span className="font-normal text-slate-400 text-[10px]">· chờ duyệt</span>
      ) : null}
    </span>
  );
}

export function VerificationStatusText({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { text: string; cls: string }> = {
    UNVERIFIED: { text: 'Chưa xác minh', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    PENDING: { text: 'Đang chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    VERIFIED: { text: 'Đã xác minh', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
    REJECTED: { text: 'Từ chối', cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const { text, cls } = map[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {text}
    </span>
  );
}
