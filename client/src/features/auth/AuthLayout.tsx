import type { ReactNode } from 'react';
import { Logo } from '../../components/layout/AppShell';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#EDF5F8] via-[#F6F8FA] to-white px-4 py-10">
      <Logo className="mb-7" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-7 shadow-[0_8px_32px_-4px_rgba(15,23,42,0.04)] sm:p-9">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-sm text-slate-600">{footer}</div>}
    </div>
  );
}
