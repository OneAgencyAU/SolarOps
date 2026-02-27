import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/DashboardPage.css';

type Period = 'This Week' | 'This Month' | 'All Time';

const kpiCards = [
  {
    value: '47',
    label: 'Calls Answered',
    subtext: '↑ 12 from last week',
    subtextColor: '#34C759',
    icon: <PhoneIcon />,
    iconColor: '#4F8EF7',
    hero: false,
  },
  {
    value: '134',
    label: 'Emails Drafted',
    subtext: '↑ 28 from last week',
    subtextColor: '#34C759',
    icon: <MailIcon />,
    iconColor: '#4F8EF7',
    hero: false,
  },
  {
    value: '4.2m',
    label: 'Avg Response Time',
    subtext: '↓ 1.8m faster than last week',
    subtextColor: '#34C759',
    icon: <ClockIcon />,
    iconColor: '#34C759',
    hero: false,
  },
  {
    value: '18.4h',
    label: 'Time Saved This Week',
    subtext: 'Based on 47 calls + 134 emails',
    subtextColor: 'rgba(0,0,0,0.4)',
    icon: <SparkleIcon />,
    iconColor: '#4F8EF7',
    hero: true,
  },
];

const activityItems = [
  {
    type: 'call',
    title: 'Inbound call handled — John Smith',
    subtitle: 'Callback requested · Commercial · 2 mins ago',
    time: '9:42 AM',
  },
  {
    type: 'mail',
    title: 'Email drafted — Sunridge Solar quote follow-up',
    subtitle: 'Proposal sent · Residential · 14 mins ago',
    time: '9:30 AM',
  },
  {
    type: 'call',
    title: 'Inbound call handled — Maria Torres',
    subtitle: 'Appointment booked · Residential · 31 mins ago',
    time: '9:13 AM',
  },
  {
    type: 'mail',
    title: 'Email drafted — Panel maintenance inquiry',
    subtitle: 'Service request · Commercial · 1 hr ago',
    time: '8:44 AM',
  },
  {
    type: 'call',
    title: 'Inbound call handled — Derek Okafor',
    subtitle: 'Information provided · Industrial · 2 hrs ago',
    time: '7:58 AM',
  },
  {
    type: 'mail',
    title: 'Email drafted — Bright Future Energy onboarding',
    subtitle: 'Welcome sequence · Commercial · 3 hrs ago',
    time: '6:51 AM',
  },
];

const quickActions = [
  { label: 'Configure Voice Agent', path: '/voice-agent' },
  { label: 'Connect Google Workspace', path: '/connections' },
  { label: 'View Helpdesk', path: '/helpdesk' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('This Week');

  const getFirstName = (): string => {
    const emailUsername = user?.email?.split('@')[0]?.split('.')[0] ?? '';
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    if (!user?.displayName) return emailUsername ? cap(emailUsername) : 'there';

    const companyTerms = ['agency', 'inc', 'llc', 'ltd', 'corp', 'company', 'co.', 'group', 'solutions', 'services', 'studio', 'labs', 'ventures'];
    const lower = user.displayName.toLowerCase();
    const isCompany = companyTerms.some((t) => lower.includes(t));

    if (isCompany) return emailUsername ? cap(emailUsername) : user.displayName.split(' ')[0];

    return user.displayName.split(' ')[0];
  };

  const firstName = getFirstName();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Good morning, {firstName}</p>
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

      <div className="kpi-grid">
        {kpiCards.map((card) => (
          <div key={card.label} className={`kpi-card${card.hero ? ' hero' : ''}`}>
            <div className="kpi-icon" style={{ color: card.iconColor, background: `${card.iconColor}18` }}>
              {card.icon}
            </div>
            <div className="kpi-value">{card.value}</div>
            <div className="kpi-label">{card.label}</div>
            <div className="kpi-subtext" style={{ color: card.subtextColor }}>{card.subtext}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Recent Activity</h2>
        <div className="glass-card activity-feed">
          {activityItems.map((item, i) => (
            <div key={i} className={`activity-item${i < activityItems.length - 1 ? ' bordered' : ''}`}>
              <div className={`activity-icon ${item.type}`}>
                {item.type === 'call' ? <PhoneIcon /> : <MailIcon />}
              </div>
              <div className="activity-body">
                <div className="activity-title">{item.title}</div>
                <div className="activity-subtitle">{item.subtitle}</div>
              </div>
              <div className="activity-time">{item.time}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path} className="quick-action-btn">
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}
