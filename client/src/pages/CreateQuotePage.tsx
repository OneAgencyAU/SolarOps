import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/CreateQuotePage.css';

const STEPS = ['Customer', 'Roof Assessment', 'System Config', 'Financial Summary', 'Review & Output'];

function fmt$(v: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function CreateQuotePage() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Step 1: Customer ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  // ── Step 2: Roof Assessment ──
  const [totalRoofArea, setTotalRoofArea] = useState('');
  const [usableRoofArea, setUsableRoofArea] = useState('');
  const [roofPitch, setRoofPitch] = useState('');
  const [roofPlanes, setRoofPlanes] = useState('');
  const [existingSolar, setExistingSolar] = useState(false);
  const [roofObstacles, setRoofObstacles] = useState('');

  // ── Step 3: System Config ──
  const [systemSizeKw, setSystemSizeKw] = useState('');
  const [installType, setInstallType] = useState<'residential' | 'commercial'>('residential');
  const [includeBattery, setIncludeBattery] = useState(false);
  // Panels
  const [panelBrand, setPanelBrand] = useState('');
  const [panelQty, setPanelQty] = useState('');
  const [panelUnitPrice, setPanelUnitPrice] = useState('');
  // Inverter
  const [inverterBrand, setInverterBrand] = useState('');
  const [inverterQty, setInverterQty] = useState('');
  const [inverterUnitPrice, setInverterUnitPrice] = useState('');
  // Battery
  const [batteryBrand, setBatteryBrand] = useState('');
  const [batteryQty, setBatteryQty] = useState('');
  const [batteryUnitPrice, setBatteryUnitPrice] = useState('');

  // ── Step 4: Financial ──
  const [stcRebate, setStcRebate] = useState('');
  const [assumptions, setAssumptions] = useState(
    'Estimated generation based on Adelaide average of 1,460 kWh/kW/year. Feed-in tariff assumed at $0.28/kWh. Actual savings may vary based on usage patterns, shading, and retailer rates.'
  );

  // ── Step 5: Review ──
  const [expiryDate, setExpiryDate] = useState(fmtDate(new Date(Date.now() + 30 * 86400000)));
  const [termsConditions, setTermsConditions] = useState('');

  // ── Derived calculations ──
  const usableArea = parseFloat(usableRoofArea) || 0;
  const recommendedSize = usableArea > 0 ? parseFloat((usableArea * 0.15).toFixed(1)) : 0;
  const sizeKw = parseFloat(systemSizeKw) || recommendedSize;

  const panelTotal = (parseFloat(panelQty) || 0) * (parseFloat(panelUnitPrice) || 0);
  const inverterTotal = (parseFloat(inverterQty) || 0) * (parseFloat(inverterUnitPrice) || 0);
  const batteryTotal = includeBattery ? (parseFloat(batteryQty) || 0) * (parseFloat(batteryUnitPrice) || 0) : 0;
  const quoteTotal = panelTotal + inverterTotal + batteryTotal;

  const annualGeneration = Math.round(sizeKw * 1460);
  const annualSavings = Math.round(annualGeneration * 0.28);
  const paybackYears = annualSavings > 0 ? parseFloat((quoteTotal / annualSavings).toFixed(1)) : 0;
  const roi10 = Math.round(annualSavings * 10 - quoteTotal);
  const roi25 = Math.round(annualSavings * 25 - quoteTotal);

  // Auto-fill recommended size when entering step 3 for the first time
  const goToStep = (s: number) => {
    if (s === 2 && !systemSizeKw && recommendedSize > 0) {
      setSystemSizeKw(recommendedSize.toString());
    }
    setStep(s);
  };

  // ── Search handler (placeholder) ──
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setTimeout(() => setSearching(false), 1500);
  };

  // ── Save draft ──
  const handleSaveDraft = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/quotes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          property_address: propertyAddress || null,
          system_size_kw: sizeKw || null,
          quote_value: quoteTotal || null,
          expiry_date: expiryDate || null,
          created_by: user?.displayName || user?.email || null,
          quote_data: {
            roof: { totalRoofArea, usableRoofArea, roofPitch, roofPlanes, existingSolar, roofObstacles },
            system: { installType, includeBattery, panelBrand, panelQty, panelUnitPrice, inverterBrand, inverterQty, inverterUnitPrice, batteryBrand, batteryQty, batteryUnitPrice },
            financial: { annualGeneration, annualSavings, paybackYears, roi10, roi25, stcRebate, assumptions },
            review: { expiryDate, termsConditions },
          },
        }),
      });
      if (res.ok) {
        navigate('/quotes');
      } else {
        const data = await res.json();
        setToast(data.error || 'Failed to save quote');
      }
    } catch {
      setToast('Network error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="cq-page">
      {/* Header + progress */}
      <div className="cq-topbar">
        <button className="cq-back" onClick={() => navigate('/quotes')}>&larr; Back to Quotes</button>
        <h1 className="cq-page-title">Create New Quote</h1>
        <div className="cq-progress">
          {STEPS.map((label, i) => (
            <div key={i} className={`cq-step ${i < step ? 'done' : i === step ? 'active' : ''}`} onClick={() => i <= step && setStep(i)}>
              <div className="cq-step-num">{i < step ? '\u2713' : i + 1}</div>
              <span className="cq-step-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cq-body">
        {/* Main content */}
        <div className="cq-main">
          {/* ────────── Step 1: Customer ────────── */}
          {step === 0 && (
            <div className="cq-card">
              <h2 className="cq-card-title">Customer Details</h2>

              <div className="cq-search-row">
                <input
                  className="cq-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name, email, phone or NMI"
                />
                <button className="cq-btn primary" onClick={handleSearch} disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searching && <div className="cq-search-status">Searching...</div>}

              <div className="cq-form-grid">
                <div className="cq-field">
                  <label className="cq-label">Customer Name</label>
                  <input className="cq-input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. John Smith" />
                </div>
                <div className="cq-field">
                  <label className="cq-label">Email</label>
                  <input className="cq-input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="john@example.com" />
                </div>
                <div className="cq-field">
                  <label className="cq-label">Phone</label>
                  <input className="cq-input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="04XX XXX XXX" />
                </div>
                <div className="cq-field full">
                  <label className="cq-label">Property Address</label>
                  <input className="cq-input" value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="123 Main St, Adelaide SA 5000" />
                </div>
              </div>

              <div className="cq-actions">
                <div />
                <button className="cq-btn primary" onClick={() => goToStep(1)}>Next: Roof Assessment</button>
              </div>
            </div>
          )}

          {/* ────────── Step 2: Roof Assessment ────────── */}
          {step === 1 && (
            <div className="cq-card">
              <h2 className="cq-card-title">Roof Assessment</h2>

              <div className="cq-field full">
                <label className="cq-label">Property Address</label>
                <input className="cq-input" value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} />
              </div>

              <div className="cq-map-placeholder">
                <div className="cq-map-pin">&#x1F4CD;</div>
                <div className="cq-map-text">Nearmap imagery will load here</div>
              </div>

              <div className="cq-form-grid">
                <div className="cq-field">
                  <label className="cq-label">Total Roof Area (m&sup2;)</label>
                  <input className="cq-input" type="number" value={totalRoofArea} onChange={e => setTotalRoofArea(e.target.value)} placeholder="e.g. 180" />
                </div>
                <div className="cq-field">
                  <label className="cq-label">Usable Roof Area (m&sup2;)</label>
                  <input className="cq-input" type="number" value={usableRoofArea} onChange={e => setUsableRoofArea(e.target.value)} placeholder="e.g. 120" />
                </div>
                <div className="cq-field">
                  <label className="cq-label">Roof Pitch (degrees)</label>
                  <input className="cq-input" type="number" value={roofPitch} onChange={e => setRoofPitch(e.target.value)} placeholder="e.g. 22" />
                </div>
                <div className="cq-field">
                  <label className="cq-label">Number of Roof Planes</label>
                  <input className="cq-input" type="number" value={roofPlanes} onChange={e => setRoofPlanes(e.target.value)} placeholder="e.g. 2" />
                </div>
                <div className="cq-field">
                  <label className="cq-label">Existing Solar Installed</label>
                  <button className={`cq-toggle ${existingSolar ? 'on' : ''}`} onClick={() => setExistingSolar(v => !v)}>
                    <span className="cq-toggle-thumb" />
                    <span className="cq-toggle-label">{existingSolar ? 'Yes' : 'No'}</span>
                  </button>
                </div>
                <div className="cq-field">
                  <label className="cq-label">Roof Obstacles</label>
                  <input className="cq-input" value={roofObstacles} onChange={e => setRoofObstacles(e.target.value)} placeholder="e.g. HVAC unit, skylight" />
                </div>
              </div>

              <div className="cq-actions">
                <button className="cq-btn" onClick={() => setStep(0)}>Back</button>
                <button className="cq-btn primary" onClick={() => goToStep(2)}>Next: System Config</button>
              </div>
            </div>
          )}

          {/* ────────── Step 3: System Configuration ────────── */}
          {step === 2 && (
            <div className="cq-card">
              <h2 className="cq-card-title">System Configuration</h2>

              <div className="cq-form-grid">
                <div className="cq-field">
                  <label className="cq-label">Recommended System Size (kW)</label>
                  <input className="cq-input" type="number" step="0.1" value={systemSizeKw} onChange={e => setSystemSizeKw(e.target.value)} placeholder="Auto-calculated" />
                  {recommendedSize > 0 && <span className="cq-hint">Suggested: {recommendedSize} kW (usable area &times; 0.15)</span>}
                </div>
                <div className="cq-field">
                  <label className="cq-label">Install Type</label>
                  <div className="cq-toggle-group">
                    <button className={`cq-toggle-opt ${installType === 'residential' ? 'active' : ''}`} onClick={() => setInstallType('residential')}>Residential</button>
                    <button className={`cq-toggle-opt ${installType === 'commercial' ? 'active' : ''}`} onClick={() => setInstallType('commercial')}>Commercial</button>
                  </div>
                </div>
                <div className="cq-field">
                  <label className="cq-label">Include Battery</label>
                  <button className={`cq-toggle ${includeBattery ? 'on' : ''}`} onClick={() => setIncludeBattery(v => !v)}>
                    <span className="cq-toggle-thumb" />
                    <span className="cq-toggle-label">{includeBattery ? 'Yes' : 'No'}</span>
                  </button>
                </div>
              </div>

              {/* Product selectors */}
              <div className="cq-products">
                <ProductSection
                  title="Panels"
                  brand={panelBrand} setBrand={setPanelBrand}
                  qty={panelQty} setQty={setPanelQty}
                  unitPrice={panelUnitPrice} setUnitPrice={setPanelUnitPrice}
                  total={panelTotal}
                />
                <ProductSection
                  title="Inverter"
                  brand={inverterBrand} setBrand={setInverterBrand}
                  qty={inverterQty} setQty={setInverterQty}
                  unitPrice={inverterUnitPrice} setUnitPrice={setInverterUnitPrice}
                  total={inverterTotal}
                />
                {includeBattery && (
                  <ProductSection
                    title="Battery"
                    brand={batteryBrand} setBrand={setBatteryBrand}
                    qty={batteryQty} setQty={setBatteryQty}
                    unitPrice={batteryUnitPrice} setUnitPrice={setBatteryUnitPrice}
                    total={batteryTotal}
                  />
                )}
              </div>

              <div className="cq-quote-total">
                <span>Quote Total</span>
                <span className="cq-quote-total-value">{fmt$(quoteTotal)}</span>
              </div>

              <div className="cq-actions">
                <button className="cq-btn" onClick={() => setStep(1)}>Back</button>
                <button className="cq-btn primary" onClick={() => setStep(3)}>Next: Financial Summary</button>
              </div>
            </div>
          )}

          {/* ────────── Step 4: Financial Summary ────────── */}
          {step === 3 && (
            <div className="cq-card">
              <h2 className="cq-card-title">Financial Summary</h2>

              <div className="cq-fin-grid">
                <FinCard label="System Size" value={`${sizeKw} kW`} />
                <FinCard label="Est. Annual Generation" value={`${annualGeneration.toLocaleString()} kWh`} />
                <FinCard label="Est. Annual Savings" value={fmt$(annualSavings)} />
                <FinCard label="Payback Period" value={paybackYears > 0 ? `${paybackYears} years` : '—'} />
                <FinCard label="10-Year ROI" value={fmt$(roi10)} highlight={roi10 > 0} />
                <FinCard label="25-Year ROI" value={fmt$(roi25)} highlight={roi25 > 0} />
              </div>

              <div className="cq-form-grid" style={{ marginTop: 24 }}>
                <div className="cq-field">
                  <label className="cq-label">STC Rebate Estimate ($)</label>
                  <input className="cq-input" type="number" value={stcRebate} onChange={e => setStcRebate(e.target.value)} placeholder="e.g. 3500" />
                </div>
              </div>

              <div className="cq-field full" style={{ marginTop: 16 }}>
                <label className="cq-label">Assumptions &amp; Notes</label>
                <textarea className="cq-textarea" rows={4} value={assumptions} onChange={e => setAssumptions(e.target.value)} />
              </div>

              <div className="cq-actions">
                <button className="cq-btn" onClick={() => setStep(2)}>Back</button>
                <button className="cq-btn primary" onClick={() => setStep(4)}>Next: Review &amp; Output</button>
              </div>
            </div>
          )}

          {/* ────────── Step 5: Review & Output ────────── */}
          {step === 4 && (
            <div className="cq-card">
              <h2 className="cq-card-title">Review &amp; Output</h2>

              <div className="cq-review-section">
                <h3 className="cq-review-heading">Customer</h3>
                <div className="cq-review-grid">
                  <ReviewRow label="Name" value={customerName} />
                  <ReviewRow label="Email" value={customerEmail} />
                  <ReviewRow label="Phone" value={customerPhone} />
                  <ReviewRow label="Property Address" value={propertyAddress} />
                </div>
              </div>

              <div className="cq-review-section">
                <h3 className="cq-review-heading">Roof Assessment</h3>
                <div className="cq-review-grid">
                  <ReviewRow label="Total Roof Area" value={totalRoofArea ? `${totalRoofArea} m\u00B2` : ''} />
                  <ReviewRow label="Usable Roof Area" value={usableRoofArea ? `${usableRoofArea} m\u00B2` : ''} />
                  <ReviewRow label="Roof Pitch" value={roofPitch ? `${roofPitch}\u00B0` : ''} />
                  <ReviewRow label="Roof Planes" value={roofPlanes} />
                  <ReviewRow label="Existing Solar" value={existingSolar ? 'Yes' : 'No'} />
                  <ReviewRow label="Obstacles" value={roofObstacles} />
                </div>
              </div>

              <div className="cq-review-section">
                <h3 className="cq-review-heading">System Configuration</h3>
                <div className="cq-review-grid">
                  <ReviewRow label="System Size" value={`${sizeKw} kW`} />
                  <ReviewRow label="Install Type" value={installType === 'residential' ? 'Residential' : 'Commercial'} />
                  <ReviewRow label="Include Battery" value={includeBattery ? 'Yes' : 'No'} />
                  <ReviewRow label="Panels" value={panelBrand ? `${panelBrand} \u00D7 ${panelQty}` : ''} />
                  <ReviewRow label="Inverter" value={inverterBrand ? `${inverterBrand} \u00D7 ${inverterQty}` : ''} />
                  {includeBattery && <ReviewRow label="Battery" value={batteryBrand ? `${batteryBrand} \u00D7 ${batteryQty}` : ''} />}
                  <ReviewRow label="Quote Total" value={fmt$(quoteTotal)} />
                </div>
              </div>

              <div className="cq-review-section">
                <h3 className="cq-review-heading">Financial</h3>
                <div className="cq-review-grid">
                  <ReviewRow label="Annual Generation" value={`${annualGeneration.toLocaleString()} kWh`} />
                  <ReviewRow label="Annual Savings" value={fmt$(annualSavings)} />
                  <ReviewRow label="Payback Period" value={paybackYears > 0 ? `${paybackYears} years` : '—'} />
                  <ReviewRow label="STC Rebate" value={stcRebate ? fmt$(parseFloat(stcRebate)) : '—'} />
                </div>
              </div>

              <div className="cq-form-grid" style={{ marginTop: 20 }}>
                <div className="cq-field">
                  <label className="cq-label">Expiry Date</label>
                  <input className="cq-input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>
                <div className="cq-field full">
                  <label className="cq-label">Terms &amp; Conditions (optional)</label>
                  <textarea className="cq-textarea" rows={3} value={termsConditions} onChange={e => setTermsConditions(e.target.value)} placeholder="Add any terms and conditions..." />
                </div>
              </div>

              <div className="cq-actions cq-actions-final">
                <button className="cq-btn" onClick={() => setStep(3)}>Back</button>
                <div className="cq-actions-right">
                  <button className="cq-btn" onClick={() => showToast('Coming soon')}>Generate PDF</button>
                  <button className="cq-btn" onClick={() => showToast('Coming soon')}>Send via Email</button>
                  <button className="cq-btn primary" disabled={saving} onClick={handleSaveDraft}>
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Context Panel (right sidebar) ── */}
        <div className="cq-context">
          <div className="cq-context-title">Context</div>
          <ContextBlock title="Bill Data" />
          <ContextBlock title="SimPro Jobs" />
          <ContextBlock title="Helpdesk Tickets" />
          <ContextBlock title="Inbox Threads" />
        </div>
      </div>

      {toast && <div className="cq-toast">{toast}</div>}
    </div>
  );
}

// ── Sub-components ──

function ProductSection({ title, brand, setBrand, qty, setQty, unitPrice, setUnitPrice, total }: {
  title: string; brand: string; setBrand: (v: string) => void;
  qty: string; setQty: (v: string) => void; unitPrice: string; setUnitPrice: (v: string) => void;
  total: number;
}) {
  return (
    <div className="cq-product">
      <h3 className="cq-product-title">{title}</h3>
      <select className="cq-select" disabled>
        <option>Select from SimPro catalogue (not connected yet)</option>
      </select>
      <div className="cq-product-fields">
        <div className="cq-field">
          <label className="cq-label">Brand / Model</label>
          <input className="cq-input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Trina Vertex S" />
        </div>
        <div className="cq-field">
          <label className="cq-label">Quantity</label>
          <input className="cq-input" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        </div>
        <div className="cq-field">
          <label className="cq-label">Unit Price ($)</label>
          <input className="cq-input" type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0" />
        </div>
        <div className="cq-field">
          <label className="cq-label">Total ($)</label>
          <div className="cq-computed">{fmt$(total)}</div>
        </div>
      </div>
    </div>
  );
}

function FinCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="cq-fin-card">
      <div className="cq-fin-label">{label}</div>
      <div className={`cq-fin-value ${highlight ? 'positive' : ''}`}>{value}</div>
    </div>
  );
}

function ContextBlock({ title }: { title: string }) {
  return (
    <div className="cq-ctx-block">
      <div className="cq-ctx-heading">{title}</div>
      <div className="cq-ctx-empty">No data connected yet</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cq-review-row">
      <span className="cq-review-label">{label}</span>
      <span className="cq-review-value">{value || '—'}</span>
    </div>
  );
}
