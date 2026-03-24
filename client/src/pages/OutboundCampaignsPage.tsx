import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/OutboundCampaignsPage.css';

interface Campaign {
  id: string;
  name: string;
  status: string;
  script_template: string | null;
  script_prompt: string | null;
  voice_id: string | null;
  total_contacts: number;
  calls_made: number;
  calls_answered: number;
  calls_interested: number;
  callbacks_booked: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  prompt_template: string;
  category: string;
  is_system: boolean;
}

interface UploadResult {
  success: boolean;
  valid_count: number;
  invalid_count: number;
  invalid: { row: number; phone: string; reason: string }[];
  preview: { phone_number: string; customer_name: string | null; custom_data: Record<string, string> }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#6e6e73', bg: '#f5f5f7' },
  scheduled: { label: 'Scheduled', color: '#AF52DE', bg: 'rgba(175,82,222,0.10)' },
  active: { label: 'Active', color: '#34C759', bg: 'rgba(52,199,89,0.10)' },
  paused: { label: 'Paused', color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
  completed: { label: 'Completed', color: '#4F8EF7', bg: 'rgba(79,142,247,0.10)' },
  cancelled: { label: 'Cancelled', color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OutboundCampaignsPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const tenantId = tenant?.id ?? '';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/campaigns/list?tenant_id=${tenantId}`);
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch { setCampaigns([]); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const totalContacts = campaigns.reduce((a, c) => a + (c.total_contacts || 0), 0);
  const totalAnswered = campaigns.reduce((a, c) => a + (c.calls_answered || 0), 0);
  const totalInterested = campaigns.reduce((a, c) => a + (c.calls_interested || 0), 0);

  return (
    <div className="oc-page">
      <div className="oc-header">
        <div>
          <h1 className="oc-title">Outbound Campaigns</h1>
          <p className="oc-subtitle">Run AI-powered outbound call campaigns</p>
        </div>
        <button className="oc-btn primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => setShowWizard(true)}>
          + New Campaign
        </button>
      </div>

      <div className="oc-stats-row">
        <div className="oc-mini-stat">
          <div className="oc-mini-value">{campaigns.length}</div>
          <div className="oc-mini-label">Campaigns</div>
        </div>
        <div className="oc-mini-stat">
          <div className="oc-mini-value">{totalContacts || '—'}</div>
          <div className="oc-mini-label">Total Contacts</div>
        </div>
        <div className="oc-mini-stat">
          <div className="oc-mini-value">{totalAnswered || '—'}</div>
          <div className="oc-mini-label">Calls Answered</div>
        </div>
        <div className="oc-mini-stat">
          <div className="oc-mini-value">{totalInterested || '—'}</div>
          <div className="oc-mini-label">Interested Leads</div>
        </div>
      </div>

      {loading ? (
        <div className="oc-empty"><div>Loading campaigns...</div></div>
      ) : campaigns.length === 0 ? (
        <div className="oc-card">
          <div className="oc-empty">
            <div className="oc-empty-icon">&#x2709;</div>
            <div>No campaigns yet. Create your first campaign to get started.</div>
            <button className="oc-btn primary" style={{ width: 'auto', margin: '16px auto 0', padding: '10px 24px' }} onClick={() => setShowWizard(true)}>
              + New Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="oc-campaigns-list">
          {campaigns.map(c => {
            const status = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
            const progress = c.total_contacts > 0 ? Math.round((c.calls_made / c.total_contacts) * 100) : 0;
            return (
              <div key={c.id} className="oc-campaign-card" onClick={() => navigate(`/outbound/${c.id}`)}>
                <div className="oc-campaign-top">
                  <p className="oc-campaign-name">{c.name}</p>
                  <span className="oc-status-pill" style={{ color: status.color, background: status.bg }}>
                    {status.label}
                  </span>
                </div>
                <div className="oc-campaign-meta">
                  <span className="oc-lead-tag">{c.total_contacts} contacts</span>
                  {c.calls_made > 0 && <span className="oc-lead-tag">{c.calls_made} called</span>}
                  {c.calls_interested > 0 && <span className="oc-lead-tag" style={{ color: '#34C759' }}>{c.calls_interested} interested</span>}
                  {c.callbacks_booked > 0 && <span className="oc-lead-tag" style={{ color: '#4F8EF7' }}>{c.callbacks_booked} callbacks</span>}
                  <span className="oc-campaign-date">{formatDate(c.created_at)}</span>
                </div>
                {c.status === 'active' && c.total_contacts > 0 && (
                  <div className="oc-progress-bar">
                    <div className="oc-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showWizard && (
        <CampaignWizard
          tenantId={tenantId}
          onClose={() => setShowWizard(false)}
          onCreated={(id) => {
            setShowWizard(false);
            fetchCampaigns();
            navigate(`/outbound/${id}`);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Campaign Creation Wizard (3 steps)
// ──────────────────────────────────────────────────────────────
function CampaignWizard({ tenantId, onClose, onCreated }: { tenantId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Step 1: Upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Step 2: Configure
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [scriptPrompt, setScriptPrompt] = useState('');
  const [voiceId, setVoiceId] = useState('11labs-Adrian');
  const [callWindowStart, setCallWindowStart] = useState('09:00');
  const [callWindowEnd, setCallWindowEnd] = useState('17:00');
  const [callWindowDays, setCallWindowDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [onInterest, setOnInterest] = useState('offer_choice');
  const [transferNumber, setTransferNumber] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [voicemailAction, setVoicemailAction] = useState('leave_message');

  // Load templates
  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/campaigns/templates?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});
  }, [tenantId]);

  const handleFileUpload = async (file: File) => {
    setError('');
    setUploading(true);

    try {
      // Create draft campaign first if not already created
      let cId = campaignId;
      if (!cId) {
        const createRes = await fetch('/api/campaigns/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenantId, name: name || 'Untitled Campaign' }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) { setError(createData.error || 'Failed to create campaign'); setUploading(false); return; }
        cId = createData.id;
        setCampaignId(cId);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenant_id', tenantId);

      const res = await fetch(`/api/campaigns/${cId}/contacts/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); setUploading(false); return; }
      setUploadResult(data);
    } catch { setError('Network error during upload'); }
    finally { setUploading(false); }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const t = templates.find(t => t.id === templateId);
    if (t) setScriptPrompt(t.prompt_template);
  };

  const toggleDay = (day: string) => {
    setCallWindowDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSaveConfig = async () => {
    setError('');
    if (!name.trim()) { setError('Campaign name is required'); return; }
    if (!scriptPrompt.trim()) { setError('Script prompt is required'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: name.trim(),
          script_template: selectedTemplate || null,
          script_prompt: scriptPrompt.trim(),
          voice_id: voiceId,
          call_window_start: callWindowStart,
          call_window_end: callWindowEnd,
          call_window_days: callWindowDays,
          on_interest: onInterest,
          transfer_number: transferNumber || null,
          max_concurrent: maxConcurrent,
          voicemail_action: voicemailAction,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
      setStep(3);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const handleLaunch = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Launch failed'); setSaving(false); return; }
      onCreated(campaignId!);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const handleSaveDraft = () => {
    if (campaignId) onCreated(campaignId);
    else onClose();
  };

  const DAYS = [
    { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
  ];

  return (
    <div className="oc-wizard-overlay" onClick={onClose}>
      <div className="oc-wizard" onClick={e => e.stopPropagation()}>
        <div className="oc-wizard-header">
          <h2 className="oc-wizard-title">New Campaign</h2>
          <button className="oc-wizard-close" onClick={onClose}>&times;</button>
        </div>

        <div className="oc-wizard-steps">
          {['Upload Contacts', 'Configure', 'Review & Launch'].map((label, i) => (
            <div key={i} className={`oc-wizard-step ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : ''}`}>
              <div className="oc-wizard-step-num">{step > i + 1 ? '\u2713' : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="oc-wizard-body">
          {error && <div className="oc-error">{error}</div>}

          {step === 1 && (
            <div className="oc-wizard-section">
              <label className="oc-label">Campaign name</label>
              <input className="oc-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Battery Rebate — March 2026" />

              <label className="oc-label" style={{ marginTop: 16 }}>Upload CSV</label>
              <p className="oc-helper" style={{ marginBottom: 8 }}>
                CSV must have a <strong>phone_number</strong> column (required) and optionally <strong>customer_name</strong> plus any custom columns.
              </p>

              <div
                className="oc-dropzone"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('dragover');
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileUpload(f);
                }}
              >
                {uploading ? 'Uploading...' : uploadResult
                  ? `${uploadResult.valid_count} valid contacts uploaded`
                  : 'Click or drag a CSV file here'}
              </div>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />

              {uploadResult && (
                <div style={{ marginTop: 12 }}>
                  <div className="oc-upload-summary">
                    <span style={{ color: '#34C759', fontWeight: 600 }}>{uploadResult.valid_count} valid</span>
                    {uploadResult.invalid_count > 0 && (
                      <span style={{ color: '#FF453A', fontWeight: 600 }}>{uploadResult.invalid_count} invalid (skipped)</span>
                    )}
                  </div>

                  {uploadResult.preview.length > 0 && (
                    <div className="oc-preview-table">
                      <div className="oc-preview-header">
                        <span>Name</span><span>Phone</span>
                      </div>
                      {uploadResult.preview.slice(0, 5).map((c, i) => (
                        <div key={i} className="oc-preview-row">
                          <span>{c.customer_name || '—'}</span>
                          <span>{c.phone_number}</span>
                        </div>
                      ))}
                      {uploadResult.valid_count > 5 && (
                        <div className="oc-preview-more">+ {uploadResult.valid_count - 5} more</div>
                      )}
                    </div>
                  )}

                  {uploadResult.invalid.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary className="oc-helper" style={{ cursor: 'pointer', color: '#FF453A' }}>
                        Show invalid rows
                      </summary>
                      <div className="oc-invalid-list">
                        {uploadResult.invalid.map((inv, i) => (
                          <div key={i} className="oc-invalid-row">
                            Row {inv.row}: {inv.phone || '(empty)'} — {inv.reason}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              <div className="oc-wizard-actions">
                <button className="oc-btn" onClick={onClose}>Cancel</button>
                <button
                  className="oc-btn primary"
                  disabled={!uploadResult || uploadResult.valid_count === 0}
                  onClick={() => setStep(2)}
                >
                  Next: Configure
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="oc-wizard-section">
              <label className="oc-label">Script template</label>
              <select className="oc-select" value={selectedTemplate} onChange={e => handleTemplateSelect(e.target.value)}>
                <option value="">Custom script</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.is_system ? ' (System)' : ''}</option>
                ))}
              </select>

              <label className="oc-label" style={{ marginTop: 12 }}>Script prompt</label>
              <textarea
                className="oc-textarea"
                rows={8}
                value={scriptPrompt}
                onChange={e => setScriptPrompt(e.target.value)}
                placeholder="Enter the agent's conversation script..."
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="oc-label">Voice</label>
                  <select className="oc-select" value={voiceId} onChange={e => setVoiceId(e.target.value)}>
                    <option value="11labs-Adrian">Adrian (Male, AU)</option>
                    <option value="11labs-Aria">Aria (Female)</option>
                  </select>
                </div>
                <div>
                  <label className="oc-label">On interested customer</label>
                  <select className="oc-select" value={onInterest} onChange={e => setOnInterest(e.target.value)}>
                    <option value="offer_choice">Offer choice (transfer or callback)</option>
                    <option value="transfer_live">Transfer live to team</option>
                    <option value="book_callback">Book a callback</option>
                  </select>
                </div>
              </div>

              {(onInterest === 'transfer_live' || onInterest === 'offer_choice') && (
                <div style={{ marginTop: 12 }}>
                  <label className="oc-label">Transfer phone number</label>
                  <input className="oc-input" value={transferNumber} onChange={e => setTransferNumber(e.target.value)} placeholder="+61 4XX XXX XXX" />
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label className="oc-label">Call window</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="oc-input" type="time" value={callWindowStart} onChange={e => setCallWindowStart(e.target.value)} style={{ width: 'auto' }} />
                  <span style={{ color: '#6e6e73' }}>to</span>
                  <input className="oc-input" type="time" value={callWindowEnd} onChange={e => setCallWindowEnd(e.target.value)} style={{ width: 'auto' }} />
                  <span style={{ color: '#6e6e73', fontSize: '0.78rem' }}>AEST</span>
                </div>
                <div className="oc-days-picker">
                  {DAYS.map(d => (
                    <button
                      key={d.key}
                      type="button"
                      className={`oc-day-btn ${callWindowDays.includes(d.key) ? 'active' : ''}`}
                      onClick={() => toggleDay(d.key)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="oc-label">Max concurrent calls</label>
                  <input className="oc-input" type="number" min={1} max={10} value={maxConcurrent} onChange={e => setMaxConcurrent(Number(e.target.value))} />
                </div>
                <div>
                  <label className="oc-label">Voicemail handling</label>
                  <select className="oc-select" value={voicemailAction} onChange={e => setVoicemailAction(e.target.value)}>
                    <option value="leave_message">Leave a message</option>
                    <option value="hang_up">Hang up (no message)</option>
                  </select>
                </div>
              </div>

              <div className="oc-wizard-actions">
                <button className="oc-btn" onClick={() => setStep(1)}>Back</button>
                <button className="oc-btn primary" disabled={saving} onClick={handleSaveConfig}>
                  {saving ? 'Saving...' : 'Next: Review'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="oc-wizard-section">
              <div className="oc-review-card">
                <h3 style={{ margin: '0 0 16px', color: '#1d1d1f', fontSize: '1.05rem' }}>{name}</h3>
                <div className="oc-review-grid">
                  <div className="oc-review-item">
                    <span className="oc-review-label">Contacts</span>
                    <span className="oc-review-value">{uploadResult?.valid_count || 0}</span>
                  </div>
                  <div className="oc-review-item">
                    <span className="oc-review-label">Voice</span>
                    <span className="oc-review-value">{voiceId === '11labs-Adrian' ? 'Adrian (Male)' : 'Aria (Female)'}</span>
                  </div>
                  <div className="oc-review-item">
                    <span className="oc-review-label">Call window</span>
                    <span className="oc-review-value">{callWindowStart} - {callWindowEnd} AEST</span>
                  </div>
                  <div className="oc-review-item">
                    <span className="oc-review-label">Days</span>
                    <span className="oc-review-value">{callWindowDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}</span>
                  </div>
                  <div className="oc-review-item">
                    <span className="oc-review-label">On interest</span>
                    <span className="oc-review-value">
                      {onInterest === 'offer_choice' ? 'Offer choice' : onInterest === 'transfer_live' ? 'Transfer live' : 'Book callback'}
                    </span>
                  </div>
                  <div className="oc-review-item">
                    <span className="oc-review-label">Max concurrent</span>
                    <span className="oc-review-value">{maxConcurrent}</span>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <span className="oc-review-label">Script preview</span>
                  <div className="oc-review-script">{scriptPrompt.slice(0, 300)}{scriptPrompt.length > 300 ? '...' : ''}</div>
                </div>
              </div>

              <div className="oc-wizard-actions" style={{ gap: 8 }}>
                <button className="oc-btn" onClick={() => setStep(2)}>Back</button>
                <button className="oc-btn" onClick={handleSaveDraft}>Save as Draft</button>
                <button className="oc-btn primary" disabled={saving} onClick={handleLaunch}>
                  {saving ? 'Launching...' : 'Launch Campaign'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
