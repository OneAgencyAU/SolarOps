-- ──────────────────────────────────────────────────────────────
-- 015: Integrations table (SimPro and future providers)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  site_url text,
  client_id text,
  client_secret text,
  connected_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON integrations(tenant_id);
