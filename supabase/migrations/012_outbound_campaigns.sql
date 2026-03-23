-- ============================================================
-- Migration 012: Outbound Campaigns Schema
-- Adds outbound voice campaign support (PRD Phase 1)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. voice_config: add outbound agent ID column
-- ──────────────────────────────────────────────────────────────
ALTER TABLE voice_config
  ADD COLUMN IF NOT EXISTS retell_agent_id_outbound TEXT;

-- ──────────────────────────────────────────────────────────────
-- 2. outbound_campaigns: add missing columns to existing table
--    Existing columns: id, tenant_id, name, campaign_type,
--    script, lead_count, retell_batch_id, status, created_at, voice
-- ──────────────────────────────────────────────────────────────
ALTER TABLE outbound_campaigns
  ADD COLUMN IF NOT EXISTS script_template TEXT,
  ADD COLUMN IF NOT EXISTS script_prompt TEXT,
  ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT '11labs-Adrian',
  ADD COLUMN IF NOT EXISTS caller_id TEXT,
  ADD COLUMN IF NOT EXISTS call_window_start TIME,
  ADD COLUMN IF NOT EXISTS call_window_end TIME,
  ADD COLUMN IF NOT EXISTS call_window_days TEXT[],
  ADD COLUMN IF NOT EXISTS on_interest TEXT DEFAULT 'offer_choice',
  ADD COLUMN IF NOT EXISTS transfer_number TEXT,
  ADD COLUMN IF NOT EXISTS max_concurrent INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS voicemail_action TEXT DEFAULT 'leave_message',
  ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calls_made INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calls_answered INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calls_interested INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS callbacks_booked INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retell_batch_call_id TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ──────────────────────────────────────────────────────────────
-- 3. outbound_contacts: per-contact call tracking
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES outbound_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  custom_data JSONB,
  status TEXT DEFAULT 'pending',
  outcome TEXT,
  callback_preference TEXT,
  sentiment TEXT,
  call_summary TEXT,
  questions_asked TEXT,
  transcript TEXT,
  recording_url TEXT,
  retell_call_id TEXT,
  call_duration INTEGER,
  call_cost DECIMAL(10,4),
  called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_contacts_campaign
  ON outbound_contacts(campaign_id);

CREATE INDEX IF NOT EXISTS idx_outbound_contacts_retell_call
  ON outbound_contacts(retell_call_id)
  WHERE retell_call_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 4. campaign_templates: system + tenant-custom prompt templates
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  category TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 5. Seed system templates
-- ──────────────────────────────────────────────────────────────

-- Battery Rebate Reactivation (full prompt from PRD section 3.4)
INSERT INTO campaign_templates (tenant_id, name, description, prompt_template, category, is_system)
VALUES (
  NULL,
  'Battery Rebate Reactivation',
  'Re-engage past solar customers about the government battery rebate. Best for customers who installed solar but don''t yet have a battery.',
  E'## Identity\nYou are calling on behalf of {{business_name}}. Your name is {{agent_name}}. You are friendly, natural, and Australian. You speak conversationally — not like a robot or telemarketer.\n\n## Context\nYou are calling {{customer_name}} who is an existing customer of {{business_name}}. They previously had solar panels installed. You are reaching out about the government battery rebate that could save them significant money on a home battery system.\n\n## Your Task\n1. Greet them warmly and confirm you''re speaking with {{customer_name}}\n2. Briefly explain why you''re calling — their solar company wanted to let them know about the government battery rebate\n3. Ask if they''ve heard about the rebate or if they already have a battery\n4. If interested: ask if they''d like to speak with someone from the team now, or if they''d prefer a callback at a time that suits\n5. If they want to speak now: transfer the call to {{transfer_number}}\n6. If they want a callback: ask what day (today/tomorrow/this week) and time (morning/afternoon) works best\n7. Thank them and wrap up\n\n## Rules\n- Keep the call under 2 minutes unless the customer wants to chat\n- Never promise specific savings amounts, prices, or rebate values\n- If they ask technical questions about batteries, say "That''s a great question — the team can give you all the details on that"\n- If they say they''re not interested, thank them and end the call politely\n- If they say "take me off your list" or "don''t call again", say "Absolutely, I''ll make sure you''re removed. Sorry to have bothered you" and end the call\n- If you reach voicemail: "Hi {{customer_name}}, this is {{agent_name}} calling from {{business_name}}. We wanted to let you know about the government battery rebate that could save you money on a home battery. Give us a call back on {{agent_number}} when you get a chance. Thanks!"\n- Always be respectful of their time\n- Use Australian English (e.g., "no worries", "cheers")\n\n## Current Time\nIt is currently {{current_time_Australia/Sydney}}.',
  'rebate',
  true
)
ON CONFLICT DO NOTHING;

