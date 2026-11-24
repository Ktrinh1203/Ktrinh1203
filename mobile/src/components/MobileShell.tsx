import {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Bell,
  ChevronRight,
  Coins,
  ExternalLink,
  HeartPulse,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Search,
  Stethoscope,
  User as UserIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { consultationsApi, messagesApi, notificationsApi, rewardsApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import { preloadDockRoute, preloadDockRoutes } from '../routePreloaders';
import { Avatar, BottomSheet, NeuroLinkLogo, Spinner, VerifiedCheck, cn, isUserVerified } from './ui';

const PILL_SPRING_TRANSITION =
  'transform 400ms cubic-bezier(0.35, 1.04, 0.45, 1), opacity 200ms ease';
const PILL_REDUCED_TRANSITION = 'transform 120ms ease-out, opacity 120ms ease';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function findNearestTabIndex(
  pillX: number,
  pillWidth: number,
  geoms: { left: number; width: number }[],
): number {
  const center = pillX + pillWidth / 2;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < geoms.length; i += 1) {
    const g = geoms[i];
    if (!g) continue;
    const dist = Math.abs(center - (g.left + g.width / 2));
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

interface TabSpec {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const SUBPAGE_TITLES: Record<string, string> = {
  '/search': 'Tìm kiếm',
  '/notifications': 'Thông báo',
  '/wallet': 'Ví Credit',
  '/communities': 'Cộng đồng',
};

export function MobileShell() {
  const { user, logout } = useAuth();
  const { isProfessional, canAccessProfessionalMode, setMode } = useMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  useRealtimeEvents(Boolean(user));

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(20),
    enabled: Boolean(user),
    refetchInterval: 20000,
  });

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    enabled: Boolean(user),
    refetchInterval: 15000,
  });

  const { data: walletData } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  const { data: queueData } = useQuery({
    queryKey: ['consultations', 'queue-badge'],
    queryFn: () => consultationsApi.list({ scope: 'queue' }),
    enabled: Boolean(user && isProfessional),
    refetchInterval: 30000,
  });

  const unreadNotifs = notifData?.unreadCount ?? 0;
  const unreadConvs = convData?.conversations.filter((c) => c.isUnread).length ?? 0;
  const openQueueCount = (queueData?.tickets ?? []).filter((t) => t.status === 'OPEN').length;
  const balance = walletData?.wallet?.balance ?? 0;

  const tabs: TabSpec[] = useMemo(
    () =>
      isProfessional
        ? [
            { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
            { to: '/consult', label: 'Ca chờ', icon: Stethoscope, badge: openQueueCount },
            { to: '/eeg', label: 'qEEG', icon: Activity },
            { to: '/feed', label: 'Tin', icon: Home },
            { to: '/chat', label: 'Chat', icon: MessageCircle, badge: unreadConvs },
          ]
        : [
            { to: '/feed', label: 'Tin', icon: Home },
            { to: '/eeg', label: 'Sóng não', icon: Activity },
            { to: '/consult', label: 'Hỏi BS', icon: Stethoscope },
            { to: '/health', label: 'Nhật ký', icon: HeartPulse },
            { to: '/chat', label: 'Chat', icon: MessageCircle, badge: unreadConvs },
          ],
    [isProfessional, openQueueCount, unreadConvs],
  );

  const isRootTab = tabs.some((t) => location.pathname === t.to);
  const isChatThread = location.pathname === '/chat' && location.search.includes('conv=');
  const routeIndex = tabs.findIndex((t) => location.pathname === t.to);

  const [optimisticState, setOptimisticState] = useState<{
    index: number;
    routesKey: string;
  } | null>(null);
  const [dragPreviewIndex, setDragPreviewIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const pillInnerRef = useRef<HTMLSpanElement | null>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const tabGeomsRef = useRef<{ left: number; width: number }[]>([]);
  const hasPositionedRef = useRef(false);
  const prevVisualIndexRef = useRef<number>(-1);
  const justDroppedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);
  const dragMetaRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    lastX: number;
    lastPreviewIdx: number;
  } | null>(null);

  const tabRoutesKey = tabs.map((t) => t.to).join('|');
  const optimisticIndex =
    optimisticState && optimisticState.routesKey === tabRoutesKey ? optimisticState.index : null;
  const visualIndex = dragPreviewIndex ?? optimisticIndex ?? routeIndex;

  // Preload bottom-dock route chunks during browser idle so tab switches never stall on Suspense
  useEffect(() => {
    if (!user) return;
    const paths = tabRoutesKey.split('|');
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => preloadDockRoutes(paths), { timeout: 900 });
      return () => win.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => preloadDockRoutes(paths), 350);
    return () => window.clearTimeout(timer);
  }, [user, tabRoutesKey]);

  useEffect(() => {
    setOptimisticState(null);
  }, [location.pathname, tabRoutesKey]);

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
      }
    };
  }, []);

  const measureTabs = useCallback(() => {
    const geoms: { left: number; width: number }[] = [];
    for (let i = 0; i < tabs.length; i += 1) {
      const el = tabRefs.current[i];
      if (!el) continue;
      geoms[i] = { left: el.offsetLeft, width: el.offsetWidth };
    }
    tabGeomsRef.current = geoms;
    return geoms;
  }, [tabs.length]);

  // Synchronously align/slide the GPU-composited pill indicator before paint
  useLayoutEffect(() => {
    if (isChatThread) {
      hasPositionedRef.current = false;
      prevVisualIndexRef.current = -1;
      justDroppedRef.current = false;
      return;
    }

    const geoms = measureTabs();
    if (isDraggingRef.current) return;

    const pillEl = pillRef.current;
    if (!pillEl) return;

    if (visualIndex < 0 || !geoms[visualIndex]) {
      pillEl.style.transition = prefersReducedMotion()
        ? PILL_REDUCED_TRANSITION
        : 'opacity 160ms ease';
      pillEl.style.opacity = '0';
      prevVisualIndexRef.current = -1;
      justDroppedRef.current = false;
      return;
    }

    const geom = geoms[visualIndex];
    const prevIdx = prevVisualIndexRef.current;
    const wasPositioned = hasPositionedRef.current;
    const wasHidden = prevIdx < 0;
    const dropped = justDroppedRef.current;
    const shouldSlide = wasPositioned && !wasHidden && (prevIdx !== visualIndex || dropped);

    if (!shouldSlide) {
      pillEl.style.transition = 'none';
      pillEl.style.width = `${geom.width}px`;
      pillEl.style.transform = `translate3d(${geom.left}px, 0, 0)`;
      if (wasHidden && wasPositioned) {
        void pillEl.offsetWidth;
        pillEl.style.transition = 'opacity 180ms ease';
      }
      pillEl.style.opacity = '1';
    } else {
      const reduced = prefersReducedMotion();
      pillEl.style.transition = reduced ? PILL_REDUCED_TRANSITION : PILL_SPRING_TRANSITION;
      pillEl.style.width = `${geom.width}px`;
      if (dropped) {
        pillInnerRef.current?.getAnimations().forEach((a) => a.cancel());
        // Commit drag release transform with active transition before snapping to target slot
        void pillEl.offsetWidth;
      }
      pillEl.style.transform = `translate3d(${geom.left}px, 0, 0)`;
      pillEl.style.opacity = '1';

      if (!reduced && !dropped && prevIdx !== visualIndex && pillInnerRef.current) {
        const dist = Math.abs(visualIndex - prevIdx);
        const stretch = Math.min(1.16, 1.06 + dist * 0.025);
        pillInnerRef.current.getAnimations().forEach((a) => a.cancel());
        pillInnerRef.current.animate(
          [
            { transform: 'scaleX(1) scaleY(1)' },
            { transform: `scaleX(${stretch}) scaleY(0.94)`, offset: 0.34 },
            { transform: 'scaleX(0.985) scaleY(1.01)', offset: 0.72 },
            { transform: 'scaleX(1) scaleY(1)' },
          ],
          { duration: 400, easing: 'cubic-bezier(0.32, 1, 0.42, 1)' },
        );
      }
    }

    hasPositionedRef.current = true;
    prevVisualIndexRef.current = visualIndex;
    justDroppedRef.current = false;
  }, [visualIndex, isDragging, isChatThread, isProfessional, measureTabs]);

  // Keep pill locked to active tab across mobile/tablet/desktop viewport resizes
  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl || isChatThread) return;
    const ro = new ResizeObserver(() => {
      if (isDraggingRef.current) return;
      const geoms = measureTabs();
      const idx = prevVisualIndexRef.current;
      const pillEl = pillRef.current;
      if (!pillEl || idx < 0 || !geoms[idx]) return;
      pillEl.style.transition = 'none';
      pillEl.style.width = `${geoms[idx].width}px`;
      pillEl.style.transform = `translate3d(${geoms[idx].left}px, 0, 0)`;
    });
    ro.observe(navEl);
    return () => ro.disconnect();
  }, [isChatThread, measureTabs]);

  const handleNavPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const geoms = measureTabs();
    if (geoms.length === 0) return;
    const fallbackIdx = visualIndex >= 0 ? visualIndex : 0;
    dragMetaRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      lastX: geoms[fallbackIdx]?.left ?? 0,
      lastPreviewIdx: visualIndex,
    };
  };

  const handleNavPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const meta = dragMetaRef.current;
    if (!meta || meta.pointerId !== e.pointerId) return;

    const dx = e.clientX - meta.startX;
    const dy = e.clientY - meta.startY;

    if (!meta.active) {
      if (Math.abs(dx) <= 6) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.25) {
        dragMetaRef.current = null;
        return;
      }
      meta.active = true;
      isDraggingRef.current = true;
      setIsDragging(true);
      pillInnerRef.current?.getAnimations().forEach((a) => a.cancel());
      try {
        navRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable on synthetic events
      }
    }

    const navEl = navRef.current;
    const pillEl = pillRef.current;
    const geoms = tabGeomsRef.current;
    if (!navEl || !pillEl || geoms.length === 0) return;

    const navRect = navEl.getBoundingClientRect();
    const first = geoms[0];
    const last = geoms[geoms.length - 1];
    if (!first || !last) return;

    const pillW = first.width;
    const localX = e.clientX - navRect.left;
    const clampedX = Math.max(first.left, Math.min(last.left, localX - pillW / 2));
    meta.lastX = clampedX;

    pillEl.style.transition = 'none';
    pillEl.style.opacity = '1';
    pillEl.style.width = `${pillW}px`;
    pillEl.style.transform = `translate3d(${clampedX}px, 0, 0)`;

    const nearest = findNearestTabIndex(clampedX, pillW, geoms);
    if (nearest !== meta.lastPreviewIdx) {
      meta.lastPreviewIdx = nearest;
      setDragPreviewIndex(nearest);
      if (tabs[nearest]) preloadDockRoute(tabs[nearest].to);
    }
  };

  const handleNavPointerEnd = (e: ReactPointerEvent<HTMLElement>) => {
    const meta = dragMetaRef.current;
    if (!meta || meta.pointerId !== e.pointerId) return;
    dragMetaRef.current = null;

    try {
      if (navRef.current?.hasPointerCapture(e.pointerId)) {
        navRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    if (!meta.active) return;

    suppressNextClickRef.current = true;
    if (suppressTimerRef.current !== null) {
      window.clearTimeout(suppressTimerRef.current);
    }
    suppressTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressTimerRef.current = null;
    }, 60);

    isDraggingRef.current = false;
    setIsDragging(false);
    justDroppedRef.current = true;
    pillInnerRef.current?.getAnimations().forEach((a) => a.cancel());

    const geoms = tabGeomsRef.current;
    const pillW = geoms[0]?.width ?? 64;
    const cancelled = e.type === 'pointercancel' || e.type === 'lostpointercapture';
    const targetIdx = cancelled
      ? Math.max(0, routeIndex)
      : findNearestTabIndex(meta.lastX, pillW, geoms);

    setDragPreviewIndex(null);
    if (!cancelled && tabs[targetIdx]) {
      if (tabs[targetIdx].to !== location.pathname) {
        setOptimisticState({ index: targetIdx, routesKey: tabRoutesKey });
        preloadDockRoute(tabs[targetIdx].to);
        startTransition(() => {
          navigate(tabs[targetIdx].to);
        });
      } else {
        setOptimisticState(null);
      }
    } else {
      setOptimisticState(null);
    }
  };
  const subTitle =
    SUBPAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/u/') ? 'Hồ sơ' : undefined);

  const iconBtnCls = isProfessional
    ? 'relative flex size-10 items-center justify-center rounded-full text-white/85 hover:bg-white/10 active:scale-95 transition-all cursor-pointer'
    : 'relative flex size-10 items-center justify-center rounded-full text-[#374151] hover:bg-[#ECFDF3] active:scale-95 transition-all cursor-pointer';

  const desktopWebUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:5173`
      : 'http://localhost:5173';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isProfessional ? '/dashboard' : '/feed', { replace: true });
    }
  };

  return (
    <div className="min-h-dvh w-full flex justify-center bg-[#E8F1EC] sm:py-0">
      {/* Subtle Desktop-only companion link (never shown on phones) */}
      <a
        href={desktopWebUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden lg:inline-flex fixed top-4 right-5 z-20 items-center gap-1.5 rounded-full border border-[#DCE6DF] bg-white/90 px-3 py-1.5 text-xs font-medium text-[#5B6860] hover:text-[#15803D] hover:border-[#86EFAC] backdrop-blur-md transition-colors"
      >
        <span>Bản Web</span>
        <ExternalLink className="size-3.5" aria-hidden />
      </a>

      {/* Mobile App Column (Full-bleed on phones, refined 430px canvas on tablets/desktop) */}
      <div
        data-mode={isProfessional ? 'professional' : 'general'}
        className={cn(
          'relative flex flex-col w-full max-w-[430px] min-h-dvh sm:shadow-[0_0_0_1px_#DCE6DF,0_24px_60px_-16px_rgba(20,83,45,0.14)]',
          isProfessional ? 'bg-[#F2F7F4]' : 'bg-[#F5FAF7]',
        )}
      >
        {/* Slim Sticky Top Bar */}
        {!isChatThread && (
          <header
            className={cn(
              'sticky top-0 z-30 backdrop-blur-xl transition-colors',
              isProfessional
                ? 'bg-[#14532D]/95 text-white border-b border-[#052E16]'
                : 'bg-white/92 text-[#111827] border-b border-[#DCE6DF] border-t-2 border-t-[#16A34A]',
            )}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="h-14 px-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {!isRootTab ? (
                  <>
                    <button
                      type="button"
                      onClick={handleBack}
                      aria-label="Quay lại"
                      className={cn(iconBtnCls, '-ml-1.5')}
                    >
                      <ArrowLeft className="size-5" aria-hidden />
                    </button>
                    <h1 className="text-[16px] font-bold truncate">{subTitle ?? 'NeuroLink'}</h1>
                  </>
                ) : (
                  <NeuroLinkLogo
                    compact
                    inverted={isProfessional}
                    to={isProfessional ? '/dashboard' : '/feed'}
                  />
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Link to="/search" aria-label="Tìm kiếm" className={iconBtnCls}>
                  <Search className="size-[19px]" aria-hidden />
                </Link>

                <Link to="/notifications" aria-label="Thông báo" className={iconBtnCls}>
                  <Bell className="size-[19px]" aria-hidden />
                  {unreadNotifs > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold text-white tabular-nums">
                      {unreadNotifs > 9 ? '9+' : unreadNotifs}
                    </span>
                  )}
                </Link>

                {user && (
                  <button
                    type="button"
                    onClick={() => setAccountOpen(true)}
                    aria-label="Tài khoản"
                    className="ml-1 flex size-10 items-center justify-center rounded-full active:scale-95 transition-transform cursor-pointer"
                  >
                    <Avatar name={user.displayName} src={user.avatarUrl} size="xs" />
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Active Screen */}
        <main
          className={cn(
            'flex-1 min-w-0',
            isChatThread ? 'flex flex-col' : 'pb-28',
          )}
        >
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>

        {/* Floating Translucent Bottom Navigation Dock */}
        {!isChatThread && (
          <div
            className="fixed bottom-0 inset-x-0 z-30 flex justify-center pointer-events-none px-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <nav
              ref={navRef}
              aria-label="Điều hướng chính"
              onPointerDown={handleNavPointerDown}
              onPointerMove={handleNavPointerMove}
              onPointerUp={handleNavPointerEnd}
              onPointerCancel={handleNavPointerEnd}
              onLostPointerCapture={handleNavPointerEnd}
              className={cn(
                'relative pointer-events-auto w-full max-w-[406px] grid grid-cols-5 items-center rounded-[22px] p-1.5 backdrop-blur-xl transition-colors select-none touch-pan-y',
                isProfessional
                  ? 'bg-[#14532D]/95 border border-white/12 shadow-[0_12px_32px_-8px_rgba(5,46,22,0.5)]'
                  : 'bg-white/94 border border-[#DCE6DF] shadow-[0_10px_28px_-8px_rgba(20,83,45,0.16)]',
              )}
            >
              {/* GPU-Composited Sliding Liquid Pill Indicator */}
              <div
                ref={pillRef}
                aria-hidden="true"
                data-testid="nav-sliding-pill"
                className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 z-0 will-change-transform"
                style={{ opacity: 0 }}
              >
                <span
                  ref={pillInnerRef}
                  className={cn(
                    'block size-full rounded-2xl transition-colors duration-240',
                    isProfessional
                      ? 'bg-white/16 border border-white/15 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.28)]'
                      : 'bg-[#ECFDF3] border border-[#BBF7D0]/85 shadow-[0_2px_10px_-2px_rgba(22,163,74,0.18)]',
                    isDragging && 'scale-[1.03]',
                  )}
                />
              </div>

              {tabs.map(({ to, label, icon: Icon, badge }, idx) => {
                const active = visualIndex === idx;
                return (
                  <NavLink
                    key={to}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    to={to}
                    draggable={false}
                    onPointerEnter={() => preloadDockRoute(to)}
                    onPointerDown={() => preloadDockRoute(to)}
                    onFocus={() => preloadDockRoute(to)}
                    onClick={(e) => {
                      if (suppressNextClickRef.current) {
                        e.preventDefault();
                        suppressNextClickRef.current = false;
                        return;
                      }
                      preloadDockRoute(to);
                      setOptimisticState(
                        to !== location.pathname ? { index: idx, routesKey: tabRoutesKey } : null,
                      );
                    }}
                    className={cn(
                      'relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 min-h-[48px] transition-colors duration-240 ease-out select-none [-webkit-user-drag:none]',
                      active
                        ? isProfessional
                          ? 'text-emerald-300 font-semibold'
                          : 'text-[#15803D] font-semibold'
                        : isProfessional
                          ? 'text-white/65 hover:text-white'
                          : 'text-[#64746B] hover:text-[#111827]',
                    )}
                  >
                    <span
                      className={cn(
                        'relative transition-transform duration-240 ease-[cubic-bezier(0.22,1.12,0.36,1)]',
                        active ? 'scale-[1.06] -translate-y-[0.5px]' : 'scale-100 translate-y-0',
                      )}
                    >
                      <Icon className="size-[20px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                      {Boolean(badge && badge > 0) && (
                        <span className="absolute -top-1 -right-2 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[9px] font-bold text-white tabular-nums">
                          {badge! > 9 ? '9+' : badge}
                        </span>
                      )}
                    </span>
                    <span className="text-[10.5px] leading-tight truncate max-w-[68px]">
                      {label}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Account & Mode Switch Bottom Sheet */}
      {user && (
        <BottomSheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Tài khoản">
          <div className="space-y-4">
            {/* Identity Header */}
            <Link
              to={`/u/${user.username}`}
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-3 rounded-2xl bg-[#F5FAF7] border border-[#DCE6DF] p-3.5"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[15px] font-bold text-[#111827] truncate">
                  <span className="truncate">{user.displayName}</span>
                  {isUserVerified(user) && <VerifiedCheck />}
                </p>
                <p className="text-xs text-[#5B6860] truncate">@{user.username}</p>
              </div>
              <ChevronRight className="size-4 text-[#94A39B] shrink-0" aria-hidden />
            </Link>

            {/* Instant Dual-Mode Switcher (Verified Professionals only) */}
            {canAccessProfessionalMode && (
              <div className="relative grid grid-cols-2 gap-1.5 rounded-2xl bg-[#EFF6F1] p-1 border border-[#DCE6DF]">
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-7px)] rounded-xl shadow-xs transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.22,1.12,0.36,1)] will-change-transform',
                    isProfessional
                      ? 'translate-x-[calc(100%+6px)] bg-[#14532D]'
                      : 'translate-x-0 bg-white',
                  )}
                />
                <button
                  type="button"
                  onClick={() => {
                    setMode('general');
                    setAccountOpen(false);
                    navigate('/feed');
                  }}
                  className={cn(
                    'relative z-10 h-10 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer',
                    !isProfessional ? 'text-[#111827]' : 'text-[#5B6860]',
                  )}
                >
                  Thành viên
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('professional');
                    setAccountOpen(false);
                    navigate('/dashboard');
                  }}
                  className={cn(
                    'relative z-10 h-10 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer',
                    isProfessional ? 'text-white' : 'text-[#5B6860]',
                  )}
                >
                  Chuyên gia
                </button>
              </div>
            )}

            {/* Quick Navigation Rows */}
            <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
              <Link
                to="/wallet"
                onClick={() => setAccountOpen(false)}
                className="flex items-center justify-between px-4 h-12 hover:bg-[#F5FAF7] transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                  <Coins className="size-4.5 text-[#16A34A]" aria-hidden />
                  <span>Ví Credit</span>
                </span>
                <span className="font-mono text-sm font-bold text-[#15803D] tabular-nums">
                  {balance.toLocaleString('vi-VN')}
                </span>
              </Link>

              <Link
                to={`/u/${user.username}`}
                onClick={() => setAccountOpen(false)}
                className="flex items-center justify-between px-4 h-12 hover:bg-[#F5FAF7] transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                  <UserIcon className="size-4.5 text-[#5B6860]" aria-hidden />
                  <span>Trang cá nhân</span>
                </span>
                <ChevronRight className="size-4 text-[#94A39B]" aria-hidden />
              </Link>

              <Link
                to="/communities"
                onClick={() => setAccountOpen(false)}
                className="flex items-center justify-between px-4 h-12 hover:bg-[#F5FAF7] transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                  <Users className="size-4.5 text-[#5B6860]" aria-hidden />
                  <span>Cộng đồng</span>
                </span>
                <ChevronRight className="size-4 text-[#94A39B]" aria-hidden />
              </Link>

              <a
                href={desktopWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 h-12 hover:bg-[#F5FAF7] transition-colors"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                  <ExternalLink className="size-4.5 text-[#5B6860]" aria-hidden />
                  <span>Mở bản Web đầy đủ</span>
                </span>
                <ChevronRight className="size-4 text-[#94A39B]" aria-hidden />
              </a>
            </div>

            <button
              type="button"
              onClick={async () => {
                setAccountOpen(false);
                await logout();
                navigate('/login', { replace: true });
              }}
              className="flex w-full items-center justify-center gap-2 h-11 rounded-full border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 active:scale-[0.98] transition-all cursor-pointer"
            >
              <LogOut className="size-4" aria-hidden />
              <span>Đăng xuất</span>
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
