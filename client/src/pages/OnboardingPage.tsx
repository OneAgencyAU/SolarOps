import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#050810');
      bg.addColorStop(1, '#0a0f1e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const blobs = [
        { x: 0.3 + Math.sin(t * 0.4) * 0.15, y: 0.3 + Math.cos(t * 0.3) * 0.1, r: 0.45, c1: 'rgba(251,146,60,0.18)', c2: 'rgba(251,146,60,0)' },
        { x: 0.7 + Math.cos(t * 0.35) * 0.1, y: 0.6 + Math.sin(t * 0.5) * 0.12, r: 0.4, c1: 'rgba(99,102,241,0.2)', c2: 'rgba(99,102,241,0)' },
        { x: 0.5 + Math.sin(t * 0.25) * 0.2, y: 0.8 + Math.cos(t * 0.4) * 0.08, r: 0.35, c1: 'rgba(251,191,36,0.12)', c2: 'rgba(251,191,36,0)' },
        { x: 0.15 + Math.cos(t * 0.45) * 0.08, y: 0.65 + Math.sin(t * 0.3) * 0.1, r: 0.3, c1: 'rgba(251,146,60,0.1)', c2: 'rgba(251,146,60,0)' },
      ];

      blobs.forEach(b => {
        const gx = b.x * w, gy = b.y * h, gr = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, b.c1);
        g.addColorStop(1, b.c2);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      for (let i = 0; i < 14; i++) {
        const px = (Math.sin(t * 0.2 + i * 2.1) * 0.5 + 0.5) * w;
        const py = (Math.cos(t * 0.15 + i * 1.7) * 0.5 + 0.5) * h;
        const alpha = (Math.sin(t * 0.5 + i) * 0.5 + 0.5) * 0.7;
        const size = 1 + Math.sin(t + i) * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? `rgba(251,146,60,${alpha})` : `rgba(251,191,36,${alpha * 0.6})`;
        ctx.fill();
      }

      t += 0.008;
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
  );
};

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('Solar — Commercial & Residential');
  const [teamSize, setTeamSize] = useState('Just me');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const canSubmit = firstName.trim() && lastName.trim() && businessName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('[Onboarding] handleSubmit called');
    e.preventDefault();
    console.log('[Onboarding] user:', user?.uid, 'canSubmit:', canSubmit);
    if (!canSubmit) return;
    if (!user) {
      setError('Session expired — please refresh the page and try again.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      console.log('[Onboarding] Submitting for user:', user.uid, 'business:', businessName.trim());

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          email: user.email,
          display_name: user.displayName,
          avatar_url: user.photoURL,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          business_name: businessName.trim(),
        }),
      });

      const data = await res.json();
      console.log('[Onboarding] API response:', res.status, data);

      if (!res.ok) {
        console.error('[Onboarding] Full error payload:', data);
        setError(data.error ?? 'Unknown error');
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error — could not reach the server';
      console.error('[Onboarding] Unexpected error:', err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '11px 14px',
    border: `1.5px solid ${focusedField === field ? '#f97316' : '#e5e7eb'}`,
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.2s',
    background: 'white',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
    display: 'block',
  };

  const fieldWrap: React.CSSProperties = {
    marginBottom: '18px',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        .a1 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards; opacity: 0; animation-delay: 0.05s; }
        .a2 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards; opacity: 0; animation-delay: 0.18s; }
        .a3 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards; opacity: 0; animation-delay: 0.3s; }
        .a4 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards; opacity: 0; animation-delay: 0.44s; }
        .a5 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards; opacity: 0; animation-delay: 0.58s; }

        .ob-feature-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.25s ease;
        }
        .ob-feature-card:hover {
          background: rgba(249,115,22,0.06);
          border-color: rgba(249,115,22,0.2);
        }
      `}</style>

      {/* LEFT PANEL */}
      <div style={{ flex: '2 1 0', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 44px' }}>
        <AnimatedBackground />

        {/* Logo */}
        <div className="a1" style={{ position: 'relative', zIndex: 10 }}>
          <img src="/solarops-logo.png" alt="SolarOps" style={{ height: '36px', width: 'auto' }} />
        </div>

        {/* Hero + Steps + Feature Cards */}
        <div className="a2" style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '32px', paddingBottom: '32px' }}>

          {/* Hero */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#f97316', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '14px' }}>
              ONBOARDING
            </div>
            <h1 style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(36px, 4vw, 58px)',
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginBottom: '14px',
              whiteSpace: 'nowrap',
            }}>
              Let's set up your <span style={{
                background: 'linear-gradient(90deg, #f97316, #fbbf24, #f97316)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 2.5s linear infinite',
              }}>workspace.</span>
            </h1>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', fontWeight: 300, lineHeight: 1.6 }}>
              2 minutes to your AI operations dashboard.
            </p>
          </div>

          {/* Progress pills */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
            <span style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: 'white', borderRadius: '20px', padding: '8px 18px', fontSize: '12px', fontWeight: 600 }}>
              1. Workspace Setup
            </span>
            <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', borderRadius: '20px', padding: '8px 18px', fontSize: '12px' }}>
              2. Connect Tools
            </span>
          </div>

          {/* Feature cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { icon: '📞', title: 'Voice Receptionist', sub: 'Answers calls 24/7, captures leads' },
              { icon: '✉️', title: 'Inbox Assistant', sub: 'Drafts replies in seconds' },
              { icon: '📄', title: 'Bill Reader', sub: 'Reads energy bills automatically' },
            ].map((card, i) => (
              <div key={i} className="ob-feature-card">
                <span style={{ fontSize: '22px', lineHeight: 1 }}>{card.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'white', fontSize: '13px', marginBottom: '2px' }}>{card.title}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial + Footer */}
        <div className="a5" style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ borderLeft: '2px solid rgba(249,115,22,0.35)', paddingLeft: '16px' }}>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.65, fontStyle: 'italic', fontWeight: 300 }}>
              "SolarOps saves our team hours every week on emails and calls."
            </p>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>N</div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>Nat Elliott · Sol Energy</span>
            </div>
          </div>
          <div style={{ marginTop: '28px' }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Powered by ONE AGENCY</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: '1 1 0', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '64px 48px', position: 'relative', overflowY: 'auto' }}>
        <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, transparent, #f97316, transparent)' }} />

        <div style={{ width: '100%', maxWidth: '340px' }}>
          <div className="a1">
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Set up your workspace
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '28px', fontWeight: 400 }}>
              Tell us about your solar business
            </p>
          </div>

          <form className="a2" onSubmit={handleSubmit}>

            {/* First + Last name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label htmlFor="firstName" style={labelStyle}>First name</label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Alex"
                  required
                  autoFocus
                  style={inputStyle('firstName')}
                />
              </div>
              <div>
                <label htmlFor="lastName" style={labelStyle}>Last name</label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onFocus={() => setFocusedField('lastName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Chen"
                  required
                  style={inputStyle('lastName')}
                />
              </div>
            </div>

            {/* Business name */}
            <div style={fieldWrap}>
              <label htmlFor="businessName" style={labelStyle}>Business name</label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                onFocus={() => setFocusedField('businessName')}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. Sol Energy"
                required
                style={inputStyle('businessName')}
              />
            </div>

            {/* Industry */}
            <div style={fieldWrap}>
              <label htmlFor="industry" style={labelStyle}>Industry</label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                onFocus={() => setFocusedField('industry')}
                onBlur={() => setFocusedField(null)}
                style={{ ...inputStyle('industry'), cursor: 'pointer' }}
              >
                <option>Solar — Commercial & Residential</option>
                <option>Solar — Commercial Only</option>
                <option>Solar — Residential Only</option>
                <option>Solar + Battery Storage</option>
                <option>Solar EPC / Contractor</option>
              </select>
            </div>

            {/* Team size */}
            <div style={fieldWrap}>
              <label htmlFor="teamSize" style={labelStyle}>Team size</label>
              <select
                id="teamSize"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                onFocus={() => setFocusedField('teamSize')}
                onBlur={() => setFocusedField(null)}
                style={{ ...inputStyle('teamSize'), cursor: 'pointer' }}
              >
                <option>Just me</option>
                <option>2–5 people</option>
                <option>6–15 people</option>
                <option>16–50 people</option>
                <option>50+ people</option>
              </select>
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '12px' }}>{error}</p>
            )}

            {!user && <p style={{ fontSize: 12, color: '#f97316', marginBottom: 8 }}>⚠️ Not signed in — please refresh</p>}

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #f97316, #fbbf24)',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                color: 'white',
                cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
                opacity: submitting || !canSubmit ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {submitting ? 'Creating workspace…' : 'Create my workspace →'}
            </button>
          </form>

          <div className="a3" style={{ marginTop: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              Already have a workspace?{' '}
              <a href="/login" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>
                Sign in →
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
