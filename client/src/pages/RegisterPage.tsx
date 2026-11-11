import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, Button, Field, Input } from '../components/ui';
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

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ displayName: '', username: '', email: '', password: '', confirm: '' });
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
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Tên hiển thị" htmlFor="displayName" error={errors.displayName}>
          <Input id="displayName" value={form.displayName} onChange={set('displayName')} invalid={!!errors.displayName} autoComplete="name" />
        </Field>
        <Field label="Tên người dùng" htmlFor="username" error={errors.username} hint="Dùng trong đường dẫn trang cá nhân, ví dụ: /u/nguyen_an">
          <Input id="username" value={form.username} onChange={set('username')} invalid={!!errors.username} autoComplete="username" />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" value={form.email} onChange={set('email')} invalid={!!errors.email} autoComplete="email" />
        </Field>
        <Field label="Mật khẩu" htmlFor="password" error={errors.password}>
          <Input id="password" type="password" value={form.password} onChange={set('password')} invalid={!!errors.password} autoComplete="new-password" />
        </Field>
        <Field label="Xác nhận mật khẩu" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} autoComplete="new-password" />
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Đăng ký
        </Button>
      </form>
    </AuthLayout>
  );
}
