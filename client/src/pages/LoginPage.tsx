import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Button, Field, Input } from '../components/ui';
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
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại cộng đồng chuyên môn NeuroLink."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-[#16A34A] hover:text-[#15803D] hover:underline">
            Đăng ký tài khoản mới
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="E-mail hoặc tên người dùng" htmlFor="identifier">
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="next"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="vd: nguyen_an hoặc email@example.com"
            autoFocus
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              enterKeyHint="done"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-2.5 flex items-center text-xs font-medium text-[#6E6D68] hover:text-[#141413]"
            >
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Đăng nhập
        </Button>
      </form>
    </AuthLayout>
  );
}
