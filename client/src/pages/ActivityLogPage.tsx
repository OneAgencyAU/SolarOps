import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ActivityLogPage.css';

interface Activity {
  id: string;
  tenant_id: string;
  module: string;
  action: string;
  details: string;
  trigger: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  successRate: string;
}

const moduleIcons: Record<string, string> = {
  inbox: '\u2709',
  voice: '\uD83D\uDCDE',
  connections: '\uD83D\uDD17',
  system: '\u2699',
};

const moduleLabels: Record<string, string> = {
  inbox: 'Inbox',
  voice: 'Voice',
  connections: 'Connections',
  system: 'System',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityLogPage() {
  const { tenant } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, success: 0, failed: 0, successRate: '0' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [drawerItem, setDrawerItem] = useState<Activity | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    fetchActivities();
    fetchStats();
  }, [tenant?.id]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activity-log?tenant_id=${tenant?.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/activity-log/stats?tenant_id=${tenant?.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch activity stats:', err);
    }
  };

  const filtered = activities.filter((a) => {
    if (search && !a.action.toLowerCase().includes(search.toLowerCase()) && !a.details.toLowerCase().includes(search.toLowerCase())) return false;
    if (moduleFilter !== 'All' && a.module !== moduleFilter.toLowerCase()) return false;
    if (statusFilter !== 'All' && a.status !== statusFilter.toLowerCase()) return false;
    if (typeFilter === 'AI Action' && a.trigger !== 'ai_auto') return false;
    if (typeFilter === 'System' && a.trigger !== 'system') return false;
    if (typeFilter === 'Error' && a.status !== 'failed') return false;
    return true;
  });

  return (
    <div className="al-page">
      <div className="al-header">
        <h1 className="al-title">Activity Log</h1>
        <p className="al-subtitle">Every action taken by SolarOps AI — fully transparent</p>
      </div>

      <div className="al-stats">
        <span className="al-stat al-stat--blue">{stats.total} Actions Today</span>
        <span className="al-stat al-stat--red">{stats.failed} Errors</span>
        <span className="al-stat al-stat--green">{stats.successRate}% Success Rate</span>
      </div>

      <div className="al-filters">
        <div className="al-filters-left">
          <input
            className="al-search"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="al-filters-right">
          <div className="al-filter-group">
            {['All', 'Inbox', 'Voice', 'Connections', 'System'].map((m) => (
              <button key={m} className={`al-pill${moduleFilter === m ? ' active' : ''}`} onClick={() => setModuleFilter(m)}>{m}</button>
            ))}
          </div>
          <div className="al-filter-group">
            {['All', 'AI Action', 'System', 'Error'].map((t) => (
              <button key={t} className={`al-pill${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>
            ))}
          </div>
          <div className="al-filter-group">
            {['All', 'Success', 'Failed'].map((s) => (
              <button key={s} className={`al-pill${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="al-table-card">
        <div className="al-table-wrap">
          <table className="al-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Module</th>
                <th>Action</th>
                <th>Details</th>
                <th>Trigger</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No activity yet — jobs will appear as the system runs</td></tr>
              ) : (
                filtered.map((a) => {
                  const mod = a.module || 'system';
                  return (
                    <tr key={a.id} className="al-row" onClick={() => setDrawerItem(a)}>
                      <td className="al-cell-time">{formatTime(a.created_at)}</td>
                      <td>
                        <div className="al-module">
                          <span className={`al-module-icon al-module-icon--${mod}`}>{moduleIcons[mod] || '\u2699'}</span>
                          <span className="al-module-name">{moduleLabels[mod] || mod}</span>
                        </div>
                      </td>
                      <td className="al-cell-action">{a.action.replace(/_/g, ' ')}</td>
                      <td className="al-cell-details">{a.details}</td>
                      <td>
                        {a.trigger === 'ai_auto' ? (
                          <span className="al-trigger-pill al-trigger--ai">AI Auto</span>
                        ) : a.trigger === 'system' ? (
                          <span className="al-trigger-pill al-trigger--system">System</span>
                        ) : (
                          <span className="al-trigger-text">{a.trigger}</span>
                        )}
                      </td>
                      <td>
                        <span className={`al-status al-status--${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="al-pagination">
          <span className="al-pagination-text">Showing {filtered.length} of {stats.total} actions today</span>
          <button className="al-load-more" onClick={fetchActivities}>Refresh</button>
        </div>
      </div>

      {drawerItem && (
        <>
          <div className="al-overlay" onClick={() => setDrawerItem(null)} />
          <div className="al-drawer">
            <div className="al-drawer-header">
              <div className="al-drawer-title-row">
                <span className="al-drawer-title">{drawerItem.action.replace(/_/g, ' ')}</span>
                <span className={`al-status al-status--${drawerItem.status}`}>{drawerItem.status.charAt(0).toUpperCase() + drawerItem.status.slice(1)}</span>
              </div>
              <button className="al-drawer-close" onClick={() => setDrawerItem(null)}>✕</button>
            </div>

            <div className="al-drawer-body">
              <div className="al-drawer-meta">
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Timestamp</span>
                  <span className="al-drawer-value">{formatDate(drawerItem.created_at)}, {formatTime(drawerItem.created_at)}</span>
                </div>
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Module</span>
                  <span className="al-drawer-value">
                    <span className={`al-module-icon al-module-icon--${drawerItem.module}`} style={{ width: 22, height: 22, fontSize: '0.7rem' }}>{moduleIcons[drawerItem.module] || '\u2699'}</span>
                    {moduleLabels[drawerItem.module] || drawerItem.module}
                  </span>
                </div>
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Details</span>
                  <span className="al-drawer-value">{drawerItem.details}</span>
                </div>
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Trigger</span>
                  <span className="al-drawer-value">
                    {drawerItem.trigger === 'ai_auto' ? (
                      <span className="al-trigger-pill al-trigger--ai">AI Auto</span>
                    ) : drawerItem.trigger === 'system' ? (
                      <span className="al-trigger-pill al-trigger--system">System</span>
                    ) : (
                      drawerItem.trigger
                    )}
                  </span>
                </div>
              </div>

              <div className="al-drawer-section-label">Metadata</div>
              <pre className="al-drawer-log">{JSON.stringify(drawerItem.metadata, null, 2)}</pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
