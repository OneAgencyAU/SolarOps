import { createClient } from '@supabase/supabase-js';
import { syncGmailForTenant } from './inboxSync';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function logActivity(
  tenant_id: string,
  module: string,
  action: string,
  details: string,
  trigger: string,
  status: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from('activity_log').insert({
      tenant_id,
      module,
      action,
      details,
      trigger,
      status,
      metadata,
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to insert:', err);
  }
}

async function executeInboxSync(payload: Record<string, any>): Promise<Record<string, any>> {
  const tenant_id = payload.tenant_id;
  if (!tenant_id) throw new Error('tenant_id missing from payload');
  const result = await syncGmailForTenant(tenant_id);
  return result;
}

async function executeConnectionHealth(payload: Record<string, any>): Promise<Record<string, any>> {
  const tenant_id = payload.tenant_id;
  if (!tenant_id) throw new Error('tenant_id missing from payload');
  const warnings: string[] = [];

  const { data: gmailConns } = await supabase
    .from('inbox_connections')
    .select('id, email, token_expiry, provider')
    .eq('tenant_id', tenant_id);

  if (gmailConns) {
    for (const conn of gmailConns) {
      if (conn.token_expiry) {
        const expiry = new Date(conn.token_expiry).getTime();
        const now = Date.now();
        if (expiry < now) {
          warnings.push(`${conn.provider} token expired for ${conn.email}`);
        } else if (expiry - now < 30 * 60 * 1000) {
          warnings.push(`${conn.provider} token expiring soon for ${conn.email}`);
        }
      }
    }
  }

  const { data: msConns } = await supabase
    .from('tenant_connections')
    .select('tenant_id, ms_email, ms_connected_at')
    .eq('tenant_id', tenant_id);

  if (msConns && msConns.length > 0) {
    for (const conn of msConns) {
      if (!conn.ms_email) {
        warnings.push('Microsoft connection exists but no email stored');
      }
    }
  }

  return { checked: true, warnings };
}

async function executeWebhookEvent(payload: Record<string, any>): Promise<Record<string, any>> {
  return { stored: true, source: payload.source || 'unknown' };
}

async function processJob(job: any) {
  const jobId = job.id;
  const jobType = job.job_type;
  const tenantId = job.tenant_id;

  await supabase.from('automation_jobs').update({
    status: 'running',
    attempts: job.attempts + 1,
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);

  try {
    let result: Record<string, any>;

    switch (jobType) {
      case 'inbox_sync':
        result = await executeInboxSync(job.payload || { tenant_id: tenantId });
        break;
      case 'connection_health':
        result = await executeConnectionHealth(job.payload || { tenant_id: tenantId });
        break;
      case 'webhook_event':
        result = await executeWebhookEvent(job.payload || {});
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    await supabase.from('automation_jobs').update({
      status: 'success',
      result,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log(`[JobRunner] ${jobType} ${tenantId} success`);

    const moduleMap: Record<string, string> = {
      inbox_sync: 'inbox',
      connection_health: 'connections',
      webhook_event: 'system',
    };
    const actionMap: Record<string, string> = {
      inbox_sync: 'inbox_synced',
      connection_health: 'connection_check',
      webhook_event: 'webhook_received',
    };

    const details = jobType === 'inbox_sync'
      ? `Synced ${result.synced || 0} of ${result.total || 0} emails`
      : jobType === 'connection_health'
        ? (result.warnings?.length ? result.warnings.join('; ') : 'All connections healthy')
        : `Webhook from ${result.source || 'unknown'}`;

    await logActivity(
      tenantId,
      moduleMap[jobType] || 'system',
      actionMap[jobType] || jobType,
      details,
      'system',
      'success',
      result
    );

  } catch (err: any) {
    const attempts = job.attempts + 1;
    const maxAttempts = job.max_attempts || 3;

    if (attempts < maxAttempts) {
      const backoffMs = attempts * 2 * 60 * 1000;
      const nextRun = new Date(Date.now() + backoffMs).toISOString();
      await supabase.from('automation_jobs').update({
        status: 'retrying',
        error_message: err.message,
        next_run_at: nextRun,
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      console.log(`[JobRunner] ${jobType} ${tenantId} retrying (attempt ${attempts}/${maxAttempts})`);
    } else {
      await supabase.from('automation_jobs').update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      console.log(`[JobRunner] ${jobType} ${tenantId} failed after ${attempts} attempts`);

      const moduleMap: Record<string, string> = {
        inbox_sync: 'inbox',
        connection_health: 'connections',
        webhook_event: 'system',
      };
      const actionMap: Record<string, string> = {
        inbox_sync: 'inbox_synced',
        connection_health: 'connection_check',
        webhook_event: 'webhook_received',
      };

      await logActivity(
        tenantId,
        moduleMap[jobType] || 'system',
        actionMap[jobType] || jobType,
        `Failed: ${err.message}`,
        'system',
        'failed',
        { error: err.message, attempts }
      );
    }
  }
}

async function runJobCycle() {
  try {
    const { data: jobs, error } = await supabase
      .from('automation_jobs')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[JobRunner] Query error:', error.message);
      return;
    }

    if (!jobs || jobs.length === 0) return;

    console.log(`[JobRunner] Processing ${jobs.length} job(s)`);

    for (const job of jobs) {
      try {
        await processJob(job);
      } catch (err: any) {
        console.error(`[JobRunner] Unhandled error for job ${job.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[JobRunner] Cycle error:', err.message);
  }
}

async function seedInboxSyncJobs() {
  try {
    const gmailTenants: string[] = [];
    const { data: gmailConns } = await supabase
      .from('inbox_connections')
      .select('tenant_id')
      .not('access_token', 'is', null);

    if (gmailConns) {
      for (const c of gmailConns) {
        if (!gmailTenants.includes(c.tenant_id)) gmailTenants.push(c.tenant_id);
      }
    }

    const { data: msConns } = await supabase
      .from('tenant_connections')
      .select('tenant_id')
      .not('ms_access_token', 'is', null);

    if (msConns) {
      for (const c of msConns) {
        if (!gmailTenants.includes(c.tenant_id)) gmailTenants.push(c.tenant_id);
      }
    }

    for (const tenant_id of gmailTenants) {
      const { data: existing } = await supabase
        .from('automation_jobs')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('job_type', 'inbox_sync')
        .in('status', ['pending', 'running'])
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('automation_jobs').insert({
          tenant_id,
          job_type: 'inbox_sync',
          status: 'pending',
          payload: { tenant_id },
          next_run_at: new Date().toISOString(),
        });
        console.log(`[JobRunner] Seeded inbox_sync for tenant ${tenant_id}`);
      }
    }
  } catch (err: any) {
    console.error('[JobRunner] Seed inbox_sync error:', err.message);
  }
}

async function seedConnectionHealthJobs() {
  try {
    const tenants: string[] = [];

    const { data: gmailConns } = await supabase
      .from('inbox_connections')
      .select('tenant_id')
      .not('access_token', 'is', null);

    if (gmailConns) {
      for (const c of gmailConns) {
        if (!tenants.includes(c.tenant_id)) tenants.push(c.tenant_id);
      }
    }

    const { data: msConns } = await supabase
      .from('tenant_connections')
      .select('tenant_id')
      .not('ms_access_token', 'is', null);

    if (msConns) {
      for (const c of msConns) {
        if (!tenants.includes(c.tenant_id)) tenants.push(c.tenant_id);
      }
    }

    for (const tenant_id of tenants) {
      const { data: existing } = await supabase
        .from('automation_jobs')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('job_type', 'connection_health')
        .in('status', ['pending', 'running'])
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('automation_jobs').insert({
          tenant_id,
          job_type: 'connection_health',
          status: 'pending',
          payload: { tenant_id },
          next_run_at: new Date().toISOString(),
        });
        console.log(`[JobRunner] Seeded connection_health for tenant ${tenant_id}`);
      }
    }
  } catch (err: any) {
    console.error('[JobRunner] Seed connection_health error:', err.message);
  }
}

export function startJobRunner() {
  console.log('[JobRunner] Starting job runner (60s interval)');
  const jobInterval = setInterval(runJobCycle, 60_000);

  console.log('[JobRunner] Starting inbox sync seeder (3m interval)');
  const syncInterval = setInterval(seedInboxSyncJobs, 3 * 60_000);

  console.log('[JobRunner] Starting connection health seeder (15m interval)');
  const healthInterval = setInterval(seedConnectionHealthJobs, 15 * 60_000);

  runJobCycle();
  seedInboxSyncJobs();
  seedConnectionHealthJobs();

  return { jobInterval, syncInterval, healthInterval };
}
