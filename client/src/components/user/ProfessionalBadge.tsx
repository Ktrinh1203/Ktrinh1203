import { BadgeCheck } from 'lucide-react';
import type { ProfessionalType, VerificationStatus } from '../../api/types';
import { cn } from '../ui';

export const PROFESSIONAL_LABEL: Record<ProfessionalType, string> = {
  HEALTHCARE_PROFESSIONAL: 'Bác sĩ',
  RESEARCHER: 'Nghiên cứu',
};

/**
 * Shows the professional capability as an understated inline credential.
 * The verified check mark is rendered ONLY when verificationStatus = VERIFIED.
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
  const verified = status === 'VERIFIED';
  const label = compact
    ? isDoctor
      ? '· Bác sĩ'
      : '· Nghiên cứu'
    : isDoctor
      ? '· Bác sĩ'
      : '· Nghiên cứu';

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-[#6E6D68] font-normal select-none"
      title={
        verified
          ? 'Hồ sơ đã được Quản trị viên xác minh năng lực chuyên môn'
          : 'Hồ sơ tự khai báo chuyên môn (chưa xác minh)'
      }
    >
      <span>{label}</span>
      {verified ? (
        <BadgeCheck className="size-3.5 text-[#16A34A] shrink-0" aria-label="Đã xác minh" />
      ) : showStatus ? (
        <span className="text-[11px] text-[#8A8882]">(chờ duyệt)</span>
      ) : null}
    </span>
  );
}

export function VerificationStatusText({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { text: string; dot: string; cls: string }> = {
    UNVERIFIED: { text: 'Chưa xác minh', dot: 'bg-[#8A8882]', cls: 'text-[#6E6D68]' },
    PENDING: { text: 'Đang chờ duyệt', dot: 'bg-amber-500', cls: 'text-[#575652]' },
    VERIFIED: { text: 'Đã xác minh', dot: 'bg-[#16A34A]', cls: 'text-[#15803D]' },
    REJECTED: { text: 'Từ chối', dot: 'bg-red-600', cls: 'text-red-700' },
  };
  const { text, dot, cls } = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cls)}>
      <span className={cn('size-1.5 rounded-full shrink-0', dot)} aria-hidden />
      <span>{text}</span>
    </span>
  );
}
