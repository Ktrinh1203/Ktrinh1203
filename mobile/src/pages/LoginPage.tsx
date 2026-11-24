import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff, Lock, Mail, Sparkles, User } from 'lucide-react';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NeuralMeshCanvas } from '../components/NeuralMeshCanvas';
import { NeuroLinkLogo, cn } from '../components/ui';

const QUICK_ACCOUNTS = [
  { id: 'hoa_health', label: 'Thành viên', name: 'hoa_health' },
  { id: 'dr_minh', label: 'Bác sĩ', name: 'dr_minh' },
  { id: 'prof_lan', label: 'Nghiên cứu', name: 'prof_lan' },
] as const;

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: string } | null)?.from;

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);

  const destinationAfterAuth = (fallback: string) =>
    rawFrom && rawFrom !== '/login' && rawFrom !== '/' ? rawFrom : fallback;

  async function submitLogin(idVal: string, pwVal: string) {
    if (!idVal.trim() || !pwVal) {
      setErr('Nhập tài khoản và mật khẩu.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await login(idVal.trim(), pwVal);
      navigate(destinationAfterAuth('/'), { replace: true });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (tab === 'login') {
      await submitLogin(identifier, password);
      return;
    }
    const cleanName = displayName.trim();
    const cleanUser = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanUser || !cleanEmail) {
      setErr('Vui lòng điền đầy đủ họ tên, tên người dùng và email.');
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUser)) {
      setErr('Tên người dùng gồm 3–30 ký tự chữ thường, số hoặc dấu gạch dưới.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErr('Địa chỉ email không hợp lệ.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setErr('Mật khẩu cần tối thiểu 8 ký tự, gồm cả chữ và số.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await register({
        displayName: cleanName,
        username: cleanUser,
        email: cleanEmail,
        password,
      });
      navigate('/feed', { replace: true });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full h-12 rounded-2xl border border-[#DCE6DF] bg-[#F8FBF9] pl-11 pr-4 text-[15px] text-[#111827] placeholder:text-[#8A9790] focus:bg-white focus:border-[#16A34A] focus:outline-none transition-colors';

  return (
    <div className="min-h-dvh w-full flex justify-center bg-[#E8F1EC]">
      <div className="relative flex flex-col justify-between w-full max-w-[430px] min-h-dvh overflow-hidden bg-[#F5FAF7] px-5 py-8 sm:shadow-[0_0_0_1px_#DCE6DF,0_24px_60px_-16px_rgba(20,83,45,0.14)]">
        <NeuralMeshCanvas />

        {/* Top Brand Anchor */}
        <div className="relative z-10 flex flex-col items-center pt-6">
          <NeuroLinkLogo />
          <p className="mt-3 text-xs font-medium text-[#5B6860]">
            Sức khỏe não bộ · qEEG · Chuyên gia
          </p>
        </div>

        {/* Center Minimal Auth Card */}
        <div className="relative z-10 my-auto py-6">
          <div className="rounded-[24px] border border-[#DCE6DF] bg-white/95 p-5 shadow-[0_8px_30px_-12px_rgba(20,83,45,0.12)] backdrop-blur-md">
            {/* Segmented Mode Pill */}
            <div className="relative grid grid-cols-2 gap-1 rounded-full bg-[#EFF6F1] p-1 mb-5">
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-full bg-white shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.22,1.12,0.36,1)] will-change-transform',
                  tab === 'register' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0',
                )}
              />
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErr(null);
                }}
                className={cn(
                  'relative z-10 h-9.5 rounded-full text-sm font-semibold transition-colors duration-200 cursor-pointer',
                  tab === 'login' ? 'text-[#111827]' : 'text-[#5B6860]',
                )}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErr(null);
                }}
                className={cn(
                  'relative z-10 h-9.5 rounded-full text-sm font-semibold transition-colors duration-200 cursor-pointer',
                  tab === 'register' ? 'text-[#111827]' : 'text-[#5B6860]',
                )}
              >
                Đăng ký
              </button>
            </div>

            {err && (
              <div
                role="alert"
                className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {err}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-3" noValidate>
              {tab === 'login' ? (
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-[#7A8880]" aria-hidden />
                  <input
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Tên đăng nhập hoặc email"
                    aria-label="Tên đăng nhập hoặc email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={inputCls}
                  />
                </div>
              ) : (
                <>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-[#7A8880]" aria-hidden />
                    <input
                      type="text"
                      placeholder="Họ và tên"
                      aria-label="Họ và tên"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-[#7A8880]" aria-hidden />
                    <input
                      type="text"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="Tên người dùng (vd: minh_an)"
                      aria-label="Tên người dùng"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-[#7A8880]" aria-hidden />
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      aria-label="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-[#7A8880]" aria-hidden />
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder="Mật khẩu"
                  aria-label="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputCls, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full text-[#7A8880] hover:text-[#111827] cursor-pointer"
                >
                  {showPw ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex w-full h-12 items-center justify-center rounded-full bg-[#16A34A] text-[15px] font-semibold text-white hover:bg-[#15803D] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
              >
                {busy ? 'Đang xử lý...' : tab === 'login' ? 'Tiếp tục' : 'Tạo tài khoản'}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Unobtrusive Quick Demo Access */}
        <div className="relative z-10 flex flex-col items-center gap-2.5 pb-2">
          <button
            type="button"
            onClick={() => setShowQuick((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#5B6860] hover:text-[#15803D] transition-colors cursor-pointer"
          >
            <Sparkles className="size-3.5 text-[#16A34A]" aria-hidden />
            <span>{showQuick ? 'Ẩn tài khoản mẫu' : 'Vào nhanh tài khoản mẫu'}</span>
          </button>

          {showQuick && (
            <div className="flex flex-wrap justify-center gap-1.5 animate-fade-in">
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setTab('login');
                    setIdentifier(acc.id);
                    setPassword('Password123');
                    void submitLogin(acc.id, 'Password123');
                  }}
                  className="rounded-full border border-[#DCE6DF] bg-white/95 px-3.5 h-9 text-xs font-semibold text-[#15803D] hover:border-[#16A34A] active:scale-95 transition-all cursor-pointer"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
