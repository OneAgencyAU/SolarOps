import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/BillReader.css';

interface BillData {
  nmi: string | null;
  retailer: string | null;
  customerName: string | null;
  propertyAddress: string | null;
  billingPeriod: { from: string | null; to: string | null; days: number | null };
  usage: {
    dailyAvgKwh: number | null;
    totalKwh: number | null;
    peakKwh: number | null;
    offPeakKwh: number | null;
    shoulderKwh: number | null;
  };
  rates: {
    supplyCharge: number | null;
    usageRate: number | null;
    peakRate: number | null;
    offPeakRate: number | null;
    feedInTariff: number | null;
  };
  totals: { totalAmount: number | null; gstAmount: number | null };
  existingSolar: boolean | null;
  existingBattery: boolean | null;
  meterType: string | null;
  meterCondition: string | null;
  confidenceScore: number;
}

interface RecentItem {
  retailer: string;
  retailerShort: string;
  customerName: string;
  nmi: string;
  date: string;
  status: 'extracted' | 'pending';
  data: BillData;
  rawOcrText: string;
}

const placeholderRecents: RecentItem[] = [
  {
    retailer: 'AGL',
    retailerShort: 'AGL',
    customerName: 'James Hartley',
    nmi: '4102...456',
    date: 'Today 10:23am',
    status: 'extracted',
    data: {
      nmi: '410200123456',
      retailer: 'AGL',
      customerName: 'James Hartley',
      propertyAddress: '14 Sunrise Crescent, Modbury SA 5092',
      billingPeriod: { from: '12 Jan 2025', to: '12 Apr 2025', days: 89 },
      usage: { dailyAvgKwh: 14.2, totalKwh: 1263.8, peakKwh: 720.5, offPeakKwh: 543.3, shoulderKwh: null },
      rates: { supplyCharge: 1.12, usageRate: 28.4, peakRate: null, offPeakRate: null, feedInTariff: 6.5 },
      totals: { totalAmount: 342.18, gstAmount: 31.11 },
      existingSolar: true,
      existingBattery: false,
      meterType: 'Smart Meter',
      meterCondition: null,
      confidenceScore: 0.96,
    },
    rawOcrText: 'AGL Electricity Bill\nAccount Number: 1234567890\nNMI: 410200123456\nCustomer: James Hartley\n14 Sunrise Crescent, Modbury SA 5092\nBilling Period: 12 Jan 2025 - 12 Apr 2025 (89 days)\nTotal Usage: 1263.8 kWh\nDaily Average: 14.2 kWh/day\nSupply Charge: $1.12/day\nUsage Rate: 28.4c/kWh\nFeed-in Tariff: 6.5c/kWh\nTotal Amount: $342.18 (incl GST $31.11)\nSolar Meter Detected\nSmart Meter',
  },
  {
    retailer: 'Origin Energy',
    retailerShort: 'OE',
    customerName: 'Rachel Wong',
    nmi: '6305...891',
    date: 'Today 9:41am',
    status: 'extracted',
    data: {
      nmi: '630500891',
      retailer: 'Origin Energy',
      customerName: 'Rachel Wong',
      propertyAddress: '7 Banksia Drive, Ferntree Gully VIC 3156',
      billingPeriod: { from: '1 Dec 2024', to: '28 Feb 2025', days: 90 },
      usage: { dailyAvgKwh: 11.8, totalKwh: 1062.0, peakKwh: 600, offPeakKwh: 462, shoulderKwh: null },
      rates: { supplyCharge: 1.05, usageRate: 26.1, peakRate: null, offPeakRate: null, feedInTariff: 5.0 },
      totals: { totalAmount: 298.45, gstAmount: 27.13 },
      existingSolar: false,
      existingBattery: false,
      meterType: 'Smart Meter',
      meterCondition: null,
      confidenceScore: 0.93,
    },
    rawOcrText: '',
  },
  {
    retailer: 'Amber Electric',
    retailerShort: 'AE',
    customerName: 'Mark Deluca',
    nmi: '4107...234',
    date: 'Yesterday',
    status: 'pending',
    data: {
      nmi: '4107000234',
      retailer: 'Amber Electric',
      customerName: 'Mark Deluca',
      propertyAddress: '23 Ocean Parade, Coolangatta QLD 4225',
      billingPeriod: { from: '15 Nov 2024', to: '14 Feb 2025', days: 92 },
      usage: { dailyAvgKwh: 18.6, totalKwh: 1711.2, peakKwh: 950, offPeakKwh: 761.2, shoulderKwh: null },
      rates: { supplyCharge: 0.98, usageRate: 32.0, peakRate: null, offPeakRate: null, feedInTariff: null },
      totals: { totalAmount: 487.32, gstAmount: 44.30 },
      existingSolar: true,
      existingBattery: true,
      meterType: 'Smart Meter',
      meterCondition: null,
      confidenceScore: 0.88,
    },
    rawOcrText: '',
  },
  {
    retailer: 'AGL',
    retailerShort: 'AGL',
    customerName: 'Priya Sharma',
    nmi: '6301...567',
    date: 'Yesterday',
    status: 'extracted',
    data: {
      nmi: '6301000567',
      retailer: 'AGL',
      customerName: 'Priya Sharma',
      propertyAddress: '9 Elm Street, Norwood SA 5067',
      billingPeriod: { from: '1 Jan 2025', to: '31 Mar 2025', days: 90 },
      usage: { dailyAvgKwh: 10.5, totalKwh: 945.0, peakKwh: 500, offPeakKwh: 445, shoulderKwh: null },
      rates: { supplyCharge: 1.10, usageRate: 27.5, peakRate: null, offPeakRate: null, feedInTariff: 7.0 },
      totals: { totalAmount: 278.90, gstAmount: 25.35 },
      existingSolar: true,
      existingBattery: false,
      meterType: 'Basic Meter',
      meterCondition: null,
      confidenceScore: 0.95,
    },
    rawOcrText: '',
  },
  {
    retailer: 'Energy Australia',
    retailerShort: 'EA',
    customerName: 'Mike Chen',
    nmi: '4103...789',
    date: '2 days ago',
    status: 'extracted',
    data: {
      nmi: '4103000789',
      retailer: 'Energy Australia',
      customerName: 'Mike Chen',
      propertyAddress: '112 Pitt Street, Sydney NSW 2000',
      billingPeriod: { from: '5 Dec 2024', to: '5 Mar 2025', days: 90 },
      usage: { dailyAvgKwh: 16.1, totalKwh: 1449.0, peakKwh: 800, offPeakKwh: 649, shoulderKwh: null },
      rates: { supplyCharge: 1.20, usageRate: 30.0, peakRate: null, offPeakRate: null, feedInTariff: 5.5 },
      totals: { totalAmount: 412.55, gstAmount: 37.50 },
      existingSolar: false,
      existingBattery: false,
      meterType: 'Smart Meter',
      meterCondition: null,
      confidenceScore: 0.97,
    },
    rawOcrText: '',
  },
];

