import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/OutboundCampaignsPage.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const CAMPAIGN_TYPES = [
  { value: 'lead_reactivation', label: 'Lead Reactivation' },
  { value: 'maintenance_reminder', label: 'Maintenance Reminder' },
  { value: 'battery_rebate', label: 'Battery Rebate Follow-up' },
  { value: 'quote_followup', label: 'Quote Follow-up' },
];

function typeBadgeLabel(type: string) {
  return CAMPAIGN_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  script: string;
  lead_count: number;
  status: string;
  created_at: string;
}

function parseLeads(raw: string): { name: string; phone: string }[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, phone] = line.split(',').map((p) => p.trim());
      return { name: name ?? '', phone: phone ?? '' };
    })
    .filter((l) => l.name && l.phone);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function OutboundCampaignsPage() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState('lead_reactivation');
  const [script, setScript] = useState('');
  const [leadsRaw, setLeadsRaw] = useState('');
  const [launching, setLaunching] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const parsedLeads = parseLeads(leadsRaw);

  const fetchCampaigns = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`${API}/api/campaigns/list?tenant_id=${tenantId}`);
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingList(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  async function handleLaunch() {
    setFormError('');
    setFormSuccess('');

    if (!name.trim()) { setFormError('Please enter a campaign name.'); return; }
    if (!script.trim()) { setFormError('Please enter a script.'); return; }
    if (parsedLeads.length === 0) {
      setFormError('No valid leads found. Use format: Name, Phone number (one per line).');
      return;
    }

    setLaunching(true);
    try {
      const res = await fetch(`${API}/api/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: name.trim(),
          campaign_type: campaignType,
          script: script.trim(),
          leads: parsedLeads,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Failed to launch campaign.');
      } else {
        setFormSuccess(`Campaign launched — ${data.lead_count} calls queued.`);
        setName('');
        setScript('');
        setLeadsRaw('');
        await fetchCampaigns();
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setLaunching(false);
    }
  }

  const totalCalls = campaigns.reduce((acc, c) => acc + (c.lead_count ?? 0), 0);

  return (
    <div className="oc-page">
      <div className="oc-header">
        <div>
          <h1 className="oc-title">Outbound Campaigns</h1>
          <p className="oc-subtitle">Run AI-powered outbound call campaigns</p>
        </div>
      </div>

      <div className="oc-columns">
        <div className="oc-left">
          <div className="oc-card">
            <h2 className="oc-card-title">New Campaign</h2>
            <div className="oc-form">
              <div>
                <label className="oc-label">Campaign name</label>
                <input
                  className="oc-input"
                  type="text"
                  placeholder="e.g. March Lead Reactivation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="oc-label">Campaign type</label>
                <select
                  className="oc-select"
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                >
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="oc-label">Script</label>
                <textarea
                  className="oc-textarea"
                  placeholder="Hi {{customer_name}}, this is calling from Sol Energy..."
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={5}
                />
              </div>

              <div>
                <label className="oc-label">Leads</label>
                <textarea
                  className="oc-textarea tall"
                  placeholder={"John Smith, 0412 345 678\nJane Doe, 0498 765 432"}
                  value={leadsRaw}
                  onChange={(e) => setLeadsRaw(e.target.value)}
                  rows={6}
                />
                <p className="oc-helper">One lead per line: Name, Phone number</p>
                {leadsRaw.trim().length > 0 && (
                  <p className="oc-lead-count">
                    {parsedLeads.length} valid lead{parsedLeads.length !== 1 ? 's' : ''} detected
                  </p>
                )}
              </div>

              {formError && <div className="oc-error">{formError}</div>}
              {formSuccess && <div className="oc-success">{formSuccess}</div>}

              <button
                className="oc-btn primary"
                onClick={handleLaunch}
                disabled={launching}
              >
                {launching ? 'Launching…' : 'Launch Campaign'}
              </button>
            </div>
          </div>
        </div>

        <div className="oc-right">
          <div className="oc-stats-row">
            <div className="oc-mini-stat">
              <div className="oc-mini-value">{campaigns.length}</div>
              <div className="oc-mini-label">Total Campaigns</div>
            </div>
            <div className="oc-mini-stat">
              <div className="oc-mini-value">{totalCalls}</div>
              <div className="oc-mini-label">Total Calls Made</div>
            </div>
            <div className="oc-mini-stat">
              <div className="oc-mini-value">—</div>
              <div className="oc-mini-label">Avg Answer Rate</div>
            </div>
          </div>

          <div className="oc-card" style={{ padding: '20px 24px' }}>
            <h2 className="oc-card-title">Campaigns</h2>

            {loadingList ? (
              <div className="oc-empty">
                <div className="oc-empty-icon">⊳</div>
                <div>Loading campaigns…</div>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="oc-empty">
                <div className="oc-empty-icon">⊳</div>
                <div>No campaigns yet. Create your first campaign to get started.</div>
              </div>
            ) : (
              <div className="oc-campaigns-list">
                {campaigns.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const preview = c.script?.length > 100
                    ? c.script.slice(0, 100) + '…'
                    : c.script;
                  return (
                    <div
                      key={c.id}
                      className={`oc-campaign-card${isExpanded ? ' expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      <div className="oc-campaign-top">
                        <p className="oc-campaign-name">{c.name}</p>
                        <span className="oc-campaign-date">{formatDate(c.created_at)}</span>
                      </div>

                      <div className="oc-campaign-meta">
                        <span className={`oc-type-badge ${c.campaign_type}`}>
                          {typeBadgeLabel(c.campaign_type)}
                        </span>
                        <span className={`oc-status-pill ${c.status}`}>
                          {c.status}
                        </span>
                        <span className="oc-lead-tag">
                          {c.lead_count} lead{c.lead_count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {!isExpanded && (
                        <p className="oc-campaign-preview">{preview}</p>
                      )}
                      {isExpanded && (
                        <div className="oc-campaign-full">{c.script}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
