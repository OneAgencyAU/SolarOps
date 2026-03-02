import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ConnectionsPage.css';

const connectors = [
  {
    logo: '🪟',
    title: 'Microsoft 365',
    subtitle: 'Outlook · Teams · Calendar',
    description: 'Connect your Microsoft inbox and calendar to enable the Inbox Assistant for Outlook users.',
  },
  {
    logo: '⚡',
    title: 'Simpro',
    subtitle: 'Jobs · Customers · Quotes',
    description: 'Sync customer records, job data, and quotes directly from Simpro into SolarOps.',
  },
  {
    logo: '📞',
    title: 'Voice Platform',
    subtitle: 'Vapi · Telnyx',
    description: 'Connect your voice AI provider to enable live call handling and transcripts.',
  },
  {
    logo: '💙',
    title: 'Xero',
    subtitle: 'Invoicing · Accounting',
    description: 'Sync invoices and customer billing data between SolarOps and Xero.',
  },
];

const inboxes = [
  { address: 'support@solenergy.com.au', enabled: true },
  { address: 'sales@solenergy.com.au', enabled: true },
  { address: 'info@solenergy.com.au', enabled: false },
];

const permissions = [
  'Read emails',
  'Create drafts',
  'Send on behalf (requires approval)',
];

interface GoogleStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export default function ConnectionsPage() {
  const { user, tenant } = useAuth();
  const [manageOpen, setManageOpen] = useState(false);
  const [inboxToggles, setInboxToggles] = useState(inboxes.map((i) => i.enabled));
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false, email: null, lastSync: null });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const toggleInbox = (idx: number) =>
    setInboxToggles((prev) => prev.map((v, i) => (i === idx ? !v : v)));

  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/auth/google/status?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setGoogleStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setToast({ message: 'Google Workspace connected successfully', type: 'success' });
      window.history.replaceState({}, '', '/connections');
    } else if (params.get('error') === 'auth_failed') {
      setToast({ message: 'Connection failed. Please try again.', type: 'error' });
      window.history.replaceState({}, '', '/connections');
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleConnect = () => {
    if (!tenant?.id || !user?.uid) return;
    window.location.href = `/api/auth/google?tenant_id=${tenant.id}&user_id=${user.uid}`;
  };

  const handleDisconnect = async () => {
    if (!tenant?.id) return;
    try {
      await fetch(`/api/auth/google/disconnect?tenant_id=${tenant.id}`, { method: 'DELETE' });
      setGoogleStatus({ connected: false, email: null, lastSync: null });
    } catch {
      setToast({ message: 'Failed to disconnect. Please try again.', type: 'error' });
    }
  };

  const connectedCount = googleStatus.connected ? 1 : 0;

  return (
    <div className="conn-page">
      <div className="conn-header">
        <h1 className="conn-title">Connections</h1>
        <p className="conn-subtitle">Connect your existing tools to SolarOps</p>
        <p className="conn-stats">{connectedCount} connected · {4 + (googleStatus.connected ? 0 : 1)} available</p>
      </div>

      {googleStatus.connected && (
        <>
          <div className="conn-section-label">Connected</div>
          <div className="conn-active-card">
            <div className="conn-active-left">
              <div className="conn-logo-box">
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="conn-active-info">
                <div className="conn-active-name">Google Workspace</div>
                <div className="conn-active-sub">Gmail · Google Calendar</div>
                <div className="conn-active-account">{googleStatus.email}</div>
                <div className="conn-active-meta">
                  <span className="conn-status-pill">
                    <span className="conn-status-dot" />
                    Connected
                  </span>
                  <span className="conn-last-sync">Last synced {googleStatus.lastSync ? timeAgo(googleStatus.lastSync) : 'just now'}</span>
                </div>
              </div>
            </div>
            <div className="conn-active-actions">
              <button className="conn-btn-outline" onClick={() => setManageOpen(true)}>Manage</button>
              <button className="conn-btn-disconnect" onClick={handleDisconnect}>Disconnect</button>
            </div>
          </div>
        </>
      )}

      <div className="conn-section-label" style={{ marginTop: googleStatus.connected ? 32 : 0 }}>Available</div>
      <div className="conn-grid">
        {!googleStatus.connected && !loading && (
          <div className="conn-card">
            <div className="conn-card-top">
              <div className="conn-card-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
            </div>
            <div className="conn-card-title">Google Workspace</div>
            <div className="conn-card-sub">Gmail · Google Calendar</div>
            <div className="conn-card-desc">Connect your Gmail inbox to enable the Inbox Assistant and AI-drafted replies.</div>
            <button className="conn-btn-connect conn-btn-connect--active" onClick={handleConnect}>Connect</button>
          </div>
        )}
        {connectors.map((c) => (
          <div key={c.title} className="conn-card">
            <div className="conn-card-top">
              <div className="conn-card-logo">{c.logo}</div>
              <span className="conn-coming-pill">Coming Soon</span>
            </div>
            <div className="conn-card-title">{c.title}</div>
            <div className="conn-card-sub">{c.subtitle}</div>
            <div className="conn-card-desc">{c.description}</div>
            <button className="conn-btn-connect" disabled>Connect</button>
          </div>
        ))}
      </div>

      {manageOpen && googleStatus.connected && (
        <>
          <div className="conn-overlay" onClick={() => setManageOpen(false)} />
          <div className="conn-modal">
            <h2 className="conn-modal-title">Google Workspace Settings</h2>
            <p className="conn-modal-account">{googleStatus.email}</p>

            <div className="conn-modal-section-label">Monitored Inboxes</div>
            <div className="conn-toggle-list">
              {inboxes.map((inbox, i) => (
                <div key={inbox.address} className="conn-toggle-row">
                  <span className="conn-toggle-address">{inbox.address}</span>
                  <button
                    className={`conn-toggle-switch${inboxToggles[i] ? ' on' : ''}`}
                    onClick={() => toggleInbox(i)}
                  >
                    <span className="conn-toggle-thumb" />
                  </button>
                </div>
              ))}
            </div>

            <div className="conn-modal-section-label">Permissions Granted</div>
            <div className="conn-permissions">
              {permissions.map((p) => (
                <div key={p} className="conn-permission-row">
                  <span className="conn-perm-check">✅</span>
                  <span className="conn-perm-label">{p}</span>
                </div>
              ))}
            </div>

            <div className="conn-modal-actions">
              <button className="conn-modal-close" onClick={() => setManageOpen(false)}>Close</button>
              <button className="conn-modal-save" onClick={() => setManageOpen(false)}>Save Changes</button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`conn-toast conn-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
