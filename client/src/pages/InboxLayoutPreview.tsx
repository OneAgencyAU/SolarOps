import { useState } from 'react';

const emailList = [
  { from: 'James Holloway', subject: 'Interested in 10kW system', preview: 'Hi, I saw your ad and wanted to get a quote for my property in...' },
  { from: 'Priya Kapoor', subject: 'Re: Battery storage follow-up', preview: 'Thanks for the info! Just wondering if the SolarEdge...' },
  { from: 'Unknown', subject: 'Urgent: Inverter fault alarm', preview: 'We have a fault showing on our app and I need someone to...' },
];

const emailListB = [
  { from: 'James Holloway', subject: 'Interested in 10kW system', urgency: 'Normal', action: 'New Lead' },
  { from: 'Priya Kapoor', subject: 'Re: Battery storage follow-up', urgency: 'Normal', action: 'Support' },
  { from: 'Unknown', subject: 'Urgent: Inverter fault alarm', urgency: 'Urgent', action: 'Support' },
  { from: 'Sarah Mitchell', subject: 'Quote request — 6.6kW', urgency: 'Normal', action: 'New Lead' },
];

const emailListC = [
  { from: 'James Holloway', subject: 'Interested in 10kW system', urgency: 'Normal', action: 'New Lead' },
  { from: 'Priya Kapoor', subject: 'Re: Battery storage follow-up', urgency: 'Normal', action: 'Support' },
  { from: 'Unknown', subject: 'Urgent: Inverter fault alarm', urgency: 'Urgent', action: 'Support' },
  { from: 'Sarah Mitchell', subject: 'Quote request — 6.6kW', urgency: 'Normal', action: 'New Lead' },
];

