import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

function getMonthRange(month: string) {
  const start = `${month}-01T00:00:00.000Z`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const end = `${nextMonth}-01T00:00:00.000Z`;
  return { start, end };
}

router.get('/api/usage/summary', async (req: Request, res: Response) => {
  try {
    const { month, tenant_id, modules } = req.query;

    let query = supabase
      .from('api_usage_log')
      .select('service, cost_usd, status, module');

    if (tenant_id) {
      query = query.or(`tenant_id.eq.${tenant_id},tenant_id.is.null`);
    }
    if (month && typeof month === 'string') {
      const { start, end } = getMonthRange(month);
      query = query.gte('created_at', start).lt('created_at', end);
    }
    if (modules && typeof modules === 'string') {
      const moduleList = modules.split(',').filter(Boolean);
      if (moduleList.length > 0) query = query.in('module', moduleList);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    const rows = data || [];
    const total_cost = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
    const total_calls = rows.length;
    const bills_processed = rows.filter(r => r.module === 'bill_reader' && r.service === 'claude_sonnet' && r.status === 'success').length;

    const serviceMap: Record<string, { total_cost: number; total_calls: number }> = {};
    const moduleMap: Record<string, { total_cost: number; total_calls: number }> = {};

    for (const r of rows) {
      if (!serviceMap[r.service]) serviceMap[r.service] = { total_cost: 0, total_calls: 0 };
      serviceMap[r.service].total_cost += Number(r.cost_usd);
      serviceMap[r.service].total_calls += 1;

      const mod = r.module || 'unknown';
      if (!moduleMap[mod]) moduleMap[mod] = { total_cost: 0, total_calls: 0 };
      moduleMap[mod].total_cost += Number(r.cost_usd);
      moduleMap[mod].total_calls += 1;
    }

    const by_service = Object.entries(serviceMap).map(([service, s]) => ({
      service, total_cost: s.total_cost, total_calls: s.total_calls,
      per_call: s.total_calls > 0 ? s.total_cost / s.total_calls : 0,
    }));

    const by_module = Object.entries(moduleMap).map(([module, s]) => ({
      module, total_cost: s.total_cost, total_calls: s.total_calls,
      per_call: s.total_calls > 0 ? s.total_cost / s.total_calls : 0,
    }));

    res.json({ total_cost, total_calls, bills_processed, by_service, by_module });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/usage/log', async (req: Request, res: Response) => {
  try {
    const { month, limit = '100', tenant_id, modules } = req.query;

    let query = supabase
      .from('api_usage_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (tenant_id) {
      query = query.or(`tenant_id.eq.${tenant_id},tenant_id.is.null`);
    }
    if (month && typeof month === 'string') {
      const { start, end } = getMonthRange(month);
      query = query.gte('created_at', start).lt('created_at', end);
    }
    if (modules && typeof modules === 'string') {
      const moduleList = modules.split(',').filter(Boolean);
      if (moduleList.length > 0) query = query.in('module', moduleList);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/usage/modules', async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    let query = supabase.from('api_usage_log').select('module');
    if (tenant_id) {
      query = query.or(`tenant_id.eq.${tenant_id},tenant_id.is.null`);
    }
    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    const modules = [...new Set((data || []).map(r => r.module).filter(Boolean))];
    res.json(modules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
