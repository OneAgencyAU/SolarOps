import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/QuotesPage.css';

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  property_address: string | null;
  system_size_kw: number | null;
  quote_value: number | null;
  status: string;
  expiry_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_quoted: number;
  accepted_count: number;
  accepted_pct: number;
  avg_quote_value: number;
  avg_acceptance_days: number;
  total_count: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  Draft:    { color: '#6e6e73', bg: '#f5f5f7' },
  Sent:     { color: '#4F8EF7', bg: 'rgba(79,142,247,0.10)' },
  Accepted: { color: '#34C759', bg: 'rgba(52,199,89,0.10)' },
  Declined: { color: '#FF453A', bg: 'rgba(255,69,58,0.10)' },
  Expired:  { color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function QuotesPage() {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [quotesRes, statsRes] = await Promise.all([
        fetch(`/api/quotes/list?tenant_id=${tenantId}`),
        fetch(`/api/quotes/stats?tenant_id=${tenantId}`),
      ]);
      const quotesData = await quotesRes.json();
      const statsData = await statsRes.json();
      if (Array.isArray(quotesData)) setQuotes(quotesData);
      if (statsData && !statsData.error) setStats(statsData);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="qt-page">
      {/* Header */}
      <div className="qt-header">
        <div>
          <h1 className="qt-title">Quotes</h1>
          <p className="qt-subtitle">Manage solar installation quotes</p>
        </div>
        <button className="qt-btn primary" onClick={() => navigate('/quotes/new')}>
          + Create New Quote
        </button>
      </div>

      {/* Analytics bar */}
      <div className="qt-stats-row">
        <div className="qt-stat-pill">
          <span className="qt-stat-dot" style={{ background: '#4F8EF7' }} />
          <span className="qt-stat-count">{stats ? formatCurrency(stats.total_quoted) : '$0'}</span>
          <span className="qt-stat-label">Total Quoted</span>
        </div>
        <div className="qt-stat-pill">
          <span className="qt-stat-dot" style={{ background: '#34C759' }} />
          <span className="qt-stat-count">
            {stats ? stats.accepted_count : 0}
            {stats && stats.total_count > 0 ? ` (${stats.accepted_pct}%)` : ''}
          </span>
          <span className="qt-stat-label">Accepted</span>
        </div>
        <div className="qt-stat-pill">
          <span className="qt-stat-dot" style={{ background: '#AF52DE' }} />
          <span className="qt-stat-count">{stats ? formatCurrency(stats.avg_quote_value) : '$0'}</span>
          <span className="qt-stat-label">Avg Quote Value</span>
        </div>
        <div className="qt-stat-pill">
          <span className="qt-stat-dot" style={{ background: '#FF9500' }} />
          <span className="qt-stat-count">{stats ? `${stats.avg_acceptance_days}d` : '—'}</span>
          <span className="qt-stat-label">Avg Acceptance Time</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="qt-empty">Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <div className="qt-card">
          <div className="qt-empty">
            <div className="qt-empty-icon">&#x1F4CB;</div>
            <div className="qt-empty-text">No quotes yet</div>
            <p className="qt-empty-sub">Create your first quote to get started.</p>
          </div>
        </div>
      ) : (
        <div className="qt-card">
          <div className="qt-table-header">
            <span>Quote #</span>
            <span>Customer Name</span>
            <span>Property Address</span>
            <span>System Size</span>
            <span>Quote Value</span>
            <span>Status</span>
            <span>Created</span>
            <span>Expiry</span>
          </div>
          {quotes.map(q => {
            const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.Draft;
            return (
              <div key={q.id} className="qt-table-row">
                <span className="qt-cell-number">{q.quote_number}</span>
                <span className="qt-cell-name">{q.customer_name || '—'}</span>
                <span className="qt-cell-address">{q.property_address || '—'}</span>
                <span>{q.system_size_kw != null ? `${q.system_size_kw} kW` : '—'}</span>
                <span className="qt-cell-value">{q.quote_value != null ? formatCurrency(q.quote_value) : '—'}</span>
                <span>
                  <span className="qt-status-pill" style={{ color: sc.color, background: sc.bg }}>
                    {q.status}
                  </span>
                </span>
                <span className="qt-cell-date">{formatDate(q.created_at)}</span>
                <span className="qt-cell-date">{q.expiry_date ? formatDate(q.expiry_date) : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
