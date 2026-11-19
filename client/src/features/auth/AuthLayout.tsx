import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../components/layout/AppShell';
import { InteractiveEEGShowcase } from './InteractiveEEGShowcase';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5FAF7] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pb-2">
        <Logo />
        <Link
          to="/"
          className="text-xs sm:text-sm font-medium text-[#15803D] hover:text-[#166534] hover:underline transition-colors"
        >
          Trang chủ &amp; Hệ sinh thái →
        </Link>
      </header>

      <main className="mx-auto my-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 py-6 lg:grid-cols-12 lg:gap-10">
        <div className="order-1 lg:order-2 lg:col-span-5">
          <div className="w-full rounded-2xl border border-[#DCE6DF] bg-white p-6 sm:p-8 shadow-xs">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">{subtitle}</p>
            )}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-slate-600">{footer}</div>}
        </div>

        <div className="order-2 lg:order-1 lg:col-span-7">
          <InteractiveEEGShowcase />
        </div>
      </main>
    </div>
  );
}
