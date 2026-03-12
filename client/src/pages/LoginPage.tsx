import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { supabase } from '../lib/supabase';
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

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
  </svg>
);

const stats = [
  { value: '18hrs', label: 'saved per week' },
  { value: '99.2%', label: 'AI accuracy' },
  { value: '4.2m', label: 'avg response' },
];

export default function LoginPage() {
  const { user, tenant, loading } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 80);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate(tenant ? '/dashboard' : '/onboarding', { replace: true });
    }
  }, [user, tenant, loading, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const { user: fbUser } = result;

      console.log('[Login] Firebase sign-in success, uid:', fbUser.uid);

      const { data: existingUser, error: selectErr } = await supabase
        .from('users')
        .select('id')
        .eq('id', fbUser.uid)
        .maybeSingle();

      if (selectErr) {
        console.error('[Login] Supabase SELECT error:', selectErr);
      }

      console.log('[Login] Existing user in Supabase:', existingUser);

      if (!existingUser) {
        console.log('[Login] New user — calling /api/users to insert');
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: fbUser.uid,
            email: fbUser.email,
            display_name: fbUser.displayName,
            avatar_url: fbUser.photoURL,
          }),
        });
        const data = await res.json();
        console.log('[Login] /api/users response:', res.status, data);
        if (!res.ok) {
          console.error('[Login] Failed to create user record:', data);
        }
        navigate('/onboarding', { replace: true });
      } else {
        const { data: membership, error: memberErr } = await supabase
          .from('tenant_memberships')
          .select('id')
          .eq('user_id', fbUser.uid)
          .maybeSingle();

        if (memberErr) {
          console.error('[Login] Supabase membership SELECT error:', memberErr);
        }

        console.log('[Login] Membership:', membership);
        navigate(membership ? '/dashboard' : '/onboarding', { replace: true });
      }
    } catch (err) {
      console.error('[Login] Sign in error:', err);
    }
  };

  if (loading) return null;

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

        .stat {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 18px 16px;
          transition: all 0.3s ease;
          cursor: default;
        }
        .stat:hover {
          background: rgba(249,115,22,0.08);
          border-color: rgba(249,115,22,0.25);
          transform: translateY(-2px);
        }

        .gbtn {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          width: 100%; padding: 15px 24px;
          background: white; border: 1.5px solid #e5e7eb;
          border-radius: 14px; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500;
          color: #111827; transition: all 0.2s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .gbtn:hover {
          border-color: #f97316;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 0 0 3px rgba(249,115,22,0.08);
          transform: translateY(-1px);
        }

        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 20px;
          font-size: 11px; font-weight: 500;
          background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;
          transition: all 0.2s;
        }
        .badge:hover { background: #fff7ed; border-color: #fed7aa; color: #c2410c; }

        @keyframes float1 {
          0%, 100% { transform: rotate(-6deg) translateY(-50%); }
          50% { transform: rotate(-6deg) translateY(calc(-50% - 12px)); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateX(-50%) rotate(2deg) translateY(-50%); }
          50% { transform: translateX(-50%) rotate(2deg) translateY(calc(-50% - 10px)); }
        }
        @keyframes float3 {
          0%, 100% { transform: rotate(5deg) translateY(-50%); }
          50% { transform: rotate(5deg) translateY(calc(-50% - 14px)); }
        }
      `}</style>

      {/* LEFT PANEL */}
      <div style={{ flex: '2 1 0', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px 48px' }}>
        <AnimatedBackground />

        {/* Logo */}
        <div className="a1" style={{ position: 'relative', zIndex: 10 }}>
          <img src="/solarops-logo.png" alt="SolarOps" style={{ height: '36px', width: 'auto' }} />
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div className="a2" style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#f97316', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              AI Operations Platform
            </span>
          </div>

          <h1 className="a3" style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 'clamp(52px, 6vw, 88px)',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.0,
            letterSpacing: '-0.04em',
            marginBottom: '24px',
          }}>
            Built for<br />
            <span style={{
              background: 'linear-gradient(90deg, #f97316, #fbbf24, #f97316)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'shimmer 2.5s linear infinite',
            }}>
              Australian solar.
            </span>
          </h1>

          <p className="a3" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', lineHeight: 1.8, maxWidth: '320px', fontWeight: 300 }}>
            Answer every call. Draft every email.<br />Track every ticket. Automatically.
          </p>

          <div className="a4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginTop: '32px' }}>

            {/* Stat 1 — 18hrs */}
            <div className="stat" style={{ padding: '20px 18px', minHeight: '100px' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>18hrs</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '3px', fontWeight: 400 }}>saved per week</div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0 8px' }} />
              <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                <div style={{ width: '74%', height: '100%', background: '#f97316', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
                <span>vs last week</span><span style={{ color: '#f97316' }}>+2.4hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>
                <span>this month</span><span>68hrs total</span>
              </div>
            </div>

            {/* Stat 2 — 99.2% */}
            <div className="stat" style={{ padding: '20px 18px', minHeight: '100px' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>99.2%</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '3px', fontWeight: 400 }}>AI accuracy</div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0 8px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '0' }}>
                <span>Bills read</span><span>847</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>
                <span>Emails drafted</span><span>1,204</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span style={{ fontSize: '9px', color: '#22c55e' }}>All systems operational</span>
              </div>
            </div>

            {/* Stat 3 — 4.2m */}
            <div className="stat" style={{ padding: '20px 18px', minHeight: '100px' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>4.2m</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '3px', fontWeight: 400 }}>avg response</div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0 8px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                <span>Fastest reply</span><span style={{ color: '#f97316' }}>0.8m</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>
                <span>vs industry avg</span><span>4x faster</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '9px', color: '#22c55e' }}>↑ Improving</span>
              </div>
            </div>

          </div>
        </div>

        {/* Floating UI Card Stack */}
        <div className="a4" style={{ position: 'relative', zIndex: 10, height: '260px', width: '100%', marginTop: '32px', marginBottom: '32px', filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.5))' }}>

          {/* Card 3 — Voice Agent (back, right) */}
          <div style={{
            position: 'absolute', right: '5%', top: '55%',
            transform: 'rotate(5deg) translateY(-50%)',
            animation: 'float3 3.8s ease-in-out infinite 1s',
            width: '280px', minHeight: '180px', background: '#0f1623',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '16px 18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#f97316', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Voice Agent</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 600, color: '#34c759' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34c759', display: 'inline-block' }} />LIVE
              </span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>John T.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>2:34</span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '20px', padding: '2px 8px' }}>New Enquiry</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '28px', marginBottom: '12px' }}>
              {[6, 14, 10, 20, 16, 24, 12, 18, 8, 22, 14, 10].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: '2px', background: i % 2 === 0 ? '#f97316' : 'rgba(251,146,60,0.4)' }} />
              ))}
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '8px' }} />
            {[
              { l: 'Caller', v: <span style={{ color: 'white', fontWeight: 600 }}>John T.</span> },
              { l: 'Classified as', v: <span style={{ fontSize: '9px', fontWeight: 600, color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '20px', padding: '1px 6px' }}>New Enquiry</span> },
              { l: 'Callback', v: <span style={{ color: 'white', fontWeight: 600 }}>Today afternoon</span> },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                <span>{r.l}</span>
                {r.v}
              </div>
            ))}
            <div style={{ marginTop: '8px', fontSize: '9px', color: '#34c759' }}>✓ Transcript ready</div>
          </div>

          {/* Card 2 — Inbox Draft (middle) */}
          <div style={{
            position: 'absolute', left: '50%', top: '40%',
            transform: 'translateX(-50%) rotate(2deg) translateY(-50%)',
            animation: 'float2 4.5s ease-in-out infinite 0.5s',
            width: '280px', minHeight: '180px', background: '#0f1623',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '16px 18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 2,
          }}>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#f97316', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Inbox Assistant</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'white', marginBottom: '2px' }}>Sarah M.</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Re: Solar Quote Request</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginBottom: '10px' }}>
              Hi Sarah, thanks for getting in touch about<br />your solar installation. I'd be happy to...
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '10px' }} />
            <button style={{ width: '100%', padding: '7px', background: 'linear-gradient(135deg, #f97316, #fbbf24)', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: 'white', cursor: 'default', marginBottom: '8px' }}>
              Send Draft
            </button>
            <div style={{ textAlign: 'center', fontSize: '9px', color: '#f97316' }}>AI drafted · 2 seconds ago</div>
          </div>

          {/* Card 1 — Dashboard (front, left) */}
          <div style={{
            position: 'absolute', left: '5%', top: '50%',
            transform: 'rotate(-6deg) translateY(-50%)',
            animation: 'float1 4s ease-in-out infinite',
            width: '280px', minHeight: '180px', background: '#0f1623',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '16px 18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 3,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#f97316', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Dashboard</span>
              <span style={{ fontSize: '9px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '2px 8px' }}>Today</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {[{ v: '12', l: 'Calls' }, { v: '8', l: 'Drafts' }, { v: '3', l: 'Bills' }].map((s, i) => (
                <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{s.v}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '36px', marginBottom: '12px' }}>
              {[18, 28, 22, 34, 26, 40, 30].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: '3px 3px 0 0', background: i === 5 ? '#f97316' : i === 6 ? '#fbbf24' : 'rgba(251,146,60,0.3)' }} />
              ))}
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '8px' }} />
            {[{ l: 'Bills Processed', v: '47' }, { l: 'Emails Drafted', v: '183' }, { l: 'Calls Answered', v: '91' }].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                <span>{r.l}</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
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
      <div style={{ flex: '1 1 0', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '64px 48px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, transparent, #f97316, transparent)' }} />

        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div className="a1">
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: '6px', textAlign: 'center' }}>
              Welcome back
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '32px', fontWeight: 400, textAlign: 'center' }}>
              Sign in to your SolarOps workspace
            </p>
          </div>

          <div className="a2">
            <button className="gbtn" onClick={handleGoogleSignIn}>
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <div className="a3" style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '22px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          </div>

          <div className="a3" style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              New to SolarOps?{' '}
              <a href="#" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>
                Request access →
              </a>
            </span>
          </div>

          <div className="a4" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="badge"><span>🔒</span>SOC 2 Ready</span>
            <span className="badge"><span>🇦🇺</span>Australian</span>
            <span className="badge"><span>⚡</span>Solar-specific</span>
          </div>
        </div>

        <div className="a5" style={{ position: 'absolute', bottom: '28px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
            By signing in, you agree to our{' '}
            <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Privacy Policy</a>
          </span>
        </div>
      </div>
    </div>
  );
}
