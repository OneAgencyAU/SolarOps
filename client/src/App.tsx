import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import VoiceAgentPage from './pages/VoiceAgentPage';
import VoiceSetupPage from './pages/VoiceSetupPage';
import VoiceOverviewPage from './pages/VoiceOverviewPage';
import InboundPage from './pages/InboundPage';
import OutboundCampaignsPage from './pages/OutboundCampaignsPage';
import InboxAssistantPage from './pages/InboxAssistantPage';
import HelpdeskPage from './pages/HelpdeskPage';
import ConnectionsPage from './pages/ConnectionsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import BillReaderPage from './pages/BillReaderPage';
import UsagePage from './pages/UsagePage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute requireTenant>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/voice-agent" element={<VoiceOverviewPage />} />
            <Route path="/voice-agent/setup" element={<VoiceSetupPage />} />
            <Route path="/voice-agent/inbound" element={<InboundPage />} />
            <Route path="/outbound" element={<OutboundCampaignsPage />} />
            <Route path="/inbox-assistant" element={<InboxAssistantPage />} />
            <Route path="/bill-reader" element={<BillReaderPage />} />
            <Route path="/helpdesk" element={<HelpdeskPage />} />
            <Route path="/activity-log" element={<ActivityLogPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
