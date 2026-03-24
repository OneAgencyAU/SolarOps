import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/CampaignDetailPage.css';

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
  call_window_start: string | null;
  call_window_end: string | null;
  call_window_days: string[] | null;
  on_interest: string | null;
  transfer_number: string | null;
  max_concurrent: number | null;
}

interface Contact {
  id: string;
  campaign_id: string;
  phone_number: string;
  customer_name: string | null;
  custom_data: Record<string, string> | null;
  status: string;
  outcome: string | null;
  sentiment: string | null;
  call_summary: string | null;
  callback_preference: string | null;
  questions_asked: string | null;
  transcript: string | null;
  recording_url: string | null;
  retell_call_id: string | null;
  call_duration: number | null;
  call_cost: number | null;
  called_at: string | null;
  created_at: string;
  followed_up: boolean;
  notes: string | null;
  excluded: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#6e6e73', bg: '#f5f5f7' },
  scheduled: { label: 'Scheduled', color: '#AF52DE', bg: 'rgba(175,82,222,0.10)' },
  active: { label: 'Active', color: '#34C759', bg: 'rgba(52,199,89,0.10)' },
  paused: { label: 'Paused', color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
  completed: { label: 'Completed', color: '#4F8EF7', bg: 'rgba(79,142,247,0.10)' },
  cancelled: { label: 'Cancelled', color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
};

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  interested: { label: 'Interested', color: '#34C759', bg: 'rgba(52,199,89,0.10)' },
  not_interested: { label: 'Not Interested', color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
  callback_booked: { label: 'Callback Booked', color: '#4F8EF7', bg: 'rgba(79,142,247,0.10)' },
  transferred_live: { label: 'Transferred', color: '#AF52DE', bg: 'rgba(175,82,222,0.10)' },
  wants_more_info: { label: 'Wants Info', color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
  voicemail_left: { label: 'Voicemail', color: '#6e6e73', bg: '#f5f5f7' },
  no_answer: { label: 'No Answer', color: '#aeaeb2', bg: '#f5f5f7' },
  wrong_number: { label: 'Wrong Number', color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
  do_not_call: { label: 'Do Not Call', color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
  busy: { label: 'Busy', color: '#aeaeb2', bg: '#f5f5f7' },
  failed: { label: 'Failed', color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
  already_has_battery: { label: 'Has Battery', color: '#6e6e73', bg: '#f5f5f7' },
};

const SENTIMENT_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  positive: { label: 'Positive', icon: '+', color: '#34C759' },
  neutral: { label: 'Neutral', icon: '~', color: '#FF9500' },
  negative: { label: 'Negative', icon: '-', color: '#FF453A' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [filterOutcome, setFilterOutcome] = useState('all');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (!tenantId || !id) return;
    try {
      const res = await fetch(`/api/campaigns/${id}?tenant_id=${tenantId}`);
      if (!res.ok) return;
      const data = await res.json();
      setCampaign(data);
    } catch { /* ignore */ }
  }, [tenantId, id]);

  const fetchContacts = useCallback(async () => {
    if (!tenantId || !id) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/contacts?tenant_id=${tenantId}&limit=500&offset=0`);
      if (!res.ok) return;
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotalContacts(data.total || 0);
    } catch { /* ignore */ }
  }, [tenantId, id]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchCampaign(), fetchContacts()]);
    setLoading(false);
  }, [fetchCampaign, fetchContacts]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time polling: every 10s when campaign is active
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (campaign?.status === 'active') {
      pollingRef.current = setInterval(() => {
        fetchCampaign();
        fetchContacts();
      }, 10000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [campaign?.status, fetchCampaign, fetchContacts]);

  // When selected contact updates from polling, refresh it
  useEffect(() => {
    if (selectedContact) {
      const updated = contacts.find(c => c.id === selectedContact.id);
      if (updated) setSelectedContact(updated);
    }
  }, [contacts]);

  const handleMarkFollowedUp = async () => {
    if (!selectedContact || !tenantId) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/contacts/${selectedContact.id}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (res.ok) {
        setSelectedContact({ ...selectedContact, followed_up: true });
        fetchContacts();
      }
    } catch { /* ignore */ }
  };

  const handleSaveNote = async () => {
    if (!selectedContact || !tenantId || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/contacts/${selectedContact.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, note: noteText.trim() }),
      });
      if (res.ok) {
        setSelectedContact({ ...selectedContact, notes: noteText.trim() });
        setNoteText('');
        fetchContacts();
      }
    } catch { /* ignore */ }
    finally { setSavingNote(false); }
  };

  const handleExclude = async () => {
    if (!selectedContact || !tenantId) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/contacts/${selectedContact.id}/exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (res.ok) {
        setSelectedContact({ ...selectedContact, excluded: true });
        fetchContacts();
      }
    } catch { /* ignore */ }
  };

  const filteredContacts = filterOutcome === 'all'
    ? contacts
    : contacts.filter(c => c.outcome === filterOutcome || c.status === filterOutcome);

  const outcomeBreakdown = contacts.reduce<Record<string, number>>((acc, c) => {
    const key = c.outcome || c.status || 'pending';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="cd-page"><div className="cd-loading">Loading campaign...</div></div>;
  }

  if (!campaign) {
    return (
      <div className="cd-page">
        <div className="cd-empty">Campaign not found.</div>
        <button className="cd-btn" onClick={() => navigate('/outbound')}>Back to Campaigns</button>
      </div>
    );
  }

  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const progress = campaign.total_contacts > 0
    ? Math.round((campaign.calls_made / campaign.total_contacts) * 100)
    : 0;

  return (
    <div className="cd-page">
      {/* Header */}
      <div className="cd-header">
        <div className="cd-header-left">
          <button className="cd-back" onClick={() => navigate('/outbound')}>&larr; Campaigns</button>
          <h1 className="cd-title">{campaign.name}</h1>
          <span className="cd-status-pill" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </span>
          {campaign.status === 'active' && (
            <span className="cd-polling-dot" title="Auto-refreshing every 10s" />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="cd-stats-row">
        <div className="cd-stat">
          <div className="cd-stat-value">{campaign.total_contacts}</div>
          <div className="cd-stat-label">Contacts</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-value">{campaign.calls_made}</div>
          <div className="cd-stat-label">Calls Made</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-value">{campaign.calls_answered}</div>
          <div className="cd-stat-label">Answered</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-value">{campaign.calls_interested}</div>
          <div className="cd-stat-label">Interested</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-value">{campaign.callbacks_booked}</div>
          <div className="cd-stat-label">Callbacks</div>
        </div>
      </div>

      {/* Progress bar for active campaigns */}
      {campaign.status === 'active' && campaign.total_contacts > 0 && (
        <div className="cd-progress-wrap">
          <div className="cd-progress-bar">
            <div className="cd-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="cd-progress-label">{progress}% complete</span>
        </div>
      )}

      {/* Outcome filter pills */}
      <div className="cd-filters">
        <button
          className={`cd-filter-pill ${filterOutcome === 'all' ? 'active' : ''}`}
          onClick={() => setFilterOutcome('all')}
        >
          All ({contacts.length})
        </button>
        {Object.entries(outcomeBreakdown).map(([key, count]) => {
          const cfg = OUTCOME_CONFIG[key] || { label: key, color: '#6e6e73', bg: '#f5f5f7' };
          return (
            <button
              key={key}
              className={`cd-filter-pill ${filterOutcome === key ? 'active' : ''}`}
              onClick={() => setFilterOutcome(key)}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Contacts table */}
      <div className="cd-card">
        <div className="cd-table-header">
          <span>Name</span>
          <span>Phone</span>
          <span>Status</span>
          <span>Outcome</span>
          <span>Duration</span>
          <span>Sentiment</span>
        </div>
        {filteredContacts.length === 0 ? (
          <div className="cd-table-empty">No contacts match the current filter.</div>
        ) : (
          filteredContacts.map(c => {
            const oc = OUTCOME_CONFIG[c.outcome || ''] || OUTCOME_CONFIG[c.status] || null;
            const sc = SENTIMENT_CONFIG[c.sentiment || ''] || null;
            return (
              <div
                key={c.id}
                className={`cd-table-row ${selectedContact?.id === c.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedContact(c);
                  setShowTranscript(false);
                  setNoteText(c.notes || '');
                }}
              >
                <span className="cd-cell-name">{c.customer_name || '—'}</span>
                <span className="cd-cell-phone">{c.phone_number}</span>
                <span>
                  <span className="cd-mini-pill" style={{
                    color: STATUS_CONFIG[c.status]?.color || '#6e6e73',
                    background: STATUS_CONFIG[c.status]?.bg || '#f5f5f7',
                  }}>
                    {STATUS_CONFIG[c.status]?.label || c.status}
                  </span>
                </span>
                <span>
                  {oc ? (
                    <span className="cd-mini-pill" style={{ color: oc.color, background: oc.bg }}>
                      {oc.label}
                    </span>
                  ) : '—'}
                </span>
                <span>{formatDuration(c.call_duration)}</span>
                <span>
                  {sc ? (
                    <span style={{ color: sc.color, fontWeight: 600, fontSize: '0.82rem' }}>
                      {sc.icon} {sc.label}
                    </span>
                  ) : '—'}
                </span>
              </div>
            );
          })
        )}
        {totalContacts > contacts.length && (
          <div className="cd-table-more">Showing {contacts.length} of {totalContacts} contacts</div>
        )}
      </div>

