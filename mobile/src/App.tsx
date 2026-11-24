import React, { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import { useMode } from './context/ModeContext';
import { MobileShell } from './components/MobileShell';
import { Spinner } from './components/ui';
import { dockRoutePreloaders } from './routePreloaders';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const FeedPage = lazy(() =>
  dockRoutePreloaders['/feed']().then((m) => ({
    default: (m as typeof import('./pages/FeedPage')).FeedPage,
  })),
);
const EegPage = lazy(() =>
  dockRoutePreloaders['/eeg']().then((m) => ({
    default: (m as typeof import('./pages/EegPage')).EegPage,
  })),
);
const ConsultPage = lazy(() =>
  dockRoutePreloaders['/consult']().then((m) => ({
    default: (m as typeof import('./pages/ConsultPage')).ConsultPage,
  })),
);
const HealthPage = lazy(() =>
  dockRoutePreloaders['/health']().then((m) => ({
    default: (m as typeof import('./pages/HealthPage')).HealthPage,
  })),
);
const ChatPage = lazy(() =>
  dockRoutePreloaders['/chat']().then((m) => ({
    default: (m as typeof import('./pages/ChatPage')).ChatPage,
  })),
);
const ProDashboardPage = lazy(() =>
  dockRoutePreloaders['/dashboard']().then((m) => ({
    default: (m as typeof import('./pages/ProDashboardPage')).ProDashboardPage,
  })),
);
const ProfilePage = React.lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const WalletPage = React.lazy(() =>
  import('./pages/WalletPage').then((m) => ({ default: m.WalletPage })),
);
const NotificationsPage = React.lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const SearchPage = React.lazy(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const CommunitiesPage = React.lazy(() =>
  import('./pages/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })),
);

function FullScreenFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F5FAF7]">
      <Spinner />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullScreenFallback />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { isProfessional } = useMode();
  const location = useLocation();
  if (isLoading) return <FullScreenFallback />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    const target =
      from && from !== '/login' && from !== '/'
        ? from
        : isProfessional
          ? '/dashboard'
          : '/feed';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { isProfessional } = useMode();
  return <Navigate to={isProfessional ? '/dashboard' : '/feed'} replace />;
}

function RequirePro({ children }: { children: ReactNode }) {
  const { canAccessProfessionalMode } = useMode();
  if (!canAccessProfessionalMode) return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Suspense fallback={<FullScreenFallback />}>
              <LoginPage />
            </Suspense>
          </GuestOnly>
        }
      />

      <Route
        element={
          <RequireAuth>
            <MobileShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/eeg" element={<EegPage />} />
        <Route path="/consult" element={<ConsultPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route
          path="/dashboard"
          element={
            <RequirePro>
              <ProDashboardPage />
            </RequirePro>
          }
        />
        <Route
          path="/u/:username"
          element={
            <Suspense fallback={<Spinner />}>
              <ProfilePage />
            </Suspense>
          }
        />
        <Route
          path="/wallet"
          element={
            <Suspense fallback={<Spinner />}>
              <WalletPage />
            </Suspense>
          }
        />
        <Route
          path="/notifications"
          element={
            <Suspense fallback={<Spinner />}>
              <NotificationsPage />
            </Suspense>
          }
        />
        <Route
          path="/search"
          element={
            <Suspense fallback={<Spinner />}>
              <SearchPage />
            </Suspense>
          }
        />
        <Route
          path="/communities"
          element={
            <Suspense fallback={<Spinner />}>
              <CommunitiesPage />
            </Suspense>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}
