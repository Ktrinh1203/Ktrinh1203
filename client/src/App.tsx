import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import {
  GuestOnly,
  RequireAdmin,
  RequireAuth,
  RequireVerifiedProfessional,
} from './features/auth/guards';

const loadLandingPage = () => import('./pages/LandingPage');
const loadLoginPage = () => import('./pages/LoginPage');
const loadRegisterPage = () => import('./pages/RegisterPage');
const loadFeedPage = () => import('./pages/FeedPage');
const loadEEGHubPage = () => import('./pages/EEGHubPage');
const loadConsultationsPage = () => import('./pages/ConsultationsPage');
const loadMyHealthPage = () => import('./pages/MyHealthPage');
const loadProfessionalDashboardPage = () => import('./pages/ProfessionalDashboardPage');
const loadSearchPage = () => import('./pages/SearchPage');
const loadCommunitiesPage = () => import('./pages/CommunitiesPage');
const loadMessagesPage = () => import('./pages/MessagesPage');
const loadNotificationsPage = () => import('./pages/NotificationsPage');
const loadContributionsPage = () => import('./pages/ContributionsPage');
const loadRewardsPage = () => import('./pages/RewardsPage');
const loadProfilePage = () => import('./pages/ProfilePage');
const loadSettingsPage = () => import('./pages/SettingsPage');
const loadAdminPage = () => import('./pages/AdminPage');
const loadNotFoundPage = () => import('./pages/NotFoundPage');

const LandingPage = lazy(() => loadLandingPage().then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => loadLoginPage().then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => loadRegisterPage().then((m) => ({ default: m.RegisterPage })));
const FeedPage = lazy(() => loadFeedPage().then((m) => ({ default: m.FeedPage })));
const EEGHubPage = lazy(() => loadEEGHubPage().then((m) => ({ default: m.EEGHubPage })));
const ConsultationsPage = lazy(() =>
  loadConsultationsPage().then((m) => ({ default: m.ConsultationsPage })),
);
const MyHealthPage = lazy(() => loadMyHealthPage().then((m) => ({ default: m.MyHealthPage })));
const ProfessionalDashboardPage = lazy(() =>
  loadProfessionalDashboardPage().then((m) => ({ default: m.ProfessionalDashboardPage })),
);
const SearchPage = lazy(() => loadSearchPage().then((m) => ({ default: m.SearchPage })));
const CommunitiesPage = lazy(() =>
  loadCommunitiesPage().then((m) => ({ default: m.CommunitiesPage })),
);
const MessagesPage = lazy(() => loadMessagesPage().then((m) => ({ default: m.MessagesPage })));
const NotificationsPage = lazy(() =>
  loadNotificationsPage().then((m) => ({ default: m.NotificationsPage })),
);
const ContributionsPage = lazy(() =>
  loadContributionsPage().then((m) => ({ default: m.ContributionsPage })),
);
const RewardsPage = lazy(() => loadRewardsPage().then((m) => ({ default: m.RewardsPage })));
const ProfilePage = lazy(() => loadProfilePage().then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => loadSettingsPage().then((m) => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => loadAdminPage().then((m) => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => loadNotFoundPage().then((m) => ({ default: m.NotFoundPage })));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Đang tải trang"
      className="flex min-h-[50vh] w-full items-center justify-center bg-[#F5FAF7]"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-[#DCE6DF] border-t-[#16A34A]" />
    </div>
  );
}

export function App() {
  useEffect(() => {
    const preloadPrimaryRoutes = () => {
      void loadFeedPage();
      void loadEEGHubPage();
      void loadConsultationsPage();
      void loadMyHealthPage();
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === 'function') {
      const idleId = w.requestIdleCallback(preloadPrimaryRoutes, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(idleId);
    }

    const timerId = window.setTimeout(preloadPrimaryRoutes, 1200);
    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/feed" element={<FeedPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireVerifiedProfessional>
                <ProfessionalDashboardPage />
              </RequireVerifiedProfessional>
            }
          />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/communities" element={<CommunitiesPage />} />
          <Route path="/my-health" element={<MyHealthPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/contributions" element={<ContributionsPage />} />
          <Route path="/eeg-hub" element={<EEGHubPage />} />
          <Route path="/eeg" element={<EEGHubPage />} />
          <Route
            path="/clinical-workstation"
            element={<Navigate to="/eeg-hub?view=workspace&fullscreen=1" replace />}
          />
          <Route path="/consultations" element={<ConsultationsPage />} />
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
