import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BadgeCheck, Loader2, X } from 'lucide-react';
import type { UserSummary } from '../api/types';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function relativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}p`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}g`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}n`;
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export function isUserVerified(user?: Pick<UserSummary, 'professionalProfiles'> | null): boolean {
  return Boolean(user?.professionalProfiles?.some((p) => p.verificationStatus === 'VERIFIED'));
}

export function primaryUserTitle(user?: Pick<UserSummary, 'professionalProfiles'> | null): string | null {
  const verified = user?.professionalProfiles?.find((p) => p.verificationStatus === 'VERIFIED');
  if (!verified) return null;
  return verified.type === 'HEALTHCARE_PROFESSIONAL' ? 'Bác sĩ' : 'Nghiên cứu';
}

export function NeuroLinkLogo({
  inverted = false,
  compact = false,
  to,
}: {
  inverted?: boolean;
  compact?: boolean;
  to?: string;
}) {
  const inner = (
    <span className="group inline-flex items-center gap-2 select-none">
      <img
        src="/logo.svg"
        alt="NeuroLink"
        width={compact ? 28 : 34}
        height={compact ? 28 : 34}
        className={cn('shrink-0', compact ? 'size-7' : 'size-8.5')}
      />
      <span className="flex flex-col items-start">
        <span
          className={cn(
            'leading-none font-extrabold tracking-[-0.04em]',
            compact ? 'text-[17px]' : 'text-[21px]',
            inverted ? 'text-white' : 'text-[#111827]',
          )}
        >
          neuro<span className={inverted ? 'text-emerald-300' : 'text-[#16A34A]'}>link</span>
        </span>
        <svg
          viewBox="0 0 112 12"
          fill="none"
          aria-hidden="true"
          className={cn(
            '-mt-0.5 overflow-visible',
            compact ? 'w-[68px] h-[9px]' : 'w-[84px] h-[10px]',
            inverted ? 'text-emerald-300' : 'text-[#16A34A]',
          )}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M2 6 H44 L49 1.5 L55 10.5 L60 3.5 L63.5 6 H108"
            pathLength={48}
            strokeDasharray={48}
            className="group-hover:animate-[ecg-flow_750ms_cubic-bezier(0.16,1,0.3,1)]"
          />
        </svg>
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function Avatar({
  name,
  src,
  size = 'md',
  online = false,
  storyRing = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  storyRing?: boolean;
  className?: string;
}) {
  const sizes = {
    xs: 'size-7 text-[11px]',
    sm: 'size-9 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
    xl: 'size-16 text-lg',
  }[size];

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  const circle = (
    <span className={cn('relative inline-flex shrink-0', !storyRing && className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover bg-[#ECFDF3] border border-[#DCE6DF]', sizes)}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-[#ECFDF3] text-[#15803D] font-bold border border-[#BBF7D0] select-none',
            sizes,
          )}
        >
          {initials || 'NL'}
        </span>
      )}
      {online && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#16A34A] border-2 border-white"
        />
      )}
    </span>
  );

  if (storyRing) {
    return (
      <span
        data-story-ring="true"
        className={cn(
          'inline-flex shrink-0 rounded-full p-[2.5px] border-[1.5px] border-[#16A34A]/35 bg-white',
          className,
        )}
      >
        {circle}
      </span>
    );
  }

  return circle;
}

export function VerifiedCheck({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn('size-3.5 text-[#16A34A] shrink-0 inline-block', className)}
      aria-label="Đã xác minh"
    />
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-[#5B6860]" role="status">
      <Loader2 className="size-5 animate-spin text-[#16A34A]" aria-hidden />
      {label && <span>{label}</span>}
    </div>
  );
}

export function EmptyView({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-[#94A39B]">{icon}</div>}
      <p className="text-sm font-medium text-[#5B6860]">{title}</p>
      {action}
    </div>
  );
}

export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  dark = false,
  className,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  dark?: boolean;
  className?: string;
}) {
  const hasLeftPad = /\b(?:px|pl)-/.test(className ?? '');
  const hasRightPad = /\b(?:px|pr)-/.test(className ?? '');
  return (
    <div
      data-pill-tabs="true"
      className={cn(
        'flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5',
        !hasLeftPad && 'pl-1.5',
        !hasRightPad && 'pr-1.5',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-[13px] transition-colors select-none cursor-pointer active:scale-[0.97]',
              active
                ? dark
                  ? 'bg-[#14532D] text-white font-semibold'
                  : 'bg-[#16A34A] text-white font-semibold'
                : 'bg-white text-[#4B5563] border border-[#DCE6DF] font-medium hover:border-[#86EFAC]',
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-[#ECFDF3] text-[#15803D]',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  headerRight,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="fixed inset-0 bg-[#052E16]/35 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-[430px] max-h-[88dvh] flex flex-col rounded-t-[24px] bg-white shadow-[0_-12px_40px_-8px_rgba(5,46,22,0.18)] border-t border-x border-[#DCE6DF] animate-sheet-up"
      >
        {/* Drag handle pill */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0" onClick={onClose}>
          <span className="h-1 w-10 rounded-full bg-[#CBD5CF]" aria-hidden="true" />
        </div>

        {/* Sticky sheet header */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1 border-b border-[#EDF3EF] shrink-0">
          <h2 className="text-[16px] font-bold text-[#111827] truncate">{title}</h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex size-9 items-center justify-center rounded-full text-[#5B6860] hover:bg-[#F5FAF7] active:scale-95 transition-transform cursor-pointer"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Sheet body */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
