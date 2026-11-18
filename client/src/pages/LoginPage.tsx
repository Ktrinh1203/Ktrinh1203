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

  async function quickLogin(username: string) {
    if (submitting) return;
    setIdentifier(username);
    setPassword('Password123');
    setSubmitting(true);
    setError(null);
    try {
      await login(username, 'Password123');
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

      {/* Demo Account Quick-Login Buttons */}
      <div className="mt-6 border-t border-[#DCE6DF] pt-4 space-y-2">
        <p className="text-xs font-medium text-[#6E6D68]">
          Đăng nhập nhanh tài khoản mẫu
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void quickLogin('hoa_health')}
          className="w-full rounded-lg border border-[#86EFAC] bg-[#ECFDF3] px-3.5 py-2.5 text-left text-xs hover:bg-[#DCFCE7] transition-colors disabled:opacity-60"
        >
          <span className="flex items-center justify-between gap-2 font-semibold text-[#141413]">
            <span>Nguyễn Thanh Hoa — Người dùng cá nhân</span>
            <span className="text-[11px] font-semibold text-[#15803D]">Khuyên dùng</span>
          </span>
          <span className="block text-[11px] text-[#6E6D68] mt-0.5">
            Trải nghiệm đo sóng não, hỏi bác sĩ và nhật ký giấc ngủ
          </span>
        </button>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void quickLogin('dr_minh')}
            className="rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-2 text-left hover:bg-[#F5FAF7] hover:border-[#86EFAC] transition-colors disabled:opacity-60"
          >
            <strong className="block font-semibold text-[#141413]">BS. Nguyễn Văn Minh</strong>
            <span className="text-[11px] text-[#6E6D68]">Bác sĩ đọc ca</span>
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void quickLogin('bs_noitru_khang')}
            className="rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-2 text-left hover:bg-[#F5FAF7] hover:border-[#86EFAC] transition-colors disabled:opacity-60"
          >
            <strong className="block font-semibold text-[#141413]">BS. Nội trú Lê Minh Khang</strong>
            <span className="text-[11px] text-[#6E6D68]">Trực ngoài giờ</span>
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void quickLogin('prof_lan')}
            className="rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-2 text-left hover:bg-[#F5FAF7] hover:border-[#86EFAC] transition-colors disabled:opacity-60"
          >
            <strong className="block font-semibold text-[#141413]">PGS. Trần Mai Lan</strong>
            <span className="text-[11px] text-[#6E6D68]">Nghiên cứu Data Bank</span>
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void quickLogin('admin')}
            className="rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-2 text-left hover:bg-[#F5FAF7] hover:border-[#86EFAC] transition-colors disabled:opacity-60"
          >
            <strong className="block font-semibold text-[#141413]">Quản trị viên</strong>
            <span className="text-[11px] text-[#6E6D68]">Điều phối hệ thống</span>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
