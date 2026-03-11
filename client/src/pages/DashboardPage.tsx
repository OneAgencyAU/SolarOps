import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import '../styles/DashboardPage.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type Period = 'This Week' | 'This Month' | 'All Time';

const PERIOD_MAP: Record<Period, string> = {
  'This Week': 'week',
  'This Month': 'month',
  'All Time': 'all',
};

interface DashboardStats {
  voice: {
    total_calls: number;
    calls_today: number;
    callback_requests: number;
    avg_duration_seconds: number;
    is_agent_live: boolean;
  };
  email: {
    emails_received: number;
    emails_received_today: number;
    unread_count: number;
  };
  drafts: {
    emails_drafted: number;
    emails_drafted_today: number;
  };
  time_saved: {
    minutes_saved: number;
    hours_saved: number;
    mins_remainder: number;
    salary_saved: number;
  };
  recent_activity: {
    type: string;
    title: string;
    subtitle: string;
    time: string;
    meta: string;
  }[];
}

const weeklyData = [
  { day: 'Mon', calls: 8, emails: 22 },
  { day: 'Tue', calls: 12, emails: 18 },
  { day: 'Wed', calls: 6, emails: 25 },
  { day: 'Thu', calls: 15, emails: 30 },
  { day: 'Fri', calls: 11, emails: 20 },
  { day: 'Sat', calls: 9, emails: 15 },
  { day: 'Sun', calls: 14, emails: 28 },
];

const pieData = [
  { name: 'New Commercial', value: 38, color: '#4F8EF7' },
  { name: 'Existing Support', value: 27, color: '#34C759' },
  { name: 'New Residential', value: 20, color: '#FF9F0A' },
  { name: 'Maintenance', value: 15, color: '#FF453A' },
];

