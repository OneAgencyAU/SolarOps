ALTER TABLE inbox_emails
ADD COLUMN IF NOT EXISTS message_id text;
