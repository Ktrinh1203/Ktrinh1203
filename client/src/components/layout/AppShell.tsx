import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
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
  Coins,
  Activity,
  Heart,
  Users,
  LayoutDashboard,
  Stethoscope,
  Clock,
  AlertCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, cn } from '../ui';
import { assetUrl } from '../../lib/assets';
import { useAuth } from '../../features/auth/AuthContext';
import { ACCOUNT_ROLE_LABELS, useMode } from '../../context/ModeContext';
import { notificationsApi, messagesApi, rewardsApi } from '../../api/endpoints';
import { ChatPopupProvider } from '../../features/messages/ChatPopupContext';
import { ChatPopupDock } from '../../features/messages/ChatPopupDock';
import { useRealtimeEvents } from '../../features/realtime/useRealtimeEvents';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  '/feed': () => import('../../pages/FeedPage'),
  '/eeg-hub': () => import('../../pages/EEGHubPage'),
  '/consultations': () => import('../../pages/ConsultationsPage'),
  '/my-health': () => import('../../pages/MyHealthPage'),
  '/communities': () => import('../../pages/CommunitiesPage'),
  '/dashboard': () => import('../../pages/ProfessionalDashboardPage'),
  '/contributions': () => import('../../pages/ContributionsPage'),
  '/messages': () => import('../../pages/MessagesPage'),
  '/rewards': () => import('../../pages/RewardsPage'),
};

function preloadRoute(to: string) {
  const path = to.split('?')[0];
  void ROUTE_PRELOADERS[path]?.();
}

function OutletFallback() {
  return (
    <div
      role="status"
      aria-label="Đang tải nội dung"
      className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#DCE6DF] bg-white"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-[#DCE6DF] border-t-[#16A34A]" />
    </div>
  );
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
      className={cn('group inline-flex items-center gap-1.5 sm:gap-2.5 select-none min-w-0', className)}
    >
      <img
        src={assetUrl('logo.svg')}
        alt="NeuroLink Logo"
        width={34}
        height={34}
        className="size-7 sm:size-8.5 shrink-0"
      />
      <div className="flex flex-col items-start min-w-0">
        <span
          className={cn(
            'text-[17px] sm:text-[21px] leading-none font-extrabold tracking-[-0.04em]',
            inverted ? 'text-white' : 'text-[#111827]',
          )}
        >
          neuro<span className={inverted ? 'text-emerald-300' : 'text-[#16A34A]'}>link</span>
        </span>
        <svg
          viewBox="0 0 112 12"
          fill="none"
          aria-hidden="true"
          className={cn(
            'w-[68px] sm:w-[88px] h-[9px] sm:h-[10px] -mt-0.5 overflow-visible',
            inverted ? 'text-emerald-300' : 'text-[#16A34A]',
          )}
          stroke="currentColor"
          strokeWidth="2.5"
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
    </Link>
  );
}

