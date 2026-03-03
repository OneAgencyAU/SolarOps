import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/OnboardingPage.css';

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

  const canSubmit = firstName.trim() && lastName.trim() && businessName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit) return;

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

  return (
    <div className="ob-page">
      <div className="ob-left">
        <div className="ob-left-grid" />
        <div className="ob-orb ob-orb--1" />
        <div className="ob-orb ob-orb--2" />
        <div className="ob-orb ob-orb--3" />
        <div className="ob-left-content">
          <div className="ob-brand">
            <span className="ob-brand-icon">⊙</span>
            <span className="ob-brand-name">SolarOps</span>
          </div>
          <p className="ob-brand-tagline">AI operations for solar businesses</p>

          <div className="ob-stats-row">
            <div className="ob-stat">
              <div className="ob-stat-num">18hrs</div>
              <div className="ob-stat-label">saved per week</div>
            </div>
            <div className="ob-stat-divider" />
            <div className="ob-stat">
              <div className="ob-stat-num">99.2%</div>
              <div className="ob-stat-label">AI success rate</div>
            </div>
            <div className="ob-stat-divider" />
            <div className="ob-stat">
              <div className="ob-stat-num">4.2m</div>
              <div className="ob-stat-label">avg response time</div>
            </div>
          </div>

          <div className="ob-progress">
            <span className="ob-progress-label">Step 1 of 2</span>
            <div className="ob-progress-pills">
              <span className="ob-pill ob-pill--active">Workspace Setup</span>
              <span className="ob-pill ob-pill--inactive">Connect Tools</span>
            </div>
          </div>
          <p className="ob-progress-desc">You're 2 minutes away from your AI operations dashboard.</p>
        </div>
        <div className="ob-left-footer">Powered by ONE AGENCY</div>
      </div>

      <div className="ob-right">
        <div className="ob-right-content">
          <h1 className="ob-title">Set up your workspace</h1>
          <p className="ob-subtitle">Tell us about your solar business</p>

          <form onSubmit={handleSubmit} className="ob-form">
            <div className="ob-form-row">
              <div className="ob-field">
                <label htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alex"
                  required
                  autoFocus
                />
              </div>
              <div className="ob-field">
                <label htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Chen"
                  required
                />
              </div>
            </div>

            <div className="ob-field">
              <label htmlFor="businessName">Business name</label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Sol Energy"
                required
              />
            </div>

            <div className="ob-field">
              <label htmlFor="industry">Industry</label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                <option>Solar — Commercial & Residential</option>
                <option>Solar — Commercial Only</option>
                <option>Solar — Residential Only</option>
                <option>Solar + Battery Storage</option>
                <option>Solar EPC / Contractor</option>
              </select>
            </div>

            <div className="ob-field">
              <label htmlFor="teamSize">Team size</label>
              <select
                id="teamSize"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
              >
                <option>Just me</option>
                <option>2–5 people</option>
                <option>6–15 people</option>
                <option>16–50 people</option>
                <option>50+ people</option>
              </select>
            </div>

            {error && <p className="ob-error">{error}</p>}

            <button type="submit" className="ob-submit" disabled={submitting || !canSubmit}>
              {submitting ? 'Creating workspace…' : 'Create my workspace →'}
            </button>
          </form>

          <p className="ob-signin-link">Already have a workspace? <span className="ob-signin-action">Sign in →</span></p>
        </div>
      </div>
    </div>
  );
}