-- Maintenance Check-In
INSERT INTO campaign_templates (tenant_id, name, description, prompt_template, category, is_system)
VALUES (
  NULL,
  'Maintenance Check-In',
  'Annual service reminder for existing solar customers. Drives repeat business and keeps customers engaged.',
  E'## Identity\nYou are calling on behalf of {{business_name}}. Your name is {{agent_name}}. You are friendly, natural, and Australian. You speak conversationally — not like a robot or telemarketer.\n\n## Context\nYou are calling {{customer_name}} who is an existing customer of {{business_name}}. Their solar system is coming up for its annual service check.\n\n## Your Task\n1. Greet them warmly and confirm you''re speaking with {{customer_name}}\n2. Let them know their solar system is due for its annual health check\n3. Explain briefly what the service includes (panel inspection, inverter check, performance review)\n4. Ask if they''d like to book a service visit\n5. If yes: ask what day and time works best (morning/afternoon, this week/next week)\n6. If not now: ask if they''d like a callback at a better time\n7. Thank them and wrap up\n\n## Rules\n- Keep the call under 2 minutes\n- Never quote specific service prices — say "the team will confirm pricing when they call back"\n- If they mention any issues with their system, note it down and say the team will prioritise looking at that\n- If they say they''re not interested, thank them and end the call politely\n- If you reach voicemail: "Hi {{customer_name}}, this is {{agent_name}} from {{business_name}}. Just a quick call to let you know your solar system is due for its annual check-up. Give us a call back on {{agent_number}} to book a time. Cheers!"\n- Use Australian English\n\n## Current Time\nIt is currently {{current_time_Australia/Sydney}}.',
  'maintenance',
  true
)
ON CONFLICT DO NOTHING;

-- New Product Announcement
INSERT INTO campaign_templates (tenant_id, name, description, prompt_template, category, is_system)
VALUES (
  NULL,
  'New Product Announcement',
  'Announce a new product or offering (e.g., new battery model, EV charger) to existing customers.',
  E'## Identity\nYou are calling on behalf of {{business_name}}. Your name is {{agent_name}}. You are friendly, natural, and Australian. You speak conversationally — not like a robot or telemarketer.\n\n## Context\nYou are calling {{customer_name}} who is an existing customer of {{business_name}}. You are reaching out to let them know about a new product offering.\n\n## Your Task\n1. Greet them warmly and confirm you''re speaking with {{customer_name}}\n2. Let them know {{business_name}} has a new offering they might be interested in\n3. Give a brief overview — keep it high-level and exciting, not technical\n4. Ask if they''d like to learn more or speak with someone from the team\n5. If yes: ask if they''d like to be connected now or prefer a callback\n6. If callback: ask what day and time works best\n7. Thank them and wrap up\n\n## Rules\n- Keep the call under 2 minutes\n- Never quote specific prices — say "the team can give you a personalised quote"\n- Keep the tone excited but not pushy\n- If they say they''re not interested, thank them and end the call politely\n- If you reach voicemail: "Hi {{customer_name}}, this is {{agent_name}} from {{business_name}}. We''ve got something new we think you''ll love — give us a call back on {{agent_number}} when you get a chance. Cheers!"\n- Use Australian English\n\n## Current Time\nIt is currently {{current_time_Australia/Sydney}}.',
  'announcement',
  true
)
ON CONFLICT DO NOTHING;
