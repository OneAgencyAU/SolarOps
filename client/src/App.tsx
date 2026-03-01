import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import PlaceholderPage from './pages/PlaceholderPage';
import VoiceAgentPage from './pages/VoiceAgentPage';
import InboxAssistantPage from './pages/InboxAssistantPage';
import HelpdeskPage from './pages/HelpdeskPage';
import ConnectionsPage from './pages/ConnectionsPage';

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
            <Route path="/voice-agent" element={<VoiceAgentPage />} />
            <Route path="/inbox-assistant" element={<InboxAssistantPage />} />
            <Route path="/helpdesk" element={<HelpdeskPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
