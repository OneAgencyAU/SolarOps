ALTER TABLE voice_config 
ADD COLUMN IF NOT EXISTS telnyx_number_id text,
ADD COLUMN IF NOT EXISTS telnyx_number text,
ADD COLUMN IF NOT EXISTS retell_agent_id text,
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 1;
