import { useState } from 'react';
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

export default function ConnectionsPage() {
  const [manageOpen, setManageOpen] = useState(false);
  const [inboxToggles, setInboxToggles] = useState(inboxes.map((i) => i.enabled));

  const toggleInbox = (idx: number) =>
    setInboxToggles((prev) => prev.map((v, i) => (i === idx ? !v : v)));

  return (
    <div className="conn-page">
      <div className="conn-header">
        <h1 className="conn-title">Connections</h1>
        <p className="conn-subtitle">Connect your existing tools to SolarOps</p>
        <p className="conn-stats">1 connected · 4 available</p>
      </div>

      {/* Active Connections */}
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
            <div className="conn-active-account">support@solenergy.com.au</div>
            <div className="conn-active-meta">
              <span className="conn-status-pill">
                <span className="conn-status-dot" />
                Connected
              </span>
              <span className="conn-last-sync">Last synced 2 minutes ago</span>
            </div>
          </div>
        </div>
        <div className="conn-active-actions">
          <button className="conn-btn-outline" onClick={() => setManageOpen(true)}>Manage</button>
          <button className="conn-btn-disconnect">Disconnect</button>
        </div>
      </div>

      {/* Available Connectors */}
      <div className="conn-section-label" style={{ marginTop: 32 }}>Available</div>
      <div className="conn-grid">
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

      {/* Manage Modal */}
      {manageOpen && (
        <>
          <div className="conn-overlay" onClick={() => setManageOpen(false)} />
          <div className="conn-modal">
            <h2 className="conn-modal-title">Google Workspace Settings</h2>
            <p className="conn-modal-account">support@solenergy.com.au</p>

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
    </div>
  );
}
