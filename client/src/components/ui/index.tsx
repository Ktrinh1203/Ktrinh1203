import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'accent' | 'dark';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-xs hover:shadow-sm disabled:bg-brand-300 font-semibold tracking-wide',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-xs hover:shadow-sm disabled:bg-slate-300 font-semibold',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200/60 border border-brand-200/70 disabled:opacity-60 font-semibold',
  accent: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 shadow-xs hover:shadow-sm disabled:bg-accent-300 font-semibold',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs disabled:opacity-60 font-medium',
  ghost: 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 disabled:opacity-60 font-medium',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs disabled:bg-red-300 font-semibold',
};

const sizeClasses: Record<Size, string> = {
  xs: 'h-7 px-3 text-xs gap-1.5 rounded-md',
  sm: 'h-8.5 px-3.5 text-xs sm:text-sm gap-1.5 rounded-md',
  md: 'h-10 px-5 text-sm gap-2 rounded-md',
  lg: 'h-11 px-6 text-base gap-2.5 rounded-md',
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
  'block w-full rounded-lg border bg-slate-50/60 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:cursor-not-allowed';

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
        'rounded-lg border border-slate-200/80 bg-white shadow-xs transition-colors',
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
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none ring-1 ring-slate-900/5',
    AVATAR_SIZES[size],
    className,
  );

  if (src) {
    return <img src={src} alt={name} className={cn(base, 'object-cover')} />;
  }

  return (
    <span
      className={cn(
        base,
        'bg-brand-50 text-brand-700 border border-brand-200/80 font-bold',
      )}
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