export default function InboxLayoutPreview() {
  const [activeTab, setActiveTab] = useState<'Review Queue (4)' | 'Sent' | 'All'>('Review Queue (4)');

  return (
    <div style={{ background: '#f5f5f7', minHeight: '100vh', padding: '40px 32px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1d1d1f', marginBottom: 6 }}>
          Inbox Assistant — Choose Your Layout
        </h1>
        <p style={{ fontSize: '0.95rem', color: '#6e6e73', marginBottom: 40 }}>
          Pick the layout that feels right for your team
        </p>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── PREVIEW A: Three Panel ── */}
          <PreviewShell label="Option A — Three Panel" subtext="Full context at a glance">
            <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
              {/* Left: email list */}
              <div style={{ width: 140, borderRight: '1px solid #e5e5e7', flexShrink: 0, overflowY: 'hidden' }}>
                {emailList.map((e, i) => (
                  <div key={i} style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #f0f0f2',
                    background: i === 0 ? '#f0f5ff' : '#fff',
                    cursor: 'default',
                  }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.from}</div>
                    <div style={{ fontSize: '0.6rem', color: '#3c3c43', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{e.subject}</div>
                    <div style={{ fontSize: '0.55rem', color: '#6e6e73', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{e.preview}</div>
                  </div>
                ))}
              </div>

              {/* Middle: thread */}
              <div style={{ flex: 1, borderRight: '1px solid #e5e5e7', padding: '10px', overflowY: 'hidden', minWidth: 0 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#1d1d1f', marginBottom: 8 }}>James Holloway</div>
                <MiniMessage from="James Holloway" text="Hi, I saw your ad and wanted to get a quote for my property in Sutherland. We have a north-facing roof." time="9:12 AM" />
                <MiniMessage from="Sol (AI draft)" text="Hi James, thanks for reaching out! I'd love to help with a quote. Could I get your address and average quarterly bill?" time="9:13 AM" isAgent />
              </div>

              {/* Right: draft reply */}
              <div style={{ width: 130, padding: '10px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#6e6e73', marginBottom: 2 }}>Draft Reply</div>
                <textarea
                  readOnly
                  value="Hi James, thanks for reaching out! I'd love to help. Could I get your address and average quarterly bill?"
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid #e5e5e7',
                    borderRadius: 8,
                    padding: 6,
                    fontSize: '0.55rem',
                    color: '#1d1d1f',
                    fontFamily: 'Inter, sans-serif',
                    background: '#fafafa',
                  }}
                />
                <button style={miniBtn('#4F8EF7')}>Approve & Send</button>
                <button style={miniBtn('#f5f5f7', '#1d1d1f')}>Edit</button>
              </div>
            </div>
          </PreviewShell>

          {/* ── PREVIEW B: Two Panel ── */}
          <PreviewShell label="Option B — Two Panel" subtext="Focused review experience">
            <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
              {/* Left: card list */}
              <div style={{ width: 180, borderRight: '1px solid #e5e5e7', flexShrink: 0, overflowY: 'hidden', padding: '8px' }}>
                {emailListB.map((e, i) => (
                  <div key={i} style={{
                    background: i === 0 ? '#f0f5ff' : '#fff',
                    border: '1px solid #e5e5e7',
                    borderRadius: 8,
                    padding: '7px 8px',
                    marginBottom: 6,
                    cursor: 'default',
                  }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.from}</div>
                    <div style={{ fontSize: '0.57rem', color: '#3c3c43', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{e.subject}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                      <UrgencyPill urgency={e.urgency} />
                      <ActionPill action={e.action} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: thread + draft combined */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ flex: 1, padding: '10px', borderBottom: '1px solid #e5e5e7', overflowY: 'hidden' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#1d1d1f', marginBottom: 8 }}>James Holloway — Interested in 10kW system</div>
                  <MiniMessage from="James Holloway" text="Hi, I saw your ad and wanted to get a quote for my property in Sutherland." time="9:12 AM" />
                  <MiniMessage from="Sol (AI draft)" text="Hi James, thanks for reaching out! Could I get your address and average quarterly bill?" time="9:13 AM" isAgent />
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    readOnly
                    value="Hi James, thanks for reaching out! Could I get your address and average quarterly electricity bill?"
                    style={{
                      resize: 'none',
                      border: '1px solid #e5e5e7',
                      borderRadius: 8,
                      padding: 6,
                      fontSize: '0.55rem',
                      color: '#1d1d1f',
                      fontFamily: 'Inter, sans-serif',
                      background: '#fafafa',
                      height: 52,
                    }}
                  />
                  <button style={miniBtn('#4F8EF7')}>Approve & Send</button>
                </div>
              </div>
            </div>
          </PreviewShell>

          {/* ── PREVIEW C: Tabbed ── */}
          <PreviewShell label="Option C — Tabbed Queue" subtext="Simple approval workflow">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e7', marginBottom: 0 }}>
                {(['Review Queue (4)', 'Sent', 'All'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab ? '2px solid #4F8EF7' : '2px solid transparent',
                      padding: '7px 10px',
                      fontSize: '0.6rem',
                      fontWeight: activeTab === tab ? 600 : 400,
                      color: activeTab === tab ? '#4F8EF7' : '#6e6e73',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      marginBottom: -1,
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Queue items */}
              <div style={{ flex: 1, overflowY: 'hidden', padding: '8px 0 0' }}>
                {emailListC.map((e, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderBottom: '1px solid #f0f0f2',
                    background: '#fff',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.from}</div>
                      <div style={{ fontSize: '0.57rem', color: '#3c3c43', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{e.subject}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <UrgencyPill urgency={e.urgency} />
                        <ActionPill action={e.action} />
                      </div>
                    </div>
                    <button style={{ ...miniBtn('#4F8EF7'), whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Approve & Send
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </PreviewShell>

        </div>
      </div>
    </div>
  );
}

function PreviewShell({ label, subtext, children }: { label: string; subtext: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 380, flexShrink: 0 }}>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1d1d1f' }}>{label}</div>
        <div style={{ fontSize: '0.82rem', color: '#6e6e73', marginTop: 2 }}>{subtext}</div>
      </div>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 400,
      }}>
        {/* Fake browser chrome */}
        <div style={{ background: '#f5f5f7', borderBottom: '1px solid #e5e5e7', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF453A', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD60A', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34C759', display: 'inline-block' }} />
          <div style={{ flex: 1, background: '#e5e5e7', borderRadius: 4, height: 14, marginLeft: 8 }} />
        </div>
        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function MiniMessage({ from, text, time, isAgent }: { from: string; text: string; time: string; isAgent?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: '0.55rem', color: '#6e6e73', marginBottom: 2 }}>{from} · {time}</div>
      <div style={{
        background: isAgent ? '#f0f5ff' : '#f5f5f7',
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: '0.57rem',
        color: '#1d1d1f',
        lineHeight: 1.5,
        borderLeft: isAgent ? '2px solid #4F8EF7' : 'none',
      }}>
        {text}
      </div>
    </div>
  );
}

function UrgencyPill({ urgency }: { urgency: string }) {
  const isUrgent = urgency === 'Urgent';
  return (
    <span style={{
      fontSize: '0.48rem',
      fontWeight: 600,
      padding: '2px 5px',
      borderRadius: 4,
      background: isUrgent ? 'rgba(255,69,58,0.1)' : 'rgba(0,0,0,0.05)',
      color: isUrgent ? '#FF453A' : '#6e6e73',
    }}>
      {urgency}
    </span>
  );
}

function ActionPill({ action }: { action: string }) {
  const isLead = action === 'New Lead';
  return (
    <span style={{
      fontSize: '0.48rem',
      fontWeight: 600,
      padding: '2px 5px',
      borderRadius: 4,
      background: isLead ? 'rgba(79,142,247,0.1)' : 'rgba(52,199,89,0.1)',
      color: isLead ? '#4F8EF7' : '#34C759',
    }}>
      {action}
    </span>
  );
}

function miniBtn(bg: string, color = '#fff'): React.CSSProperties {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: 6,
    padding: '5px 8px',
    fontSize: '0.55rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    textAlign: 'center',
  };
}