function UserMenu({ inverted = false }: { inverted?: boolean }) {
  const { user, logout } = useAuth();
  const { toggleMode, isProfessional, canAccessProfessionalMode } = useMode();
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
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border shrink-0',
            inverted
              ? 'border-white/20 text-white hover:bg-white/10'
              : 'border-[#DCE6DF] text-[#111827] hover:bg-[#F5FAF7]',
          )}
        >
          Đăng nhập
        </Link>
        <Link
          to="/register"
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0',
            inverted
              ? 'bg-white text-[#14532D] hover:bg-white/90'
              : 'bg-[#16A34A] text-white hover:bg-[#15803D]',
          )}
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const item =
    'group flex w-full items-center gap-2.5 px-3.5 py-2 text-xs text-[#1F2937] hover:bg-[#F5FAF7] hover:text-[#15803D] transition-colors font-medium';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-1 sm:px-1.5 py-1 transition-colors focus-visible:outline-none select-none shrink-0',
          inverted
            ? 'text-white hover:bg-white/10'
            : 'text-[#111827] hover:bg-[#F5FAF7]',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu tài khoản"
      >
        <Avatar name={user.displayName} src={user.avatarUrl} size="xs" />
        <span className="hidden xl:block text-xs font-medium max-w-[110px] truncate">
          {user.displayName}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-150 hidden sm:block',
            open && 'rotate-180',
            inverted ? 'text-white/60' : 'text-[#6B7280]',
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#DCE6DF] bg-white py-1 shadow-lg text-[#111827]"
        >
          <div className="border-b border-[#DCE6DF] bg-[#F5FAF7] px-3.5 py-2.5">
            <p className="truncate text-sm font-semibold text-[#111827]">{user.displayName}</p>
            <p className="truncate text-xs text-[#6B7280]">@{user.username}</p>
            {canAccessProfessionalMode && (
              <button
                type="button"
                onClick={() => {
                  toggleMode();
                  setOpen(false);
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#15803D] hover:bg-[#ECFDF3] transition-colors"
              >
                <Stethoscope className="size-3.5 shrink-0" aria-hidden />
                <span>{isProfessional ? 'Chế độ Cá nhân' : 'Chế độ Chuyên gia'}</span>
              </button>
            )}
          </div>

          <div className="py-1">
            <Link
              role="menuitem"
              to={`/u/${user.username}`}
              className={item}
              onClick={() => setOpen(false)}
            >
              <UserIcon className="size-4 text-[#6B7280] group-hover:text-[#16A34A]" />
              <span>Trang cá nhân</span>
            </Link>

            <Link
              role="menuitem"
              to="/rewards"
              className={item}
              onClick={() => setOpen(false)}
            >
              <Gift className="size-4 text-[#6B7280] group-hover:text-[#16A34A]" />
              <span>Ví Credit</span>
            </Link>

            <Link
              role="menuitem"
              to="/settings"
              className={item}
              onClick={() => setOpen(false)}
            >
              <Settings className="size-4 text-[#6B7280] group-hover:text-[#16A34A]" />
              <span>Cài đặt</span>
            </Link>

            {canAccessProfessionalMode && (
              <Link
                role="menuitem"
                to="/dashboard"
                className={item}
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard className="size-4 text-[#6B7280] group-hover:text-[#16A34A]" />
                <span>Bảng chuyên gia</span>
              </Link>
            )}

            {user.role === 'ADMIN' && (
              <Link
                role="menuitem"
                to="/admin"
                className={item}
                onClick={() => setOpen(false)}
              >
                <Shield className="size-4 text-[#6B7280] group-hover:text-[#16A34A]" />
                <span>Quản trị</span>
              </Link>
            )}
          </div>

          <div className="border-t border-[#DCE6DF] pt-1">
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut className="size-4 text-[#DC2626]" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppShellContent() {
  const { user } = useAuth();
  const {
    isProfessional,
    canAccessProfessionalMode,
    enableVerificationCenter,
    enableResubmission,
    accountRole,
    verificationStatus,
  } = useMode();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');

  useRealtimeEvents(Boolean(user));

  const rejectedProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'REJECTED');
  const pendingProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'PENDING');

  const { data: walletData } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(1),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const walletBalance = walletData?.wallet?.balance ?? 0;
  const unreadNotifs = notifData?.unreadCount ?? 0;
  const unreadConvs = convData?.conversations.filter((c) => c.isUnread).length ?? 0;

  const handleGlobalSearch = (e: FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  // Left Architectural Navigation Rail items
  const sidebarItems: NavItem[] = isProfessional
    ? [
        { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
        { to: '/eeg-hub?view=workspace', label: 'Trạm qEEG', icon: Activity },
        { to: '/consultations?tab=queue', label: 'Ca chờ đọc', icon: Stethoscope },
        { to: '/feed', label: 'Bảng tin', icon: Home },
        { to: '/contributions', label: 'Nghiên cứu', icon: Award },
        { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, badge: unreadConvs },
        { to: '/rewards', label: 'Ví thù lao', icon: Gift },
      ]
    : [
        { to: '/feed', label: 'Bảng tin', icon: Home },
        { to: '/eeg-hub', label: 'Đo sóng não', icon: Activity },
        { to: '/consultations', label: 'Hỏi bác sĩ', icon: Stethoscope },
        { to: '/my-health', label: 'Nhật ký', icon: Heart },
        { to: '/communities', label: 'Cộng đồng', icon: Users },
        { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, badge: unreadConvs },
        { to: '/rewards', label: 'Credit', icon: Gift },
      ];

  // Mobile Bottom Nav items (5 monochrome tabs)
  const mobileNavItems: NavItem[] = isProfessional
    ? [
        { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
        { to: '/consultations?tab=queue', label: 'Ca chờ', icon: Stethoscope },
        { to: '/eeg-hub?view=workspace', label: 'Trạm qEEG', icon: Activity },
        { to: '/feed', label: 'Bảng tin', icon: Home },
        { to: '/messages', label: 'Tin nhắn', icon: MessageCircle, badge: unreadConvs },
      ]
    : [
        { to: '/feed', label: 'Bảng tin', icon: Home },
        { to: '/eeg-hub', label: 'Đo sóng', icon: Activity },
        { to: '/consultations', label: 'Hỏi BS', icon: Stethoscope },
        { to: '/my-health', label: 'Nhật ký', icon: Heart },
        { to: '/communities', label: 'Cộng đồng', icon: Users },
      ];

  const iconBtnClass = isProfessional
    ? 'relative flex size-7.5 sm:size-8.5 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-[background-color,color,transform] duration-150 ease-out active:scale-95'
    : 'relative flex size-7.5 sm:size-8.5 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-[background-color,color,transform] duration-150 ease-out active:scale-95';

  return (
    <div
      data-mode={isProfessional ? 'professional' : 'general'}
      className="min-h-screen pb-18 md:pb-10 bg-[#F5FAF7] text-[#111827]"
    >
      {/* Top Sticky Header */}
      <header
        className={cn(
          'h-14 sticky top-0 z-40 border-t-2 border-t-[#16A34A]',
          isProfessional
            ? 'bg-[#14532D] text-white border-b border-[#052E16]'
            : 'bg-white/95 backdrop-blur-md border-b border-[#DCE6DF]',
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1220px] items-center justify-between gap-1.5 sm:gap-4 px-2.5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <Logo inverted={isProfessional} isProfessional={isProfessional} />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <form onSubmit={handleGlobalSearch} className="hidden sm:block w-44 lg:w-56 mr-0.5">
              <div className="relative w-full">
                <Search
                  className={cn(
                    'absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5',
                    isProfessional ? 'text-white/50' : 'text-[#8A8882]',
                  )}
                  aria-hidden
                />
                <input
                  type="text"
                  placeholder={isProfessional ? 'Tra cứu ca, CCHN...' : 'Tìm kiếm...'}
                  aria-label="Tìm kiếm toàn trang"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border pl-8.5 pr-3 py-1.5 text-xs focus:outline-none transition-colors',
                    isProfessional
                      ? 'border-white/15 bg-white/10 text-white placeholder:text-white/50 focus:border-white/40'
                      : 'border-[#E2E0D8] bg-white text-[#141413] placeholder:text-[#8A8882] focus:border-[#1B4332]',
                  )}
                />
              </div>
            </form>

            {user && (
              <Link
                to="/rewards"
                aria-label="Ví Credit"
                title="Ví Credit & Thanh toán"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold tabular-nums transition-colors shrink-0 whitespace-nowrap',
                  isProfessional
                    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                    : 'border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D] hover:bg-[#DCFCE7]',
                )}
              >
                <Coins className="size-3.5 shrink-0" aria-hidden />
                <span>
                  {walletBalance.toLocaleString('vi-VN')}
                  <span className="hidden sm:inline"> Credit</span>
                </span>
              </Link>
            )}

            <Link to="/search" aria-label="Tìm kiếm" className={cn(iconBtnClass, 'sm:hidden')}>
              <Search className="size-4 sm:size-4.5" aria-hidden />
            </Link>

            <Link to="/notifications" aria-label="Thông báo" className={iconBtnClass}>
              <Bell className="size-4 sm:size-4.5" aria-hidden />
              {Boolean(unreadNotifs && unreadNotifs > 0) && (
                <span className="absolute top-0.5 right-0.5 flex min-w-4 h-4 px-0.5 items-center justify-center rounded-full bg-[#B91C1C] text-[10px] font-semibold text-white leading-none">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </Link>

            <UserMenu inverted={isProfessional} />
          </div>
        </div>
      </header>

      {/* 3-Column Architectural Body */}
      <div className="mx-auto max-w-[1220px] px-4 sm:px-6 py-6 flex gap-7 items-start">
        {/* Left Architectural Navigation Rail */}
        <aside
          aria-label="Điều hướng chính"
          className="hidden md:flex flex-col w-[208px] shrink-0 sticky top-[76px] self-start pr-4 border-r border-[#DCE6DF]"
        >
          <nav className="flex flex-col gap-0.5">
            {sidebarItems.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                onMouseEnter={() => preloadRoute(to)}
                onFocus={() => preloadRoute(to)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 active:scale-[0.98]',
                    isActive
                      ? 'font-semibold text-[#15803D] bg-[#ECFDF3]'
                      : 'font-normal text-[#4B5563] hover:text-[#111827] hover:bg-[#EAF4EE]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        isActive ? 'text-[#16A34A]' : 'text-[#6B7280]',
                      )}
                      aria-hidden
                    />
                    <span className="truncate flex-1">{label}</span>
                    {Boolean(badge && badge > 0) && (
                      <span className="rounded-full bg-[#DCFCE7] px-1.5 py-0.2 text-[11px] font-semibold text-[#15803D] tabular-nums">
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-4">
          {!canAccessProfessionalMode && verificationStatus === 'PENDING' && enableVerificationCenter && (
            <div className="rounded-xl border border-[#E6E4DF] bg-white px-4 py-2.5 text-xs text-[#262624] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="size-4 text-[#6E6D68] shrink-0" aria-hidden />
                <p className="truncate">
                  Hồ sơ <strong>{pendingProfile?.title || ACCOUNT_ROLE_LABELS[accountRole]}</strong> đang chờ phê duyệt.
                </p>
              </div>
              <Link
                to="/settings#verification-center"
                className="text-xs font-semibold text-[#1B4332] hover:underline shrink-0"
              >
                Trung tâm xác minh →
              </Link>
            </div>
          )}

          {!canAccessProfessionalMode && verificationStatus === 'REJECTED' && enableResubmission && (
            <div className="rounded-xl border border-[#E6E4DF] bg-white px-4 py-2.5 text-xs text-[#262624] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="size-4 text-[#B91C1C] shrink-0" aria-hidden />
                <p className="truncate">
                  Hồ sơ <strong>{rejectedProfile?.title || ACCOUNT_ROLE_LABELS[accountRole]}</strong> cần nộp lại
                  {rejectedProfile?.verificationNote ? `: "${rejectedProfile.verificationNote}"` : '.'}
                </p>
              </div>
              <Link
                to="/settings?resubmit=true#verification-center"
                className="text-xs font-semibold text-[#B91C1C] hover:underline shrink-0"
              >
                Nộp lại hồ sơ →
              </Link>
            </div>
          )}

          <Suspense fallback={<OutletFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-[#DCE6DF] bg-white md:hidden"
        aria-label="Điều hướng di động"
      >
        {mobileNavItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onMouseEnter={() => preloadRoute(to)}
            onFocus={() => preloadRoute(to)}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] transition-[color,transform] duration-150 ease-out active:scale-95',
                isActive ? 'text-[#16A34A] font-semibold' : 'text-[#6B7280] font-normal hover:text-[#111827]',
              )
            }
          >
            <div className="relative">
              <Icon className="size-4.5" aria-hidden />
              {Boolean(badge && badge > 0) && (
                <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#B91C1C] px-1 text-[9px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </div>
            <span className="truncate max-w-[64px]">{label}</span>
          </NavLink>
        ))}
      </nav>
      <ChatPopupDock />
    </div>
  );
}

export function AppShell() {
  return (
    <ChatPopupProvider>
      <AppShellContent />
    </ChatPopupProvider>
  );
}
