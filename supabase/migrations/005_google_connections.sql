CREATE TABLE google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  scopes TEXT[],
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX google_connections_tenant_user_idx
  ON google_connections (tenant_id, user_id);

ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on google_connections"
  ON google_connections FOR SELECT USING (true);
