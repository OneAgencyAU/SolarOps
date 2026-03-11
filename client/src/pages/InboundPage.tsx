import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/InboundPage.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type Tone = 'Professional' | 'Friendly' | 'Formal';

interface VoiceConfig {
  assistant_id: string;
  retell_agent_id: string;
  retell_agent_id_jake?: string;
  retell_agent_id_brooke?: string;
  business_name: string;
  notification_email: string;
  phone_number: string;
  telnyx_number: string;
  telnyx_number_id: string;
  is_live: boolean;
  onboarding_step: number;
  voice?: string;
}

const GREETINGS: Record<string, string> = {
  jake: "Hi, thanks for calling {{business_name}}. You're through to Jake — how can I help?",
  brooke: "Hi, thanks for calling {{business_name}}. You're through to Brooke — how can I help?",
};

export default function InboundPage() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [voice, setVoice] = useState<'jake' | 'brooke'>('brooke');
  const [businessName, setBusinessName] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [greeting, setGreeting] = useState(GREETINGS.brooke);
  const [tone, setTone] = useState<Tone>('Friendly');
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('17:00');
  const [days, setDays] = useState<Record<string, boolean>>({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true });
  const [escalationPhone, setEscalationPhone] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['fire', 'smoke', 'outage', 'emergency', 'sparks']);
  const [keywordInput, setKeywordInput] = useState('');
  const [escalationMsg, setEscalationMsg] = useState("I'm going to connect you with our team right away. Please hold.");

  const [isLive, setIsLive] = useState(false);
  const [voiceWarning, setVoiceWarning] = useState('');

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`${API}/api/voice/config?tenant_id=${tenantId}`);
      if (res.ok) {
        const cfg: VoiceConfig = await res.json();
        if (cfg) {
          setConfig(cfg);
          const v = cfg.voice === 'jake' ? 'jake' : 'brooke';
          setVoice(v as 'jake' | 'brooke');
          setBusinessName(cfg.business_name || '');
          setNotificationEmail(cfg.notification_email || '');
          setIsLive(cfg.is_live ?? false);
          setVoiceWarning('');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleVoiceChange = (v: 'jake' | 'brooke') => {
    setVoice(v);
    setGreeting(GREETINGS[v]);
    if (config) {
      const hasAgent = v === 'jake' ? config.retell_agent_id_jake : config.retell_agent_id_brooke;
      setVoiceWarning(hasAgent ? '' : 'Save configuration to activate this voice.');
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

  const toggleDay = (d: string) => setDays(prev => ({ ...prev, [d]: !prev[d] }));

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${API}/api/voice/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          business_name: businessName.trim(),
          notification_email: notificationEmail.trim(),
          greeting,
          tone,
          voice,
          escalation_phone: escalationPhone,
          escalation_message: escalationMsg,
          keywords,
        }),
      });
      if (res.ok) {
        setSaveMsg('Configuration saved.');
        setVoiceWarning('');
        await fetchConfig();
      } else {
        setSaveMsg('Failed to save. Please try again.');
      }
    } catch {
      setSaveMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  const handleToggleLive = async () => {
    if (!tenantId) return;
    const newLive = !isLive;
    setIsLive(newLive);
    await fetch(`${API}/api/voice/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, is_live: newLive }),
    });
  };

  const displayNumber = config?.telnyx_number || config?.phone_number || '—';
  const resolvedGreeting = greeting.replace('{{business_name}}', businessName || '…');

  if (loading) {
    return (
      <div className="ib-page">
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#6e6e73', fontSize: '0.9rem' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="ib-page">
      <div className="ib-header">
        <div>
          <h1 className="ib-title">Inbound Receptionist</h1>
          <p className="ib-subtitle">Configure your AI receptionist for incoming calls</p>
        </div>
      </div>

      <div className="ib-columns">
        <div className="ib-left">
          <div className="ib-card">
            <div className="ib-card-title">Voice & Identity</div>
            <div className="ib-form">
              <div>
                <label className="ib-label">Voice</label>
                <div className="ib-voice-picker">
                  <button
                    type="button"
                    className={`ib-voice-card${voice === 'jake' ? ' selected' : ''}`}
                    onClick={() => handleVoiceChange('jake')}
                  >
                    <div className="ib-voice-name">Jake</div>
                    <div className="ib-voice-desc">Male · Friendly · Aussie</div>
                  </button>
                  <button
                    type="button"
                    className={`ib-voice-card${voice === 'brooke' ? ' selected' : ''}`}
                    onClick={() => handleVoiceChange('brooke')}
                  >
                    <div className="ib-voice-name">Brooke</div>
                    <div className="ib-voice-desc">Female · Warm · Aussie</div>
                  </button>
                </div>
                {voiceWarning && (
                  <div className="ib-warning">{voiceWarning}</div>
                )}
              </div>
              <div>
                <label className="ib-label">Agent name</label>
                <input className="ib-input" type="text" value={voice === 'jake' ? 'Jake' : 'Brooke'} readOnly />
              </div>
              <div>
                <label className="ib-label">Business name</label>
                <input className="ib-input" type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Sol Energy" />
              </div>
              <div>
                <label className="ib-label">Notification email</label>
                <input className="ib-input" type="email" value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} placeholder="sarah@solenergy.com.au" />
              </div>
            </div>
          </div>

          <div className="ib-card">
            <div className="ib-card-title">Greeting & Tone</div>
            <div className="ib-form">
              <div>
                <label className="ib-label">Greeting message</label>
                <textarea className="ib-textarea" rows={3} value={greeting} onChange={e => setGreeting(e.target.value)} />
              </div>
              <div>
                <label className="ib-label">Tone</label>
                <div className="ib-tone-pills">
                  {(['Professional', 'Friendly', 'Formal'] as Tone[]).map(t => (
                    <button key={t} type="button" className={`ib-tone-pill${tone === t ? ' active' : ''}`} onClick={() => setTone(t)}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="ib-card">
            <div className="ib-card-title">Business Hours</div>
            <div className="ib-form">
              <div className="ib-toggle-row">
                <span className="ib-toggle-label">Only answer during business hours</span>
                <button className={`ib-switch${hoursEnabled ? ' on' : ''}`} onClick={() => setHoursEnabled(!hoursEnabled)}>
                  <span className="ib-switch-thumb" />
                </button>
              </div>
              {hoursEnabled && (
                <>
                  <div className="ib-hours-inputs">
                    <div>
                      <label className="ib-label">Open</label>
                      <input className="ib-input small" type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
                    </div>
                    <div>
                      <label className="ib-label">Close</label>
                      <input className="ib-input small" type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="ib-days-row">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`ib-day-pill${days[d] ? ' active' : ''}`}
                        onClick={() => toggleDay(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="ib-card">
            <div className="ib-card-title">Call Routing</div>
            <div className="ib-form">
              <div className="ib-routing-card">
                <div className="ib-routing-badge new">A</div>
                <div>
                  <div className="ib-routing-title">New Enquiry</div>
                  <div className="ib-routing-desc">Collect: Name, Phone, Suburb, System type, Callback window</div>
                </div>
              </div>
              <div className="ib-routing-card">
                <div className="ib-routing-badge existing">B</div>
                <div>
                  <div className="ib-routing-title">Existing Customer</div>
                  <div className="ib-routing-desc">Collect: Name, Phone, Issue description, Urgency level</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ib-card">
            <div className="ib-card-title">Escalation Settings</div>
            <div className="ib-form">
              <div>
                <label className="ib-label">Escalation phone number</label>
                <input className="ib-input" type="tel" value={escalationPhone} onChange={e => setEscalationPhone(e.target.value)} placeholder="+61 4XX XXX XXX" />
              </div>
              <div>
                <label className="ib-label">Safety keywords</label>
                <div className="ib-tags-wrap">
                  {keywords.map(w => (
                    <span key={w} className="ib-tag">
                      {w}
                      <button className="ib-tag-x" onClick={() => removeKeyword(w)}>×</button>
                    </span>
                  ))}
                  <input className="ib-tag-input" value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={addKeyword} placeholder="Add keyword…" />
                </div>
              </div>
              <div>
                <label className="ib-label">Escalation message</label>
                <textarea className="ib-textarea" rows={2} value={escalationMsg} onChange={e => setEscalationMsg(e.target.value)} />
              </div>
            </div>
          </div>

          {saveMsg && (
            <div className={`ib-save-msg${saveMsg.includes('saved') ? ' success' : ' error'}`}>{saveMsg}</div>
          )}

          <button className="ib-btn primary full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>

        <div className="ib-right">
          <div className="ib-card">
            <div className="ib-card-title">Script Preview</div>
            <div className="ib-chat-preview">
              <div className="ib-chat-bubble agent">{resolvedGreeting}</div>
              <div className="ib-chat-bubble customer">Hi, I'm interested in getting solar panels for my business</div>
              <div className="ib-chat-bubble agent">Great! I'd love to help. Could I start by getting your name and the suburb you're based in?</div>
            </div>
          </div>

          <div className="ib-card">
            <div className="ib-card-title">Agent Status</div>
            <div className="ib-status-body">
              <div className="ib-status-toggle-row">
                <button className={`ib-status-toggle${isLive ? ' live' : ' offline'}`} onClick={handleToggleLive}>
                  {isLive && <span className="ib-status-dot" />}
                  {isLive ? 'LIVE' : 'OFFLINE'}
                </button>
              </div>
              <div className="ib-agent-info">
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1d1d1f' }}>
                  {voice === 'jake' ? 'Jake' : 'Brooke'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6e6e73' }}>
                  {voice === 'jake' ? 'Male · Friendly · Aussie' : 'Female · Warm · Aussie'}
                </div>
              </div>
              <div className="ib-phone-row">
                <span style={{ fontSize: '0.82rem', color: '#6e6e73' }}>Phone number</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1d1d1f' }}>{displayNumber}</span>
              </div>
            </div>
          </div>

          <div className="ib-card">
            <div className="ib-card-title" style={{ marginBottom: 14 }}>Quick Tips</div>
            <div className="ib-tips-list">
              {[
                `Test ${voice === 'jake' ? 'Jake' : 'Brooke'} by calling ${displayNumber} before forwarding your business number.`,
                `Update ${voice === 'jake' ? 'Jake' : 'Brooke'}'s greeting seasonally — e.g. mention battery rebates when available.`,
                'Check your escalation number is always reachable during business hours.',
              ].map((tip, i) => (
                <div key={i} className="ib-tip-row">
                  <span className="ib-tip-bullet">•</span>
                  <span className="ib-tip-text">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
