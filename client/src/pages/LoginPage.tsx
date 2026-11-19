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
            className="font-semibold text-[#0F6E56] underline hover:text-[#0A5240]"
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
            className="rounded-2xl border border-red-400/50 bg-red-50/90 px-4 py-2.5 text-xs font-medium text-red-800 sm:text-sm"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="identifier"
            className="mb-1.5 block text-xs font-semibold text-[#113C38] sm:text-sm"
          >
            E-mail hoặc tên người dùng
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#184E48]"
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
              className="w-full rounded-full border border-[#1E5650]/35 bg-[#E8F6F2]/90 py-3 pr-4 pl-11 text-sm text-[#0F3834] placeholder-[#3B6E68]/70 transition-all focus:border-[#158A6A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#158A6A]/25"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-[#113C38] sm:text-sm"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#184E48]"
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
              className="w-full rounded-full border border-[#1E5650]/35 bg-[#E8F6F2]/90 py-3 pr-11 pl-11 text-sm text-[#0F3834] placeholder-[#3B6E68]/70 transition-all focus:border-[#158A6A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#158A6A]/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer text-[#1E5650]/75 transition-colors hover:text-[#0F3834]"
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
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#158A6A] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#107055] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogIn className="size-4" aria-hidden="true" />
          <span>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
