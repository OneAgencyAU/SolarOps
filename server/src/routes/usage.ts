import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

router.get('/api/usage/summary', async (req: Request, res: Response) => {
  try {
    const { month } = req.query;

    let query = supabase
      .from('api_usage_log')
      .select('service, cost_usd, status, module');

    if (month && typeof month === 'string') {
      const start = `${month}-01T00:00:00.000Z`;
      const [y, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      const end = `${nextMonth}-01T00:00:00.000Z`;
      query = query.gte('created_at', start).lt('created_at', end);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const rows = data || [];

    const total_cost = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
    const total_calls = rows.length;
    const bills_processed = rows.filter(
      (r) => r.service === 'claude_sonnet' && r.status === 'success'
    ).length;

    const serviceMap: Record<string, { total_cost: number; total_calls: number }> = {};
    for (const r of rows) {
      if (!serviceMap[r.service]) serviceMap[r.service] = { total_cost: 0, total_calls: 0 };
      serviceMap[r.service].total_cost += Number(r.cost_usd);
      serviceMap[r.service].total_calls += 1;
    }

    const by_service = Object.entries(serviceMap).map(([service, s]) => ({
      service,
      total_cost: s.total_cost,
      total_calls: s.total_calls,
      per_call: s.total_calls > 0 ? s.total_cost / s.total_calls : 0,
    }));

    res.json({ total_cost, total_calls, bills_processed, by_service });
  } catch (err: any) {
    console.error('[Usage] Summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/usage/log', async (req: Request, res: Response) => {
  try {
    const { month, limit = '50' } = req.query;

    let query = supabase
      .from('api_usage_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (month && typeof month === 'string') {
      const start = `${month}-01T00:00:00.000Z`;
      const [y, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      const end = `${nextMonth}-01T00:00:00.000Z`;
      query = query.gte('created_at', start).lt('created_at', end);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch (err: any) {
    console.error('[Usage] Log error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
