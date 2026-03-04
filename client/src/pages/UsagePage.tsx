import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import '../styles/UsagePage.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface SummaryService {
  service: string;
  total_cost: number;
  total_calls: number;
  per_call: number;
}

interface Summary {
  total_cost: number;
  total_calls: number;
  bills_processed: number;
  by_service: SummaryService[];
}

interface LogEntry {
  id: string;
  created_at: string;
  module: string;
  customer_name: string | null;
  retailer: string | null;
  service: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number;
  status: string;
}

interface DailyPoint {
  day: string;
  cost: number;
}

function buildDailyChart(logs: LogEntry[], year: number, month: number): DailyPoint[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map: Record<number, number> = {};
  for (const l of logs) {
    const d = new Date(l.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      map[day] = (map[day] || 0) + Number(l.cost_usd);
    }
  }
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: String(i + 1),
    cost: Number((map[i + 1] || 0).toFixed(4)),
  }));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${time}`;
}

function getServiceLabel(service: string): string {
  if (service === 'google_vision') return 'Google Cloud Vision';
  if (service === 'claude_haiku') return 'Claude Haiku';
  if (service === 'claude_sonnet') return 'Claude Sonnet';
  return service;
}

function getServiceKey(service: string): 'vision' | 'haiku' | 'sonnet' | null {
  if (service === 'google_vision') return 'vision';
  if (service === 'claude_haiku') return 'haiku';
  if (service === 'claude_sonnet') return 'sonnet';
  return null;
}

interface GroupedRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  retailer: string | null;
  status: string;
  vision: number;
  haiku: number;
  sonnet: number;
}

function groupLogsByExtraction(logs: LogEntry[]): GroupedRow[] {
  const sonnetLogs = logs.filter((l) => l.service === 'claude_sonnet');
  return sonnetLogs.map((sl) => {
    const near = logs.filter((l) => {
      const diff = Math.abs(new Date(l.created_at).getTime() - new Date(sl.created_at).getTime());
      return diff < 120000;
    });
    const vision = near.filter((l) => l.service === 'google_vision').reduce((s, l) => s + Number(l.cost_usd), 0);
    const haiku = near.filter((l) => l.service === 'claude_haiku').reduce((s, l) => s + Number(l.cost_usd), 0);
    return {
      id: sl.id,
      created_at: sl.created_at,
      customer_name: sl.customer_name,
      retailer: sl.retailer,
      status: sl.status,
      vision,
      haiku,
      sonnet: Number(sl.cost_usd),
    };
  });
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i}>
          <div style={{ height: 14, borderRadius: 6, background: '#e5e5e7', width: i === 0 ? 90 : i === 1 ? 110 : 70 }} />
        </td>
      ))}
    </tr>
  );
}

export default function UsagePage() {
  const now = new Date();
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [budget, setBudget] = useState('50.00');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthParam = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, logRes] = await Promise.all([
        fetch(`/api/usage/summary?month=${monthParam}`),
        fetch(`/api/usage/log?month=${monthParam}&limit=50`),
      ]);
      if (!summaryRes.ok || !logRes.ok) throw new Error('Failed to fetch usage data');
      const [summaryData, logData] = await Promise.all([summaryRes.json(), logRes.json()]);
      setSummary(summaryData);
      setLogs(logData);
    } catch (e: any) {
      setError(e.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [monthParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    setMonthIndex((m) => {
      if (m === 0) { setYear((y) => y - 1); return 11; }
      return m - 1;
    });
  };
  const nextMonth = () => {
    setMonthIndex((m) => {
      if (m === 11) { setYear((y) => y + 1); return 0; }
      return m + 1;
    });
  };

  const dailyData = buildDailyChart(logs, year, monthIndex);
  const chartMax = Math.max(...dailyData.map((d) => d.cost), 0.5);

  const svc = (key: string) => summary?.by_service.find((s) => s.service === key);
  const visionSvc = svc('google_vision');
  const haikuSvc = svc('claude_haiku');
  const sonnetSvc = svc('claude_sonnet');

  const budgetNum = parseFloat(budget) || 50;
  const spent = summary?.total_cost || 0;
  const remaining = Math.max(budgetNum - spent, 0);
  const spentPct = budgetNum > 0 ? Math.min((spent / budgetNum) * 100, 100) : 0;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dayOfMonth = year === now.getFullYear() && monthIndex === now.getMonth() ? now.getDate() : daysInMonth;
  const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
  const estimated = dailyRate * daysInMonth;

  const grouped = groupLogsByExtraction(logs);
  const filtered = grouped.filter(
    (r) =>
      (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.retailer || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number) => `$${n.toFixed(4)}`;
  const fmtCost = (n: number) => `$${n.toFixed(2)}`;

  const isEmpty = !loading && logs.length === 0;

  return (
    <div className="usage-page">
      <div className="usage-header">
        <div className="usage-header-text">
          <h1>Usage & Costs</h1>
          <p>Track API usage and processing costs across all SolarOps modules</p>
        </div>
        <div className="usage-month-selector">
          <button onClick={prevMonth}>‹</button>
          <span>{MONTHS[monthIndex]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#FF453A', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div className="usage-stats-bar">
        <div className="usage-stat-card">
          <div className="usage-stat-label">Total Spent This Month</div>
          <div className="usage-stat-value">
            {loading ? <div style={{ height: 28, width: 80, borderRadius: 6, background: '#e5e5e7' }} /> : fmtCost(spent)}
          </div>
          <div className="usage-stat-sub">Across all API services</div>
        </div>
        <div className="usage-stat-card">
          <div className="usage-stat-label">Bills Processed</div>
          <div className="usage-stat-value">
            {loading ? <div style={{ height: 28, width: 60, borderRadius: 6, background: '#e5e5e7' }} /> : summary?.bills_processed ?? 0}
          </div>
          <div className="usage-stat-sub">Successful extractions</div>
        </div>
        <div className="usage-stat-card">
          <div className="usage-stat-label">Total API Calls</div>
          <div className="usage-stat-value">
            {loading ? <div style={{ height: 28, width: 60, borderRadius: 6, background: '#e5e5e7' }} /> : summary?.total_calls ?? 0}
          </div>
          <div className="usage-stat-sub">Across all services</div>
        </div>
        <div className="usage-stat-card">
          <div className="usage-stat-label">Budget Remaining</div>
          <div className="usage-stat-value" style={{ color: '#34C759' }}>
            {loading ? <div style={{ height: 28, width: 80, borderRadius: 6, background: '#e5e5e7' }} /> : fmtCost(remaining)}
          </div>
          <div className="usage-progress-track">
            <div className="usage-progress-fill" style={{ width: `${spentPct}%` }} />
          </div>
          <div className="usage-stat-sub">{spentPct.toFixed(1)}% of {fmtCost(budgetNum)} budget used</div>
        </div>
      </div>

      <div className="usage-section-label">Cost by Service</div>
      <div className="usage-service-cards">
        <div className="usage-service-card blue">
          <div className="usage-service-header">
            <div className="usage-service-icon">👁</div>
            <div>
              <div className="usage-service-name">Google Cloud Vision</div>
              <div className="usage-service-label">OCR Processing</div>
            </div>
          </div>
          <div className="usage-service-cost">
            {loading ? <div style={{ height: 24, width: 60, borderRadius: 6, background: '#e5e5e7' }} /> : fmtCost(visionSvc?.total_cost || 0)}
          </div>
          <div className="usage-service-meta">
            <div className="usage-service-meta-item">
              <span className="meta-label">Calls</span>
              <span className="meta-value">{loading ? '—' : visionSvc?.total_calls ?? 0}</span>
            </div>
            <div className="usage-service-meta-item">
              <span className="meta-label">Per Call</span>
              <span className="meta-value">{loading ? '—' : fmt(visionSvc?.per_call || 0)}</span>
            </div>
          </div>
        </div>

        <div className="usage-service-card purple">
          <div className="usage-service-header">
            <div className="usage-service-icon">⚡</div>
            <div>
              <div className="usage-service-name">Claude Haiku</div>
              <div className="usage-service-label">Bill Pre-check</div>
            </div>
          </div>
          <div className="usage-service-cost">
            {loading ? <div style={{ height: 24, width: 60, borderRadius: 6, background: '#e5e5e7' }} /> : fmtCost(haikuSvc?.total_cost || 0)}
          </div>
          <div className="usage-service-meta">
            <div className="usage-service-meta-item">
              <span className="meta-label">Calls</span>
              <span className="meta-value">{loading ? '—' : haikuSvc?.total_calls ?? 0}</span>
            </div>
            <div className="usage-service-meta-item">
              <span className="meta-label">Per Call</span>
              <span className="meta-value">{loading ? '—' : fmt(haikuSvc?.per_call || 0)}</span>
            </div>
          </div>
        </div>

        <div className="usage-service-card orange">
          <div className="usage-service-header">
            <div className="usage-service-icon">✦</div>
            <div>
              <div className="usage-service-name">Claude Sonnet</div>
              <div className="usage-service-label">Data Extraction</div>
            </div>
          </div>
          <div className="usage-service-cost">
            {loading ? <div style={{ height: 24, width: 60, borderRadius: 6, background: '#e5e5e7' }} /> : fmtCost(sonnetSvc?.total_cost || 0)}
          </div>
          <div className="usage-service-meta">
            <div className="usage-service-meta-item">
              <span className="meta-label">Calls</span>
              <span className="meta-value">{loading ? '—' : sonnetSvc?.total_calls ?? 0}</span>
            </div>
            <div className="usage-service-meta-item">
              <span className="meta-label">Per Call</span>
              <span className="meta-value">{loading ? '—' : fmt(sonnetSvc?.per_call || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="usage-card">
        <div className="usage-section-label">Daily Spend — {MONTHS[monthIndex]} {year}</div>
        {isEmpty ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6e73', fontSize: '0.875rem' }}>
            No spend data for this month
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#6e6e73' }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tickFormatter={(v) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 11, fill: '#6e6e73' }}
                axisLine={false}
                tickLine={false}
                domain={[0, chartMax * 1.2]}
                width={52}
              />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(4)}`, 'Spend']}
                labelFormatter={(l) => `Day ${l}`}
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e7', fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#4F8EF7"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#4F8EF7' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="usage-card">
        <div className="usage-card-header">
          <div className="usage-section-label" style={{ marginBottom: 0 }}>Extraction Cost Log</div>
        </div>
        <div className="usage-table-controls">
          <input
            className="usage-search"
            placeholder="Search by customer or retailer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="usage-export-btn" disabled>Export CSV</button>
        </div>
        <div className="usage-table-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Retailer</th>
                <th>Vision</th>
                <th>Haiku</th>
                <th>Sonnet</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : isEmpty ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: '#6e6e73', fontSize: '0.875rem' }}>
                    No extractions this month
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0', color: '#6e6e73', fontSize: '0.875rem' }}>
                    No results matching your search
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td style={{ color: '#6e6e73', whiteSpace: 'nowrap' }}>{formatTime(row.created_at)}</td>
                      <td style={{ fontWeight: 500 }}>{row.customer_name || '—'}</td>
                      <td>{row.retailer || '—'}</td>
                      <td>{fmt(row.vision)}</td>
                      <td>{fmt(row.haiku)}</td>
                      <td>{fmt(row.sonnet)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(row.vision + row.haiku + row.sonnet)}</td>
                      <td>
                        <span className={`usage-status-pill ${row.status === 'success' ? 'extracted' : row.status === 'rejected' ? 'failed' : 'pending'}`}>
                          {row.status === 'success' ? 'Extracted' : row.status === 'rejected' ? 'Failed' : 'Pending Review'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={3}>Total ({filtered.length} extractions)</td>
                    <td>{fmt(filtered.reduce((s, r) => s + r.vision, 0))}</td>
                    <td>{fmt(filtered.reduce((s, r) => s + r.haiku, 0))}</td>
                    <td>{fmt(filtered.reduce((s, r) => s + r.sonnet, 0))}</td>
                    <td>{fmt(filtered.reduce((s, r) => s + r.vision + r.haiku + r.sonnet, 0))}</td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="usage-card" style={{ marginBottom: 0 }}>
        <div className="usage-section-label">Monthly Budget</div>
        <div className="usage-budget-grid">
          <div>
            <div className="usage-budget-field" style={{ marginBottom: 16 }}>
              <label>Budget limit (USD/month)</label>
              <input
                className="usage-budget-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <div className="usage-budget-field">
              <label>Alert Threshold (%)</label>
              <input
                className="usage-budget-input"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="80"
              />
            </div>
            <button className="usage-save-btn">Save Budget</button>
          </div>
          <div>
            <div className="usage-budget-info-row">
              <span className="label">Current spend</span>
              <span className="value">{fmtCost(spent)}</span>
            </div>
            <div className="usage-budget-info-row" style={{ marginTop: 12 }}>
              <span className="label">Estimated end of month</span>
              <span className="value">{fmtCost(estimated)}</span>
            </div>
            <div className="usage-budget-info-row" style={{ marginTop: 12 }}>
              <span className="label">Budget remaining</span>
              <span className="value" style={{ color: '#34C759' }}>{fmtCost(remaining)}</span>
            </div>
            <div className="usage-budget-info-row" style={{ marginTop: 16 }}>
              <span className="label">Status</span>
              <span className="usage-on-track-pill">✓ On track</span>
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.75rem', color: '#6e6e73', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Budget Used
              </div>
              <div className="usage-progress-track">
                <div className="usage-progress-fill" style={{ width: `${spentPct}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: '#6e6e73' }}>
                <span>{fmtCost(spent)} used</span>
                <span>{fmtCost(budgetNum)} budget</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
