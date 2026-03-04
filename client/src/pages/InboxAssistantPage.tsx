import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/InboxAssistantPage.css';

type FilterType = 'All' | 'Urgent' | 'New Lead' | 'Support';

interface Email {
  id: number;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  time: string;
  tags: { label: string; color: 'blue' | 'red' | 'orange' }[];
  body: string;
  aiSummary: string;
  draft: string;
}

const emails: Email[] = [
  {
    id: 1,
    sender: 'James Hartley',
    email: 'james@suncoastcommercial.com.au',
    subject: 'Commercial solar quote — 85kW system',
    preview: "Hi, we're looking to install solar across our warehouse...",
    time: '9:41 AM',
    tags: [
      { label: 'New Lead', color: 'blue' },
      { label: 'Urgent', color: 'red' },
    ],
    body: `Hi Sol Energy team,

We've been considering going solar for our warehouse in Bibra Lake for a while now. We're looking at roughly an 85kW system across the main roof. I'm the operations manager here and have sign-off authority for this kind of project.

Could you provide a quote and potentially arrange a site visit? We'd like to move fairly quickly on this.

Thanks,
James Hartley
Operations Manager — Suncoast Commercial`,
    aiSummary:
      'Commercial enquiry for an 85kW system across a warehouse facility. Decision maker is James (Operations Manager). Budget not yet discussed. Requesting quote and site visit.',
    draft: `Hi James,

Thanks for reaching out — an 85kW system for a warehouse in Bibra Lake sounds like a great fit for what we do.

I'd love to arrange a site visit and put together a detailed quote for you. Could I grab a few details first?

- What's the best number to reach you on?
- Are you the primary contact for this project?
- Do you have a rough timeline in mind?

Looking forward to connecting.

Warm regards,
Sol Energy Team`,
  },
  {
    id: 2,
    sender: 'Rachel Wong',
    email: 'rachel.wong@gmail.com',
    subject: 'Re: System monitoring not showing data',
    preview: "Thanks for getting back to me. The app still isn't...",
    time: '9:22 AM',
    tags: [{ label: 'Support', color: 'orange' }],
    body: `Hi,

Thanks for getting back to me. The app still isn't showing any generation data since last Thursday. I've tried restarting the inverter like you suggested but it hasn't helped.

The system is only 3 months old so I'm hoping this is a simple fix. Can someone come and take a look?

Cheers,
Rachel`,
    aiSummary:
      'Existing customer reporting monitoring data outage since last Thursday. Inverter restart attempted without success. System is 3 months old — may be under warranty.',
    draft: `Hi Rachel,

Sorry to hear the monitoring issue is persisting. Since the inverter restart didn't resolve it, this may be a connectivity issue between your inverter and the monitoring platform.

I'll arrange for one of our technicians to visit and diagnose the issue. Since your system is under warranty, there'll be no charge.

Could you let me know a couple of times that suit you this week?

Best regards,
Sol Energy Team`,
  },
  {
    id: 3,
    sender: 'Mark Deluca',
    email: 'mark@delucabuilders.com.au',
    subject: 'Interested in solar for new development',
    preview: 'We have a 12-unit residential development starting...',
    time: '8:55 AM',
    tags: [{ label: 'New Lead', color: 'blue' }],
    body: `Hi there,

We have a 12-unit residential development starting construction in Joondalup next month. We'd like to include solar as standard on each unit — probably 6.6kW systems with battery-ready inverters.

Is this something you can help with? We'd need bulk pricing and coordination with our build schedule.

Mark Deluca
Director — Deluca Builders`,
    aiSummary:
      'Developer enquiry for 12-unit residential project in Joondalup. Looking for 6.6kW systems per unit with battery-ready inverters. Needs bulk pricing and build schedule coordination.',
    draft: `Hi Mark,

Great to hear about the Joondalup development — we work with several builders on projects like this and would be happy to put together a bulk proposal.

For 12 units at 6.6kW each, we can offer competitive volume pricing and coordinate installations around your build schedule.

Could we schedule a quick call to discuss the specifics? I'd also like to understand your inverter preferences and whether you'd like us to include EV charger pre-wiring.

Kind regards,
Sol Energy Team`,
  },
  {
    id: 4,
    sender: 'Priya Sharma',
    email: 'priya.sharma@hotmail.com',
    subject: 'Battery rebate question',
    preview: "I saw on the news that there's a new government rebate...",
    time: '8:30 AM',
    tags: [{ label: 'Support', color: 'orange' }],
    body: `Hi,

I saw on the news that there's a new government rebate for home batteries in WA. I already have a 10kW solar system installed by you guys last year.

Am I eligible for the rebate? And how much would a battery add-on cost? I'm thinking of a Tesla Powerwall or similar.

Thanks,
Priya`,
    aiSummary:
      'Existing customer enquiring about WA government battery rebate eligibility. Has a 10kW system installed last year. Interested in Tesla Powerwall or similar.',
    draft: `Hi Priya,

Great question! Yes, there is a current rebate available for home batteries in WA, and as an existing solar customer you should be eligible.

The rebate covers up to $3,000 depending on the battery size. For a Tesla Powerwall 2 (13.5kWh), the installed price is typically around $12,000–$14,000 before the rebate.

Would you like me to send through a detailed quote with the rebate applied? I can also check compatibility with your existing inverter.

Best regards,
Sol Energy Team`,
  },
];

