import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import '../styles/DashboardPage.css';

type Period = 'This Week' | 'This Month' | 'All Time';

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

const activityItems = [
  { type: 'call', title: 'Inbound call handled — John Smith', subtitle: 'Callback requested · Commercial · 2 mins ago', time: '9:42 AM' },
  { type: 'mail', title: 'Email drafted — Sunridge Solar quote follow-up', subtitle: 'Proposal sent · Residential · 14 mins ago', time: '9:30 AM' },
  { type: 'call', title: 'Inbound call handled — Maria Torres', subtitle: 'Appointment booked · Residential · 31 mins ago', time: '9:13 AM' },
  { type: 'mail', title: 'Email drafted — Panel maintenance inquiry', subtitle: 'Service request · Commercial · 1 hr ago', time: '8:44 AM' },
  { type: 'call', title: 'Inbound call handled — Derek Okafor', subtitle: 'Information provided · Industrial · 2 hrs ago', time: '7:58 AM' },
];

export default function DashboardPage() {
  const { user, firstName } = useAuth();
  const [period, setPeriod] = useState<Period>('This Week');

  const getGreetingName = (): string => {
    if (firstName) return firstName;
    const emailUsername = user?.email?.split('@')[0]?.split('.')[0] ?? '';
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return emailUsername ? cap(emailUsername) : 'there';
  };

  const greetingName = getGreetingName();

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
        {/* Card 1 — Time Saved Hero */}
        <div className="bento-card hero-card">
          <div className="hero-content">
            <div className="hero-value">18.4h</div>
            <div className="hero-label">Time Saved This Week</div>
            <div className="hero-sub">Equivalent to 2.3 working days</div>
          </div>
          <div className="hero-pills">
            <span className="hero-pill">47 calls</span>
            <span className="hero-pill">134 emails</span>
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
          <div className="stat-value">134</div>
          <div className="stat-label">Emails Drafted</div>
          <div className="stat-trend positive">↑ 28 this week</div>
        </div>

        {/* Card 4 — Emails Sent */}
        <div className="bento-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(79,142,247,0.10)', color: '#4F8EF7' }}><SendIcon /></div>
          <div className="stat-value">89</div>
          <div className="stat-label">Emails Sent</div>
          <div className="stat-trend positive">↑ 19 this week</div>
        </div>

        {/* Card 5 — Avg Response */}
        <div className="bento-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759' }}><ClockIcon /></div>
          <div className="stat-value">4.2m</div>
          <div className="stat-label">Avg Response Time</div>
          <div className="stat-trend positive">↓ 1.8m faster</div>
        </div>

        {/* Card 6 — Live Status */}
        <div className="bento-card live-card">
          <div className="live-label">VOICE AGENT</div>
          <div className="live-row">
            <span className="live-dot" />
            <span className="live-text">LIVE</span>
          </div>
          <div className="live-sub">47 calls this week</div>
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
