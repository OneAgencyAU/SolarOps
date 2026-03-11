import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/VoiceSetupPage.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type Tone = 'Professional' | 'Friendly' | 'Formal';

const GREETINGS: Record<string, string> = {
  jake: "Hi, thanks for calling {{business_name}}. You're through to Jake, our AI receptionist — how can I help?",
  brooke: "Hi, thanks for calling {{business_name}}. You're through to Brooke, our AI receptionist — how can I help?",
};

export default function VoiceSetupPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [voice, setVoice] = useState<'jake' | 'brooke'>('brooke');
  const [businessName, setBusinessName] = useState(tenant?.name ?? '');
  const [greeting, setGreeting] = useState(GREETINGS.brooke);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [tone, setTone] = useState<Tone>('Friendly');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  const handleVoiceChange = (v: 'jake' | 'brooke') => {
    setVoice(v);
    setGreeting(GREETINGS[v]);
  };

  const handleActivate = async () => {
    if (!tenant?.id) return;
    setActivating(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/voice/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          business_name: businessName.trim(),
          notification_email: notificationEmail.trim(),
          greeting,
          tone,
          voice,
        }),
      });
      if (res.ok) {
        navigate('/voice-agent', { replace: true });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Activation failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const resolvedGreeting = greeting.replace('{{business_name}}', businessName || '…');

  return (
    <div className="vs-page">
      <div className="vs-container">
        <div className="vs-steps">
          {[1, 2, 3].map(n => (
            <div key={n} className="vs-step-item">
              <div className={`vs-step-dot${step > n ? ' done' : step === n ? ' active' : ''}`}>
                {step > n ? '✓' : n}
              </div>
              <div className={`vs-step-label${step === n ? ' active' : ''}`}>
                {n === 1 ? 'Choose Voice' : n === 2 ? 'Configure' : 'Activate'}
              </div>
            </div>
          ))}
          <div className="vs-step-line" />
        </div>

        <div className="vs-card">
          {step === 1 && (
            <>
              <h2 className="vs-title">Choose your AI receptionist</h2>
              <p className="vs-subtitle">Pick the voice that will represent your business on every call.</p>
              <div className="vs-voice-picker">
                <button
                  type="button"
                  className={`vs-voice-card${voice === 'jake' ? ' selected' : ''}`}
                  onClick={() => handleVoiceChange('jake')}
                >
                  <div className="vs-voice-avatar">👨</div>
                  <div className="vs-voice-name">Jake</div>
                  <div className="vs-voice-desc">Male · Friendly · Aussie</div>
                </button>
                <button
                  type="button"
                  className={`vs-voice-card${voice === 'brooke' ? ' selected' : ''}`}
                  onClick={() => handleVoiceChange('brooke')}
                >
                  <div className="vs-voice-avatar">👩</div>
                  <div className="vs-voice-name">Brooke</div>
                  <div className="vs-voice-desc">Female · Warm · Aussie</div>
                </button>
              </div>
              <button className="vs-btn primary" onClick={() => setStep(2)}>
                Next
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="vs-title">Set up your receptionist</h2>
              <p className="vs-subtitle">Configure how {voice === 'jake' ? 'Jake' : 'Brooke'} answers your calls.</p>
              <div className="vs-form">
                <div>
                  <label className="vs-label">Business name</label>
                  <input
                    className="vs-input"
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Sol Energy"
                  />
                </div>
                <div>
                  <label className="vs-label">Greeting message</label>
                  <textarea
                    className="vs-textarea"
                    rows={3}
                    value={greeting}
                    onChange={e => setGreeting(e.target.value)}
                  />
                </div>
                <div>
                  <label className="vs-label">Notification email</label>
                  <input
                    className="vs-input"
                    type="email"
                    value={notificationEmail}
                    onChange={e => setNotificationEmail(e.target.value)}
                    placeholder="sarah@solenergy.com.au"
                  />
                </div>
                <div>
                  <label className="vs-label">Tone</label>
                  <div className="vs-tone-pills">
                    {(['Professional', 'Friendly', 'Formal'] as Tone[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`vs-tone-pill${tone === t ? ' active' : ''}`}
                        onClick={() => setTone(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="vs-btn-row">
                <button className="vs-btn secondary" onClick={() => setStep(1)}>Back</button>
                <button
                  className="vs-btn primary"
                  onClick={() => setStep(3)}
                  disabled={!businessName.trim()}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="vs-title">You're almost live</h2>
              <p className="vs-subtitle">Review your configuration and activate your AI receptionist.</p>
              <div className="vs-summary">
                <div className="vs-summary-row">
                  <span className="vs-summary-label">Voice</span>
                  <span className="vs-summary-value">{voice === 'jake' ? 'Jake — Male · Friendly · Aussie' : 'Brooke — Female · Warm · Aussie'}</span>
                </div>
                <div className="vs-summary-divider" />
                <div className="vs-summary-row">
                  <span className="vs-summary-label">Business</span>
                  <span className="vs-summary-value">{businessName || '—'}</span>
                </div>
                <div className="vs-summary-divider" />
                <div className="vs-summary-row">
                  <span className="vs-summary-label">Tone</span>
                  <span className="vs-summary-value">{tone}</span>
                </div>
                <div className="vs-summary-divider" />
                <div className="vs-summary-row vertical">
                  <span className="vs-summary-label">Greeting</span>
                  <span className="vs-summary-greeting">{resolvedGreeting}</span>
                </div>
              </div>

              {error && <div className="vs-error">{error}</div>}

              <div className="vs-btn-row">
                <button className="vs-btn secondary" onClick={() => setStep(2)}>Back</button>
                <button
                  className="vs-btn primary activate"
                  onClick={handleActivate}
                  disabled={activating}
                >
                  {activating ? 'Activating…' : 'Activate Voice Agent'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
