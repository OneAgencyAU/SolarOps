import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/InboxAssistantPage.css';

type FilterType = 'All' | 'Urgent' | 'New Lead' | 'Support' | 'Completed';

export default function InboxAssistantPage() {
  const { user, tenant } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [toast, setToast] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ provider: string; email: string }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [realEmails, setRealEmails] = useState<any[]>([]);
  const [aiDrafts, setAiDrafts] = useState<Record<string, { id: string; draft_text: string; ai_summary: string; status: string }>>({});
  const [draftLoading, setDraftLoading] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [readEmails, setReadEmails] = useState<Set<string>>(new Set());
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft'>('google');
  const [msConnected, setMsConnected] = useState(false);
  const [msEmails, setMsEmails] = useState<any[]>([]);
  const [msSyncing, setMsSyncing] = useState(false);
  const [stats, setStats] = useState<{ queueCount: number; draftCount: number; avgMins: number | null } | null>(null);

  const fetchConnections = async () => {
    if (!tenant?.id) return;
    const res = await fetch(`/api/inbox/connections?tenant_id=${tenant.id}`);
    if (res.ok) setConnections(await res.json());
  };

  const fetchStats = async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/inbox/stats?tenant_id=${tenant.id}`);
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  const fetchEmails = async () => {
    if (!tenant?.id) return;
    const res = await fetch(`/api/inbox/emails?tenant_id=${tenant.id}`);
    if (res.ok) {
      const data = await res.json();
      setRealEmails(data);
    }
  };

  const fetchOrGenerateDraft = async (emailId: string) => {
    if (!tenant?.id || aiDrafts[emailId]) return;
    setDraftLoading(p => ({ ...p, [emailId]: true }));
    try {
      const res = await fetch('/api/inbox/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, tenant_id: tenant.id }),
      });
      if (res.ok) {
        const draft = await res.json();
        setAiDrafts(p => ({ ...p, [emailId]: draft }));
      }
    } catch (e) { console.error('Draft fetch failed', e); }
    finally { setDraftLoading(p => ({ ...p, [emailId]: false })); }
  };

  const checkMsStatus = async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/auth/microsoft/status?tenant_id=${tenant.id}`);
      if (res.ok) {
        const data = await res.json();
        setMsConnected(data.connected);
      }
    } catch {}
  };

  const fetchMsEmails = async () => {
    if (!tenant?.id) return;
    setMsSyncing(true);
    try {
      const res = await fetch(`/api/microsoft/emails?tenant_id=${tenant.id}&folder=inbox&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setMsEmails(data);
      }
    } catch (e) { console.error('MS email fetch failed', e); }
    finally { setMsSyncing(false); }
  };

  const handleMsDisconnect = async () => {
    if (!tenant?.id) return;
    await fetch(`/api/auth/microsoft/disconnect?tenant_id=${tenant.id}`, { method: 'DELETE' });
    setMsConnected(false);
    setMsEmails([]);
    if (activeProvider === 'microsoft') setActiveProvider('google');
  };

  const handleDisconnect = async (provider: string) => {
    if (!tenant?.id) return;
    await fetch(`/api/inbox/connections/${provider}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id }),
    });
    await fetch(`/api/inbox/emails?tenant_id=${tenant.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id }),
    });
    setConnections([]);
    setRealEmails([]);
    setAiDrafts({});
    setSelectedId(null);
  };

  const markAsRead = async (emailId: string) => {
    if (readEmails.has(emailId) || !tenant?.id) return;
    setReadEmails(p => new Set([...p, emailId]));
    await fetch('/api/inbox/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenant.id, email_id: emailId }),
    });
  };

  const handleSync = async () => {
    if (!tenant?.id) return;
    setSyncing(true);
    await fetch('/api/inbox/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenant.id }) });
    await fetchEmails();
    setSyncing(false);
  };

  useEffect(() => {
    fetchConnections();
    fetchEmails();
    checkMsStatus();
    fetchStats();
  }, [tenant?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'gmail') {
      handleSync();
      window.history.replaceState({}, '', '/inbox-assistant');
    } else if (params.get('connected') === 'outlook' || params.get('ms_connected') === 'true') {
      setActiveProvider('microsoft');
      setMsConnected(true);
      fetchMsEmails();
      window.history.replaceState({}, '', '/inbox-assistant');
    } else if (params.get('error') === 'ms_auth_failed') {
      setToast('Microsoft connection failed. Please try again.');
      window.history.replaceState({}, '', '/inbox-assistant');
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const msEmailSource = msEmails.map((e: any) => ({
    id: e.id || e.external_id,
    sender: e.from_name || e.from_email,
    email: e.from_email,
    subject: e.subject || '(no subject)',
    preview: e.body_preview || '',
    time: new Date(e.received_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }),
    tags: [] as { label: string; color: 'blue' | 'red' | 'orange' }[],
    body: (e.body_text || '').replace(/^\s*\*\s*/gm, '• ').replace(/<[^>]*>/g, ''),
    is_read: e.is_read || readEmails.has(String(e.id || e.external_id)),
    is_sent: sentEmails.has(String(e.id || e.external_id)) || aiDrafts[String(e.id || e.external_id)]?.status === 'sent',
    message_id: e.external_id || null,
    provider: 'microsoft' as const,
  }));

  const gmailEmailSource = realEmails.map((e: any) => ({
    id: e.id,
    sender: e.from_name || e.from_email,
    email: e.from_email,
    subject: e.subject || '(no subject)',
    preview: e.body_preview || '',
    time: new Date(e.received_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }),
    tags: [] as { label: string; color: 'blue' | 'red' | 'orange' }[],
    body: (e.body_text || '').replace(/^\s*\*\s*/gm, '• '),
    is_read: e.is_read || readEmails.has(String(e.id)),
    is_sent: sentEmails.has(String(e.id)) || aiDrafts[String(e.id)]?.status === 'sent',
    message_id: e.message_id || null,
    provider: 'gmail' as const,
  }));

  const emailSource = activeProvider === 'microsoft' ? msEmailSource : gmailEmailSource;

  const selected = emailSource.find((e) => String(e.id) === String(selectedId)) ?? null;

  const filterCounts: Record<FilterType, number> = {
    All: emailSource.filter(e => !e.is_sent).length,
    Urgent: emailSource.filter(e => !e.is_sent && e.tags.some(t => t.label === 'Urgent')).length,
    'New Lead': emailSource.filter(e => !e.is_sent && e.tags.some(t => t.label === 'New Lead')).length,
    Support: emailSource.filter(e => !e.is_sent && e.tags.some(t => t.label === 'Support')).length,
    Completed: emailSource.filter(e => e.is_sent).length,
  };

  const filtered = activeFilter === 'Completed'
    ? emailSource.filter(e => e.is_sent)
    : activeFilter === 'All'
    ? emailSource.filter(e => !e.is_sent)
    : emailSource.filter(e => !e.is_sent && e.tags.some(t => t.label === activeFilter));

  const handleApprove = async () => {
    if (!tenant?.id || !selected) return;
    const emailId = String(selected.id);
    const draft = aiDrafts[emailId];
    const draftText = draft?.draft_text ?? '';
    if (!draftText.trim()) { setToast('No draft to send'); return; }
    setSending(true);
    try {
      if (activeProvider === 'microsoft') {
        const draftRes = await fetch('/api/microsoft/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenant.id,
            to: selected.email,
            subject: selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`,
            body: draftText,
            replyToMessageId: selected.message_id || null,
          }),
        });
        if (!draftRes.ok) {
          const err = await draftRes.json();
          setToast(`Failed to create draft: ${err.error}`);
          setSending(false);
          return;
        }
        const { draftId } = await draftRes.json();
        const sendRes = await fetch('/api/microsoft/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenant.id, draftId }),
        });
        if (sendRes.ok) {
          setToast('Reply sent via Outlook ✓');
          setSentEmails(p => new Set([...p, emailId]));
          if (draft) setAiDrafts(p => ({ ...p, [emailId]: { ...p[emailId], status: 'sent' } }));
        } else {
          const err = await sendRes.json();
          setToast(`Failed to send: ${err.error}`);
        }
      } else {
        const res = await fetch('/api/inbox/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenant.id,
            email_id: emailId,
            draft_id: draft?.id || null,
            draft_text: draftText,
            message_id: selected.message_id || null,
          }),
        });
        if (res.ok) {
          setToast('Reply sent via Gmail ✓');
          setSentEmails(p => new Set([...p, emailId]));
          if (draft) setAiDrafts(p => ({ ...p, [emailId]: { ...p[emailId], status: 'sent' } }));
        } else {
          const err = await res.json();
          setToast(`Failed to send: ${err.error}`);
        }
      }
    } catch {
      setToast('Send failed — check connection');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="inbox-page">
      <div className="inbox-header-row">
        <h1 className="inbox-title">Inbox Assistant</h1>
        {(connections.length > 0 || msConnected) && stats && (
          <p className="inbox-stats-bar">
            {stats.queueCount} in queue
            {stats.draftCount > 0 && ` · ${stats.draftCount} drafted this week`}
            {stats.avgMins !== null && ` · Avg ${stats.avgMins}min response time`}
          </p>
        )}
      </div>

      {(connections.length > 0 || msConnected) && (
        <div className="inbox-connection-bar">
          <div className="inbox-provider-toggle">
            {connections.length > 0 && (
              <button
                className={`inbox-provider-pill${activeProvider === 'google' ? ' active' : ''}`}
                onClick={() => setActiveProvider('google')}
              >
                <img src="https://www.google.com/favicon.ico" width={14} height={14} style={{ marginRight: 4 }} />
                Google
              </button>
            )}
            {msConnected && (
              <button
                className={`inbox-provider-pill${activeProvider === 'microsoft' ? ' active' : ''}`}
                onClick={() => { setActiveProvider('microsoft'); if (msEmails.length === 0) fetchMsEmails(); }}
              >
                <svg width="14" height="14" viewBox="0 0 22 22" style={{ marginRight: 4 }}>
                  <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                  <rect x="12" y="1" width="9" height="9" fill="#7FBA00"/>
                  <rect x="1" y="12" width="9" height="9" fill="#00A4EF"/>
                  <rect x="12" y="12" width="9" height="9" fill="#FFB900"/>
                </svg>
                Microsoft
              </button>
            )}
          </div>
          <div className="inbox-connected-status">
            {activeProvider === 'google' && connections.map(c => (
              <span key={c.provider} className="inbox-connected-pill">
                {c.email} connected
                <button
                  onClick={() => handleDisconnect(c.provider)}
                  className="inbox-sync-btn"
                  style={{ borderColor: '#ff3b30', color: '#ff3b30' }}
                >
                  Disconnect
                </button>
              </span>
            ))}
            {activeProvider === 'microsoft' && msConnected && (
              <span className="inbox-connected-pill">
                Microsoft 365 connected
                <button
                  onClick={handleMsDisconnect}
                  className="inbox-sync-btn"
                  style={{ borderColor: '#ff3b30', color: '#ff3b30' }}
                >
                  Disconnect
                </button>
              </span>
            )}
            {activeProvider === 'google' && (
              <button className="inbox-sync-btn" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync now'}
              </button>
            )}
            {activeProvider === 'microsoft' && (
              <button className="inbox-sync-btn" onClick={fetchMsEmails} disabled={msSyncing}>
                {msSyncing ? 'Syncing...' : 'Sync now'}
              </button>
            )}
          </div>
        </div>
      )}

      {connections.length === 0 && !msConnected && (
        <div className="inbox-empty-state">
          <div className="inbox-empty-icon">📭</div>
          <h2 className="inbox-empty-title">Connect your inbox to get started</h2>
          <p className="inbox-empty-desc">
            SolarOps will read incoming emails and generate AI-drafted replies for your team to review and send.
          </p>
          <div className="inbox-provider-options">
            <a href={`/api/auth/gmail?tenant_id=${tenant?.id}&redirect=/inbox-assistant`} className="inbox-provider-btn gmail">
              <img src="https://www.google.com/favicon.ico" width={18} height={18} />
              Connect Gmail
            </a>
            <a href={`/api/auth/microsoft?tenant_id=${tenant?.id}&user_id=${user?.uid || ''}&redirect=/inbox-assistant`} className="inbox-provider-btn outlook">
              <svg width="18" height="18" viewBox="0 0 22 22">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="12" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="12" width="9" height="9" fill="#00A4EF"/>
                <rect x="12" y="12" width="9" height="9" fill="#FFB900"/>
              </svg>
              Connect Outlook
            </a>
          </div>
          <p className="inbox-empty-note">Your emails are never stored without your permission. AI drafts require your approval before sending.</p>
        </div>
      )}

      {(connections.length > 0 || msConnected) && (
        <div className="inbox-panels">
          {/* ── LEFT PANEL ── */}
          <div className="inbox-left">
            <div className="inbox-left-topbar">
              <div className="inbox-filters">
                {(['All', 'Urgent', 'New Lead', 'Support', 'Completed'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    className={`filter-pill${activeFilter === f ? ' active' : ''}`}
                    onClick={() => setActiveFilter(f)}
                  >
                    {f} ({filterCounts[f]})
                  </button>
                ))}
              </div>
            </div>

            <div className="inbox-email-list">
              {emailSource.length === 0 && !syncing && !msSyncing ? (
                <div className="inbox-sync-prompt">
                  <p>No emails loaded yet.</p>
                  <button
                    className="inbox-connect-btn"
                    onClick={activeProvider === 'microsoft' ? fetchMsEmails : handleSync}
                  >
                    Sync inbox now
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="inbox-sync-prompt">
                  <p>No emails in this category.</p>
                </div>
              ) : (
                filtered.map((e) => (
                  <button
                    key={e.id}
                    className={`email-card${String(selectedId) === String(e.id) ? ' selected' : ''}${!e.is_read ? ' unread' : ''}${e.is_sent ? ' sent' : ''}`}
                    onClick={() => {
                      setSelectedId(String(e.id));
                      fetchOrGenerateDraft(String(e.id));
                      markAsRead(String(e.id));
                    }}
                  >
                    <div className="email-card-top">
                      <span className="email-sender">{e.sender}</span>
                      <span className="email-time">{e.time}</span>
                    </div>
                    <div className="email-subject">{e.subject}</div>
                    <div className="email-preview">{e.preview}</div>
                    <div className="email-tags">
                      {e.tags.map((t) => (
                        <span key={t.label} className={`email-tag ${t.color}`}>
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="inbox-right" key={selected?.id ?? 'empty'}>
            {!selected ? (
              <div className="inbox-sync-prompt" style={{ height: '100%', justifyContent: 'center' }}>
                <p style={{ color: '#6e6e73' }}>Select an email to view</p>
              </div>
            ) : (
              <>
                {/* Thread */}
                <div className="thread-section">
                  <div className="thread-header">
                    <div className="thread-subject">{selected.subject}</div>
                    <div className="thread-meta-row">
                      <span className="thread-meta">
                        {selected.sender} · {selected.email} · Today {selected.time}
                      </span>
                      <div className="thread-badges">
                        {selected.tags.map((t) => (
                          <span key={t.label} className={`thread-badge ${t.color}`}>
                            {t.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {aiDrafts[String(selected.id)]?.ai_summary && (
                    <div className="ai-summary-box">
                      <span className="ai-icon">✦</span> AI Summary: {aiDrafts[String(selected.id)].ai_summary}
                    </div>
                  )}

                  <div className="email-body" style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</div>
                </div>

                {/* Divider */}
                <div className="panel-divider" />

                {/* Draft */}
                <div className="draft-section">
                  <div className="draft-header">
                    <span className="draft-label">✦ AI Draft</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="regen-btn" onClick={() => {
                        const id = String(selected.id);
                        setAiDrafts(p => { const n = { ...p }; delete n[id]; return n; });
                        fetchOrGenerateDraft(id);
                      }}>Regenerate</button>
                      {aiDrafts[String(selected.id)] && (
                        <button className="regen-btn" style={{ color: '#ff3b30' }} onClick={async () => {
                          const draft = aiDrafts[String(selected.id)];
                          if (!draft || !tenant?.id) return;
                          await fetch(`/api/inbox/drafts/${draft.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenant_id: tenant.id }),
                          });
                          setAiDrafts(p => { const n = { ...p }; delete n[String(selected.id)]; return n; });
                        }}>Delete Draft</button>
                      )}
                    </div>
                  </div>
                  {draftLoading[String(selected.id)] ? (
                    <div className="draft-generating">✦ Generating AI draft...</div>
                  ) : (
                    <textarea
                      className="draft-textarea"
                      readOnly={aiDrafts[String(selected.id)]?.status === 'sent' || sentEmails.has(String(selected.id))}
                      style={aiDrafts[String(selected.id)]?.status === 'sent' || sentEmails.has(String(selected.id)) ? { background: '#f9f9f9', color: '#6e6e73' } : {}}
                      value={aiDrafts[String(selected.id)]?.draft_text ?? ''}
                      onChange={(ev) => {
                        const id = String(selected.id);
                        setAiDrafts(p => ({ ...p, [id]: { ...p[id], draft_text: ev.target.value } }));
                      }}
                      placeholder="Click an email to generate an AI draft"
                    />
                  )}
                  <div className="draft-actions">
                    <div className="draft-actions-left">
                      <button className="action-btn secondary">Create Ticket</button>
                      <button className="action-btn secondary">Link to Ticket</button>
                    </div>
                    <button
                      className={`action-btn ${aiDrafts[String(selected.id)]?.status === 'sent' || sentEmails.has(String(selected.id)) ? 'sent' : 'primary'}`}
                      onClick={handleApprove}
                      disabled={sending || aiDrafts[String(selected.id)]?.status === 'sent' || sentEmails.has(String(selected.id))}
                    >
                      {sending ? 'Sending...' : aiDrafts[String(selected.id)]?.status === 'sent' || sentEmails.has(String(selected.id)) ? '✓ Sent' : 'Approve & Send'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="inbox-toast">{toast}</div>}
    </div>
  );
}
