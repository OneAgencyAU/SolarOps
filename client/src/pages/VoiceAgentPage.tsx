import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/VoiceAgentPage.css';

type Tone = 'Professional' | 'Friendly' | 'Formal';

interface VoiceCall {
  id: string;
  created_at: string;
  caller_name: string | null;
  caller_number: string | null;
  caller_suburb: string | null;
  caller_email: string | null;
  reason: string | null;
  call_type: string;
  callback_window: string | null;
  summary: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  status: string;
}

interface VoiceConfig {
  assistant_id: string;
  retell_agent_id: string;
  business_name: string;
  notification_email: string;
  phone_number: string;
  telnyx_number: string;
  telnyx_number_id: string;
  is_live: boolean;
  onboarding_step: number;
}

export default function VoiceAgentPage() {
  const { tenant } = useAuth();
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState(false);

  const [isLive, setIsLive] = useState(true);
  const [agentName, setAgentName] = useState('Sol Energy Assistant');
  const [greeting, setGreeting] = useState("Hi, thanks for calling Sol Energy. I'm here to help — are you an existing customer or is this a new enquiry?");
  const [tone, setTone] = useState<Tone>('Friendly');
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [afterHoursMsg, setAfterHoursMsg] = useState("Thanks for calling Sol Energy. We're currently closed but leave your details and we'll call you back next business day.");
  const [escalationPhone, setEscalationPhone] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['fire','smoke','outage','emergency','sparks']);
  const [keywordInput, setKeywordInput] = useState('');
  const [escalationMsg, setEscalationMsg] = useState("I'm going to connect you with our team right away. Please hold.");
  const [notificationEmail, setNotificationEmail] = useState('');

  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string>('');
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [purchasingNumber, setPurchasingNumber] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [purchasedNumber, setPurchasedNumber] = useState<string>('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true, hours: true, routing: true, escalation: true, phone: true,
  });

  const toggle = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const [callsRes, configRes] = await Promise.all([
        fetch(`/api/voice/calls?tenant_id=${tenant.id}`),
        fetch(`/api/voice/config?tenant_id=${tenant.id}`),
      ]);
      if (callsRes.ok) setCalls(await callsRes.json());
      if (configRes.ok) {
        const cfg = await configRes.json();
        if (cfg) {
          setConfig(cfg);
          setIsLive(cfg.is_live ?? true);
          setAgentName(cfg.business_name ? `${cfg.business_name} Assistant` : 'Sol Energy Assistant');
          setNotificationEmail(cfg.notification_email || '');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleLive = async () => {
    if (!tenant?.id) return;
    const newLive = !isLive;
    setIsLive(newLive);
    await fetch('/api/voice/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id, is_live: newLive }),
    });
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await fetch('/api/voice/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          business_name: agentName.replace(' Assistant', ''),
          notification_email: notificationEmail,
          greeting,
          tone,
          escalation_phone: escalationPhone,
          escalation_message: escalationMsg,
          keywords,
        }),
      });
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      const word = keywordInput.trim().toLowerCase();
      if (!keywords.includes(word)) setKeywords([...keywords, word]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (w: string) => setKeywords(keywords.filter(k => k !== w));

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (diffDays === 0) return `Today ${time}`;
    if (diffDays === 1) return `Yesterday ${time}`;
    return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${time}`;
  };

  const searchNumbers = async () => {
    setSearchingNumbers(true);
    try {
      const res = await fetch('/api/voice/numbers/search');
      const data = await res.json();
      setAvailableNumbers(data);
    } finally {
      setSearchingNumbers(false);
    }
  };

  const purchaseNumber = async () => {
    if (!selectedNumber || !tenant?.id) return;
    setPurchasingNumber(true);
    try {
      const res = await fetch('/api/voice/numbers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, phone_number: selectedNumber }),
      });
      const data = await res.json();
      if (data.success) {
        setPurchasedNumber(selectedNumber);
        setOnboardingStep(2);
      }
    } finally {
      setPurchasingNumber(false);
    }
  };

  const displayCalls = calls.length > 0 ? calls : [];
  const totalCalls = calls.length;
  const callbackRequests = calls.filter(c => c.caller_name).length;
  const avgDuration = calls.filter(c => c.duration_seconds).length > 0
    ? Math.round(calls.filter(c => c.duration_seconds).reduce((s, c) => s + (c.duration_seconds || 0), 0) / calls.filter(c => c.duration_seconds).length)
    : null;

  const avgDurationLabel = avgDuration
    ? avgDuration >= 60 ? `${(avgDuration / 60).toFixed(1)}m` : `${avgDuration}s`
    : '—';

  if (!config || (config.onboarding_step || 1) < 3) {
    const step = onboardingStep > 1 ? onboardingStep : (config?.onboarding_step || 1);
    const forwardingCodes: Record<string, string> = {
      Telstra: `*21*${purchasedNumber || config?.telnyx_number || ''}#`,
      Optus: `*21*${purchasedNumber || config?.telnyx_number || ''}#`,
      TPG: `*21*${purchasedNumber || config?.telnyx_number || ''}#`,
      'iiNet': `*21*${purchasedNumber || config?.telnyx_number || ''}#`,
      Vonex: 'Login to your Vonex portal → Call Forwarding → enter your SolarOps number',
    };

    return (
      <div className="va-page">
        <div className="va-header">
          <div>
            <h1 className="va-title">Voice Agent Setup</h1>
            <p className="va-subtitle">Get your AI receptionist live in 3 steps</p>
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['Choose Number', 'Configure Agent', 'Activate Forwarding'].map((label, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', margin: '0 auto 6px',
                  background: step > i + 1 ? '#34C759' : step === i + 1 ? '#4F8EF7' : '#e5e5e7',
                  color: step >= i + 1 ? '#fff' : '#aeaeb2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700,
                }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: '0.72rem', color: step === i + 1 ? '#1d1d1f' : '#aeaeb2', fontWeight: step === i + 1 ? 600 : 400 }}>{label}</div>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="va-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card-title">Choose your AI receptionist number</div>
              <p style={{ fontSize: '0.875rem', color: '#6e6e73', margin: 0 }}>
                This is the number your AI receptionist will answer. You'll forward your existing business number to it — $2/month.
              </p>
              <button className="va-btn primary" onClick={searchNumbers} disabled={searchingNumbers}>
                {searchingNumbers ? 'Searching...' : 'Search Available Numbers'}
              </button>
              {availableNumbers.length > 0 && (
                <>
                  <label className="va-label">Select a number</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableNumbers.map((n: any) => (
                      <button
                        key={n.phone_number}
                        onClick={() => setSelectedNumber(n.phone_number)}
                        style={{
                          padding: '12px 16px', borderRadius: 10, border: `2px solid ${selectedNumber === n.phone_number ? '#4F8EF7' : '#e5e5e7'}`,
                          background: selectedNumber === n.phone_number ? 'rgba(79,142,247,0.06)' : '#f5f5f7',
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1d1d1f' }}>{n.phone_number}</span>
                        <span style={{ fontSize: '0.78rem', color: '#6e6e73' }}>${parseFloat(n.cost_information?.monthly_cost || '0').toFixed(2)}/mo</span>
                      </button>
                    ))}
                  </div>
                  <button className="va-btn primary" onClick={purchaseNumber} disabled={!selectedNumber || purchasingNumber}>
                    {purchasingNumber ? 'Purchasing...' : `Get ${selectedNumber || 'this number'}`}
                  </button>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="va-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card-title">Configure your AI receptionist</div>
              <div className="info-box" style={{ marginBottom: 4 }}>
                Your number <strong>{purchasedNumber || config?.telnyx_number}</strong> is reserved
              </div>
              <label className="va-label">Business name</label>
              <input className="va-input" value={agentName.replace(' Assistant','')} onChange={e => setAgentName(e.target.value)} placeholder="Sol Energy" />
              <label className="va-label">Greeting message</label>
              <textarea className="va-textarea" rows={3} value={greeting} onChange={e => setGreeting(e.target.value)} />
              <label className="va-label">Tone</label>
              <div className="tone-pills">
                {(['Professional','Friendly','Formal'] as Tone[]).map(t => (
                  <button key={t} className={`tone-pill${tone === t ? ' active' : ''}`} onClick={() => setTone(t)}>{t}</button>
                ))}
              </div>
              <label className="va-label">Notification email</label>
              <input className="va-input" value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} type="email" placeholder="sarah@solenergy.com.au" />
              <button className="va-btn primary" onClick={async () => {
                await handleSave();
                await fetchData();
                setOnboardingStep(3);
              }} disabled={saving}>
                {saving ? 'Setting up...' : 'Create AI Receptionist →'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="va-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card-title">Activate call forwarding</div>
              <div className="info-box">
                Your AI receptionist is configured and ready on <strong>{config?.telnyx_number}</strong>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6e6e73', margin: 0 }}>
                Forward your existing business number to your SolarOps number. Select your phone provider:
              </p>
              <label className="va-label">Your phone provider</label>
              <select className="va-input" onChange={e => {}} defaultValue="">
                <option value="" disabled>Select provider...</option>
                {Object.keys(forwardingCodes).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="info-box" style={{ fontFamily: 'monospace', fontSize: '0.95rem', letterSpacing: 1 }}>
                {forwardingCodes['Telstra']}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: 0 }}>
                Dial this code from your business phone. Forwarding activates instantly.
              </p>
              <button className="va-btn primary" onClick={() => { fetchData(); }}>
                I've set up forwarding — Go Live
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="va-page">
      <div className="va-header">
        <div>
          <h1 className="va-title">Voice Agent</h1>
          <p className="va-subtitle">Configure and manage your AI phone receptionist</p>
        </div>
        <button className={`status-toggle ${isLive ? 'live' : 'offline'}`} onClick={handleToggleLive}>
          {isLive && <span className="status-dot" />}
          {isLive ? 'LIVE' : 'OFFLINE'}
        </button>
      </div>

      <div className="va-columns">
        {/* ── LEFT COLUMN ── */}
        <div className="va-left">
          <Section title="Agent Identity" open={openSections.identity} onToggle={() => toggle('identity')}>
            <label className="va-label">Agent name</label>
            <input className="va-input" value={agentName} onChange={e => setAgentName(e.target.value)} />
            <label className="va-label">Notification email</label>
            <input className="va-input" value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} type="email" placeholder="sarah@solenergy.com.au" />
            <label className="va-label">Greeting message</label>
            <textarea className="va-textarea" rows={3} value={greeting} onChange={e => setGreeting(e.target.value)} />
            <label className="va-label">Tone</label>
            <div className="tone-pills">
              {(['Professional', 'Friendly', 'Formal'] as Tone[]).map(t => (
                <button key={t} className={`tone-pill${tone === t ? ' active' : ''}`} onClick={() => setTone(t)}>{t}</button>
              ))}
            </div>
          </Section>

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
                  {['Mon','Tue','Wed','Thu','Fri'].map(d => (
                    <div key={d} className="hours-row">
                      <span className="hours-day">{d}</span>
                      <input className="va-input small" type="time" defaultValue="09:00" />
                      <span className="hours-sep">–</span>
                      <input className="va-input small" type="time" defaultValue="17:00" />
                    </div>
                  ))}
                </div>
                <label className="va-label">After hours message</label>
                <textarea className="va-textarea" rows={2} value={afterHoursMsg} onChange={e => setAfterHoursMsg(e.target.value)} />
              </>
            )}
          </Section>

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

          <Section title="Escalation Settings" open={openSections.escalation} onToggle={() => toggle('escalation')} className="grow">
            <label className="va-label">Escalation phone number</label>
            <input className="va-input" value={escalationPhone} onChange={e => setEscalationPhone(e.target.value)} placeholder="+61 4XX XXX XXX" />
            <label className="va-label">Safety keywords</label>
            <div className="tags-wrap">
              {keywords.map(w => (
                <span key={w} className="tag">
                  {w}
                  <button className="tag-x" onClick={() => removeKeyword(w)}>×</button>
                </span>
              ))}
              <input className="tag-input" value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={addKeyword} placeholder="Add keyword…" />
            </div>
            <label className="va-label">Escalation message</label>
            <textarea className="va-textarea" rows={2} value={escalationMsg} onChange={e => setEscalationMsg(e.target.value)} />
          </Section>

          <button className="va-btn primary full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : config ? 'Save Configuration' : 'Activate Voice Agent'}
          </button>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="va-right">
          <div className="va-card">
            <div className="card-title">Live Script Preview</div>
            <div className="chat-preview">
              <div className="chat-bubble agent">{greeting}</div>
              <div className="chat-bubble customer">Hi, I'm interested in getting solar panels for my business</div>
              <div className="chat-bubble agent">Great! I'd love to help. Could I start by getting your name and the suburb you're based in?</div>
            </div>
          </div>

          <div className="va-stats-row">
            <div className="va-card mini-stat">
              <div className="mini-value">{totalCalls || '—'}</div>
              <div className="mini-label">Calls Handled</div>
            </div>
            <div className="va-card mini-stat">
              <div className="mini-value">{avgDurationLabel}</div>
              <div className="mini-label">Avg Call Duration</div>
            </div>
            <div className="va-card mini-stat">
              <div className="mini-value">{callbackRequests || '—'}</div>
              <div className="mini-label">Callback Requests</div>
            </div>
          </div>

          <div className="va-card">
            <div className="card-title" style={{ marginBottom: 8 }}>Recent Calls</div>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6e6e73', fontSize: '0.875rem' }}>Loading calls...</div>
            ) : displayCalls.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6e6e73', fontSize: '0.875rem' }}>
                <p>No calls yet.</p>
                {(config?.telnyx_number || config?.phone_number) && (
                  <p style={{ marginTop: 8 }}>Call <strong>{config?.telnyx_number || config?.phone_number}</strong> to test your agent.</p>
                )}
              </div>
            ) : (
              <>
                <div className="calls-table">
                  <div className="calls-header">
                    <span>Caller</span>
                    <span>Route</span>
                    <span>Duration</span>
                    <span>Outcome</span>
                    <span>Time</span>
                  </div>
                  {displayCalls.map(call => (
                    <div
                      key={call.id}
                      className={`calls-row${selectedCall?.id === call.id ? ' selected' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)}
                    >
                      <span className="calls-name">{call.caller_name || 'Unknown'}</span>
                      <span className="calls-route">{call.call_type === 'existing' ? 'Existing Customer' : 'New Enquiry'}</span>
                      <span className="calls-dur">{formatDuration(call.duration_seconds)}</span>
                      <span className={`outcome-pill ${call.caller_name ? 'callback-requested' : 'completed'}`}>
                        {call.caller_name ? 'Callback Requested' : 'Completed'}
                      </span>
                      <span className="calls-time">{formatTime(call.created_at)}</span>
                    </div>
                  ))}
                </div>
                {selectedCall && (
                  <div style={{ marginTop: 16, padding: 16, background: '#f5f5f7', borderRadius: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      {[
                        ['Name', selectedCall.caller_name],
                        ['Number', selectedCall.caller_number],
                        ['Suburb', selectedCall.caller_suburb],
                        ['Email', selectedCall.caller_email],
                        ['Reason', selectedCall.reason],
                        ['Callback Window', selectedCall.callback_window],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#aeaeb2', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: '0.875rem', color: '#1d1d1f', fontWeight: 500 }}>{value || '—'}</div>
                        </div>
                      ))}
                    </div>
                    {selectedCall.summary && (
                      <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: '0.825rem', color: '#3a3a3c', lineHeight: 1.6, marginBottom: 10 }}>
                        <span style={{ color: '#4F8EF7', marginRight: 6 }}>✦</span>{selectedCall.summary}
                      </div>
                    )}
                    {selectedCall.transcript && (
                      <div>
                        <button
                          onClick={() => setExpandedTranscript(!expandedTranscript)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#4F8EF7', padding: 0, marginBottom: 8 }}
                        >
                          {expandedTranscript ? '▲ Hide transcript' : '▼ Show transcript'}
                        </button>
                        {expandedTranscript && (
                          <div style={{ fontSize: '0.8rem', color: '#3a3a3c', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#fff', borderRadius: 8, padding: 12 }}>
                            {selectedCall.transcript}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <Section title="Phone Number Setup" open={openSections.phone} onToggle={() => toggle('phone')}>
            <div className="steps">
              <Step icon={config ? '✅' : '⏳'} label="Agent configured" />
              <Step icon={config ? '✅' : '🔒'} label={config?.telnyx_number || config?.phone_number ? `Your number: ${config?.telnyx_number || config?.phone_number}` : 'Your number: not yet assigned'} />
              <Step icon="💡" label="Forward your business number to this number to go live" />
            </div>
            <div className="info-box">
              Set up call forwarding on your existing business number to{config?.telnyx_number || config?.phone_number ? <> <strong>{config?.telnyx_number || config?.phone_number}</strong></> : ' your SolarOps number'}. Calls will be answered by your AI receptionist. You can toggle the agent offline above at any time.
            </div>
          </Section>

          <div className="va-card">
            <div className="card-title" style={{ marginBottom: 14 }}>Quick Tips</div>
            <div className="tips-list">
              {[
                `Test your agent by calling ${config?.telnyx_number || config?.phone_number || 'your SolarOps number'} before forwarding your business number.`,
                'Update your greeting seasonally — e.g. mention battery rebates when available.',
                'Check your escalation number is always reachable during business hours.',
              ].map((tip, i) => (
                <div key={i} className="tip-row">
                  <span className="tip-bullet">•</span>
                  <span className="tip-text">{tip}</span>
                </div>
              ))}
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
