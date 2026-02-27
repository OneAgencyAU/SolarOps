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
    <div className="onboarding-page">
      <div className="onboarding-bg-gradient" />
      <div className="onboarding-card">
        <h2 className="onboarding-title">Set up your workspace</h2>
        <p className="onboarding-subtitle">Tell us a bit about you and your solar business</p>
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-row">
            <div className="form-group">
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
            <div className="form-group">
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
          <div className="form-group">
            <label htmlFor="businessName">Business name</label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sunrise Solar Co."
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="submit-btn" disabled={submitting || !canSubmit}>
            {submitting ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
