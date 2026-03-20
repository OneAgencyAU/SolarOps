ALTER TABLE voice_config
  ADD COLUMN IF NOT EXISTS telnyx_connection_id TEXT;
