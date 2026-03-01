import { useState } from 'react';
import '../styles/HelpdeskPage.css';

type SourceFilter = 'All' | 'Voice' | 'Email' | 'Manual';
type PriorityFilter = 'All' | 'Normal' | 'Urgent';
type DetailTab = 'Details' | 'Transcript' | 'Notes' | 'Timeline';

interface Ticket {
  id: string;
  title: string;
  customer: string;
  email?: string;
  source: 'Email' | 'Voice' | 'Manual';
  priority: 'Normal' | 'Urgent';
  assignee: string;
  sla: string;
  slaColor: 'green' | 'orange' | 'red';
  time: string;
  column: 'New' | 'In Progress' | 'Waiting on Customer' | 'Closed';
  resolved?: string;
  aiSummary?: string;
  phone?: string;
  queue?: string;
}

const tickets: Ticket[] = [
  { id: '#1042', title: 'Commercial solar quote — 85kW warehouse', customer: 'James Hartley', email: 'james@suncoastcommercial.com.au', source: 'Email', priority: 'Urgent', assignee: 'Unassigned', sla: '2h remaining', slaColor: 'orange', time: '9:41 AM', column: 'New', aiSummary: 'Commercial enquiry for an 85kW warehouse system in Bibra Lake. Decision maker confirmed. No budget discussed yet. Callback requested for site visit.', queue: 'New Enquiries' },
  { id: '#1041', title: 'Battery rebate eligibility question', customer: 'Priya Sharma', email: 'priya.sharma@hotmail.com', source: 'Email', priority: 'Normal', assignee: 'Unassigned', sla: '4h remaining', slaColor: 'green', time: '8:30 AM', column: 'New', aiSummary: 'Customer asking about WA government battery rebate eligibility. Already has a 10kW system.', queue: 'Support' },
  { id: '#1040', title: 'Inbound call — new residential enquiry', customer: 'Unknown Caller', source: 'Voice', priority: 'Normal', assignee: 'Unassigned', sla: '5h remaining', slaColor: 'green', time: '8:15 AM', column: 'New', aiSummary: 'New residential solar enquiry from inbound call. Details to be confirmed via callback.', queue: 'New Enquiries' },
  { id: '#1039', title: 'Solar monitoring app not loading', customer: 'Rachel Wong', email: 'rachel.wong@gmail.com', source: 'Email', priority: 'Urgent', assignee: 'Sarah', sla: 'OVERDUE', slaColor: 'red', time: 'Yesterday', column: 'New', aiSummary: 'Existing customer reporting monitoring data outage. System is 3 months old. Needs technician visit.', queue: 'Support' },
  { id: '#1038', title: 'Site visit scheduling — Bibra Lake', customer: 'James Hartley', email: 'james@suncoastcommercial.com.au', source: 'Manual', priority: 'Normal', assignee: 'Nat', sla: '1d remaining', slaColor: 'green', time: 'Yesterday', column: 'In Progress', aiSummary: 'Follow-up to schedule commercial site visit at Bibra Lake warehouse.', queue: 'New Enquiries' },
  { id: '#1037', title: 'Inverter fault — system offline', customer: 'Mike Chen', email: 'mike.chen@gmail.com', source: 'Voice', priority: 'Urgent', assignee: 'Sarah', sla: 'OVERDUE', slaColor: 'red', time: '2 days ago', column: 'In Progress', aiSummary: 'Urgent inverter fault causing system to go offline. Customer reported via phone. Needs immediate technician dispatch.', queue: 'Support' },
  { id: '#1036', title: 'Quote follow-up — 12 unit development', customer: 'Mark Deluca', email: 'mark@delucabuilders.com.au', source: 'Email', priority: 'Normal', assignee: 'Nat', sla: '3h remaining', slaColor: 'orange', time: '2 days ago', column: 'In Progress', aiSummary: 'Developer follow-up for bulk solar quote on 12-unit residential project in Joondalup.', queue: 'New Enquiries' },
  { id: '#1035', title: 'Awaiting electricity bill — residential', customer: 'Tom Henderson', email: 'tom.henderson@gmail.com', source: 'Email', priority: 'Normal', assignee: 'Sarah', sla: 'Paused', slaColor: 'green', time: '3 days ago', column: 'Waiting on Customer', aiSummary: 'Waiting on customer to provide electricity bill for accurate system sizing.', queue: 'New Enquiries' },
  { id: '#1034', title: 'Pending site access confirmation', customer: 'Suncoast Commercial', email: 'admin@suncoastcommercial.com.au', source: 'Manual', priority: 'Normal', assignee: 'Nat', sla: 'Paused', slaColor: 'green', time: '3 days ago', column: 'Waiting on Customer', aiSummary: 'Waiting on site access confirmation from building management.', queue: 'New Enquiries' },
  { id: '#1033', title: 'Awaiting strata approval — rooftop install', customer: 'Maria Torres', email: 'maria.torres@outlook.com', source: 'Email', priority: 'Normal', assignee: 'Unassigned', sla: 'Paused', slaColor: 'green', time: '4 days ago', column: 'Waiting on Customer', aiSummary: 'Customer needs strata body corporate approval before rooftop installation can proceed.', queue: 'Support' },
  { id: '#1032', title: 'Battery installation complete', customer: 'David Park', source: 'Email', priority: 'Normal', assignee: 'Nat', sla: '', slaColor: 'green', time: '', column: 'Closed', resolved: 'Today 8:00 AM' },
  { id: '#1031', title: 'Monitoring setup assistance', customer: 'Lisa Nguyen', source: 'Email', priority: 'Normal', assignee: 'Sarah', sla: '', slaColor: 'green', time: '', column: 'Closed', resolved: 'Yesterday' },
  { id: '#1030', title: 'Commercial quote sent — 45kW', customer: 'Coastal Retail Group', source: 'Manual', priority: 'Normal', assignee: 'Nat', sla: '', slaColor: 'green', time: '', column: 'Closed', resolved: '2 days ago' },
];