      {/* Call Detail Drawer */}
      {selectedContact && (
        <>
          <div className="cd-overlay" onClick={() => setSelectedContact(null)} />
          <div className="cd-drawer">
            <div className="cd-drawer-header">
              <div className="cd-drawer-title-row">
                <h2 className="cd-drawer-title">
                  {selectedContact.customer_name || 'Unknown Contact'}
                </h2>
                {selectedContact.followed_up && (
                  <span className="cd-mini-pill" style={{ color: '#34C759', background: 'rgba(52,199,89,0.10)' }}>
                    Followed Up
                  </span>
                )}
                {selectedContact.excluded && (
                  <span className="cd-mini-pill" style={{ color: '#FF453A', background: 'rgba(255,69,58,0.10)' }}>
                    Excluded
                  </span>
                )}
              </div>
              <button className="cd-drawer-close" onClick={() => setSelectedContact(null)}>&times;</button>
            </div>

            <div className="cd-drawer-body">
              {/* Contact info */}
              <div className="cd-drawer-meta">
                <div className="cd-drawer-meta-row">
                  <span className="cd-drawer-label">Phone</span>
                  <span className="cd-drawer-value">{selectedContact.phone_number}</span>
                </div>
                <div className="cd-drawer-meta-row">
                  <span className="cd-drawer-label">Called</span>
                  <span className="cd-drawer-value">
                    {selectedContact.called_at
                      ? `${formatDate(selectedContact.called_at)} at ${formatTime(selectedContact.called_at)}`
                      : 'Not yet called'}
                  </span>
                </div>
                <div className="cd-drawer-meta-row">
                  <span className="cd-drawer-label">Duration</span>
                  <span className="cd-drawer-value">{formatDuration(selectedContact.call_duration)}</span>
                </div>
              </div>

              {/* Outcome badge */}
              {(selectedContact.outcome || selectedContact.status !== 'pending') && (() => {
                const oc = OUTCOME_CONFIG[selectedContact.outcome || ''] || OUTCOME_CONFIG[selectedContact.status] || null;
                return oc ? (
                  <div className="cd-drawer-section">
                    <span className="cd-drawer-label">Outcome</span>
                    <span className="cd-outcome-badge" style={{ color: oc.color, background: oc.bg }}>
                      {oc.label}
                    </span>
                  </div>
                ) : null;
              })()}

              {/* Sentiment */}
              {selectedContact.sentiment && (() => {
                const sc = SENTIMENT_CONFIG[selectedContact.sentiment];
                return sc ? (
                  <div className="cd-drawer-section">
                    <span className="cd-drawer-label">Sentiment</span>
                    <div className="cd-sentiment" style={{ color: sc.color }}>
                      <span className="cd-sentiment-icon">{sc.icon}</span>
                      {sc.label}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* AI Summary */}
              {selectedContact.call_summary && (
                <div className="cd-drawer-section">
                  <span className="cd-drawer-label">AI Call Summary</span>
                  <div className="cd-summary-box">{selectedContact.call_summary}</div>
                </div>
              )}

              {/* Callback preference */}
              {selectedContact.callback_preference && (
                <div className="cd-drawer-section">
                  <span className="cd-drawer-label">Callback Preference</span>
                  <div className="cd-callback-box">{selectedContact.callback_preference}</div>
                </div>
              )}

              {/* Questions asked */}
              {selectedContact.questions_asked && (
                <div className="cd-drawer-section">
                  <span className="cd-drawer-label">Customer Questions</span>
                  <div className="cd-questions-box">{selectedContact.questions_asked}</div>
                </div>
              )}

              {/* Audio player */}
              {selectedContact.recording_url && (
                <div className="cd-drawer-section">
                  <span className="cd-drawer-label">Call Recording</span>
                  <audio controls className="cd-audio-player" src={selectedContact.recording_url}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {/* Transcript */}
              {selectedContact.transcript && (
                <div className="cd-drawer-section">
                  <span className="cd-drawer-label">
                    Transcript
                    <button
                      className="cd-toggle-link"
                      onClick={() => setShowTranscript(v => !v)}
                    >
                      {showTranscript ? 'Hide' : 'Show'}
                    </button>
                  </span>
                  {showTranscript && (
                    <div className="cd-transcript-box">
                      {formatTranscript(selectedContact.transcript)}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="cd-drawer-section">
                <span className="cd-drawer-label">Notes</span>
                {selectedContact.notes && !noteText ? (
                  <div className="cd-note-display">
                    {selectedContact.notes}
                    <button className="cd-toggle-link" onClick={() => setNoteText(selectedContact.notes || '')}>Edit</button>
                  </div>
                ) : (
                  <div className="cd-note-input-wrap">
                    <textarea
                      className="cd-note-input"
                      rows={3}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                    />
                    <button
                      className="cd-btn-sm primary"
                      disabled={savingNote || !noteText.trim()}
                      onClick={handleSaveNote}
                    >
                      {savingNote ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="cd-drawer-actions">
                {!selectedContact.followed_up && (
                  <button className="cd-btn-sm primary" onClick={handleMarkFollowedUp}>
                    Mark Followed Up
                  </button>
                )}
                {!selectedContact.excluded && (
                  <button className="cd-btn-sm danger" onClick={handleExclude}>
                    Exclude from Future
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatTranscript(raw: string): JSX.Element[] {
  // Retell transcripts are typically formatted as "role: content" or JSON
  // Try to parse as structured transcript
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry: any, i: number) => {
        const role = entry.role === 'agent' ? 'AI' : 'Customer';
        const roleClass = entry.role === 'agent' ? 'cd-t-agent' : 'cd-t-customer';
        return (
          <div key={i} className={`cd-transcript-line ${roleClass}`}>
            <span className="cd-t-role">{role}</span>
            <span className="cd-t-text">{entry.content || entry.text || entry.words?.map((w: any) => w.word).join(' ') || ''}</span>
          </div>
        );
      });
    }
  } catch { /* not JSON, fall through */ }

  // Plain text: try to detect "Agent:" / "Customer:" prefixes
  const lines = raw.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const agentMatch = line.match(/^(Agent|AI|Bot|Assistant)\s*:\s*(.*)/i);
    const customerMatch = line.match(/^(Customer|User|Human|Caller)\s*:\s*(.*)/i);

    if (agentMatch) {
      return (
        <div key={i} className="cd-transcript-line cd-t-agent">
          <span className="cd-t-role">AI</span>
          <span className="cd-t-text">{agentMatch[2]}</span>
        </div>
      );
    }
    if (customerMatch) {
      return (
        <div key={i} className="cd-transcript-line cd-t-customer">
          <span className="cd-t-role">Customer</span>
          <span className="cd-t-text">{customerMatch[2]}</span>
        </div>
      );
    }
    return (
      <div key={i} className="cd-transcript-line">
        <span className="cd-t-text">{line}</span>
      </div>
    );
  });
}
