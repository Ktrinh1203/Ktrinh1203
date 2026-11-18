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
  ExternalLink,
  HelpCircle,
  X,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, cn } from '../ui';
import { useAuth } from '../../features/auth/AuthContext';
import { ACCOUNT_ROLE_LABELS, useMode } from '../../context/ModeContext';
import { notificationsApi, messagesApi } from '../../api/endpoints';
import { ChatPopupProvider, useChatPopup } from '../../features/messages/ChatPopupContext';
import { ChatPopupDock } from '../../features/messages/ChatPopupDock';

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
      <img
        src="/logo.svg"
        alt="NeuroLink Logo"
        width={34}
        height={34}
        className="size-8.5 shrink-0"
      />
      <div className="flex flex-col items-start">
        <span
          className={cn(
            'text-[21px] leading-none font-extrabold tracking-[-0.04em]',
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
            'w-[88px] h-[10px] -mt-0.5 overflow-visible',
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
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border shrink-0',
            inverted
              ? 'border-white/20 text-white hover:bg-white/10'
              : 'border-[#E6E4DF] text-[#141413] hover:bg-[#EFECE6]',
          )}
        >
          Đăng nhập
        </Link>
        <Link
          to="/register"
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0',
            inverted
              ? 'bg-white text-[#141413] hover:bg-white/90'
              : 'bg-[#141413] text-white hover:bg-[#292927]',
          )}
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const item =
    'group flex w-full items-center gap-2.5 px-3.5 py-2 text-xs text-[#262624] hover:bg-[#F3F2EE] transition-colors font-medium';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors focus-visible:outline-none select-none shrink-0',
          inverted
            ? 'text-white hover:bg-white/10'
            : 'text-[#141413] hover:bg-[#EFECE6]',
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
            inverted ? 'text-white/60' : 'text-[#6E6D68]',
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#E6E4DF] bg-white py-1 shadow-md text-[#141413]"
        >
          <div className="border-b border-[#E6E4DF] bg-[#FAF9F6] px-3.5 py-2.5">
            <p className="truncate text-sm font-semibold text-[#141413]">{user.displayName}</p>
            <p className="truncate text-xs text-[#6E6D68]">
              @{user.username} · {ACCOUNT_ROLE_LABELS[accountRole]}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-[#575652]">
              <span className="font-medium text-[#1B4332]">
                {isProfessional ? 'Chế độ Chuyên gia' : 'Chế độ Thành viên'}
              </span>
              {verificationStatus === 'VERIFIED' && <span>· Đã xác minh</span>}
              {verificationStatus === 'PENDING' && <span>· Chờ xét duyệt</span>}
              {verificationStatus === 'REJECTED' && (
                <span className="text-[#B91C1C]">· Cần nộp lại</span>
              )}
              {user.role === 'ADMIN' && <span>· Quản trị viên</span>}
            </div>
          </div>

          <div className="py-1">
            {canAccessProfessionalMode ? (
              <button
                type="button"
                className={cn(item, 'font-semibold text-[#1B4332]')}
                onClick={() => {
                  toggleMode();
                  setOpen(false);
                }}
              >
                {isProfessional ? (
                  <>
                    <UserIcon className="size-4 text-[#6E6D68]" /> Chuyển sang Chế độ Thành viên
                  </>
                ) : (
                  <>
                    <Stethoscope className="size-4 text-[#1B4332]" /> Chuyển sang Chế độ Chuyên gia
                  </>
                )}
              </button>
            ) : enableResubmission ? (
              <Link
                role="menuitem"
                to="/settings?resubmit=true#verification-center"
                className={cn(item, 'font-semibold text-[#B91C1C]')}
                onClick={() => setOpen(false)}
              >
                <AlertCircle className="size-4 text-[#B91C1C]" /> Nộp lại Hồ sơ Minh chứng
              </Link>
            ) : enableVerificationCenter ? (
              <Link
                role="menuitem"
                to="/settings#verification-center"
                className={item}
                onClick={() => setOpen(false)}
              >
                <Clock className="size-4 text-[#6E6D68]" /> Trung tâm Xác minh (Chờ duyệt)
              </Link>
            ) : (
              <Link
                role="menuitem"
                to="/settings#verification-center"
                className={item}
                onClick={() => setOpen(false)}
              >
                <ShieldCheck className="size-4 text-[#6E6D68]" /> Đăng ký Xác minh Chuyên gia
              </Link>
            )}

            <Link
              role="menuitem"
              to={`/u/${user.username}`}
              className={item}
              onClick={() => setOpen(false)}
            >
              <UserIcon className="size-4 text-[#6E6D68]" />
              {isProfessional ? 'Hồ sơ Chuyên môn' : 'Trang cá nhân'}
            </Link>

            {isProfessional ? (
              <>
                <Link role="menuitem" to="/dashboard" className={item} onClick={() => setOpen(false)}>
                  <LayoutDashboard className="size-4 text-[#6E6D68]" /> Tổng quan Chuyên môn
                </Link>
                <Link role="menuitem" to="/contributions" className={item} onClick={() => setOpen(false)}>
                  <Award className="size-4 text-[#6E6D68]" /> Nghiên cứu &amp; CME
                </Link>
                <Link role="menuitem" to="/eeg-hub?view=workspace" className={item} onClick={() => setOpen(false)}>
                  <Activity className="size-4 text-[#6E6D68]" /> Trạm qEEG
                </Link>
                <a
                  role="menuitem"
                  href="/clinical-workstation?mode=professional"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={item}
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="size-4 text-[#6E6D68]" /> Trạm qEEG Cortical
                </a>
                <Link role="menuitem" to="/consultations?tab=queue" className={item} onClick={() => setOpen(false)}>
                  <Stethoscope className="size-4 text-[#6E6D68]" /> Đọc ca Từ xa
                </Link>
                <Link role="menuitem" to="/rewards" className={item} onClick={() => setOpen(false)}>
                  <Gift className="size-4 text-[#6E6D68]" /> Ví thù lao &amp; CME
                </Link>
                <div className="my-1 border-t border-[#E6E4DF]" />
                <Link role="menuitem" to="/my-health" className={item} onClick={() => setOpen(false)}>
                  <Heart className="size-4 text-[#6E6D68]" /> Sức khỏe cá nhân
                </Link>
                <Link role="menuitem" to="/eeg-hub?view=personal" className={item} onClick={() => setOpen(false)}>
                  <Brain className="size-4 text-[#6E6D68]" /> Bản ghi EEG cá nhân
                </Link>
              </>
            ) : (
              <>
                <Link role="menuitem" to="/my-health" className={item} onClick={() => setOpen(false)}>
                  <Heart className="size-4 text-[#6E6D68]" /> Sức khỏe của tôi
                </Link>
                <Link role="menuitem" to="/eeg-hub?view=personal" className={item} onClick={() => setOpen(false)}>
                  <Brain className="size-4 text-[#6E6D68]" /> Dữ liệu EEG cá nhân
                </Link>
                <Link role="menuitem" to="/consultations" className={item} onClick={() => setOpen(false)}>
                  <Stethoscope className="size-4 text-[#6E6D68]" /> Tư vấn Sóng não
                </Link>
                <a
                  role="menuitem"
                  href="/clinical-workstation?mode=general"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={item}
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="size-4 text-[#6E6D68]" /> Trạm qEEG Cortical
                </a>
                <Link role="menuitem" to="/rewards" className={item} onClick={() => setOpen(false)}>
                  <Gift className="size-4 text-[#6E6D68]" /> Ví Credit &amp; Quyền lợi
                </Link>
                <Link role="menuitem" to="/communities" className={item} onClick={() => setOpen(false)}>
                  <Users className="size-4 text-[#6E6D68]" /> Cộng đồng hỗ trợ
                </Link>
                <Link role="menuitem" to="/messages" className={item} onClick={() => setOpen(false)}>
                  <MessageCircle className="size-4 text-[#6E6D68]" /> Tin nhắn
                </Link>
              </>
            )}

            <Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
              <Settings className="size-4 text-[#6E6D68]" /> Cài đặt tài khoản
            </Link>
            {user.role === 'ADMIN' && (
              <Link role="menuitem" to="/admin" className={item} onClick={() => setOpen(false)}>
                <Shield className="size-4 text-[#6E6D68]" /> Quản trị hệ thống
              </Link>
            )}
          </div>

          <div className="border-t border-[#E6E4DF] pt-1">
            <button
              role="menuitem"
              type="button"
              className={cn(item, 'text-[#B91C1C] hover:bg-[#FEF2F2]')}
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut className="size-4 text-[#B91C1C]" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppShellContent() {
  const { user } = useAuth();
  const { isOpen, togglePopup, openInbox } = useChatPopup();
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
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (!showGuideModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuideModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showGuideModal]);

  const rejectedProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'REJECTED');
  const pendingProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'PENDING');

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
    ? 'relative flex size-8.5 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors'
    : 'relative flex size-8.5 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#ECFDF3] hover:text-[#15803D] transition-colors';

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
        <div className="mx-auto flex h-14 max-w-[1220px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 shrink-0">
            <Logo inverted={isProfessional} isProfessional={isProfessional} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <form onSubmit={handleGlobalSearch} className="hidden sm:block w-56 lg:w-64 mr-1">
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

            <Link to="/search" aria-label="Tìm kiếm" className={cn(iconBtnClass, 'sm:hidden')}>
              <Search className="size-4.5" aria-hidden />
            </Link>

            <button type="button" onClick={togglePopup} aria-label="Tin nhắn" className={iconBtnClass}>
              <MessageCircle className="size-4.5" aria-hidden />
              {Boolean(unreadConvs && unreadConvs > 0) && (
                <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-[#B91C1C] text-[10px] font-semibold text-white">
                  {unreadConvs}
                </span>
              )}
            </button>

            <Link to="/notifications" aria-label="Thông báo" className={iconBtnClass}>
              <Bell className="size-4.5" aria-hidden />
              {Boolean(unreadNotifs && unreadNotifs > 0) && (
                <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-[#B91C1C] text-[10px] font-semibold text-white">
                  {unreadNotifs}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              aria-label="Hướng dẫn nhanh"
              title="Hướng dẫn nhanh"
              className={iconBtnClass}
            >
              <HelpCircle className="size-4.5" aria-hidden />
            </button>

            {canAccessProfessionalMode ? (
              <button
                type="button"
                onClick={() => setMode(isGeneral ? 'professional' : 'general')}
                className={cn(
                  'hidden sm:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                  isProfessional
                    ? 'text-white/80 hover:bg-white/10 hover:text-white'
                    : 'text-[#575652] hover:bg-[#EFECE6] hover:text-[#141413]',
                )}
              >
                {isProfessional ? 'Thành viên' : 'Chuyên gia'}
              </button>
            ) : enableResubmission ? (
              <Link
                to="/settings?resubmit=true#verification-center"
                className="hidden sm:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#EFECE6] transition-colors whitespace-nowrap shrink-0"
              >
                Nộp lại hồ sơ
              </Link>
            ) : enableVerificationCenter ? (
              <Link
                to="/settings#verification-center"
                className="hidden sm:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#575652] hover:bg-[#EFECE6] hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
              >
                Chờ duyệt
              </Link>
            ) : null}

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
            {sidebarItems.map(({ to, label, icon: Icon, badge }) =>
              to === '/messages' ? (
                <button
                  key={to}
                  type="button"
                  onClick={openInbox}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors',
                    isOpen
                      ? 'font-semibold text-[#15803D] bg-[#ECFDF3]'
                      : 'font-normal text-[#4B5563] hover:text-[#111827] hover:bg-[#EAF4EE]',
                  )}
                >
                  <Icon
                    className={cn('size-4 shrink-0', isOpen ? 'text-[#16A34A]' : 'text-[#6B7280]')}
                    aria-hidden
                  />
                  <span className="truncate flex-1">{label}</span>
                  {Boolean(badge && badge > 0) && (
                    <span className="rounded-full bg-[#DCFCE7] px-1.5 py-0.2 text-[11px] font-semibold text-[#15803D] tabular-nums">
                      {badge}
                    </span>
                  )}
                </button>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] transition-colors',
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
              ),
            )}
          </nav>

          <Link
            to={isProfessional ? '/consultations?tab=queue' : '/eeg-hub'}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#15803D] transition-colors"
          >
            <Activity className="size-3.5 shrink-0" aria-hidden />
            <span>{isProfessional ? 'Ca chờ đọc' : 'Đo sóng não'}</span>
          </Link>

          {user && (
            <Link
              to={`/u/${user.username}`}
              className="mt-4 pt-4 border-t border-[#E6E4DF] flex items-center gap-2.5 px-2 text-xs text-[#575652] hover:text-[#141413] transition-colors"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="xs" />
              <div className="min-w-0">
                <p className="truncate font-medium text-[#141413]">{user.displayName}</p>
                <p className="truncate text-[11px] text-[#8A8882]">@{user.username}</p>
              </div>
            </Link>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-4">
          {!canAccessProfessionalMode && verificationStatus === 'PENDING' && enableVerificationCenter && (
            <div className="rounded-xl border border-[#E6E4DF] bg-white px-4 py-3 text-xs text-[#262624] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2">
                <Clock className="size-4 text-[#6E6D68] shrink-0 mt-0.5 sm:mt-0" aria-hidden />
                <p>
                  Hồ sơ <strong>{pendingProfile?.title || ACCOUNT_ROLE_LABELS[accountRole]}</strong> đang chờ phê duyệt. Chế độ Chuyên gia sẽ mở sau khi xác minh hoàn tất.
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
            <div className="rounded-xl border border-[#E6E4DF] bg-white px-4 py-3 text-xs text-[#262624] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2">
                <AlertCircle className="size-4 text-[#B91C1C] shrink-0 mt-0.5 sm:mt-0" aria-hidden />
                <p>
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

          <Outlet />
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
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] transition-colors',
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

      {/* Quick Guide Modal */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-modal-title"
            className="w-full max-w-2xl rounded-xl border border-[#E6E4DF] bg-white shadow-lg overflow-hidden text-[#141413]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#E6E4DF] bg-[#FAF9F6] px-5 py-3.5">
              <h2 id="guide-modal-title" className="text-sm font-semibold text-[#141413]">
                Hướng dẫn nhanh
              </h2>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Đóng hướng dẫn"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#6E6D68] hover:bg-[#EFECE6] hover:text-[#141413] transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    title: '1. Đo sóng não',
                    to: '/eeg-hub',
                    desc: 'Xem mẫu thử hoặc tải file .csv.',
                    Icon: Activity,
                  },
                  {
                    title: '2. Hỏi Bác sĩ',
                    to: '/consultations?ask=1',
                    desc: 'Gửi triệu chứng kèm bản đo sóng não.',
                    Icon: Stethoscope,
                  },
                  {
                    title: '3. Nhật ký',
                    to: '/my-health',
                    desc: 'Chấm giấc ngủ & xem lịch hôm nay.',
                    Icon: Heart,
                  },
                ].map(({ title, to, desc, Icon }) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => {
                      navigate(to);
                      setShowGuideModal(false);
                    }}
                    className="group flex flex-col justify-between rounded-xl border border-[#E6E4DF] bg-white p-3.5 text-left hover:border-[#1B4332] transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#141413]">{title}</h3>
                        <Icon className="size-4 text-[#6E6D68] shrink-0" aria-hidden />
                      </div>
                      <p className="text-xs text-[#575652]">{desc}</p>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1B4332]">
                      <span>Mở</span>
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-[#E6E4DF] bg-[#FAF9F6] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-[#575652]">
                  <strong className="text-[#141413]">Bác sĩ / Nghiên cứu: </strong>
                  Chuyển chế độ Chuyên gia ở góc phải màn hình.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {canAccessProfessionalMode && !isProfessional && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('professional');
                        setShowGuideModal(false);
                      }}
                      className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#292927] transition-colors whitespace-nowrap"
                    >
                      Chuyển sang Chuyên gia
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(false)}
                    className="rounded-lg border border-[#E6E4DF] bg-white px-3 py-1.5 text-xs font-medium text-[#575652] hover:bg-[#F3F2EE] transition-colors whitespace-nowrap"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