const columns: Ticket['column'][] = ['New', 'In Progress', 'Waiting on Customer', 'Closed'];

const transcript = [
  { role: 'Agent', text: "Hi, thanks for calling Sol Energy. I'm here to help — are you an existing customer or is this a new enquiry?" },
  { role: 'Customer', text: "Hi, I'm looking to get solar for our warehouse in Bibra Lake." },
  { role: 'Agent', text: "Great, could I get your name and best callback number?" },
  { role: 'Customer', text: "Sure, it's James, 0412 345 678" },
  { role: 'Agent', text: "Perfect James, someone will call you back this afternoon." },
];

const timeline = [
  { time: '9:41 AM', event: 'Ticket created via email' },
  { time: '9:42 AM', event: 'AI draft generated' },
  { time: '9:45 AM', event: 'Note added by Sarah' },
  { time: '10:00 AM', event: 'Assigned to Nat' },
];

export default function HelpdeskPage() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('Details');
  const [noteText, setNoteText] = useState('');

  const filtered = tickets.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.customer.toLowerCase().includes(search.toLowerCase()) && !t.id.includes(search)) return false;
    if (sourceFilter !== 'All' && t.source !== sourceFilter) return false;
    if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
    return true;
  });

  const getColumnTickets = (col: Ticket['column']) => filtered.filter((t) => t.column === col);

  const sourceIcon = (s: string) => {
    if (s === 'Email') return '✉';
    if (s === 'Voice') return '📞';
    return '✏️';
  };

  const openTicket = (t: Ticket) => {
    setSelectedTicket(t);
    setDetailTab('Details');
  };

  return (
    <div className="hd-page">
      <div className="hd-header">
        <h1 className="hd-title">Helpdesk</h1>
        <p className="hd-subtitle">Manage and resolve customer tickets</p>
      </div>

      <div className="hd-stats-row">
        <StatPill color="#4F8EF7" count={12} label="Open" />
        <StatPill color="#FF453A" count={3} label="Urgent" />
        <StatPill color="#FF9F0A" count={2} label="Overdue" />
        <StatPill color="#34C759" count={8} label="Resolved Today" />
      </div>

      <div className="hd-filter-row">
        <div className="hd-search-wrap">
          <span className="hd-search-icon">🔍</span>
          <input className="hd-search" placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="hd-filters">
          <div className="hd-filter-group">
            <span className="hd-filter-label">Source:</span>
            {(['All', 'Voice', 'Email', 'Manual'] as SourceFilter[]).map((f) => (
              <button key={f} className={`hd-fpill${sourceFilter === f ? ' active' : ''}`} onClick={() => setSourceFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="hd-filter-group">
            <span className="hd-filter-label">Priority:</span>
            {(['All', 'Normal', 'Urgent'] as PriorityFilter[]).map((f) => (
              <button key={f} className={`hd-fpill${priorityFilter === f ? ' active' : ''}`} onClick={() => setPriorityFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="kanban-board">
        {columns.map((col) => {
          const colTickets = getColumnTickets(col);
          return (
            <div key={col} className="kanban-col">
              <div className="kanban-col-header">
                <span className="kanban-col-title">{col}</span>
                <span className="kanban-col-count">{colTickets.length}</span>
              </div>
              <div className="kanban-col-body">
                {colTickets.map((t) => (
                  <button key={t.id} className={`ticket-card${col === 'Closed' ? ' closed' : ''}`} onClick={() => openTicket(t)}>
                    <div className="tc-top">
                      <span className="tc-id">{t.id}</span>
                      {t.time && <span className="tc-time">{t.time}</span>}
                      {t.resolved && <span className="tc-time">{t.resolved}</span>}
                    </div>
                    <div className="tc-title">{t.title}</div>
                    <div className="tc-customer">{t.customer}</div>
                    <div className="tc-bottom">
                      <div className="tc-bottom-left">
                        <span className="tc-source" title={t.source}>{sourceIcon(t.source)}</span>
                        {t.priority === 'Urgent' && <span className="tc-urgent-pill">URGENT</span>}
                        {col === 'Closed' && <span className="tc-resolved-pill">Resolved</span>}
                      </div>
                      <div className="tc-bottom-right">
                        {t.assignee !== 'Unassigned' && <span className="tc-assignee">{t.assignee}</span>}
                        {t.sla && <span className={`tc-sla ${t.slaColor}`}>{t.sla}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTicket && (
        <>
          <div className="hd-overlay" onClick={() => setSelectedTicket(null)} />
          <div className="hd-detail-panel">
            <div className="hd-dp-header">
              <div>
                <div className="hd-dp-id">{selectedTicket.id}</div>
                <div className="hd-dp-title">{selectedTicket.title}</div>
                <div className="hd-dp-pills">
                  <span className="hd-dp-status-pill">{selectedTicket.column}</span>
                  {selectedTicket.priority === 'Urgent' && <span className="tc-urgent-pill">URGENT</span>}
                  {selectedTicket.priority === 'Normal' && <span className="hd-dp-normal-pill">Normal</span>}
                </div>
              </div>
              <button className="hd-dp-close" onClick={() => setSelectedTicket(null)}>×</button>
            </div>

            <div className="hd-dp-assignee-row">
              <span className="hd-dp-assignee-label">Assignee:</span>
              <select className="hd-dp-assignee-select" defaultValue={selectedTicket.assignee}>
                <option>Unassigned</option>
                <option>Sarah</option>
                <option>Nat</option>
              </select>
            </div>

            {selectedTicket.aiSummary && (
              <div className="hd-ai-summary">
                <span className="hd-ai-icon">✦</span> AI Summary: {selectedTicket.aiSummary}
              </div>
            )}

            <div className="hd-dp-tabs">
              {(['Details', 'Transcript', 'Notes', 'Timeline'] as DetailTab[]).map((tab) => (
                <button key={tab} className={`hd-dp-tab${detailTab === tab ? ' active' : ''}`} onClick={() => setDetailTab(tab)}>{tab}</button>
              ))}
            </div>

            <div className="hd-dp-content">
              {detailTab === 'Details' && (
                <div className="hd-details-grid">
                  <DetailRow label="Customer" value={selectedTicket.customer} />
                  <DetailRow label="Email" value={selectedTicket.email || 'Not provided'} />
                  <DetailRow label="Phone" value={selectedTicket.phone || 'Not provided'} />
                  <DetailRow label="Source" value={selectedTicket.source} />
                  <DetailRow label="Created" value={`Today ${selectedTicket.time || ''}`} />
                  {selectedTicket.sla && <DetailRow label="SLA" value={selectedTicket.sla} valueClass={`sla-${selectedTicket.slaColor}`} />}
                  <DetailRow label="Queue" value={selectedTicket.queue || '—'} />
                </div>
              )}

              {detailTab === 'Transcript' && (
                <div className="hd-transcript">
                  {transcript.map((msg, i) => (
                    <div key={i} className={`hd-t-msg ${msg.role.toLowerCase()}`}>
                      <div className="hd-t-role">{msg.role}</div>
                      <div className="hd-t-text">{msg.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'Notes' && (
                <div className="hd-notes">
                  <div className="hd-note-existing">
                    <strong>Sarah — 9:45 AM:</strong> Forwarded to Nat for follow-up. High-value commercial lead.
                  </div>
                  <textarea className="hd-note-input" placeholder="Add internal note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
                  <button className="hd-note-btn">Add Note</button>
                </div>
              )}

              {detailTab === 'Timeline' && (
                <div className="hd-timeline">
                  {timeline.map((item, i) => (
                    <div key={i} className="hd-tl-item">
                      <div className="hd-tl-dot" />
                      <div className="hd-tl-content">
                        <span className="hd-tl-time">{item.time}</span>
                        <span className="hd-tl-event">{item.event}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div className="hd-stat-pill">
      <span className="hd-stat-dot" style={{ background: color }} />
      <span className="hd-stat-count">{count}</span>
      <span className="hd-stat-label">{label}</span>
    </div>
  );
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="hd-detail-row">
      <span className="hd-dr-label">{label}</span>
      <span className={`hd-dr-value${valueClass ? ` ${valueClass}` : ''}`}>{value}</span>
    </div>
  );
}
