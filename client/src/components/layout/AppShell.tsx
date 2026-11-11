import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  LogOut,
  Settings,
  Shield,
  User as UserIcon,
  Search,
  MessageCircle,
  Bell,
  Award,
  Gift,
  Activity,
  Heart,
  Brain,
  Users,
  LayoutDashboard,
  Stethoscope,
  Clock,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, cn } from '../ui';
import { useAuth } from '../../features/auth/AuthContext';
import { ACCOUNT_ROLE_LABELS, useMode } from '../../context/ModeContext';
import { notificationsApi, messagesApi } from '../../api/endpoints';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function Logo({
  className,
  inverted = false,
  isProfessional = false,
}: {
  className?: string;
  inverted?: boolean;
  isProfessional?: boolean;
}) {
  return (
    <Link
      to={isProfessional ? '/dashboard' : '/feed'}
      className={cn('group inline-flex items-center gap-2.5 select-none', className)}
    >
      <div className="flex flex-col items-start">
        <span
          className={cn(
            'text-2xl leading-none font-black tracking-[-0.045em]',
            inverted ? 'text-white' : 'text-slate-800',
          )}
        >
          neurolink
        </span>
        <svg
          viewBox="0 0 112 12"
          fill="none"
          className={cn(
            'w-[96px] h-[11px] -mt-0.5 overflow-visible',
            inverted ? 'text-teal-300' : isProfessional ? 'text-brand-600' : 'text-teal-600',
          )}
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M2 6 H44 L49 1.5 L55 10.5 L60 3.5 L63.5 6 H108"
            pathLength={48}
            strokeDasharray={48}
            className="group-hover:animate-[ecg-flow_750ms_cubic-bezier(0.16,1,0.3,1)]"
          />
        </svg>
      </div>
      {isProfessional ? (
        <span
          className={cn(
            'hidden sm:inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider border whitespace-nowrap shrink-0',
            inverted
              ? 'bg-white/10 text-teal-200 border-white/20'
              : 'bg-brand-50 text-brand-700 border-brand-200/80',
          )}
        >
          CLINICAL & BCI
        </span>
      ) : (
        <span className="hidden sm:inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-sky-800 border border-sky-200/80 whitespace-nowrap shrink-0">
          Health & Brain
        </span>
      )}
    </Link>
  );
}

