CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  module TEXT NOT NULL,
  customer_name TEXT,
  retailer TEXT,
  service TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6) NOT NULL,
  status TEXT DEFAULT 'success'
);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON api_usage_log
  FOR ALL USING (
    tenant_id IS NULL
    OR tenant_id = (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()::text LIMIT 1
    )
  );
