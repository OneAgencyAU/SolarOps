CREATE TABLE IF NOT EXISTS automation_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  job_type        text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  payload         jsonb DEFAULT '{}',
  result          jsonb DEFAULT NULL,
  error_message   text DEFAULT NULL,
  attempts        int DEFAULT 0,
  max_attempts    int DEFAULT 3,
  next_run_at     timestamptz DEFAULT now(),
  last_run_at     timestamptz DEFAULT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_status_next_run
  ON automation_jobs (status, next_run_at);

CREATE TABLE IF NOT EXISTS activity_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  module          text NOT NULL,
  action          text NOT NULL,
  details         text,
  trigger         text DEFAULT 'system',
  status          text NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_created
  ON activity_log (tenant_id, created_at DESC);
