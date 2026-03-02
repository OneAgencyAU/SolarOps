import { useState } from 'react';
import '../styles/ActivityLogPage.css';

type ModuleType = 'Inbox' | 'Voice' | 'Helpdesk' | 'Connections';
type StatusType = 'Success' | 'Pending' | 'Failed';
type TriggerType = 'AI Auto' | 'System' | 'Sarah' | 'Nat';
type TypeFilter = 'All' | 'AI Action' | 'System' | 'Error';

interface Activity {
  id: number;
  time: string;
  module: ModuleType;
  action: string;
  details: string;
  trigger: TriggerType;
  status: StatusType;
  log: Record<string, unknown>;
}

const activities: Activity[] = [
  { id: 1, time: '10:23 AM', module: 'Inbox', action: 'Draft generated', details: 'Reply drafted for James Hartley — Commercial solar quote', trigger: 'AI Auto', status: 'Success', log: { action: 'draft_generated', model: 'claude-sonnet-4', tokens_used: 847, latency_ms: 1243, thread_id: 'msg_abc123', confidence: 0.94 } },
  { id: 2, time: '10:21 AM', module: 'Voice', action: 'Call handled', details: 'Inbound call from +61 412 345 678 — New enquiry, callback requested', trigger: 'AI Auto', status: 'Success', log: { action: 'call_handled', duration_s: 134, outcome: 'callback_requested', caller: '+61412345678', agent_id: 'voice_01' } },
  { id: 3, time: '10:18 AM', module: 'Inbox', action: 'Email classified', details: "Tagged as 'New Lead' — Mark Deluca, 12-unit development enquiry", trigger: 'AI Auto', status: 'Success', log: { action: 'email_classified', tag: 'New Lead', confidence: 0.97, model: 'claude-sonnet-4', latency_ms: 312 } },
  { id: 4, time: '10:15 AM', module: 'Helpdesk', action: 'Ticket created', details: 'Ticket #1042 created from email — James Hartley', trigger: 'AI Auto', status: 'Success', log: { action: 'ticket_created', ticket_id: 1042, source: 'email', customer: 'James Hartley', priority: 'medium' } },
  { id: 5, time: '10:12 AM', module: 'Inbox', action: 'Draft approved & sent', details: 'Sarah approved and sent reply to Rachel Wong', trigger: 'Sarah', status: 'Success', log: { action: 'draft_sent', approved_by: 'sarah@solenergy.com.au', recipient: 'rachel@example.com', latency_ms: 89 } },
  { id: 6, time: '10:08 AM', module: 'Voice', action: 'Transcript saved', details: 'Call transcript saved — Maria Torres, 2m 14s', trigger: 'AI Auto', status: 'Success', log: { action: 'transcript_saved', duration_s: 134, caller: 'Maria Torres', words: 412, model: 'whisper-v3' } },
  { id: 7, time: '10:05 AM', module: 'Connections', action: 'Gmail sync', details: 'Inbox synced — 3 new emails processed', trigger: 'System', status: 'Success', log: { action: 'gmail_sync', emails_fetched: 3, sync_duration_ms: 2100, connection_id: 'gc_001' } },
  { id: 8, time: '9:58 AM', module: 'Inbox', action: 'Draft generated', details: 'Reply drafted for Priya Sharma — Battery rebate question', trigger: 'AI Auto', status: 'Pending', log: { action: 'draft_generated', model: 'claude-sonnet-4', tokens_used: 623, latency_ms: 1087, thread_id: 'msg_def456', confidence: 0.88 } },
  { id: 9, time: '9:52 AM', module: 'Helpdesk', action: 'SLA warning', details: 'Ticket #1037 — Inverter fault, SLA breached by 2 hours', trigger: 'System', status: 'Failed', log: { action: 'sla_breach', ticket_id: 1037, sla_target_hours: 4, actual_hours: 6, priority: 'high' } },
  { id: 10, time: '9:45 AM', module: 'Voice', action: 'Escalation triggered', details: "Call escalated — keyword 'smoke' detected, transferred to Nat", trigger: 'AI Auto', status: 'Success', log: { action: 'escalation_triggered', keyword: 'smoke', transferred_to: 'nat@solenergy.com.au', latency_ms: 450 } },
  { id: 11, time: '9:41 AM', module: 'Inbox', action: 'Email received', details: 'New email from james@suncoastcommercial.com.au', trigger: 'System', status: 'Success', log: { action: 'email_received', from: 'james@suncoastcommercial.com.au', subject: 'Commercial solar quote', size_kb: 12 } },
  { id: 12, time: '9:38 AM', module: 'Helpdesk', action: 'Ticket assigned', details: 'Ticket #1038 assigned to Nat by Sarah', trigger: 'Sarah', status: 'Success', log: { action: 'ticket_assigned', ticket_id: 1038, assigned_to: 'nat@solenergy.com.au', assigned_by: 'sarah@solenergy.com.au' } },
  { id: 13, time: '9:30 AM', module: 'Connections', action: 'Gmail sync failed', details: 'Connection timeout — retrying in 5 minutes', trigger: 'System', status: 'Failed', log: { action: 'gmail_sync_failed', error: 'ETIMEDOUT', retry_in_s: 300, attempts: 3 } },
  { id: 14, time: '9:22 AM', module: 'Voice', action: 'Call handled', details: 'Inbound call — James Park, existing customer support', trigger: 'AI Auto', status: 'Success', log: { action: 'call_handled', duration_s: 97, outcome: 'resolved', caller: 'James Park', agent_id: 'voice_01' } },
  { id: 15, time: '9:15 AM', module: 'Inbox', action: 'AI summary generated', details: 'Summary generated for ticket #1041 — Priya Sharma battery rebate', trigger: 'AI Auto', status: 'Success', log: { action: 'summary_generated', ticket_id: 1041, model: 'claude-sonnet-4', tokens_used: 312, latency_ms: 890, confidence: 0.92 } },
];

