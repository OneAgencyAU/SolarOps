import { useState } from 'react';
import '../styles/VoiceAgentPage.css';

type Tone = 'Professional' | 'Friendly' | 'Formal';

const defaultKeywords = ['fire', 'smoke', 'outage', 'emergency', 'sparks'];

const recentCalls = [
  { name: 'Sarah Mitchell', route: 'New Enquiry', duration: '3:12', outcome: 'Callback Requested', time: '9:41 AM' },
  { name: 'James Park', route: 'Existing Customer', duration: '1:48', outcome: 'Completed', time: '9:22 AM' },
  { name: 'Unknown Caller', route: 'New Enquiry', duration: '0:34', outcome: 'Escalated', time: '8:55 AM' },
  { name: 'Priya Kapoor', route: 'New Enquiry', duration: '4:01', outcome: 'Callback Requested', time: '8:30 AM' },
  { name: 'Tom Henderson', route: 'Existing Customer', duration: '2:15', outcome: 'Completed', time: '8:12 AM' },
];

export default function VoiceAgentPage() {
  const [isLive, setIsLive] = useState(true);
  const [agentName, setAgentName] = useState('Sol Energy Assistant');
  const [greeting, setGreeting] = useState(
    "Hi, thanks for calling Sol Energy. I'm here to help — are you an existing customer or is this a new enquiry?"
  );
  const [tone, setTone] = useState<Tone>('Friendly');
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [afterHoursMsg, setAfterHoursMsg] = useState(
    "Thanks for calling Sol Energy. We're currently closed but leave your details and we'll call you back next business day."
  );
  const [escalationPhone, setEscalationPhone] = useState('');
  const [keywords, setKeywords] = useState<string[]>(defaultKeywords);
  const [keywordInput, setKeywordInput] = useState('');
  const [escalationMsg, setEscalationMsg] = useState(
    "I'm going to connect you with our team right away. Please hold."
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    hours: true,
    routing: true,
    escalation: true,
    phone: true,
  });

  const toggle = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const addKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      const word = keywordInput.trim().toLowerCase();
      if (!keywords.includes(word)) setKeywords([...keywords, word]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (w: string) => setKeywords(keywords.filter((k) => k !== w));

  return (
    <div className="va-page">
      <div className="va-header">
        <div>
          <h1 className="va-title">Voice Agent</h1>
          <p className="va-subtitle">Configure and manage your AI phone receptionist</p>
        </div>
        <button className={`status-toggle ${isLive ? 'live' : 'offline'}`} onClick={() => setIsLive(!isLive)}>
          {isLive && <span className="status-dot" />}
          {isLive ? 'LIVE' : 'OFFLINE'}
        </button>
      </div>

      <div className="va-columns">
        {/* ── LEFT COLUMN ── */}
        <div className="va-left">

          {/* Identity */}
          <Section title="Agent Identity" open={openSections.identity} onToggle={() => toggle('identity')}>
            <label className="va-label">Agent name</label>
            <input className="va-input" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            <label className="va-label">Greeting message</label>
            <textarea className="va-textarea" rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
            <label className="va-label">Tone</label>
            <div className="tone-pills">
              {(['Professional', 'Friendly', 'Formal'] as Tone[]).map((t) => (
                <button key={t} className={`tone-pill${tone === t ? ' active' : ''}`} onClick={() => setTone(t)}>{t}</button>
              ))}
            </div>
          </Section>

          {/* Business Hours */}
          <Section title="Business Hours" open={openSections.hours} onToggle={() => toggle('hours')}>
            <div className="toggle-row">
              <span className="toggle-label">Only answer during business hours</span>
              <button className={`switch ${hoursEnabled ? 'on' : ''}`} onClick={() => setHoursEnabled(!hoursEnabled)}>
                <span className="switch-thumb" />
              </button>
            </div>
            {hoursEnabled && (
              <>
                <div className="hours-grid">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
                    <div key={d} className="hours-row">
                      <span className="hours-day">{d}</span>
                      <input className="va-input small" type="time" defaultValue="09:00" />
                      <span className="hours-sep">–</span>
                      <input className="va-input small" type="time" defaultValue="17:00" />
                    </div>
                  ))}
                </div>
                <label className="va-label">After hours message</label>
                <textarea className="va-textarea" rows={2} value={afterHoursMsg} onChange={(e) => setAfterHoursMsg(e.target.value)} />
              </>
            )}
          </Section>

          {/* Call Routing */}
          <Section title="Call Routing" open={openSections.routing} onToggle={() => toggle('routing')}>
            <div className="routing-card">
              <div className="routing-badge new">A</div>
              <div>
                <div className="routing-title">New Enquiry</div>
                <div className="routing-desc">Collect: Name, Phone, Suburb, System type, Callback window</div>
              </div>
            </div>
            <div className="routing-card">
              <div className="routing-badge existing">B</div>
              <div>
                <div className="routing-title">Existing Customer</div>
                <div className="routing-desc">Collect: Name, Phone, Issue description, Urgency level</div>
              </div>
            </div>
          </Section>

          {/* Escalation */}
          <Section title="Escalation Settings" open={openSections.escalation} onToggle={() => toggle('escalation')} className="grow">
            <label className="va-label">Escalation phone number</label>
            <input className="va-input" value={escalationPhone} onChange={(e) => setEscalationPhone(e.target.value)} placeholder="+61 4XX XXX XXX" />
            <label className="va-label">Safety keywords</label>
            <div className="tags-wrap">
              {keywords.map((w) => (
                <span key={w} className="tag">
                  {w}
                  <button className="tag-x" onClick={() => removeKeyword(w)}>×</button>
                </span>
              ))}
              <input
                className="tag-input"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={addKeyword}
                placeholder="Add keyword…"
              />
            </div>
            <label className="va-label">Escalation message</label>
            <textarea className="va-textarea" rows={2} value={escalationMsg} onChange={(e) => setEscalationMsg(e.target.value)} />
          </Section>

          <button className="va-btn primary full">Save Configuration</button>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="va-right">

          {/* Script Preview */}
          <div className="va-card">
            <div className="card-title">Live Script Preview</div>
            <div className="chat-preview">
              <div className="chat-bubble agent">{greeting}</div>
              <div className="chat-bubble customer">Hi, I'm interested in getting solar panels for my business</div>
              <div className="chat-bubble agent">Great! I'd love to help. Could I start by getting your name and the suburb you're based in?</div>
            </div>
          </div>

          {/* Stats */}
          <div className="va-stats-row">
            <div className="va-card mini-stat">
              <div className="mini-value">47</div>
              <div className="mini-label">Calls Handled</div>
            </div>
            <div className="va-card mini-stat">
              <div className="mini-value">2.4m</div>
              <div className="mini-label">Avg Call Duration</div>
            </div>
            <div className="va-card mini-stat">
              <div className="mini-value">31</div>
              <div className="mini-label">Callback Requests</div>
            </div>
          </div>

          {/* Recent Calls */}
          <div className="va-card">
            <div className="card-title" style={{ marginBottom: 8 }}>Recent Calls</div>
            <div className="calls-table">
              <div className="calls-header">
                <span>Caller</span>
                <span>Route</span>
                <span>Duration</span>
                <span>Outcome</span>
                <span>Time</span>
              </div>
              {recentCalls.map((c, i) => (
                <div key={i} className="calls-row">
                  <span className="calls-name">{c.name}</span>
                  <span className="calls-route">{c.route}</span>
                  <span className="calls-dur">{c.duration}</span>
                  <span className={`outcome-pill ${c.outcome.toLowerCase().replace(/\s/g, '-')}`}>{c.outcome}</span>
                  <span className="calls-time">{c.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone Number Setup */}
          <Section title="Phone Number Setup" open={openSections.phone} onToggle={() => toggle('phone')}>
            <div className="steps">
              <Step icon="✅" label="Agent configured" />
              <Step icon="⏳" label="Connect phone number" />
              <Step icon="🔒" label="Test call" />
              <Step icon="🔒" label="Go live" />
            </div>
            <div className="info-box">
              Forward your existing business number to your SolarOps number. We'll provide your forwarding number once your agent is configured.
            </div>
            <button className="va-btn disabled" disabled>Get My Forwarding Number</button>
          </Section>

          {/* Quick Tips */}
          <div className="va-card">
            <div className="card-title" style={{ marginBottom: 14 }}>Quick Tips</div>
            <div className="tips-list">
              <div className="tip-row">
                <span className="tip-bullet">•</span>
                <span className="tip-text">Test your agent with a real call before going live</span>
              </div>
              <div className="tip-row">
                <span className="tip-bullet">•</span>
                <span className="tip-text">Update your greeting seasonally — e.g. mention battery rebates when they're available</span>
              </div>
              <div className="tip-row">
                <span className="tip-bullet">•</span>
                <span className="tip-text">Check your escalation number is always reachable during business hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, open, onToggle, children, className }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div className={`va-card section-card${className ? ` ${className}` : ''}`}>
      <button className="section-header" onClick={onToggle}>
        <span className="card-title">{title}</span>
        <span className={`chevron ${open ? 'open' : ''}`}>‹</span>
      </button>
      <div className={`section-body ${open ? 'expanded' : 'collapsed'}`}>
        {children}
      </div>
    </div>
  );
}

function Step({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="step-row">
      <span className="step-icon">{icon}</span>
      <span className="step-label">{label}</span>
    </div>
  );
}
