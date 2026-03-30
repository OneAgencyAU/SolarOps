import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

// List quotes for a tenant
router.get('/api/quotes/list', async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('tenant_id', tenant_id as string)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Quotes List]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch (err: any) {
    console.error('[Quotes List]', err);
    res.status(500).json({ error: err.message });
  }
});

// Get quote stats/analytics for a tenant
router.get('/api/quotes/stats', async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('quote_value, status, created_at, updated_at')
      .eq('tenant_id', tenant_id as string);

    if (error) {
      console.error('[Quotes Stats]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    const all = quotes || [];
    const totalQuoted = all.reduce((sum, q) => sum + (q.quote_value || 0), 0);
    const accepted = all.filter(q => q.status === 'Accepted');
    const acceptedCount = accepted.length;
    const acceptedPct = all.length > 0 ? Math.round((acceptedCount / all.length) * 100) : 0;
    const avgQuoteValue = all.length > 0 ? Math.round(totalQuoted / all.length) : 0;

    // Average acceptance time: days between created_at and updated_at for accepted quotes
    let avgAcceptanceDays = 0;
    if (accepted.length > 0) {
      const totalDays = accepted.reduce((sum, q) => {
        const created = new Date(q.created_at).getTime();
        const updated = new Date(q.updated_at).getTime();
        return sum + (updated - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgAcceptanceDays = Math.round(totalDays / accepted.length);
    }

    res.json({
      total_quoted: totalQuoted,
      accepted_count: acceptedCount,
      accepted_pct: acceptedPct,
      avg_quote_value: avgQuoteValue,
      avg_acceptance_days: avgAcceptanceDays,
      total_count: all.length,
    });
  } catch (err: any) {
    console.error('[Quotes Stats]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
