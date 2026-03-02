import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SettingsPage.css';

const timezones = [
  'Australia/Adelaide (ACST +9:30)',
  'Australia/Sydney (AEST +10:00)',
  'Australia/Melbourne (AEST +10:00)',
  'Australia/Brisbane (AEST +10:00)',
  'Australia/Perth (AWST +8:00)',
];

const industries = [
  'Solar — Commercial & Residential',
  'Solar — Commercial Only',
  'Solar — Residential Only',
  'Electrical — General',
  'HVAC',
];

interface Notif {
  id: string;
  label: string;
  desc: string;
  on: boolean;
}

const initNotifs: Notif[] = [
  { id: 'urgent', label: 'Urgent ticket alerts', desc: 'Get notified when a ticket is marked urgent', on: true },
  { id: 'callback', label: 'New callback requests', desc: 'Email alert when voice agent captures a callback', on: true },
  { id: 'sla', label: 'SLA overdue alerts', desc: 'Alert when a ticket breaches its SLA target', on: true },
  { id: 'daily', label: 'Daily summary email', desc: 'Receive a daily digest of activity and KPIs', on: false },
  { id: 'draft', label: 'Inbox draft ready', desc: 'Notify when AI has drafted a reply for review', on: true },
];

export default function SettingsPage() {
  const { user, firstName } = useAuth();

  const [bizName, setBizName] = useState('Sol Energy');
  const [timezone, setTimezone] = useState(timezones[0]);
  const [industry, setIndustry] = useState(industries[0]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Agent');

  const [notifs, setNotifs] = useState<Notif[]>(initNotifs);
  const [notifEmail, setNotifEmail] = useState(user?.email ?? '');

  const [aiToggles, setAiToggles] = useState({ autoTag: true, aiSummary: true, escalation: true, signature: true, followUp: true });
  const toggleAi = (key: keyof typeof aiToggles) => setAiToggles(prev => ({ ...prev, [key]: !prev[key] }));
  const [tone, setTone] = useState<'Professional' | 'Friendly' | 'Formal'>('Friendly');
  const [confidence, setConfidence] = useState(75);

  const [hourlyRate, setHourlyRate] = useState('42');
  const [minsPerCall, setMinsPerCall] = useState('4');
  const [minsPerEmail, setMinsPerEmail] = useState('6');

  const toggleNotif = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, on: !n.on } : n));
  };

  const calls = 47;
  const emails = 134;
  const totalMins = calls * Number(minsPerCall) + emails * Number(minsPerEmail);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const salary = Math.round((totalMins / 60) * Number(hourlyRate));

  const displayName = firstName || user?.displayName?.split(' ')[0] || 'You';
  const displayEmail = user?.email || 'you@solenergy.com.au';

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage your workspace, team, and preferences</p>
      </div>

      <div className="settings-grid">
        <div className="settings-col">

      <div className="settings-card">
        <div className="settings-card-title">Workspace</div>

        <div className="settings-field">
          <label className="settings-label">Business name</label>
          <input
            className="settings-input"
            value={bizName}
            onChange={e => setBizName(e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Logo</label>
          <div className="settings-logo-row">
            <div className="settings-logo-placeholder">SE</div>
            <div className="settings-logo-actions">
              <button className="settings-btn-outline">Upload logo</button>
              <span className="settings-field-hint">Recommended: 256×256px, PNG or JPG</span>
            </div>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Timezone</label>
          <select
            className="settings-select"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
          >
            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-label">Industry</label>
          <select
            className="settings-select"
            value={industry}
            onChange={e => setIndustry(e.target.value)}
          >
            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        </div>

        <div className="settings-card-actions">
          <button className="settings-btn-primary">Save Changes</button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Notifications</div>

        <div className="settings-notif-list">
          {notifs.map((n, i) => (
            <div key={n.id}>
              <div className="settings-notif-row">
                <div className="settings-notif-text">
                  <span className="settings-notif-label">{n.label}</span>
                  <span className="settings-notif-desc">{n.desc}</span>
                </div>
                <button
                  className={`settings-toggle ${n.on ? 'on' : ''}`}
                  onClick={() => toggleNotif(n.id)}
                >
                  <span className="settings-toggle-knob" />
                </button>
              </div>
              {i < notifs.length - 1 && <div className="settings-notif-divider" />}
            </div>
          ))}
        </div>

        <div className="settings-notif-email-row">
          <label className="settings-label">Send notifications to</label>
          <div className="settings-inline-save">
            <input
              className="settings-input"
              value={notifEmail}
              onChange={e => setNotifEmail(e.target.value)}
            />
            <button className="settings-btn-primary">Save</button>
          </div>
        </div>
      </div>

      <div className="settings-card ai-behaviour-card">
        <div className="settings-card-title">AI Behaviour</div>
        <p className="settings-card-desc">Control how the AI assistant behaves across your workspace</p>

        <div className="settings-ai-content">
        <div className="settings-notif-list">
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Human approval required</span>
              <span className="settings-notif-desc">AI drafts must be approved before sending</span>
            </div>
            <div className="settings-ai-locked-row">
              <button className="settings-toggle on settings-toggle-locked" disabled>
                <span className="settings-toggle-knob" />
              </button>
              <span className="settings-lock-badge" title="Required for safety">🔒</span>
            </div>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Auto-tag enquiry type</span>
              <span className="settings-notif-desc">Automatically classify emails as New Lead, Support, or Maintenance</span>
            </div>
            <button
              className={`settings-toggle ${aiToggles.autoTag ? 'on' : ''}`}
              onClick={() => toggleAi('autoTag')}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">AI summary on tickets</span>
              <span className="settings-notif-desc">Generate an AI summary when a new ticket is created</span>
            </div>
            <button
              className={`settings-toggle ${aiToggles.aiSummary ? 'on' : ''}`}
              onClick={() => toggleAi('aiSummary')}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Suggest escalation</span>
              <span className="settings-notif-desc">AI flags emails or calls that should be escalated to a human</span>
            </div>
            <button
              className={`settings-toggle ${aiToggles.escalation ? 'on' : ''}`}
              onClick={() => toggleAi('escalation')}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Tone preference</span>
              <span className="settings-notif-desc">Default tone used in AI-drafted email replies</span>
            </div>
            <div className="settings-tone-pills">
              {(['Professional', 'Friendly', 'Formal'] as const).map(t => (
                <button
                  key={t}
                  className={`settings-tone-pill ${tone === t ? 'active' : ''}`}
                  onClick={() => setTone(t)}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Signature on drafts</span>
              <span className="settings-notif-desc">Automatically append email signature to all drafted replies</span>
            </div>
            <button
              className={`settings-toggle ${aiToggles.signature ? 'on' : ''}`}
              onClick={() => toggleAi('signature')}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Smart follow-up detection</span>
              <span className="settings-notif-desc">Flag emails that haven't received a reply after 48 hours</span>
            </div>
            <button
              className={`settings-toggle ${aiToggles.followUp ? 'on' : ''}`}
              onClick={() => toggleAi('followUp')}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-notif-divider" />
          <div className="settings-notif-row settings-notif-row--slider">
            <div className="settings-notif-text">
              <span className="settings-notif-label">Confidence threshold</span>
              <span className="settings-notif-desc">Minimum AI confidence before generating a draft (lower = more drafts)</span>
            </div>
            <div className="settings-slider-wrap">
              <input
                type="range"
                min={60}
                max={95}
                value={confidence}
                onChange={e => setConfidence(Number(e.target.value))}
                className="settings-slider"
              />
              <span className="settings-slider-value">{confidence}%</span>
            </div>
          </div>
        </div>

        <div className="settings-ai-info-box">
          <div className="settings-ai-info-inner">
            ✦ All AI actions are logged and reversible from the Activity Log.
          </div>
        </div>
        </div>
      </div>

        </div>
        <div className="settings-col">

      <div className="settings-card">
        <div className="settings-card-title">Team Members</div>

        <div className="settings-invite-row">
          <input
            className="settings-input"
            placeholder="Invite by email address..."
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
          />
          <select
            className="settings-select settings-select-sm"
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
          >
            <option value="Admin">Admin</option>
            <option value="Agent">Agent</option>
          </select>
          <button className="settings-btn-primary">Send Invite</button>
        </div>

        <div className="settings-members">
          <div className="settings-member-row">
            <div className="settings-member-left">
              <div className="settings-avatar" style={{ background: '#4F8EF7' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="settings-member-info">
                <span className="settings-member-name">{displayName}</span>
                <span className="settings-member-email">{displayEmail}</span>
              </div>
            </div>
            <div className="settings-member-right">
              <span className="settings-role-pill admin">Admin</span>
              <span className="settings-you-pill">You</span>
            </div>
          </div>

          <div className="settings-member-divider" />

          <div className="settings-member-row">
            <div className="settings-member-left">
              <div className="settings-avatar" style={{ background: '#34C759' }}>N</div>
              <div className="settings-member-info">
                <span className="settings-member-name">Nat Elliott</span>
                <span className="settings-member-email">nat@solenergy.com.au</span>
              </div>
            </div>
            <div className="settings-member-right">
              <span className="settings-role-pill admin">Admin</span>
              <button className="settings-remove-btn">Remove</button>
            </div>
          </div>

          <div className="settings-member-divider" />

          <div className="settings-member-row">
            <div className="settings-member-left">
              <div className="settings-avatar" style={{ background: '#FF9F0A' }}>S</div>
              <div className="settings-member-info">
                <span className="settings-member-name">Sarah</span>
                <span className="settings-member-email">sarah@solenergy.com.au</span>
              </div>
            </div>
            <div className="settings-member-right">
              <span className="settings-role-pill agent">Agent</span>
              <button className="settings-remove-btn">Remove</button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Billing & Plan</div>

        <div className="settings-plan-card">
          <div className="settings-plan-top">
            <div>
              <div className="settings-plan-name">Pilot Plan</div>
              <div className="settings-plan-desc">Case study partnership with ONE AGENCY</div>
            </div>
            <span className="settings-plan-status">
              <span className="settings-plan-dot" />
              Active
            </span>
          </div>
          <div className="settings-plan-renewal">Valid until 31 December 2025</div>
        </div>

        <div className="settings-usage-row">
          <div className="settings-usage-item">
            <span className="settings-usage-label">AI Processing</span>
            <span className="settings-usage-value">$23.40 / ~$75 est.</span>
          </div>
          <div className="settings-usage-item">
            <span className="settings-usage-label">Calls handled</span>
            <span className="settings-usage-value">47 / unlimited</span>
          </div>
          <div className="settings-usage-item">
            <span className="settings-usage-label">Emails drafted</span>
            <span className="settings-usage-value">134 / unlimited</span>
          </div>
        </div>

        <div className="settings-info-box">
          During the pilot period, ONE AGENCY covers all hosting and infrastructure costs.
          You are only billed for AI processing usage at cost.
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Time Saved Calculation</div>
        <p className="settings-card-desc">These settings affect how time and salary savings are calculated across your dashboard.</p>

        <div className="settings-calc-row">
          <div className="settings-calc-text">
            <span className="settings-calc-label">Admin hourly rate</span>
            <span className="settings-calc-desc">Used to calculate estimated salary savings</span>
          </div>
          <div className="settings-inline-save">
            <div className="settings-input-suffix">
              <span className="settings-input-prefix-text">$</span>
              <input
                className="settings-input settings-input-narrow"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
              />
              <span className="settings-suffix-text">/hr</span>
            </div>
            <button className="settings-btn-primary">Save</button>
          </div>
        </div>

        <div className="settings-calc-divider" />

        <div className="settings-calc-row">
          <div className="settings-calc-text">
            <span className="settings-calc-label">Minutes saved per call</span>
            <span className="settings-calc-desc">Estimated time saved per AI-handled call</span>
          </div>
          <div className="settings-inline-save">
            <div className="settings-input-suffix">
              <input
                className="settings-input settings-input-narrow"
                value={minsPerCall}
                onChange={e => setMinsPerCall(e.target.value)}
              />
              <span className="settings-suffix-text">minutes</span>
            </div>
            <button className="settings-btn-primary">Save</button>
          </div>
        </div>

        <div className="settings-calc-divider" />

        <div className="settings-calc-row">
          <div className="settings-calc-text">
            <span className="settings-calc-label">Minutes saved per email draft</span>
            <span className="settings-calc-desc">Estimated time saved per AI-drafted email</span>
          </div>
          <div className="settings-inline-save">
            <div className="settings-input-suffix">
              <input
                className="settings-input settings-input-narrow"
                value={minsPerEmail}
                onChange={e => setMinsPerEmail(e.target.value)}
              />
              <span className="settings-suffix-text">minutes</span>
            </div>
            <button className="settings-btn-primary">Save</button>
          </div>
        </div>

        <div className="settings-calc-preview">
          Based on your settings: {calls} calls × {minsPerCall} mins + {emails} emails × {minsPerEmail} mins
          = {hrs}hrs {mins}mins saved = ${salary} in salary costs this week
        </div>
      </div>

        </div>
      </div>
    </div>
  );
}
