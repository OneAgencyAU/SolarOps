import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const { user, tenant, loading } = useAuth();
  const navigate = useNavigate();

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
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-grid" />
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-orb login-orb--3" />
        <div className="login-left-content">
          <div className="login-brand">
            <span className="login-brand-icon">⊙</span>
            <span className="login-brand-name">SolarOps</span>
          </div>
          <p className="login-brand-tagline">AI operations for solar businesses</p>

          <div className="login-stats-row">
            <div className="login-stat">
              <div className="login-stat-num">18hrs</div>
              <div className="login-stat-label">saved per week</div>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <div className="login-stat-num">99.2%</div>
              <div className="login-stat-label">AI success rate</div>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <div className="login-stat-num">4.2m</div>
              <div className="login-stat-label">avg response time</div>
            </div>
          </div>

          <div className="login-features">
            <div className="login-feature login-feature--1"><span className="login-dot" />Answer every call. Draft every email. Track every ticket.</div>
            <div className="login-feature login-feature--2"><span className="login-dot" />Built for Australian solar installers.</div>
            <div className="login-feature login-feature--3"><span className="login-dot" />Your team's AI operations layer.</div>
          </div>

          <div className="login-testimonial">
            <p className="login-testimonial-text">"SolarOps saves our team hours every week on emails and calls."</p>
            <p className="login-testimonial-attr">— Nat Elliott, Sol Energy</p>
          </div>
        </div>
        <div className="login-left-footer">Powered by ONE AGENCY</div>
      </div>

      <div className="login-right">
        <div className="login-right-content">
          <h1 className="login-welcome">Welcome back</h1>
          <p className="login-welcome-sub">Sign in to your SolarOps workspace</p>
          <button className="login-google-btn" onClick={handleGoogleSignIn}>
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-text">or</span>
            <span className="login-divider-line" />
          </div>
          <div className="login-access">
            <span className="login-access-text">New to SolarOps?</span>
            <span className="login-access-link">Request access →</span>
          </div>
          <div className="login-trust-badges">
            <span className="login-badge">🔒 SOC 2 Ready</span>
            <span className="login-badge">🇦🇺 Australian</span>
            <span className="login-badge">⚡ Solar-specific</span>
          </div>
        </div>
        <div className="login-right-footer">By signing in, you agree to our Terms of Service and Privacy Policy</div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
