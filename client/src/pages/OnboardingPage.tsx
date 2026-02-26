import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/OnboardingPage.css';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessName.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const slug = slugify(businessName);

      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ name: businessName.trim(), slug })
        .select()
        .single();

      if (tenantErr) throw tenantErr;

      const { error: memberErr } = await supabase
        .from('tenant_memberships')
        .insert({ tenant_id: tenant.id, user_id: user.uid, role: 'admin' });

      if (memberErr) throw memberErr;

      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
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
        <p className="onboarding-subtitle">Tell us the name of your solar business</p>
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-group">
            <label htmlFor="businessName">Business name</label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sunrise Solar Co."
              required
              autoFocus
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="submit-btn" disabled={submitting || !businessName.trim()}>
            {submitting ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
