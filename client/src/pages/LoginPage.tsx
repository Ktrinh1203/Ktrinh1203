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

  const fillAccount = (username: string) => {
    setIdentifier(username);
    setPassword('Password123');
    setError(null);
  };

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại cộng đồng chuyên môn NeuroLink."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
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
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="vd: dr_minh, prof_lan, admin..."
            autoFocus
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Đăng nhập
        </Button>
      </form>

      {/* Demo Account Quick-Fill Buttons */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Đăng nhập nhanh tài khoản mẫu:
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => fillAccount('dr_minh')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-slate-700 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            🩺 <strong>BS. Minh</strong> (Bác sĩ)
          </button>
          <button
            type="button"
            onClick={() => fillAccount('prof_lan')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-slate-700 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            🔬 <strong>PGS. Lan</strong> (BCI)
          </button>
          <button
            type="button"
            onClick={() => fillAccount('tuan_bme')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-slate-700 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            🎓 <strong>Tuấn BME</strong> (Sinh viên)
          </button>
          <button
            type="button"
            onClick={() => fillAccount('admin')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-slate-700 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            🛡️ <strong>Admin</strong> (Quản trị)
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
