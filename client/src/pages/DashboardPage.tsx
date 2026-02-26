import { useAuth } from '../contexts/AuthContext';
import '../styles/PlaceholderPage.css';

export default function DashboardPage() {
  const { user, tenant } = useAuth();

  return (
    <div className="placeholder-page">
      <div className="placeholder-card">
        <h1 className="placeholder-title">Dashboard</h1>
        <p className="placeholder-sub">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}
          {tenant?.name ? ` · ${tenant.name}` : ''}
        </p>
        <span className="coming-soon-badge">Coming soon</span>
      </div>
    </div>
  );
}