export default function InboxAssistantPage() {
  const { tenant } = useAuth();
  const [selectedId, setSelectedId] = useState<string | number>(1);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    emails.forEach((e) => (d[String(e.id)] = e.draft));
    return d;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ provider: string; email: string }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [realEmails, setRealEmails] = useState<any[]>([]);
  const [useRealEmails, setUseRealEmails] = useState(false);

  const fetchConnections = async () => {
    if (!tenant?.id) return;
    const res = await fetch(`/api/inbox/connections?tenant_id=${tenant.id}`);
    if (res.ok) setConnections(await res.json());
  };

  const fetchEmails = async () => {
    if (!tenant?.id) return;
    const res = await fetch(`/api/inbox/emails?tenant_id=${tenant.id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) { setRealEmails(data); setUseRealEmails(true); }
    }
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
    const interval = setInterval(() => { fetchEmails(); }, 180000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'gmail') {
      handleSync();
      window.history.replaceState({}, '', '/inbox');
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const emailSource = useRealEmails ? realEmails.map((e: any) => ({
    id: e.id,
    sender: e.from_name || e.from_email,
    email: e.from_email,
    subject: e.subject || '(no subject)',
    preview: e.body_preview || '',
    time: new Date(e.received_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }),
    tags: [],
    body: e.body_text || '',
    aiSummary: '',
    draft: '',
  })) : connections.length === 0 ? emails : [];

  const selected = emailSource.find((e) => String(e.id) === String(selectedId)) || emailSource[0];

  const filterCounts: Record<FilterType, number> = {
    All: emailSource.length,
    Urgent: emailSource.filter((e) => e.tags.some((t) => t.label === 'Urgent')).length,
    'New Lead': emailSource.filter((e) => e.tags.some((t) => t.label === 'New Lead')).length,
    Support: emailSource.filter((e) => e.tags.some((t) => t.label === 'Support')).length,
  };

  const filtered =
    activeFilter === 'All'
      ? emailSource
      : emailSource.filter((e) => e.tags.some((t) => t.label === activeFilter));

  const handleApprove = () => {
    setToast('Draft approved and sent via Outlook');
  };

  return (
    <div className="inbox-page">
      <div className="inbox-header-row">
        <h1 className="inbox-title">Inbox Assistant</h1>
        <p className="inbox-subtitle">AI-drafted replies, ready for your approval</p>
        <p className="inbox-stats-bar">4 in queue · 134 drafted this week · Avg 4.2min response time</p>
      </div>

      {connections.length > 0 && (
        <div className="inbox-connection-bar">
          <div className="inbox-connected-status">
            {connections.map(c => (
              <span key={c.provider} className="inbox-connected-pill">
                {c.email} connected
              </span>
            ))}
            <button className="inbox-sync-btn" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          </div>
        </div>
      )}

      {connections.length === 0 && (
        <div className="inbox-empty-state">
          <div className="inbox-empty-icon">📭</div>
          <h2 className="inbox-empty-title">Connect your inbox to get started</h2>
          <p className="inbox-empty-desc">
            SolarOps will read incoming emails and generate AI-drafted replies for your team to review and send.
          </p>
          <div className="inbox-provider-options">
            <a href={`/api/auth/gmail?tenant_id=${tenant?.id}`} className="inbox-provider-btn gmail">
              <img src="https://www.google.com/favicon.ico" width={18} height={18} />
              Connect Gmail
            </a>
            <button className="inbox-provider-btn outlook" disabled>
              <img src="https://outlook.com/favicon.ico" width={18} height={18} />
              Outlook — Coming Soon
            </button>
          </div>
          <p className="inbox-empty-note">Your emails are never stored without your permission. AI drafts require your approval before sending.</p>
        </div>
      )}

      {connections.length > 0 && (
      <div className="inbox-panels">
        {/* ── LEFT PANEL ── */}
        <div className="inbox-left">
          <div className="inbox-left-topbar">
            <select className="inbox-select">
              <option>support@solenergy.com.au</option>
              <option>sales@solenergy.com.au</option>
              <option>info@solenergy.com.au</option>
            </select>
            <div className="inbox-filters">
              {(['All', 'Urgent', 'New Lead', 'Support'] as FilterType[]).map((f) => (
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
            {connections.length > 0 && emailSource.length === 0 && !syncing ? (
              <div className="inbox-sync-prompt">
                <p>No emails loaded yet.</p>
                <button className="inbox-connect-btn" onClick={handleSync}>Sync inbox now</button>
              </div>
            ) : filtered.map((e) => (
              <button
                key={e.id}
                className={`email-card${selectedId === e.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(e.id)}
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
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="inbox-right" key={selected?.id}>
          {selected && (
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

                {selected.aiSummary && (
                  <div className="ai-summary-box">
                    <span className="ai-icon">✦</span> AI Summary: {selected.aiSummary}
                  </div>
                )}

                <div className="email-body">{selected.body}</div>
              </div>

              {/* Divider */}
              <div className="panel-divider" />

              {/* Draft */}
              <div className="draft-section">
                <div className="draft-header">
                  <span className="draft-label">✦ AI Draft</span>
                  <button className="regen-btn">Regenerate</button>
                </div>
                <textarea
                  className="draft-textarea"
                  value={drafts[String(selected?.id)] || ''}
                  onChange={(ev) => setDrafts((p) => ({ ...p, [String(selected?.id)]: ev.target.value }))}
                />
                <div className="draft-actions">
                  <div className="draft-actions-left">
                    <button className="action-btn secondary">Create Ticket</button>
                    <button className="action-btn secondary">Link to Ticket</button>
                  </div>
                  <button className="action-btn primary" onClick={handleApprove}>
                    Approve &amp; Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Toast */}
      {toast && <div className="inbox-toast">{toast}</div>}
    </div>
  );
}
