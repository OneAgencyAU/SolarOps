import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTenant?: boolean;
}

export default function ProtectedRoute({ children, requireTenant = false }: ProtectedRouteProps) {
  const { user, tenant, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireTenant && !tenant) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
