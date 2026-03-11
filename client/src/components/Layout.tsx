import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Layout.css';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '▦' },
  { label: 'Voice Agent', path: '/voice-agent', icon: '◎' },
  { label: 'Outbound', path: '/outbound', icon: '⊳' },
  { label: 'Inbox Assistant', path: '/inbox-assistant', icon: '✉' },
  { label: 'Bill Reader', path: '/bill-reader', icon: '⎘' },
  { label: 'Helpdesk', path: '/helpdesk', icon: '⊙' },
  { label: 'Activity Log', path: '/activity-log', icon: '⏱' },
  { label: 'Usage & Costs', path: '/usage', icon: '◈' },
  { label: 'Connections', path: '/connections', icon: '⌘' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
];

export default function Layout() {
  const { user, tenant, signOut } = useAuth();

  return (
    <div className="app-shell">
      <div className="bg-layer" aria-hidden="true" />

      <aside className="sidebar">
        <div className="sidebar-logo">
          <img
            src="/solarops-logo.png"
            alt="SolarOps"
            style={{ height: '38px', width: 'auto', objectFit: 'contain', objectPosition: 'left center' }}
          />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item${isActive ? ' active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="topbar-tenant">{tenant?.name ?? ''}</span>
          <div className="topbar-right">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                className="topbar-avatar"
              />
            )}
            <button className="topbar-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
