import { Route, Routes } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import {
  GuestOnly,
  RequireAdmin,
  RequireAuth,
  RequireVerifiedProfessional,
} from './features/auth/guards';
import { FeedPage } from './pages/FeedPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { SearchPage } from './pages/SearchPage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminPage } from './pages/AdminPage';
import { ContributionsPage } from './pages/ContributionsPage';
import { RewardsPage } from './pages/RewardsPage';
import { EEGHubPage } from './pages/EEGHubPage';
import { MyHealthPage } from './pages/MyHealthPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { ProfessionalDashboardPage } from './pages/ProfessionalDashboardPage';

export function App() {
  return (
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
  );
}
