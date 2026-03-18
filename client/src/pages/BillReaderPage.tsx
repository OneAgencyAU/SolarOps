import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface BillData {
  nmi: string | null;
  retailer: string | null;
  customerName: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  accountNumber: string | null;
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

interface SavedExtraction {
  id: string;
  retailer: string | null;
  customer_name: string | null;
  nmi: string | null;
  created_at: string;
  status: string;
  daily_avg_kwh: number | null;
  total_kwh: number | null;
  supply_charge: number | null;
  usage_rate: number | null;
  feed_in_tariff: number | null;
  total_amount: number | null;
  existing_solar: boolean | null;
  existing_battery: boolean | null;
  meter_type: string | null;
  billing_period_from: string | null;
  billing_period_to: string | null;
  billing_days: number | null;
  property_address: string | null;
  raw_ocr_text: string | null;
  confidence_score: number | null;
  phone_number: string | null;
  email_address: string | null;
  account_number: string | null;
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<ProcessStage>('idle');
  const [checkReason, setCheckReason] = useState('');
  const [extractedData, setExtractedData] = useState<BillData | null>(null);
  const [rawOcr, setRawOcr] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [recentExtractions, setRecentExtractions] = useState<SavedExtraction[]>([]);
  const [stats, setStats] = useState<{ billsProcessed: number; accuracy: number | null; avgProcessingSeconds: number | null } | null>(null);
  const [processingMs, setProcessingMs] = useState<number | null>(null);

  const fetchRecentExtractions = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/bill-reader/recent?tenant_id=${tenant.id}`);
      if (res.ok) {
        const data = await res.json();
        setRecentExtractions(data);
      }
    } catch (e) {
      console.error('Failed to fetch recent extractions', e);
    }
  }, [tenant?.id]);

  const fetchStats = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/bill-reader/stats?tenant_id=${tenant.id}`);
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error('Failed to fetch stats', e); }
  }, [tenant?.id]);

  useEffect(() => {
    fetchRecentExtractions();
    fetchStats();
  }, [fetchRecentExtractions, fetchStats]);

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
    setUploadedFile(f);
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
    setUploadedFile(null);
    setStage('idle');
    setCheckReason('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const normaliseConfidence = (score: number | undefined | null): number => {
    if (score == null) return 0;
    if (score > 1) return score / 100;
    return score;
  };

  const handleExtract = async () => {
    if (!file) return;

    setStage('checking');
    try {
      const checkForm = new FormData();
      checkForm.append('file', file);
      checkForm.append('tenant_id', tenant?.id || '');
      console.log('[BillReader] Calling /api/bill-reader/check for', file.name);
      const checkRes = await fetch('/api/bill-reader/check', { method: 'POST', body: checkForm });
      const checkData = await checkRes.json();
      console.log('[BillReader] Check result:', checkData);

      if (!checkData.isBill) {
        setStage('not-bill');
        setCheckReason(checkData.reason || 'This does not appear to be an electricity bill.');
        return;
      }

      setStage('extracting');
      const extractForm = new FormData();
      extractForm.append('file', file);
      extractForm.append('tenant_id', tenant?.id || '');
      console.log('[BillReader] Calling /api/bill-reader/extract');
      const extractRes = await fetch('/api/bill-reader/extract', { method: 'POST', body: extractForm });

      if (!extractRes.ok) {
        const errData = await extractRes.json();
        console.error('[BillReader] Extract HTTP error:', extractRes.status, errData);
        setStage('not-bill');
        setCheckReason(errData.error || 'Extraction failed. Please try again.');
        return;
      }

      const { extracted, rawOcrText, processingMs: pMs } = await extractRes.json();
      console.log('[BillReader] Extracted fields:', extracted);
      console.log('[BillReader] Raw OCR length:', rawOcrText?.length);
      setProcessingMs(pMs ?? null);

      if (!extracted || Object.keys(extracted).length === 0) {
        console.error('[BillReader] Empty extracted data');
        setStage('not-bill');
        setCheckReason('Could not parse bill data. Please try a clearer image.');
        return;
      }

      const data = {
        ...extracted,
        confidenceScore: normaliseConfidence(extracted?.confidenceScore),
      };
      console.log('[BillReader] Final data going to state:', data);
      setExtractedData(data);
      setRawOcr(rawOcrText || '');
      setStage('complete');
    } catch (err) {
      console.error('[BillReader] Extract error:', err);
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
        processing_ms: processingMs ?? null,
        phone_number: extractedData.phoneNumber || null,
        email_address: extractedData.emailAddress || null,
        account_number: extractedData.accountNumber || null,
      };

      const res = await fetch('/api/bill-reader/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Extraction saved successfully');
        fetchRecentExtractions();
        fetchStats();
      } else {
        showToast('Failed to save extraction');
      }
    } catch {
      showToast('Failed to save extraction');
    }
    setSaving(false);
  };

  const copyField = (value: string) => {
    navigator.clipboard.writeText(value);
    showToast('Copied!');
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

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    color: '#4F8EF7',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '12px',
    display: 'block',
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '3px',
    display: 'block',
  };

  const fieldValue: React.CSSProperties = {
    fontSize: '14px',
    color: '#0f172a',
    fontWeight: 500,
  };

  const divider: React.CSSProperties = {
    height: '1px',
    background: '#f1f5f9',
    margin: '20px 0',
  };

  const card: React.CSSProperties = {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '28px 32px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress { 0% { width: 0% } 60% { width: 75% } 100% { width: 90% } }
        .br-spinner-ring {
          width: 18px; height: 18px; border: 2px solid #f1f5f9;
          border-top-color: #4F8EF7; border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        .br-upload-zone:hover { border-color: #4F8EF7 !important; background: #f0f9ff !important; }
        .br-recent-row:hover { background: #f8fafc !important; }
        .br-extract-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .br-extract-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .br-btn-outline:hover { border-color: #4F8EF7 !important; color: #4F8EF7 !important; }
        .br-btn-primary:hover:not(:disabled) { opacity: 0.9; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Bill & NMI Reader</h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          Upload an electricity bill to extract customer and usage data automatically
        </p>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{stats?.billsProcessed ?? '—'}</span> Bills Processed
          </span>
          {stats?.accuracy != null && (
            <span style={{ fontSize: '13px', color: '#475569' }}>
              <span style={{ fontWeight: 700, color: '#22c55e' }}>{stats.accuracy}%</span> Accuracy
            </span>
          )}
          {stats?.avgProcessingSeconds != null && (
            <span style={{ fontSize: '13px', color: '#475569' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{stats.avgProcessingSeconds}s</span> Avg Processing
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'stretch' }}>

        {/* LEFT PANEL */}
        <div style={{ ...card, padding: '24px', height: '100%' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/tiff,image/gif,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />

          {/* Upload zone */}
          {!file ? (
            <div
              className="br-upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#4F8EF7' : '#e2e8f0'}`,
                borderRadius: '12px',
                background: dragOver ? '#f0f9ff' : '#f8fafc',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '16px',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4F8EF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Drop a bill here or click to upload
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                JPG, PNG, PDF, HEIC, WebP · Max 10MB
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              {/* File info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '12px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F8EF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatFileSize(file.size)}</div>
                </div>
                <button
                  onClick={removeFile}
                  style={{ fontSize: '12px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                >
                  Remove
                </button>
              </div>

              {/* Status states */}
              {stage === 'checking' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                  <span className="br-spinner-ring" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>Checking document...</div>
                    <div style={{ fontSize: '11px', color: '#0284c7' }}>Verifying this is an electricity bill</div>
                  </div>
                </div>
              )}

              {stage === 'extracting' && (
                <div style={{ padding: '14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span className="br-spinner-ring" style={{ borderTopColor: '#4F8EF7' } as React.CSSProperties} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#4F8EF7' }}>Extracting data with AI...</div>
                      <div style={{ fontSize: '11px', color: '#4F8EF7' }}>Reading bill with OCR</div>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: '#bae6fd', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #4F8EF7, #6BB3F7)', borderRadius: '2px', animation: 'progress 3s ease forwards' }} />
                  </div>
                </div>
              )}

              {stage === 'not-bill' && (
                <div style={{ padding: '12px 14px', background: '#fff1f2', borderRadius: '10px', border: '1px solid #fecdd3', marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#be123c', marginBottom: '3px' }}>Not an electricity bill</div>
                  <div style={{ fontSize: '12px', color: '#e11d48' }}>{checkReason}</div>
                </div>
              )}

              {stage === 'complete' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '8px' }}>
                    <div style={{ width: '24px', height: '24px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#15803d' }}>Extraction complete</div>
                      <div style={{ fontSize: '11px', color: '#16a34a' }}>
                        {Math.round((extractedData?.confidenceScore || 0) * 100)}% confidence score
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extract button */}
          <button
            className="br-extract-btn"
            disabled={!file || stage === 'checking' || stage === 'extracting'}
            onClick={handleExtract}
            style={{
              width: '100%',
              padding: '13px',
              background: 'linear-gradient(135deg, #4F8EF7, #6BB3F7)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              marginBottom: '24px',
            }}
          >
            {(stage === 'checking' || stage === 'extracting') && (
              <span className="br-spinner-ring" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' } as React.CSSProperties} />
            )}
            {stage === 'checking' ? 'Checking...' : stage === 'extracting' ? 'Extracting...' : 'Extract Bill Data'}
          </button>

          {/* Recent extractions */}
          <div>
            <span style={sectionLabel}>Recent Extractions</span>
            {recentExtractions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '13px' }}>
                No extractions yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {recentExtractions.map((item) => {
                  const retailerShort = (item.retailer || 'UN').slice(0, 3).toUpperCase().replace(' ', '');
                  const nmiDisplay = item.nmi ? item.nmi.slice(0, 4) + '...' + item.nmi.slice(-3) : '—';
                  const dateDisplay = new Date(item.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                  return (
                    <div
                      key={item.id}
                      className="br-recent-row"
                      onClick={() => {
                        setExtractedData({
                          nmi: item.nmi,
                          retailer: item.retailer,
                          customerName: item.customer_name,
                          phoneNumber: item.phone_number ?? null,
                          emailAddress: item.email_address ?? null,
                          accountNumber: item.account_number ?? null,
                          propertyAddress: item.property_address,
                          billingPeriod: { from: item.billing_period_from, to: item.billing_period_to, days: item.billing_days },
                          usage: { dailyAvgKwh: item.daily_avg_kwh, totalKwh: item.total_kwh, peakKwh: null, offPeakKwh: null, shoulderKwh: null },
                          rates: { supplyCharge: item.supply_charge, usageRate: item.usage_rate, peakRate: null, offPeakRate: null, feedInTariff: item.feed_in_tariff },
                          totals: { totalAmount: item.total_amount, gstAmount: null },
                          existingSolar: item.existing_solar,
                          existingBattery: item.existing_battery,
                          meterType: item.meter_type,
                          meterCondition: null,
                          confidenceScore: item.confidence_score ?? 0.85,
                        });
                        setRawOcr(item.raw_ocr_text || '');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #4F8EF7, #6BB3F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {retailerShort}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.retailer || 'Unknown'} — {item.customer_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>NMI: {nmiDisplay}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>{dateDisplay}</div>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px',
                          background: item.status === 'extracted' ? '#f0fdf4' : '#f0f9ff',
                          color: item.status === 'extracted' ? '#16a34a' : '#4F8EF7',
                          border: `1px solid ${item.status === 'extracted' ? '#bbf7d0' : '#bae6fd'}`,
                        }}>
                          {item.status === 'extracted' ? 'Extracted' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ ...card, padding: '28px', height: '100%' }}>
          {!extractedData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Upload a bill to see extracted data</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Data will appear here after extraction</div>
            </div>
          ) : (
            <>
              {/* Result header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {extractedData.customerName || 'Unknown Customer'}
                    </h2>
                    {extractedData.customerName && (
                      <button onClick={() => copyField(extractedData.customerName!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{extractedData.propertyAddress || ''}</p>
                    {extractedData.propertyAddress && (
                      <button onClick={() => copyField(extractedData.propertyAddress!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
                  {uploadedFile && (
                    <button
                      onClick={() => { const url = URL.createObjectURL(uploadedFile); window.open(url, '_blank'); }}
                      style={{ border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 12, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                    >
                      View Original
                    </button>
                  )}
                  <span style={{
                    fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '20px',
                    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                  }}>
                    {Math.round(extractedData.confidenceScore * 100)}% confidence
                  </span>
                </div>
              </div>

              {/* Account Details */}
              <span style={sectionLabel}>Account Details</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '4px' }}>
                <div>
                  <span style={fieldLabel}>NMI</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...fieldValue, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{extractedData.nmi || '—'}</span>
                    {extractedData.nmi && (
                      <button onClick={() => copyNmi(extractedData.nmi!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8', fontSize: '12px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span style={fieldLabel}>Retailer</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={fieldValue}>{extractedData.retailer || '—'}</span>
                    {extractedData.retailer && (
                      <button onClick={() => copyField(extractedData.retailer!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                {extractedData.accountNumber && (
                  <div>
                    <span style={fieldLabel}>Account Number</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ ...fieldValue, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{extractedData.accountNumber}</span>
                      <button onClick={() => copyField(extractedData.accountNumber!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </div>
                  </div>
                )}
                {extractedData.phoneNumber && (
                  <div>
                    <span style={fieldLabel}>Phone Number</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={fieldValue}>{extractedData.phoneNumber}</span>
                      <button onClick={() => copyField(extractedData.phoneNumber!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </div>
                  </div>
                )}
                {extractedData.emailAddress && (
                  <div>
                    <span style={fieldLabel}>Email Address</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={fieldValue}>{extractedData.emailAddress}</span>
                      <button onClick={() => copyField(extractedData.emailAddress!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <span style={fieldLabel}>Billing Period</span>
                  <span style={fieldValue}>
                    {(() => {
                      const from = extractedData.billingPeriod?.from;
                      const to = extractedData.billingPeriod?.to;
                      const days = extractedData.billingPeriod?.days
                        ?? (from && to
                          ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
                          : null);
                      return from && to
                        ? `${from} — ${to}${days ? ` (${days} days)` : ''}`
                        : '—';
                    })()}
                  </span>
                </div>
                <div>
                  <span style={fieldLabel}>Total Amount</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {extractedData.totals?.totalAmount != null ? `$${extractedData.totals.totalAmount.toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>

              <div style={divider} />

              {/* Usage Data */}
              <span style={sectionLabel}>Usage Data</span>
              {(extractedData.usage?.peakKwh != null || extractedData.usage?.offPeakKwh != null) && (
                <div style={{ marginBottom: '16px' }}>
                  {extractedData.usage?.peakKwh != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', width: '60px' }}>Peak</span>
                      <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(extractedData.usage.peakKwh / maxKwh) * 100}%`, background: 'linear-gradient(90deg, #4F8EF7, #6BB3F7)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 500, width: '72px', textAlign: 'right' }}>{extractedData.usage.peakKwh} kWh</span>
                    </div>
                  )}
                  {extractedData.usage?.offPeakKwh != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', width: '60px' }}>Off-peak</span>
                      <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(extractedData.usage.offPeakKwh / maxKwh) * 100}%`, background: 'linear-gradient(90deg, #fb923c, #fcd34d)', borderRadius: '3px', opacity: 0.6 }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 500, width: '72px', textAlign: 'right' }}>{extractedData.usage.offPeakKwh} kWh</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 16px', marginBottom: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#4F8EF7' }}>{extractedData.usage?.dailyAvgKwh ?? '—'}</span>
                <span style={{ fontSize: '12px', color: '#4F8EF7' }}>kWh/day average</span>
              </div>

              <div style={divider} />

              {/* Tariff & Rates */}
              <span style={sectionLabel}>Tariff & Rates</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '4px' }}>
                <div>
                  <span style={fieldLabel}>Supply Charge</span>
                  <span style={fieldValue}>
                    {extractedData.rates?.supplyCharge != null ? `$${extractedData.rates.supplyCharge.toFixed(2)}/day` : '—'}
                  </span>
                </div>
                <div>
                  <span style={fieldLabel}>Usage Rate</span>
                  <span style={fieldValue}>
                    {extractedData.rates?.usageRate != null ? `${extractedData.rates.usageRate}c/kWh` : '—'}
                  </span>
                </div>
                <div>
                  <span style={fieldLabel}>Feed-in Tariff</span>
                  <span style={fieldValue}>
                    {extractedData.rates?.feedInTariff != null ? `${extractedData.rates.feedInTariff}c/kWh` : 'None detected'}
                  </span>
                </div>
                {extractedData.rates?.peakRate != null && (
                  <div>
                    <span style={fieldLabel}>Peak Rate</span>
                    <span style={fieldValue}>{extractedData.rates.peakRate}c/kWh</span>
                  </div>
                )}
                {extractedData.rates?.offPeakRate != null && (
                  <div>
                    <span style={fieldLabel}>Off-peak Rate</span>
                    <span style={fieldValue}>{extractedData.rates.offPeakRate}c/kWh</span>
                  </div>
                )}
              </div>

              <div style={divider} />

              {/* System Info */}
              <span style={sectionLabel}>System Info</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                {extractedData.existingSolar === true ? (
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>✓ Solar detected</span>
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '20px', background: '#f0f9ff', color: '#4F8EF7', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>⚡ Solar opportunity</span>
                )}
                {extractedData.existingBattery === true ? (
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>✓ Battery detected</span>
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 500, padding: '6px 12px', borderRadius: '20px', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>No battery detected</span>
                )}
                {extractedData.meterType && (
                  <span style={{ fontSize: '12px', fontWeight: 500, padding: '6px 12px', borderRadius: '20px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{extractedData.meterType}</span>
                )}
                {extractedData.meterCondition && (
                  <span style={{ fontSize: '12px', fontWeight: 500, padding: '6px 12px', borderRadius: '20px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{extractedData.meterCondition}</span>
                )}
              </div>

              <div style={divider} />

              {/* Bottom actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="br-btn-outline"
                  onClick={() => extractedData.nmi && copyNmi(extractedData.nmi)}
                  style={{
                    flex: 1, padding: '11px', background: 'white', border: '1.5px solid #e2e8f0',
                    borderRadius: '10px', fontSize: '13px', fontWeight: 500, color: '#475569',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  Copy NMI
                </button>
                <button
                  className="br-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 2, padding: '11px', background: 'linear-gradient(135deg, #4F8EF7, #6BB3F7)',
                    border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    color: 'white', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                  }}
                >
                  {saving && <span className="br-spinner-ring" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: '14px', height: '14px' } as React.CSSProperties} />}
                  Save extraction
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: 'white', padding: '11px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