const moduleIcons: Record<ModuleType, string> = {
  Inbox: '✉',
  Voice: '📞',
  Helpdesk: '🎫',
  Connections: '🔗',
};

export default function ActivityLogPage() {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('Today');
  const [moduleFilter, setModuleFilter] = useState<'All' | ModuleType>('All');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | StatusType>('All');
  const [drawerItem, setDrawerItem] = useState<Activity | null>(null);

  const filtered = activities.filter((a) => {
    if (search && !a.action.toLowerCase().includes(search.toLowerCase()) && !a.details.toLowerCase().includes(search.toLowerCase())) return false;
    if (moduleFilter !== 'All' && a.module !== moduleFilter) return false;
    if (statusFilter !== 'All' && a.status !== statusFilter) return false;
    if (typeFilter === 'AI Action' && a.trigger !== 'AI Auto') return false;
    if (typeFilter === 'System' && a.trigger !== 'System') return false;
    if (typeFilter === 'Error' && a.status !== 'Failed') return false;
    return true;
  });

  return (
    <div className="al-page">
      <div className="al-header">
        <h1 className="al-title">Activity Log</h1>
        <p className="al-subtitle">Every action taken by SolarOps AI — fully transparent</p>
      </div>

      <div className="al-stats">
        <span className="al-stat al-stat--blue">247 Actions Today</span>
        <span className="al-stat al-stat--orange">12 Pending Review</span>
        <span className="al-stat al-stat--red">3 Errors</span>
        <span className="al-stat al-stat--green">99.2% Success Rate</span>
      </div>

      <div className="al-filters">
        <div className="al-filters-left">
          <input
            className="al-search"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="al-date-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option>Today</option>
            <option>Yesterday</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
        </div>
        <div className="al-filters-right">
          <div className="al-filter-group">
            {(['All', 'Voice', 'Inbox', 'Helpdesk', 'Connections'] as const).map((m) => (
              <button key={m} className={`al-pill${moduleFilter === m ? ' active' : ''}`} onClick={() => setModuleFilter(m)}>{m}</button>
            ))}
          </div>
          <div className="al-filter-group">
            {(['All', 'AI Action', 'System', 'Error'] as const).map((t) => (
              <button key={t} className={`al-pill${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>
            ))}
          </div>
          <div className="al-filter-group">
            {(['All', 'Success', 'Pending', 'Failed'] as const).map((s) => (
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
                <th>User / Trigger</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="al-row" onClick={() => setDrawerItem(a)}>
                  <td className="al-cell-time">{a.time}</td>
                  <td>
                    <div className="al-module">
                      <span className={`al-module-icon al-module-icon--${a.module.toLowerCase()}`}>{moduleIcons[a.module]}</span>
                      <span className="al-module-name">{a.module}</span>
                    </div>
                  </td>
                  <td className="al-cell-action">{a.action}</td>
                  <td className="al-cell-details">{a.details}</td>
                  <td>
                    {a.trigger === 'AI Auto' ? (
                      <span className="al-trigger-pill al-trigger--ai">AI Auto</span>
                    ) : a.trigger === 'System' ? (
                      <span className="al-trigger-pill al-trigger--system">System</span>
                    ) : (
                      <span className="al-trigger-text">{a.trigger}</span>
                    )}
                  </td>
                  <td>
                    <span className={`al-status al-status--${a.status.toLowerCase()}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="al-pagination">
          <span className="al-pagination-text">Showing {filtered.length} of 247 actions today</span>
          <button className="al-load-more">Load more</button>
        </div>
      </div>

      {drawerItem && (
        <>
          <div className="al-overlay" onClick={() => setDrawerItem(null)} />
          <div className="al-drawer">
            <div className="al-drawer-header">
              <div className="al-drawer-title-row">
                <span className="al-drawer-title">{drawerItem.action}</span>
                <span className={`al-status al-status--${drawerItem.status.toLowerCase()}`}>{drawerItem.status}</span>
              </div>
              <button className="al-drawer-close" onClick={() => setDrawerItem(null)}>✕</button>
            </div>

            <div className="al-drawer-body">
              <div className="al-drawer-meta">
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Timestamp</span>
                  <span className="al-drawer-value">2 Mar 2026, {drawerItem.time}</span>
                </div>
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Module</span>
                  <span className="al-drawer-value">
                    <span className={`al-module-icon al-module-icon--${drawerItem.module.toLowerCase()}`} style={{ width: 22, height: 22, fontSize: '0.7rem' }}>{moduleIcons[drawerItem.module]}</span>
                    {drawerItem.module}
                  </span>
                </div>
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Details</span>
                  <span className="al-drawer-value">{drawerItem.details}</span>
                </div>
                <div className="al-drawer-meta-row">
                  <span className="al-drawer-label">Trigger</span>
                  <span className="al-drawer-value">
                    {drawerItem.trigger === 'AI Auto' ? (
                      <span className="al-trigger-pill al-trigger--ai">AI Auto</span>
                    ) : drawerItem.trigger === 'System' ? (
                      <span className="al-trigger-pill al-trigger--system">System</span>
                    ) : (
                      drawerItem.trigger
                    )}
                  </span>
                </div>
              </div>

              <div className="al-drawer-section-label">Raw Log</div>
              <pre className="al-drawer-log">{JSON.stringify(drawerItem.log, null, 2)}</pre>

              <div className="al-drawer-actions">
                <button className="al-btn-secondary" disabled>Re-run Action</button>
                <button className="al-btn-primary" onClick={() => setDrawerItem(null)}>Mark as Reviewed</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
