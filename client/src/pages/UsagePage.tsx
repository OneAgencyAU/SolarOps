import { useState } from 'react';
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

const dailyData = [
  { day: '1', cost: 0.12 }, { day: '2', cost: 0.08 }, { day: '3', cost: 0.41 },
  { day: '4', cost: 0.55 }, { day: '5', cost: 0.62 }, { day: '6', cost: 0.47 },
  { day: '7', cost: 0.18 }, { day: '8', cost: 0.07 }, { day: '9', cost: 0.38 },
  { day: '10', cost: 0.71 }, { day: '11', cost: 0.58 }, { day: '12', cost: 0.44 },
  { day: '13', cost: 0.63 }, { day: '14', cost: 0.79 }, { day: '15', cost: 0.11 },
  { day: '16', cost: 0.06 }, { day: '17', cost: 0.52 }, { day: '18', cost: 0.34 },
  { day: '19', cost: 0.48 }, { day: '20', cost: 0.61 }, { day: '21', cost: 0.39 },
  { day: '22', cost: 0.09 }, { day: '23', cost: 0.05 }, { day: '24', cost: 0.28 },
  { day: '25', cost: 0.45 }, { day: '26', cost: 0.37 }, { day: '27', cost: 0.22 },
  { day: '28', cost: 0.14 }, { day: '29', cost: 0.10 }, { day: '30', cost: 0.08 },
  { day: '31', cost: 0.00 },
];

interface LogRow {
  time: string;
  customer: string;
  retailer: string;
  vision: number;
  haiku: number;
  sonnet: number;
  status: 'extracted' | 'failed' | 'pending';
}

