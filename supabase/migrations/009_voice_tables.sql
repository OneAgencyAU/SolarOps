CREATE TABLE IF NOT EXISTS voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  vapi_call_id text UNIQUE,
  caller_number text,
  caller_name text,
  caller_email text,
  caller_suburb text,
  reason text,
  call_type text,
  callback_window text,
  transcript text,
  summary text,
  status text DEFAULT 'completed',
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text UNIQUE NOT NULL,
  assistant_id text,
  business_name text,
  notification_email text,
  phone_number text,
  is_live boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
