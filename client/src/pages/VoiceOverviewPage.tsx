import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/VoiceAgentPage.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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

interface VoiceCall {
  id: string;
  created_at: string;
  caller_name: string | null;
  caller_number: string | null;
  call_type: string;
  duration_seconds: number | null;
  status: string;
  callback_requested: boolean | null;
  summary: string | null;
}

export default function VoiceOverviewPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const [configRes, callsRes] = await Promise.all([
        fetch(`${API}/api/voice/config?tenant_id=${tenant.id}`),
        fetch(`${API}/api/voice/calls?tenant_id=${tenant.id}`),
      ]);
      if (configRes.ok) {
        const cfg = await configRes.json();
        if (!cfg || (cfg.onboarding_step ?? 0) < 3) {
          navigate('/voice-agent/setup', { replace: true });
          return;
        }
        setConfig(cfg);
        setIsLive(cfg.is_live ?? false);
      } else {
        navigate('/voice-agent/setup', { replace: true });
        return;
      }
      if (callsRes.ok) setCalls(await callsRes.json());
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleLive = async () => {
    if (!tenant?.id) return;
    const newLive = !isLive;
    setIsLive(newLive);
    await fetch(`${API}/api/voice/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id, is_live: newLive }),
    });
  };

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

  if (loading) {
    return (
      <div className="va-page">
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#6e6e73', fontSize: '0.9rem' }}>Loading...</div>
      </div>
    );
  }

  const totalCalls = calls.length;
  const callbackRequests = calls.filter(c => c.callback_requested).length;
  const durations = calls.filter(c => c.duration_seconds).map(c => c.duration_seconds!);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;
  const avgDurationLabel = avgDuration
    ? `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`
    : '—';

  const recentCalls = calls.slice(0, 5);
  const voiceName = config?.voice ?? (config?.retell_agent_id_brooke ? 'brooke' : 'jake');
  const isJake = voiceName === 'jake';
  const displayNumber = config?.telnyx_number || config?.phone_number || '—';

  const forwardingCodes: Record<string, string> = {
    Telstra: `*21*${displayNumber}#`,
    Optus: `*21*${displayNumber}#`,
    TPG: `*21*${displayNumber}#`,
    iiNet: `*21*${displayNumber}#`,
    Vonex: 'Login to your Vonex portal → Call Forwarding → enter your SolarOps number',
  };

  return (
    <div className="va-page">
      <div className="va-header">
        <div>
          <h1 className="va-title">Voice Agent</h1>
          <p className="va-subtitle">AI-powered phone receptionist</p>
        </div>
        <button className={`status-toggle ${isLive ? 'live' : 'offline'}`} onClick={handleToggleLive}>
          {isLive && <span className="status-dot" />}
          {isLive ? 'LIVE' : 'OFFLINE'}
        </button>
      </div>

      <div className="va-columns">
        <div className="va-left">
          <div className="va-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-title">Your AI Receptionist</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: isJake ? 'rgba(79,142,247,0.10)' : 'rgba(167,104,247,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem',
              }}>
                {isJake ? '👨' : '👩'}
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1d1d1f' }}>
                  {isJake ? 'Jake' : 'Brooke'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6e6e73' }}>
                  {isJake ? 'Male · Friendly · Aussie' : 'Female · Warm · Aussie'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f5f5f7', borderRadius: 10 }}>
              <span style={{ fontSize: '0.82rem', color: '#6e6e73' }}>Phone number</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1d1d1f', marginLeft: 'auto' }}>{displayNumber}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="va-btn primary"
                style={{ flex: 1 }}
                onClick={() => navigate('/voice-agent/inbound')}
              >
                Configure Inbound
              </button>
              <button
                className="va-btn primary"
                style={{ flex: 1, background: '#1d1d1f' }}
                onClick={() => navigate('/outbound')}
              >
                Manage Campaigns
              </button>
            </div>
          </div>
        </div>

        <div className="va-right">
          <div className="va-stats-row">
            <div className="va-card mini-stat">
              <div className="mini-value">{totalCalls || '—'}</div>
              <div className="mini-label">Total Calls</div>
            </div>
            <div className="va-card mini-stat">
              <div className="mini-value">{callbackRequests || '—'}</div>
              <div className="mini-label">Callback Requests</div>
            </div>
            <div className="va-card mini-stat">
              <div className="mini-value">{avgDurationLabel}</div>
              <div className="mini-label">Avg Duration</div>
            </div>
          </div>

          <div className="va-card">
            <div className="card-title" style={{ marginBottom: 8 }}>Recent Calls</div>
            {recentCalls.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6e6e73', fontSize: '0.875rem' }}>
                <p>No calls yet.</p>
                {displayNumber !== '—' && (
                  <p style={{ marginTop: 8 }}>Call <strong>{displayNumber}</strong> to test your agent.</p>
                )}
              </div>
            ) : (
              <div className="calls-table">
                <div className="calls-header">
                  <span>Caller</span>
                  <span>Route</span>
                  <span>Duration</span>
                  <span>Outcome</span>
                  <span>Time</span>
                </div>
                {recentCalls.map(call => (
                  <div key={call.id} className="calls-row">
                    <span className="calls-name">{call.caller_name || 'Unknown'}</span>
                    <span className="calls-route">{call.call_type === 'existing' ? 'Existing Customer' : 'New Enquiry'}</span>
                    <span className="calls-dur">{formatDuration(call.duration_seconds)}</span>
                    <span className={`outcome-pill ${call.callback_requested ? 'callback-requested' : 'completed'}`}>
                      {call.callback_requested ? 'Callback Requested' : 'Completed'}
                    </span>
                    <span className="calls-time">{formatTime(call.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="va-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-title">Phone Number Setup</div>
            <div className="info-box">
              Your AI receptionist is configured and ready on <strong>{displayNumber}</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#6e6e73', margin: 0 }}>
              Forward your existing business number to your SolarOps number using the code below.
            </p>
            <div className="info-box" style={{ fontFamily: 'monospace', fontSize: '0.95rem', letterSpacing: 1 }}>
              {forwardingCodes['Telstra']}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#aeaeb2', margin: 0 }}>
              Dial this code from your business phone. Works with Telstra, Optus, TPG, and iiNet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
