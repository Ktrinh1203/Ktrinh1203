import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { errorMessage } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { AuthLayout } from '../features/auth/AuthLayout';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: string } | null)?.from;
  const from = rawFrom && rawFrom !== '/login' && rawFrom !== '/register' ? rawFrom : '/feed';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập e-mail/tên người dùng và mật khẩu.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để truy cập hệ thống NeuroLink"
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link
            to="/register"
            className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-500/15 px-3.5 py-2.5 text-xs sm:text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-slate-300">
            E-mail hoặc tên người dùng
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="vd: nguyen_an hoặc email@example.com"
              className="w-full rounded-xl border border-white/12 bg-white/5 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-all focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              enterKeyHint="done"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full rounded-xl border border-white/12 bg-white/5 py-3 pr-10 pl-10 text-sm text-white placeholder-slate-500 transition-all focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#16A34A] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#15803D] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogIn className="size-4" aria-hidden="true" />
          <span>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