function UserMenu({ inverted = false }: { inverted?: boolean }) {
  const { user, logout } = useAuth();
  const {
    toggleMode,
    isProfessional,
    canAccessProfessionalMode,
    enableVerificationCenter,
    enableResubmission,
    accountRole,
    verificationStatus,
  } = useMode();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          to="/login"
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-bold transition-all border shrink-0',
            inverted
              ? 'border-white/20 text-white hover:bg-white/10'
              : 'border-slate-200 text-slate-700 hover:text-teal-800 hover:bg-slate-100',
          )}
        >
          Đăng nhập
        </Link>
        <Link
          to="/register"
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-bold transition-all shadow-2xs shrink-0',
            inverted
              ? 'bg-teal-400 text-slate-950 hover:bg-teal-300'
              : 'bg-teal-700 text-white hover:bg-teal-800',
          )}
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const item =
    'group flex w-full items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-full sm:rounded-md p-1 sm:px-2.5 sm:py-1 transition-all focus:outline-none border border-transparent select-none shrink-0',
          inverted
            ? 'hover:bg-white/10 hover:border-white/20 text-white'
            : 'hover:bg-slate-100 hover:border-slate-200 text-slate-800',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu tài khoản"
      >
        <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
        <div className="hidden md:flex flex-col items-start text-left leading-tight">
          <span className="text-xs font-bold max-w-[120px] truncate">{user.displayName}</span>
          <span className={cn('text-[10px] font-medium', inverted ? 'text-teal-300' : 'text-slate-500')}>
            {isProfessional ? 'Chuyên gia' : 'Thành viên'}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-150 hidden sm:block',
            open && 'rotate-180',
            inverted ? 'text-slate-300' : 'text-slate-400',
          )}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-68 overflow-hidden rounded-lg border border-slate-200/90 bg-white py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100 text-slate-800"
        >
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
            <p className="truncate text-xs text-slate-500">@{user.username}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-600">
              {ACCOUNT_ROLE_LABELS[accountRole]}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${
                  isProfessional
                    ? 'bg-brand-50 text-brand-700 border-brand-200'
                    : 'bg-teal-50 text-teal-700 border-teal-200'
                }`}
              >
                {isProfessional ? 'Chế độ Chuyên gia' : 'Chế độ Thành viên'}
              </span>
              {verificationStatus === 'VERIFIED' && (
                <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Đã xác minh
                </span>
              )}
              {verificationStatus === 'PENDING' && (
                <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                  Chờ xét duyệt
                </span>
              )}
              {verificationStatus === 'REJECTED' && (
                <span className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                  Cần nộp lại
                </span>
              )}
              {user.role === 'ADMIN' && (
                <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                  Quản trị viên
                </span>
              )}
            </div>
          </div>

          <div className="py-1">
            {canAccessProfessionalMode ? (
              <button
                type="button"
                className={cn(item, 'bg-slate-50/60 font-semibold text-brand-700 hover:bg-brand-50')}
                onClick={() => {
                  toggleMode();
                  setOpen(false);
                }}
              >
                {isProfessional ? (
                  <>
                    <UserIcon className="size-4 text-teal-600" /> Chuyển sang Chế độ Thành viên
                  </>
                ) : (
                  <>
                    <Stethoscope className="size-4 text-brand-600" /> Chuyển sang Chế độ Chuyên gia
                  </>
                )}
              </button>
            ) : enableResubmission ? (
              <Link
                role="menuitem"
                to="/settings?resubmit=true#verification-center"
                className={cn(item, 'bg-red-50/60 font-semibold text-red-700 hover:bg-red-50')}
                onClick={() => setOpen(false)}
              >
                <AlertCircle className="size-4 text-red-600" /> Nộp lại Hồ sơ Minh chứng
              </Link>
            ) : enableVerificationCenter ? (
              <Link
                role="menuitem"
                to="/settings#verification-center"
                className={cn(item, 'bg-amber-50/60 font-semibold text-amber-800 hover:bg-amber-50')}
                onClick={() => setOpen(false)}
              >
                <Clock className="size-4 text-amber-600" /> Trung tâm Xác minh (Đang chờ duyệt)
              </Link>
            ) : (
              <Link
                role="menuitem"
                to="/settings#verification-center"
                className={cn(item, 'bg-slate-50/60 font-semibold text-brand-700 hover:bg-brand-50')}
                onClick={() => setOpen(false)}
              >
                <ShieldCheck className="size-4 text-brand-600" /> Đăng ký Xác minh Chuyên gia
              </Link>
            )}
            <Link role="menuitem" to={`/u/${user.username}`} className={item} onClick={() => setOpen(false)}>
              <UserIcon className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" />{' '}
              {isProfessional ? 'Hồ sơ Chuyên môn' : 'Trang cá nhân'}
            </Link>
            {isProfessional ? (
              <>
                <Link role="menuitem" to="/dashboard" className={item} onClick={() => setOpen(false)}>
                  <LayoutDashboard className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Tổng quan Chuyên môn
                </Link>
                <Link role="menuitem" to="/contributions" className={item} onClick={() => setOpen(false)}>
                  <Award className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Research Hub & Đóng góp
                </Link>
                <Link role="menuitem" to="/eeg-hub?view=workspace" className={item} onClick={() => setOpen(false)}>
                  <Activity className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> EEG Workspace
                </Link>
                <Link role="menuitem" to="/rewards" className={item} onClick={() => setOpen(false)}>
                  <Gift className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Ví tín chỉ Honoraria & CME
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <Link role="menuitem" to="/my-health" className={item} onClick={() => setOpen(false)}>
                  <Heart className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Sức khỏe cá nhân (My Health)
                </Link>
                <Link role="menuitem" to="/eeg-hub?view=personal" className={item} onClick={() => setOpen(false)}>
                  <Brain className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Bản ghi My EEG cá nhân
                </Link>
              </>
            ) : (
              <>
                <Link role="menuitem" to="/my-health" className={item} onClick={() => setOpen(false)}>
                  <Heart className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Sức khỏe của tôi
                </Link>
                <Link role="menuitem" to="/eeg-hub?view=personal" className={item} onClick={() => setOpen(false)}>
                  <Brain className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Dữ liệu EEG cá nhân
                </Link>
                <Link role="menuitem" to="/communities" className={item} onClick={() => setOpen(false)}>
                  <Users className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Cộng đồng hỗ trợ
                </Link>
                <Link role="menuitem" to="/messages" className={item} onClick={() => setOpen(false)}>
                  <MessageCircle className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Tin nhắn trao đổi
                </Link>
              </>
            )}
            <Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
              <Settings className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Cài đặt tài khoản
            </Link>
            {user.role === 'ADMIN' && (
              <Link role="menuitem" to="/admin" className={item} onClick={() => setOpen(false)}>
                <Shield className="size-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> Quản trị hệ thống
              </Link>
            )}
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button
              role="menuitem"
              type="button"
              className={cn(item, 'text-red-600 hover:bg-red-50/80')}
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut className="size-4 text-red-500" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const {
    setMode,
    isProfessional,
    isGeneral,
    canAccessProfessionalMode,
    enableVerificationCenter,
    enableResubmission,
    accountRole,
    verificationStatus,
  } = useMode();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');

  const rejectedProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'REJECTED');
  const pendingProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'PENDING');

  // Polling for notification badges
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(1),
    enabled: Boolean(user),
    refetchInterval: 15000,
  });

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    enabled: Boolean(user),
    refetchInterval: 15000,
  });

  const unreadNotifs = notifData?.unreadCount ?? 0;
  const unreadConvs = convData?.conversations.filter((c) => c.isUnread).length ?? 0;

  const handleGlobalSearch = (e: FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  // Dynamic Navigation Items for Mobile Bottom Navigation
  const navItems: NavItem[] = isProfessional
    ? [
        { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
        { to: '/feed', label: 'Bảng tin', icon: Home },
        { to: '/contributions', label: 'Research', icon: Award },
        { to: '/eeg-hub?view=workspace', label: 'EEG', icon: Activity },
        { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, badge: unreadConvs },
      ]
    : [
        { to: '/feed', label: 'Trang chủ', icon: Home },
        { to: '/search', label: 'Khám phá', icon: Search },
        { to: '/communities', label: 'Cộng đồng', icon: Users },
        { to: '/my-health', label: 'Sức khỏe', icon: Heart },
        { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, badge: unreadConvs },
      ];

  return (
    <div
      data-mode={isProfessional ? 'professional' : 'general'}
      className={cn(
        'min-h-screen pb-20 md:pb-10 relative overflow-x-hidden transition-colors',
        isProfessional ? 'bg-[#F1F5F9] text-slate-800' : 'bg-[#F8FAFB] text-slate-700',
      )}
    >
      {/* ===================================================================== */}
      {/* MODE A: GENERAL MODE HEADER (Friendly, White & Soft Neutral, Teal/Sky) */}
      {/* ===================================================================== */}
      {!isProfessional ? (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 border-t-2 border-t-teal-600 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
            <div className="flex items-center gap-3 lg:gap-5">
              <Logo isProfessional={false} />

              {/* Mode Switcher or Verification Status Pill */}
              {canAccessProfessionalMode ? (
                <div className="hidden sm:flex items-center rounded-md border border-teal-200/80 bg-teal-50/50 p-0.5 text-xs font-semibold whitespace-nowrap shrink-0">
                  <button
                    type="button"
                    onClick={() => setMode('general')}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded transition-all select-none whitespace-nowrap',
                      isGeneral
                        ? 'bg-white text-teal-900 shadow-2xs font-bold border border-teal-200/60'
                        : 'text-slate-500 hover:text-slate-800',
                    )}
                  >
                    <UserIcon className="size-3.5 text-teal-600 shrink-0" />
                    <span>Thành viên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('professional')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-slate-600 hover:text-brand-700 transition-all select-none whitespace-nowrap"
                  >
                    <Stethoscope className="size-3.5 text-brand-600 shrink-0" />
                    <span>Chuyên gia</span>
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-teal-200/70 bg-teal-50/40 p-0.5 text-xs font-semibold whitespace-nowrap shrink-0">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white text-teal-900 shadow-2xs font-bold select-none whitespace-nowrap">
                    <UserIcon className="size-3.5 text-teal-600 shrink-0" />
                    <span>Thành viên</span>
                  </span>
                  {enableResubmission ? (
                    <Link
                      to="/settings?resubmit=true#verification-center"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-bold whitespace-nowrap"
                    >
                      <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                      <span>Nộp lại Hồ sơ</span>
                    </Link>
                  ) : enableVerificationCenter ? (
                    <Link
                      to="/settings#verification-center"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors font-bold whitespace-nowrap"
                    >
                      <Clock className="size-3.5 text-amber-600 shrink-0" />
                      <span>Chờ duyệt CCHN/ORCID</span>
                    </Link>
                  ) : null}
                </div>
              )}
            </div>

            {/* Search Input */}
            <form onSubmit={handleGlobalSearch} className="hidden md:flex flex-1 max-w-sm mx-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiến thức sức khỏe, bác sĩ, bệnh án..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 transition-colors hover:border-teal-300 focus:bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {canAccessProfessionalMode && (
                <button
                  type="button"
                  onClick={() => setMode('professional')}
                  aria-label="Đổi chế độ"
                  className="sm:hidden flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <UserIcon className="size-4 text-teal-600" />
                </button>
              )}

              <Link
                to="/search"
                aria-label="Tìm kiếm"
                className="md:hidden flex size-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Search className="size-5" />
              </Link>

              <Link
                to="/messages"
                aria-label="Tin nhắn"
                className="relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
              >
                <MessageCircle className="size-5" />
                {Boolean(unreadConvs && unreadConvs > 0) && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                    {unreadConvs}
                  </span>
                )}
              </Link>

              <Link
                to="/notifications"
                aria-label="Thông báo"
                className="relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
              >
                <Bell className="size-5" />
                {Boolean(unreadNotifs && unreadNotifs > 0) && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
                    {unreadNotifs}
                  </span>
                )}
              </Link>

              <Link
                to="/feed"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors shadow-2xs ml-1 whitespace-nowrap shrink-0"
              >
                <span>+ Tạo bài viết</span>
              </Link>

              <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />
              <UserMenu inverted={false} />
              {user && (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/login', { replace: true });
                  }}
                  title="Đăng xuất khỏi tài khoản"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors shadow-2xs shrink-0 select-none"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="size-3.5 text-slate-500" />
                  <span>Đăng xuất</span>
                </button>
              )}
            </div>
          </div>

          {/* Tier 2: General Mode Navigation Strip (Visible across Desktop, Tablet, and Mobile) */}
          <div className="border-t border-slate-200/80 bg-white">
            <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-3 sm:px-6 text-xs">
              <nav
                className="flex items-center gap-1 overflow-x-auto h-full"
                aria-label="Điều hướng thành viên"
              >
                <NavLink
                  to="/feed"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Home className="size-3.5 text-teal-600 shrink-0" />
                  <span>Trang chủ</span>
                </NavLink>
                <NavLink
                  to="/search"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Search className="size-3.5 text-teal-600 shrink-0" />
                  <span>Khám phá</span>
                </NavLink>
                <NavLink
                  to="/communities"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Users className="size-3.5 text-teal-600 shrink-0" />
                  <span>Cộng đồng</span>
                </NavLink>
                <NavLink
                  to="/my-health"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Heart className="size-3.5 text-rose-500 shrink-0" />
                  <span>Sức khỏe của tôi</span>
                </NavLink>
                <NavLink
                  to="/eeg-hub?view=personal"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-sky-600 text-sky-800 bg-sky-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Brain className="size-3.5 text-sky-600 shrink-0" />
                  <span>My EEG</span>
                </NavLink>
                <NavLink
                  to="/messages"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <MessageCircle className="size-3.5 text-teal-600 shrink-0" />
                  <span>Tin nhắn</span>
                </NavLink>
                {user && (
                  <NavLink
                    to={`/u/${user.username}`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                        isActive
                          ? 'border-teal-600 text-teal-800 bg-teal-50/40 font-bold'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                      )
                    }
                  >
                    <UserIcon className="size-3.5 text-teal-600 shrink-0" />
                    <span>Hồ sơ</span>
                  </NavLink>
                )}
                {user?.role === 'ADMIN' && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1.5 h-full px-2.5 border-b-2 font-bold transition-colors whitespace-nowrap shrink-0',
                        isActive
                          ? 'border-purple-600 text-purple-800 bg-purple-50/60'
                          : 'border-transparent text-purple-700 hover:bg-purple-50/50',
                      )
                    }
                  >
                    <Shield className="size-3.5 text-purple-600 shrink-0" />
                    <span>Quản trị</span>
                  </NavLink>
                )}
              </nav>

              <div className="flex items-center gap-2 text-[11px] text-teal-700 font-semibold whitespace-nowrap shrink-0">
                <span className="hidden sm:inline">Chăm sóc Sức khỏe & Nghiên cứu Não bộ</span>
              </div>
            </div>
          </div>
        </header>
      ) : (
        /* ===================================================================== */
        /* MODE B: PROFESSIONAL MODE HEADER (Two-Tier Navy & Structured Sub-Nav) */
        /* ===================================================================== */
        <header className="sticky top-0 z-40 shadow-2xs">
          {/* Tier 1: Navy Blue Clinical & Research Command Bar */}
          <div className="bg-[#162B47] text-white border-b border-[#0F1E32]">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
              <div className="flex items-center gap-4 lg:gap-5">
                <Logo inverted isProfessional />

                {/* Mode Switcher in Navy Header */}
                {canAccessProfessionalMode && (
                  <div className="hidden sm:flex items-center rounded-md border border-white/15 bg-[#0F1E32]/80 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setMode('general')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-slate-300 hover:text-white transition-all select-none"
                      title="Chuyển sang Chế độ Thành viên"
                    >
                      <UserIcon className="size-3.5 text-teal-300" />
                      <span>Thành viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('professional')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2B4C7E] text-white shadow-2xs font-bold border border-white/15 transition-all select-none"
                      title="Đang ở Chế độ Chuyên gia"
                    >
                      <Stethoscope className="size-3.5 text-teal-300" />
                      <span>Chuyên gia</span>
                    </button>
                  </div>
                )}

                <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-300 border-l border-white/15 pl-4">
                  <ShieldCheck className="size-3.5 text-teal-300 shrink-0" />
                  <span className="font-medium truncate max-w-[220px]">
                    {ACCOUNT_ROLE_LABELS[accountRole]} · Đã xác minh
                  </span>
                </div>
              </div>

              {/* Clinical & Research Search Input */}
              <form onSubmit={handleGlobalSearch} className="hidden md:flex flex-1 max-w-md mx-2">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-300" />
                  <input
                    type="text"
                    placeholder="Tra cứu ca lâm sàng, mã CCHN/ORCID, đạo trình EEG, chuyên gia..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-[#0F1E32]/75 pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-400 transition-colors hover:border-white/25 focus:bg-[#0F1E32] focus:border-teal-400 focus:outline-none"
                  />
                </div>
              </form>

              {/* Right Command Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {canAccessProfessionalMode && (
                  <button
                    type="button"
                    onClick={() => setMode('general')}
                    aria-label="Đổi chế độ"
                    className="sm:hidden flex size-8 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10 transition-colors"
                  >
                    <Stethoscope className="size-4 text-teal-300" />
                  </button>
                )}

                <Link
                  to="/search"
                  aria-label="Tìm kiếm"
                  className="md:hidden flex size-8 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <Search className="size-4.5" />
                </Link>

                <Link
                  to="/messages"
                  aria-label="Tin nhắn chuyên môn"
                  className="relative flex size-8 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <MessageCircle className="size-4.5" />
                  {Boolean(unreadConvs && unreadConvs > 0) && (
                    <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-slate-950">
                      {unreadConvs}
                    </span>
                  )}
                </Link>

                <Link
                  to="/notifications"
                  aria-label="Thông báo"
                  className="relative flex size-8 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Bell className="size-4.5" />
                  {Boolean(unreadNotifs && unreadNotifs > 0) && (
                    <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950">
                      {unreadNotifs}
                    </span>
                  )}
                </Link>

                <Link
                  to="/contributions"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[#2C6865] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#214F4D] border border-teal-400/30 transition-colors ml-1"
                >
                  <span>+ Công bố ca bệnh</span>
                </Link>

                <div className="h-4 w-px bg-white/15 mx-1 hidden sm:block" />
                <UserMenu inverted />
                {user && (
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      navigate('/login', { replace: true });
                    }}
                    title="Đăng xuất khỏi tài khoản"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-red-300 hover:bg-red-950/40 hover:border-red-400/40 transition-colors shrink-0 select-none"
                    aria-label="Đăng xuất"
                  >
                    <LogOut className="size-3.5 text-slate-300" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tier 2: Structured Clinical & Research Sub-Navigation Strip (Visible across Desktop, Tablet, and Mobile) */}
          <div className="bg-white border-b border-slate-200/90">
            <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-3 sm:px-6 text-xs">
              <nav className="flex items-center gap-0.5 h-full overflow-x-auto" aria-label="Điều hướng chuyên gia">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <LayoutDashboard className="size-3.5 text-brand-600 shrink-0" />
                  <span>Tổng quan</span>
                </NavLink>
                <NavLink
                  to="/feed"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <span>Bảng tin Chuyên môn</span>
                </NavLink>
                <NavLink
                  to="/search"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <span>Danh bạ Chuyên gia</span>
                </NavLink>
                <NavLink
                  to="/communities"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <span>Hội đồng Chuyên khoa</span>
                </NavLink>
                <NavLink
                  to="/contributions"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Award className="size-3.5 text-accent-600 shrink-0" />
                  <span>Research Hub</span>
                </NavLink>
                <NavLink
                  to="/eeg-hub?view=workspace"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Activity className="size-3.5 text-brand-600 shrink-0" />
                  <span>EEG Workspace</span>
                </NavLink>
                <NavLink
                  to="/messages"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <MessageCircle className="size-3.5 text-brand-600 shrink-0" />
                  <span>Tin nhắn</span>
                </NavLink>
                <NavLink
                  to="/rewards"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    )
                  }
                >
                  <Gift className="size-3.5 text-brand-600 shrink-0" />
                  <span>Tín chỉ & Honoraria</span>
                </NavLink>
                {user && (
                  <NavLink
                    to={`/u/${user.username}`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1.5 h-full px-2 border-b-2 font-semibold transition-colors whitespace-nowrap shrink-0',
                        isActive
                          ? 'border-brand-600 text-brand-700 bg-brand-50/40 font-bold'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                      )
                    }
                  >
                    <span>Hồ sơ Chuyên gia</span>
                  </NavLink>
                )}
                {user?.role === 'ADMIN' && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1.5 h-full px-2 border-b-2 font-bold transition-colors whitespace-nowrap shrink-0',
                        isActive
                          ? 'border-purple-600 text-purple-800 bg-purple-50/60'
                          : 'border-transparent text-purple-700 hover:bg-purple-50/50',
                      )
                    }
                  >
                    <Shield className="size-3.5 text-purple-600 shrink-0" />
                    <span>Quản trị</span>
                  </NavLink>
                )}
              </nav>

              <div className="hidden 2xl:flex items-center gap-2 text-[11px] font-mono text-slate-500 whitespace-nowrap shrink-0">
                <span>ICD-10 / 10-20 EEG</span>
                <span className="text-slate-300">|</span>
                <span className="text-brand-700 font-semibold">PHI Anonymized</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'mx-auto px-3 sm:px-6 space-y-4',
          isProfessional ? 'max-w-7xl py-5' : 'max-w-6xl py-6',
        )}
      >
        {/* Phase 3 Automatic Role Resolution Banner for Pending / Rejected Verification */}
        {!canAccessProfessionalMode && verificationStatus === 'PENDING' && enableVerificationCenter && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <Clock className="size-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold">
                  Phân giải Trải nghiệm Tự động: Chế độ Thành viên (GENERAL_MODE)
                </span>
                <span className="hidden sm:inline"> · </span>
                <p className="sm:inline text-amber-900">
                  Hồ sơ <strong>{pendingProfile?.title || ACCOUNT_ROLE_LABELS[accountRole]}</strong> của bạn đang ở trạng thái <strong>PENDING</strong> (Chờ Quản trị viên phê duyệt). Chế độ Chuyên gia sẽ tự động kích hoạt ngay sau khi minh chứng được duyệt.
                </p>
              </div>
            </div>
            <Link
              to="/settings#verification-center"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shrink-0"
            >
              <ShieldCheck className="size-3.5" /> Mở Trung tâm Xác minh
            </Link>
          </div>
        )}

        {!canAccessProfessionalMode && verificationStatus === 'REJECTED' && enableResubmission && (
          <div className="rounded-lg border border-red-300 bg-red-50/90 px-4 py-3 text-xs text-red-950 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold">
                  Phân giải Trải nghiệm Tự động: Chế độ Thành viên (GENERAL_MODE) — Cần nộp lại hồ sơ
                </span>
                <p className="text-red-900 mt-0.5">
                  Hồ sơ <strong>{rejectedProfile?.title || ACCOUNT_ROLE_LABELS[accountRole]}</strong> ở trạng thái <strong>REJECTED</strong>
                  {rejectedProfile?.verificationNote ? `: "${rejectedProfile.verificationNote}"` : '.'}
                </p>
              </div>
            </div>
            <Link
              to="/settings?resubmit=true#verification-center"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors shrink-0"
            >
              <ShieldCheck className="size-3.5" /> Nộp lại Minh chứng
            </Link>
          </div>
        )}

        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t md:hidden shadow-lg',
          isProfessional ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white',
        )}
        aria-label="Điều hướng di động"
      >
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors',
                isActive
                  ? isProfessional
                    ? 'text-brand-700 font-bold'
                    : 'text-teal-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-900',
              )
            }
          >
            <div className="relative">
              <Icon className="size-5" aria-hidden />
              {Boolean(badge && badge > 0) && (
                <span
                  className={cn(
                    'absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-xs',
                    isProfessional ? 'bg-brand-600' : 'bg-teal-600',
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            <span className="truncate max-w-[64px]">{label}</span>
          </NavLink>
        ))}

        {user && (
          <NavLink
            to={`/u/${user.username}`}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors',
                isActive
                  ? isProfessional
                    ? 'text-brand-700 font-bold'
                    : 'text-teal-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-900',
              )
            }
          >
            <Avatar name={user.displayName} src={user.avatarUrl} size="xs" />
            <span>Hồ sơ</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}