export default function DashboardPage() {
  const { user, firstName, tenant } = useAuth();
  const [period, setPeriod] = useState<Period>('This Week');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const getGreetingName = (): string => {
    if (firstName) return firstName;
    const emailUsername = user?.email?.split('@')[0]?.split('.')[0] ?? '';
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return emailUsername ? cap(emailUsername) : 'there';
  };

  useEffect(() => {
    if (!tenant?.id) return;
    setLoading(true);
    fetch(`${API}/api/dashboard/stats?tenant_id=${tenant.id}&period=${PERIOD_MAP[period]}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [tenant?.id, period]);

  const d = (v: number | undefined, suffix = ''): string =>
    loading || v === undefined ? '—' : `${v}${suffix}`;

  const timeSavedToday = (): string => {
    if (loading || !stats) return '—';
    const mins = (stats.voice.calls_today * 4) + (stats.drafts.emails_drafted_today * 3);
    return `${(mins / 60).toFixed(1)}h`;
  };

  const workingDays = (): string => {
    if (loading || !stats) return '—';
    return (stats.time_saved.minutes_saved / 480).toFixed(1);
  };

  const formatActivityTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const activityItems = stats?.recent_activity.map((item) => ({
    type: item.type === 'call' ? 'call' : 'mail',
    title: item.title,
    subtitle: item.subtitle,
    time: formatActivityTime(item.time),
  })) ?? [];

  const greetingName = getGreetingName();
  const isLive = stats?.voice.is_agent_live ?? false;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Good morning, {greetingName}</p>
        </div>
        <div className="period-selector">
          {(['This Week', 'This Month', 'All Time'] as Period[]).map((p) => (
            <button
              key={p}
              className={`period-btn${period === p ? ' active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="bento-grid">
        {/* Card 1 — Today's Summary */}
        <div className="bento-card summary-card">
          <div className="summary-label">Today's Summary</div>
          <div className="summary-date">
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="summary-rows">
            <div className="summary-row">
              <div className="summary-row-left">
                <span className="summary-icon" style={{ color: '#4F8EF7' }}>📞</span>
                <span className="summary-row-label">Calls handled today</span>
              </div>
              <span className="summary-row-value">{d(stats?.voice.calls_today)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row">
              <div className="summary-row-left">
                <span className="summary-icon" style={{ color: '#4F8EF7' }}>✉️</span>
                <span className="summary-row-label">Emails drafted today</span>
              </div>
              <span className="summary-row-value">{d(stats?.drafts.emails_drafted_today)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row">
              <div className="summary-row-left">
                <span className="summary-icon" style={{ color: '#34C759' }}>🕐</span>
                <span className="summary-row-label">Time saved today</span>
              </div>
              <span className="summary-row-value">{timeSavedToday()}</span>
            </div>
          </div>
          <div className="summary-footer">
            <div className="summary-footer-divider" />
            <div className="summary-time-saved">
              <div className="summary-time-label">TIME SAVED THIS {period === 'This Week' ? 'WEEK' : period === 'This Month' ? 'MONTH' : 'TIME'}</div>
              <div className="summary-time-value">
                <span className="summary-time-hours">{loading ? '—' : `${stats?.time_saved.hours_saved ?? 0}hrs`}</span>
                <span className="summary-time-mins">{loading ? '' : `${stats?.time_saved.mins_remainder ?? 0}mins`}</span>
              </div>
              <div className="summary-time-sub">Equivalent to {workingDays()} working days</div>
              <div className="summary-money-label">EST. SALARY SAVED</div>
              <div className="summary-money-value">{loading ? '—' : `$${stats?.time_saved.salary_saved ?? 0}`}</div>
              <div className="summary-money-sub">Based on $42/hr admin rate</div>
            </div>
            <Link to="/helpdesk" className="summary-alert-row">
              <span className="summary-alert-text urgent">3 tickets need attention</span>
              <span className="summary-arrow">→</span>
            </Link>
            <Link to="/inbox-assistant" className="summary-alert-row">
              <span className="summary-alert-text muted">
                {loading ? '—' : stats?.email.unread_count ?? 0} emails waiting for approval
              </span>
              <span className="summary-arrow muted">→</span>
            </Link>
          </div>
        </div>

        {/* Card 2 — Weekly Chart */}
        <div className="bento-card chart-card">
          <div className="card-header">
            <div className="card-title">Weekly Activity</div>
            <div className="card-subtitle">Calls + emails · last 7 days</div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weeklyData} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6e6e73' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e5e7', borderRadius: 10, fontSize: 13 }}
                  itemStyle={{ padding: 0 }}
                />
                <Line type="monotone" dataKey="calls" stroke="#4F8EF7" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="emails" stroke="#34C759" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: '#4F8EF7' }} />Calls</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#34C759' }} />Emails</span>
          </div>
        </div>

        {/* Card 3 — Emails Drafted */}
        <div className="bento-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(79,142,247,0.10)', color: '#4F8EF7' }}><MailIcon /></div>
          <div className="stat-value">{d(stats?.drafts.emails_drafted)}</div>
          <div className="stat-label">Emails Drafted</div>
          <div className="stat-trend positive">↑ {d(stats?.drafts.emails_drafted_today)} today</div>
        </div>

        {/* Card 4 — Emails Received */}
        <div className="bento-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(79,142,247,0.10)', color: '#4F8EF7' }}><SendIcon /></div>
          <div className="stat-value">{d(stats?.email.emails_received)}</div>
          <div className="stat-label">Emails Received</div>
          <div className="stat-trend positive">↑ {d(stats?.email.emails_received_today)} today</div>
        </div>

        {/* Card 5 — Avg Response */}
        <div className="bento-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759' }}><ClockIcon /></div>
          <div className="stat-value">—</div>
          <div className="stat-label">Avg Response Time</div>
          <div className="stat-trend positive">No data yet</div>
        </div>

        {/* Card 6 — Live Status */}
        <div className="bento-card live-card">
          <div className="live-label">VOICE AGENT</div>
          <div className="live-row">
            <span className="live-dot" style={{ background: isLive ? '#34C759' : '#aeaeb2' }} />
            <span className="live-text" style={{ color: isLive ? '#34C759' : '#aeaeb2' }}>
              {loading ? '—' : isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div className="live-sub">{d(stats?.voice.total_calls)} calls this {period === 'This Week' ? 'week' : period === 'This Month' ? 'month' : 'time'}</div>
          <div className="live-sub" style={{ marginTop: 4 }}>{d(stats?.voice.callback_requests)} callback requests</div>
        </div>

        {/* Card 7 — Enquiry Types */}
        <div className="bento-card enquiry-card">
          <div className="card-title">Top Enquiry Types</div>
          <div className="enquiry-content">
            <div className="enquiry-chart">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={72} strokeWidth={0}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="enquiry-legend">
              {pieData.map((entry) => (
                <div key={entry.name} className="enquiry-legend-item">
                  <span className="legend-dot" style={{ background: entry.color }} />
                  <span className="enquiry-legend-name">{entry.name}</span>
                  <span className="enquiry-legend-pct">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 8 — Tickets */}
        <div className="bento-card tickets-card">
          <div className="tickets-half">
            <div className="stat-value">12</div>
            <div className="stat-label">Open Tickets</div>
            <div className="stat-trend negative">3 urgent</div>
          </div>
          <div className="tickets-divider" />
          <div className="tickets-half">
            <div className="stat-value">94</div>
            <div className="stat-label">Resolved</div>
            <div className="stat-trend positive">this month</div>
          </div>
        </div>

        {/* Card 9 — Activity Feed */}
        <div className="bento-card feed-card">
          <div className="card-title" style={{ marginBottom: 8 }}>Recent Activity</div>
          {activityItems.length === 0 && !loading && (
            <div style={{ color: '#aeaeb2', fontSize: '0.84rem', padding: '20px 0' }}>No recent activity.</div>
          )}
          {activityItems.map((item, i) => (
            <div key={i} className={`feed-row${i < activityItems.length - 1 ? ' bordered' : ''}`}>
              <div className={`feed-icon ${item.type}`}>
                {item.type === 'call' ? <PhoneIcon /> : <MailIcon />}
              </div>
              <div className="feed-body">
                <div className="feed-title">{item.title}</div>
                <div className="feed-subtitle">{item.subtitle}</div>
              </div>
              <div className="feed-time">{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  );
}
