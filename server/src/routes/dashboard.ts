import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

router.get('/api/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const { tenant_id, period } = req.query as { tenant_id?: string; period?: string };

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    let since: string | null = null;
    if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      since = d.toISOString();
    } else if (period === 'month') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      since = d.toISOString();
    }

    const applyPeriod = (q: any) => since ? q.gte('created_at', since) : q;

    const [
      voiceAllRes,
      voiceTodayRes,
      callbackRes,
      durationRes,
      voiceConfigRes,
      emailsAllRes,
      emailsTodayRes,
      emailsUnreadRes,
      draftsAllRes,
      draftsTodayRes,
      recentCallsRes,
      recentEmailsRes,
    ] = await Promise.all([
      applyPeriod(supabase.from('voice_calls').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id)),
      supabase.from('voice_calls').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).gte('created_at', startOfToday),
      applyPeriod(supabase.from('voice_calls').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).eq('callback_requested', true)),
      applyPeriod(supabase.from('voice_calls').select('duration_seconds').eq('tenant_id', tenant_id).not('duration_seconds', 'is', null)),
      supabase.from('voice_config').select('is_live').eq('tenant_id', tenant_id).maybeSingle(),
      applyPeriod(supabase.from('inbox_emails').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id)),
      supabase.from('inbox_emails').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).gte('created_at', startOfToday),
      applyPeriod(supabase.from('inbox_emails').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).eq('is_read', false)),
      applyPeriod(supabase.from('inbox_drafts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id)),
      supabase.from('inbox_drafts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).gte('created_at', startOfToday),
      applyPeriod(supabase.from('voice_calls').select('caller_name,reason,call_type,created_at').eq('tenant_id', tenant_id).order('created_at', { ascending: false }).limit(5)),
      applyPeriod(supabase.from('inbox_emails').select('subject,from_name,created_at').eq('tenant_id', tenant_id).order('created_at', { ascending: false }).limit(5)),
    ]);

    const total_calls = voiceAllRes.count ?? 0;
    const calls_today = voiceTodayRes.count ?? 0;
    const callback_requests = callbackRes.count ?? 0;

    const durations: number[] = (durationRes.data ?? []).map((r: any) => r.duration_seconds).filter((v: any) => typeof v === 'number');
    const avg_duration_seconds = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const is_agent_live: boolean = voiceConfigRes.data?.is_live ?? false;

    const emails_received = emailsAllRes.count ?? 0;
    const emails_received_today = emailsTodayRes.count ?? 0;
    const unread_count = emailsUnreadRes.count ?? 0;

    const emails_drafted = draftsAllRes.count ?? 0;
    const emails_drafted_today = draftsTodayRes.count ?? 0;

    const minutes_saved = (total_calls * 4) + (emails_drafted * 3);
    const hours_saved = Math.floor(minutes_saved / 60);
    const mins_remainder = minutes_saved % 60;
    const salary_saved = Math.round((minutes_saved / 60) * 42);

    const callActivities = (recentCallsRes.data ?? []).map((c: any) => ({
      type: 'call',
      title: c.caller_name || 'Unknown caller',
      subtitle: c.reason || c.call_type || '',
      time: c.created_at,
      meta: c.call_type || '',
    }));

    const emailActivities = (recentEmailsRes.data ?? []).map((e: any) => ({
      type: 'email',
      title: e.subject || '(no subject)',
      subtitle: e.from_name || '',
      time: e.created_at,
      meta: 'received',
    }));

    const recent_activity = [...callActivities, ...emailActivities]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);

    res.json({
      voice: {
        total_calls,
        calls_today,
        callback_requests,
        avg_duration_seconds,
        is_agent_live,
      },
      email: {
        emails_received,
        emails_received_today,
        unread_count,
      },
      drafts: {
        emails_drafted,
        emails_drafted_today,
      },
      time_saved: {
        minutes_saved,
        hours_saved,
        mins_remainder,
        salary_saved,
      },
      recent_activity,
    });
  } catch (err: any) {
    console.error('[Dashboard] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
