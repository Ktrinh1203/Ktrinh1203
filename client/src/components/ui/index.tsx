import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'accent' | 'dark';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[#16A34A] text-white hover:bg-[#15803D] active:bg-[#166534] disabled:opacity-50 font-semibold',
  dark: 'bg-[#14532D] text-white hover:bg-[#166534] active:bg-[#052E16] disabled:opacity-50 font-semibold',
  secondary: 'bg-[#ECFDF3] text-[#15803D] hover:bg-[#DCFCE7] border border-[#BBF7D0] disabled:opacity-50 font-semibold',
  accent: 'bg-[#16A34A] text-white hover:bg-[#15803D] active:bg-[#166534] disabled:opacity-50 font-semibold',
  outline: 'border border-[#D5E2D9] bg-white text-[#1F2937] hover:bg-[#F3F9F5] hover:border-[#16A34A]/50 disabled:opacity-50 font-medium',
  ghost: 'text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] disabled:opacity-50 font-medium',
  danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50 font-semibold',
};

const sizeClasses: Record<Size, string> = {
  xs: 'h-7.5 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8.5 px-3.5 text-xs sm:text-sm gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm sm:text-base gap-2 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin shrink-0" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Form fields
interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, htmlFor, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'block w-full rounded-lg border bg-white px-3.5 text-sm text-[#141413] placeholder:text-[#8A8882] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1B4332]/15 disabled:bg-[#F5F4F0] disabled:cursor-not-allowed';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputBase,
        'h-9.5',
        invalid
          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
          : 'border-slate-200/90 focus:border-brand-600',
        className,
      )}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputBase,
        'py-2.5 leading-relaxed',
        invalid
          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
          : 'border-slate-200/90 focus:border-brand-600',
        className,
      )}
      {...rest}
    />
  );
});

// ---------------------------------------------------------------- Card
export function Card({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-xl border border-[#DCE6DF] bg-white',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Feedback
export function Spinner({ className, label = 'Đang tải…' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-8 text-sm text-slate-500', className)} role="status">
      <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'success' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50/80 text-red-800',
    success: 'border-emerald-200 bg-emerald-50/80 text-emerald-800',
    info: 'border-accent-200 bg-accent-50/80 text-accent-800',
  }[tone];
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm', styles, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-3.5 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-4 ring-brand-50/50">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Avatar
const AVATAR_SIZES = {
  xs: 'size-7 text-[10px]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-xl',
  xl: 'size-24 text-2xl',
};

const AVATAR_TONES = [
  'bg-[#DCFCE7] text-[#166534]',
  'bg-[#E0F2FE] text-[#075985]',
  'bg-[#D1FAE5] text-[#065F46]',
  'bg-[#FEF3C7] text-[#92400E]',
  'bg-[#E2E8F0] text-[#1E293B]',
];

function pickAvatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const base = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none border border-black/8',
    AVATAR_SIZES[size],
    className,
  );

  if (src) {
    return <img src={src} alt={name} width={44} height={44} className={cn(base, 'object-cover')} />;
  }

  return (
    <span
      className={cn(base, pickAvatarTone(name))}
      aria-label={name}
    >
      {initials || '?'}
    </span>
  );
}

// ---------------------------------------------------------------- Mode-Aware Reusable Primitives
export interface TelemetryMetricItem {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}

export function TelemetryStrip({ items }: { items: TelemetryMetricItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/80 text-xs">
      {items.map((item, idx) => (
        <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-600">{item.label}</span>
          <span className={cn('font-extrabold text-slate-900 tabular-nums', item.valueClassName)}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DataTableContainer({
  icon,
  title,
  subtitle,
  metaLabel,
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  metaLabel?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-0 overflow-hidden border-slate-300 shadow-2xs', className)}>
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {metaLabel && <span className="text-[11px] font-mono text-slate-500">{metaLabel}</span>}
          {action}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

