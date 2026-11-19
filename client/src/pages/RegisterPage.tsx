import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AtSign, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { AuthLayout } from '../features/auth/AuthLayout';

interface FormState {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirm: string;
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.displayName.trim()) errors.displayName = 'Vui lòng nhập tên hiển thị.';
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(f.username.trim()))
    errors.username = 'Tên người dùng gồm 3–30 ký tự: chữ, số hoặc dấu gạch dưới.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = 'E-mail không hợp lệ.';
  if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
    errors.password = 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.';
  if (f.confirm !== f.password) errors.confirm = 'Mật khẩu xác nhận không khớp.';
  return errors;
}

const inputBaseClass =
  'w-full rounded-xl border bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#141413] placeholder-[#8A8882] transition-colors focus:outline-none focus:ring-2';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clientErrors = validate(form);
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      await register({
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/feed', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Hồ sơ chuyên môn (bác sĩ, nhà nghiên cứu) có thể bổ sung sau khi đăng ký."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link
            to="/login"
            className="font-medium text-[#16A34A] hover:text-[#15803D] hover:underline"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 sm:text-sm"
          >
            {formError}
          </div>
        )}

        <div>
          <label
            htmlFor="displayName"
            className="mb-1.5 block text-xs font-semibold text-[#141413] sm:text-sm"
          >
            Tên hiển thị
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6E6D68]"
              aria-hidden="true"
            />
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              required
              value={form.displayName}
              onChange={set('displayName')}
              aria-invalid={!!errors.displayName || undefined}
              placeholder="vd: Nguyễn Văn An"
              className={`${inputBaseClass} ${
                errors.displayName
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-[#DCE6DF] focus:border-[#16A34A] focus:ring-[#16A34A]/15'
              }`}
            />
          </div>
          {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>}
        </div>

        <div>
          <label
            htmlFor="username"
            className="mb-1.5 block text-xs font-semibold text-[#141413] sm:text-sm"
          >
            Tên người dùng
          </label>
          <div className="relative">
            <AtSign
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6E6D68]"
              aria-hidden="true"
            />
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={form.username}
              onChange={set('username')}
              aria-invalid={!!errors.username || undefined}
              placeholder="vd: nguyen_an"
              className={`${inputBaseClass} ${
                errors.username
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-[#DCE6DF] focus:border-[#16A34A] focus:ring-[#16A34A]/15'
              }`}
            />
          </div>
          {errors.username ? (
            <p className="mt-1 text-xs text-red-600">{errors.username}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Dùng trong đường dẫn trang cá nhân, ví dụ: /u/nguyen_an
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold text-[#141413] sm:text-sm"
          >
            E-mail
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6E6D68]"
              aria-hidden="true"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set('email')}
              aria-invalid={!!errors.email || undefined}
              placeholder="email@example.com"
              className={`${inputBaseClass} ${
                errors.email
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-[#DCE6DF] focus:border-[#16A34A] focus:ring-[#16A34A]/15'
              }`}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-[#141413] sm:text-sm"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6E6D68]"
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set('password')}
              aria-invalid={!!errors.password || undefined}
              placeholder="Tối thiểu 8 ký tự, gồm chữ và số"
              className={`${inputBaseClass} pr-10 ${
                errors.password
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-[#DCE6DF] focus:border-[#16A34A] focus:ring-[#16A34A]/15'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#6E6D68] transition-colors hover:text-[#141413]"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="mb-1.5 block text-xs font-semibold text-[#141413] sm:text-sm"
          >
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6E6D68]"
              aria-hidden="true"
            />
            <input
              id="confirm"
              name="confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={form.confirm}
              onChange={set('confirm')}
              aria-invalid={!!errors.confirm || undefined}
              placeholder="Nhập lại mật khẩu"
              className={`${inputBaseClass} pr-10 ${
                errors.confirm
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                  : 'border-[#DCE6DF] focus:border-[#16A34A] focus:ring-[#16A34A]/15'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
              aria-pressed={showConfirm}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#6E6D68] transition-colors hover:text-[#141413]"
            >
              {showConfirm ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          <span>{submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
