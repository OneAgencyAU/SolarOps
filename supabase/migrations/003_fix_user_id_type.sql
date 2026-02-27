ALTER TABLE tenant_memberships DROP CONSTRAINT IF EXISTS tenant_memberships_user_id_fkey;
ALTER TABLE users ALTER COLUMN id TYPE TEXT;
ALTER TABLE tenant_memberships ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE tenant_memberships ADD CONSTRAINT tenant_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
