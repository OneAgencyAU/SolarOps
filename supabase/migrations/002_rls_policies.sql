-- SELECT policies for frontend reads (anon key).
-- Writes are routed through the backend (service role key) and bypass RLS.

CREATE POLICY "Allow anon select on tenants"
  ON tenants FOR SELECT
  USING (true);

CREATE POLICY "Allow anon select on users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Allow anon select on tenant_memberships"
  ON tenant_memberships FOR SELECT
  USING (true);
