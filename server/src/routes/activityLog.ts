import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

router.get('/api/activity-log', async (req: Request, res: Response) => {
  const { tenant_id, limit = '50' } = req.query;
  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('tenant_id', tenant_id as string)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (error) {
    console.error('[ActivityLog] Query error:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.get('/api/activity-log/stats', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('activity_log')
    .select('status')
    .eq('tenant_id', tenant_id as string)
    .gte('created_at', todayStart.toISOString());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = data || [];
  const total = rows.length;
  const success = rows.filter(r => r.status === 'success').length;
  const failed = rows.filter(r => r.status === 'failed').length;
  const rate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';

  res.json({ total, success, failed, successRate: rate });
});

export default router;
