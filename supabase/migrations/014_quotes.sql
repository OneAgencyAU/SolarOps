-- ──────────────────────────────────────────────────────────────
-- 014: Quotes table
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_number text NOT NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  property_address text,
  system_size_kw numeric,
  quote_value numeric,
  status text NOT NULL DEFAULT 'Draft',
  expiry_date date,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  quote_data jsonb DEFAULT '{}'::jsonb
);

-- Index for tenant lookups + ordering
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id, created_at DESC);

-- Auto-incrementing quote number sequence per tenant
-- Uses a helper function to generate Q-001, Q-002, etc.
CREATE OR REPLACE FUNCTION generate_quote_number(p_tenant_id uuid)
RETURNS text AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(quote_number, 'Q-', '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM quotes
  WHERE tenant_id = p_tenant_id;

  RETURN 'Q-' || LPAD(next_num::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