const logRows: LogRow[] = [
  { time: 'Today 10:23am', customer: 'James Hartley', retailer: 'AGL', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: 'Today 9:41am', customer: 'Rachel Wong', retailer: 'Origin Energy', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: 'Yesterday 4:02pm', customer: 'Mark Deluca', retailer: 'Amber Electric', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'pending' },
  { time: 'Yesterday 1:17pm', customer: 'Priya Sharma', retailer: 'AGL', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: 'Yesterday 11:55am', customer: 'Mike Chen', retailer: 'Energy Australia', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: '28 Feb 3:30pm', customer: 'Sophie Turner', retailer: 'SA Power Networks', vision: 0.0015, haiku: 0.0002, sonnet: 0.0000, status: 'failed' },
  { time: '28 Feb 2:14pm', customer: 'Liam Nguyen', retailer: 'Red Energy', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: '27 Feb 9:03am', customer: 'Emily Zhao', retailer: 'Origin Energy', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: '26 Feb 11:40am', customer: 'Ben McAllister', retailer: 'AGL', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
  { time: '25 Feb 8:22am', customer: 'Chloe Park', retailer: 'Amber Electric', vision: 0.0015, haiku: 0.0002, sonnet: 0.0178, status: 'extracted' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function UsagePage() {
  const [monthIndex, setMonthIndex] = useState(2);
  const [year] = useState(2026);
  const [search, setSearch] = useState('');
  const [budget, setBudget] = useState('50.00');
  const [alertThreshold, setAlertThreshold] = useState('80');

  const prevMonth = () => setMonthIndex((m) => (m === 0 ? 11 : m - 1));
  const nextMonth = () => setMonthIndex((m) => (m === 11 ? 0 : m + 1));

  const filteredRows = logRows.filter(
    (r) =>
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.retailer.toLowerCase().includes(search.toLowerCase())
  );

  const totalVision = logRows.reduce((s, r) => s + r.vision, 0);
  const totalHaiku = logRows.reduce((s, r) => s + r.haiku, 0);
  const totalSonnet = logRows.reduce((s, r) => s + r.sonnet, 0);
  const grandTotal = totalVision + totalHaiku + totalSonnet;

  const fmt = (n: number) => `$${n.toFixed(4)}`;

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

      <div className="usage-stats-bar">
        <div className="usage-stat-card">
          <div className="usage-stat-label">Total Spent This Month</div>
          <div className="usage-stat-value">$4.82</div>
          <div className="usage-stat-sub">Across all API services</div>
        </div>
        <div className="usage-stat-card">
          <div className="usage-stat-label">Bills Processed</div>
          <div className="usage-stat-value">247</div>
          <div className="usage-stat-sub">Successful extractions</div>
        </div>
        <div className="usage-stat-card">
          <div className="usage-stat-label">Total API Calls</div>
          <div className="usage-stat-value">741</div>
          <div className="usage-stat-sub">3 calls per bill</div>
        </div>
        <div className="usage-stat-card">
          <div className="usage-stat-label">Budget Remaining</div>
          <div className="usage-stat-value" style={{ color: '#34C759' }}>$45.18</div>
          <div className="usage-progress-track">
            <div className="usage-progress-fill" style={{ width: '9.6%' }} />
          </div>
          <div className="usage-stat-sub">9.6% of $50.00 budget used</div>
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
          <div className="usage-service-cost">$0.37</div>
          <div className="usage-service-meta">
            <div className="usage-service-meta-item">
              <span className="meta-label">Calls</span>
              <span className="meta-value">247</span>
            </div>
            <div className="usage-service-meta-item">
              <span className="meta-label">Per Call</span>
              <span className="meta-value">$0.0015</span>
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
          <div className="usage-service-cost">$0.05</div>
          <div className="usage-service-meta">
            <div className="usage-service-meta-item">
              <span className="meta-label">Calls</span>
              <span className="meta-value">247</span>
            </div>
            <div className="usage-service-meta-item">
              <span className="meta-label">Per Call</span>
              <span className="meta-value">$0.0002</span>
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
          <div className="usage-service-cost">$4.40</div>
          <div className="usage-service-meta">
            <div className="usage-service-meta-item">
              <span className="meta-label">Calls</span>
              <span className="meta-value">247</span>
            </div>
            <div className="usage-service-meta-item">
              <span className="meta-label">Per Call</span>
              <span className="meta-value">$0.0178</span>
            </div>
          </div>
        </div>
      </div>

      <div className="usage-card">
        <div className="usage-section-label">Daily Spend — {MONTHS[monthIndex]} {year}</div>
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
              domain={[0, 1.0]}
              width={48}
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spend']}
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
              {filteredRows.map((row, i) => (
                <tr key={i}>
                  <td style={{ color: '#6e6e73', whiteSpace: 'nowrap' }}>{row.time}</td>
                  <td style={{ fontWeight: 500 }}>{row.customer}</td>
                  <td>{row.retailer}</td>
                  <td>{fmt(row.vision)}</td>
                  <td>{fmt(row.haiku)}</td>
                  <td>{fmt(row.sonnet)}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(row.vision + row.haiku + row.sonnet)}</td>
                  <td>
                    <span className={`usage-status-pill ${row.status}`}>
                      {row.status === 'extracted' ? 'Extracted' : row.status === 'failed' ? 'Failed' : 'Pending Review'}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}>Total ({filteredRows.length} extractions)</td>
                <td>{fmt(filteredRows.reduce((s, r) => s + r.vision, 0))}</td>
                <td>{fmt(filteredRows.reduce((s, r) => s + r.haiku, 0))}</td>
                <td>{fmt(filteredRows.reduce((s, r) => s + r.sonnet, 0))}</td>
                <td>{fmt(filteredRows.reduce((s, r) => s + r.vision + r.haiku + r.sonnet, 0))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="usage-card" style={{ marginBottom: 0 }}>
        <div className="usage-section-label">Monthly Budget</div>
        <div className="usage-budget-grid">
          <div>
            <div className="usage-budget-field" style={{ marginBottom: 16 }}>
              <label>Monthly Budget</label>
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
              <span className="value">$4.82</span>
            </div>
            <div className="usage-budget-info-row" style={{ marginTop: 12 }}>
              <span className="label">Estimated end of month</span>
              <span className="value">$7.20</span>
            </div>
            <div className="usage-budget-info-row" style={{ marginTop: 12 }}>
              <span className="label">Budget remaining</span>
              <span className="value" style={{ color: '#34C759' }}>$45.18</span>
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
                <div className="usage-progress-fill" style={{ width: '9.6%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: '#6e6e73' }}>
                <span>$4.82 used</span>
                <span>${budget || '50.00'} budget</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