type ProcessStage = 'idle' | 'checking' | 'not-bill' | 'extracting' | 'complete';

export default function BillReaderPage() {
  const { tenant } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<ProcessStage>('idle');
  const [checkReason, setCheckReason] = useState('');
  const [extractedData, setExtractedData] = useState<BillData | null>(null);
  const [rawOcr, setRawOcr] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleFileSelect = (f: File) => {
    setFile(f);
    setStage('idle');
    setCheckReason('');
    setExtractedData(null);
    setRawOcr('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const removeFile = () => {
    setFile(null);
    setStage('idle');
    setCheckReason('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExtract = async () => {
    if (!file) return;

    setStage('checking');
    try {
      const checkForm = new FormData();
      checkForm.append('file', file);
      const checkRes = await fetch('/api/bill-reader/check', { method: 'POST', body: checkForm });
      const checkData = await checkRes.json();

      if (!checkData.isBill) {
        setStage('not-bill');
        setCheckReason(checkData.reason || 'This does not appear to be an electricity bill.');
        return;
      }

      setStage('extracting');
      const extractForm = new FormData();
      extractForm.append('file', file);
      const extractRes = await fetch('/api/bill-reader/extract', { method: 'POST', body: extractForm });
      const extractResult = await extractRes.json();

      setExtractedData(extractResult.extracted);
      setRawOcr(extractResult.rawOcrText || '');
      setStage('complete');
    } catch (err) {
      console.error('Extract error:', err);
      setStage('not-bill');
      setCheckReason('An error occurred during processing. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!extractedData || !tenant) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        file_name: file?.name || 'unknown',
        nmi: extractedData.nmi,
        retailer: extractedData.retailer,
        customer_name: extractedData.customerName,
        property_address: extractedData.propertyAddress,
        billing_period_from: extractedData.billingPeriod?.from || null,
        billing_period_to: extractedData.billingPeriod?.to || null,
        billing_days: extractedData.billingPeriod?.days,
        daily_avg_kwh: extractedData.usage?.dailyAvgKwh,
        total_kwh: extractedData.usage?.totalKwh,
        supply_charge: extractedData.rates?.supplyCharge,
        usage_rate: extractedData.rates?.usageRate,
        feed_in_tariff: extractedData.rates?.feedInTariff,
        total_amount: extractedData.totals?.totalAmount,
        existing_solar: extractedData.existingSolar,
        existing_battery: extractedData.existingBattery,
        meter_type: extractedData.meterType,
        raw_ocr_text: rawOcr,
        confidence_score: extractedData.confidenceScore,
      };

      const res = await fetch('/api/bill-reader/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Extraction saved successfully');
      } else {
        showToast('Failed to save extraction');
      }
    } catch {
      showToast('Failed to save extraction');
    }
    setSaving(false);
  };

  const copyNmi = (nmi: string) => {
    navigator.clipboard.writeText(nmi);
    showToast('NMI copied to clipboard');
  };

  const copyRawText = () => {
    navigator.clipboard.writeText(rawOcr);
    showToast('Raw text copied to clipboard');
  };

  const loadRecent = (item: RecentItem) => {
    setExtractedData(item.data);
    setRawOcr(item.rawOcrText);
    setStage('complete');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const maxKwh = extractedData
    ? Math.max(extractedData.usage?.peakKwh || 0, extractedData.usage?.offPeakKwh || 0, 1)
    : 1;

  return (
    <div className="bill-reader-page">
      <div className="bill-reader-header">
        <h1>Bill & NMI Reader</h1>
        <p>Upload an electricity bill to extract customer and usage data automatically</p>
        <div className="bill-reader-stats">
          <span className="bill-reader-stat blue">247 Bills Processed</span>
          <span className="bill-reader-stat green">99.1% Accuracy</span>
          <span className="bill-reader-stat grey">4.2s Avg Processing</span>
        </div>
      </div>

      <div className="bill-reader-columns">
        <div className="bill-reader-card">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />

          {!file ? (
            <div
              className={`br-upload-zone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="br-upload-icon">⬒</div>
              <h3>Drop a bill here or click to upload</h3>
              <p>Supports JPG, PNG, PDF · Max 10MB</p>
            </div>
          ) : (
            <div className="br-upload-zone has-file">
              <div className="br-file-preview">
                <div className="br-file-icon">📄</div>
                <div className="br-file-info">
                  <div className="name">{file.name}</div>
                  <div className="size">{formatFileSize(file.size)}</div>
                </div>
                <button className="br-file-remove" onClick={removeFile}>Remove</button>
              </div>

              {stage === 'checking' && (
                <div className="br-status">
                  <div className="br-status-icon checking"><div className="br-spinner blue" /></div>
                  <div className="br-status-text">
                    <h4>Checking document...</h4>
                    <p>Verifying this is an electricity bill</p>
                  </div>
                </div>
              )}

              {stage === 'not-bill' && (
                <>
                  <div className="br-status">
                    <div className="br-status-icon error">✕</div>
                    <div className="br-status-text">
                      <h4>Not an electricity bill</h4>
                      <p>{checkReason}</p>
                    </div>
                  </div>
                  <button className="br-try-again-btn" onClick={removeFile}>Try a different file</button>
                </>
              )}

              {stage === 'extracting' && (
                <>
                  <div className="br-status">
                    <div className="br-status-icon extracting"><div className="br-spinner blue" /></div>
                    <div className="br-status-text">
                      <h4>Extracting data...</h4>
                      <p>Reading bill with Google Vision OCR</p>
                    </div>
                  </div>
                  <div className="br-progress-bar"><div className="br-progress-fill" /></div>
                </>
              )}

              {stage === 'complete' && (
                <div className="br-status">
                  <div className="br-status-icon complete">✓</div>
                  <div className="br-status-text">
                    <h4>Extraction complete</h4>
                    <span className="br-confidence-badge">
                      {Math.round((extractedData?.confidenceScore || 0) * 100)}% confidence
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className="br-extract-btn"
            disabled={!file || stage === 'checking' || stage === 'extracting'}
            onClick={handleExtract}
          >
            {(stage === 'checking' || stage === 'extracting') && <div className="br-spinner" />}
            {stage === 'checking' ? 'Checking...' : stage === 'extracting' ? 'Extracting...' : 'Extract Bill Data'}
          </button>

          <div style={{ marginTop: 28 }}>
            <div className="br-section-label">Recent extractions</div>
            <ul className="br-recent-list">
              {placeholderRecents.map((item, i) => (
                <li key={i} className="br-recent-item" onClick={() => loadRecent(item)}>
                  <div className="retailer-icon">{item.retailerShort}</div>
                  <div className="details">
                    <div className="top-row">
                      <span>{item.retailer}</span>
                      <span style={{ color: '#6e6e73' }}>—</span>
                      <span>{item.customerName}</span>
                    </div>
                    <div className="bottom-row">NMI: {item.nmi}</div>
                  </div>
                  <div className="meta">
                    <div className="date">{item.date}</div>
                    <span className={`br-status-pill ${item.status === 'extracted' ? 'extracted' : 'pending'}`}>
                      {item.status === 'extracted' ? 'Extracted' : 'Pending Review'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bill-reader-card">
          {!extractedData ? (
            <div className="br-empty-state">
              <div className="icon">⬒</div>
              <h3>Upload a bill to see extracted data</h3>
              <p>Data will appear here after extraction</p>
            </div>
          ) : (
            <>
              <div className="br-result-header">
                <div className="customer-info">
                  <h2>{extractedData.customerName || 'Unknown Customer'}</h2>
                  <p>{extractedData.propertyAddress || ''}</p>
                </div>
                <div className="br-result-actions">
                  <span className="br-confidence-badge">
                    {Math.round(extractedData.confidenceScore * 100)}% confidence
                  </span>
                  {extractedData.nmi && (
                    <button className="br-copy-nmi-btn" onClick={() => copyNmi(extractedData.nmi!)}>
                      📋 Copy NMI
                    </button>
                  )}
                  <button className="br-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? <div className="br-spinner" /> : null}
                    Save to Dashboard
                  </button>
                </div>
              </div>

              <div className="br-section-label">Account Details</div>
              <div className="br-grid">
                <div className="br-field">
                  <span className="br-field-label">NMI</span>
                  <div className="br-nmi-display">
                    <span className="nmi-text">{extractedData.nmi || '—'}</span>
                    {extractedData.nmi && (
                      <button className="br-nmi-copy-icon" onClick={() => copyNmi(extractedData.nmi!)}>📋</button>
                    )}
                  </div>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Retailer</span>
                  <span className="br-field-value">{extractedData.retailer || '—'}</span>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Customer Name</span>
                  <span className="br-field-value">{extractedData.customerName || '—'}</span>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Property Address</span>
                  <span className="br-field-value">{extractedData.propertyAddress || '—'}</span>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Billing Period</span>
                  <span className="br-field-value">
                    {extractedData.billingPeriod?.from && extractedData.billingPeriod?.to
                      ? `${extractedData.billingPeriod.from} — ${extractedData.billingPeriod.to} (${extractedData.billingPeriod.days || '?'} days)`
                      : '—'}
                  </span>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Total Amount</span>
                  <span className="br-field-value large green">
                    {extractedData.totals?.totalAmount != null ? `$${extractedData.totals.totalAmount.toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>

              <div className="br-section-label" style={{ marginTop: 28 }}>Usage Data</div>
              <div className="br-usage-bars">
                {extractedData.usage?.peakKwh != null && (
                  <div className="br-usage-bar-row">
                    <span className="label">Peak</span>
                    <div className="bar-track">
                      <div className="bar-fill peak" style={{ width: `${(extractedData.usage.peakKwh / maxKwh) * 100}%` }} />
                    </div>
                    <span className="value">{extractedData.usage.peakKwh} kWh</span>
                  </div>
                )}
                {extractedData.usage?.offPeakKwh != null && (
                  <div className="br-usage-bar-row">
                    <span className="label">Off-peak</span>
                    <div className="bar-track">
                      <div className="bar-fill off-peak" style={{ width: `${(extractedData.usage.offPeakKwh / maxKwh) * 100}%` }} />
                    </div>
                    <span className="value">{extractedData.usage.offPeakKwh} kWh</span>
                  </div>
                )}
              </div>
              <div className="br-daily-avg">
                <div className="number">{extractedData.usage?.dailyAvgKwh ?? '—'}</div>
                <div className="unit">kWh/day average</div>
              </div>

              <div className="br-section-label" style={{ marginTop: 28 }}>Tariff & Rates</div>
              <div className="br-grid">
                <div className="br-field">
                  <span className="br-field-label">Supply Charge</span>
                  <span className="br-field-value">
                    {extractedData.rates?.supplyCharge != null ? `$${extractedData.rates.supplyCharge.toFixed(2)}/day` : '—'}
                  </span>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Usage Rate</span>
                  <span className="br-field-value">
                    {extractedData.rates?.usageRate != null ? `${extractedData.rates.usageRate}c/kWh` : '—'}
                  </span>
                </div>
                <div className="br-field">
                  <span className="br-field-label">Feed-in Tariff</span>
                  <span className="br-field-value">
                    {extractedData.rates?.feedInTariff != null ? `${extractedData.rates.feedInTariff}c/kWh` : 'None detected'}
                  </span>
                </div>
                {extractedData.rates?.peakRate != null && (
                  <div className="br-field">
                    <span className="br-field-label">Peak Rate</span>
                    <span className="br-field-value">{extractedData.rates.peakRate}c/kWh</span>
                  </div>
                )}
                {extractedData.rates?.offPeakRate != null && (
                  <div className="br-field">
                    <span className="br-field-label">Off-peak Rate</span>
                    <span className="br-field-value">{extractedData.rates.offPeakRate}c/kWh</span>
                  </div>
                )}
              </div>

              <div className="br-section-label" style={{ marginTop: 28 }}>System Info</div>
              <div className="br-pills-row">
                {extractedData.existingSolar === true ? (
                  <span className="br-pill green">✓ Solar detected</span>
                ) : (
                  <span className="br-pill grey">No solar detected</span>
                )}
                {extractedData.existingBattery === true ? (
                  <span className="br-pill green">✓ Battery detected</span>
                ) : (
                  <span className="br-pill grey">No battery detected</span>
                )}
                {extractedData.meterType && <span className="br-pill blue">{extractedData.meterType}</span>}
                {extractedData.meterCondition && <span className="br-pill blue">{extractedData.meterCondition}</span>}
              </div>

              <div style={{ marginTop: 28 }}>
                <button className="br-raw-toggle" onClick={() => setRawExpanded(!rawExpanded)}>
                  <span className="br-section-label">Raw OCR Text</span>
                  <span className={`arrow ${rawExpanded ? 'open' : ''}`}>▼</span>
                </button>
                {rawExpanded && (
                  <>
                    <div className="br-raw-text">{rawOcr || 'No raw text available'}</div>
                    <button className="br-raw-copy-btn" onClick={copyRawText}>Copy raw text</button>
                  </>
                )}
              </div>

              <div className="br-bottom-actions">
                <button className="br-btn-outline" onClick={() => extractedData.nmi && copyNmi(extractedData.nmi)}>
                  📋 Copy NMI
                </button>
                <button className="br-btn-disabled" title="Coming Soon" disabled>
                  Push to Simpro
                </button>
                <button className="br-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <div className="br-spinner" /> : null}
                  Save extraction
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="br-toast">{toast}</div>}
    </div>
  );
}
