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

// Create a new quote (draft)
router.post('/api/quotes/create', async (req: Request, res: Response) => {
  try {
    const {
      tenant_id, customer_name, customer_email, customer_phone,
      property_address, system_size_kw, quote_value, expiry_date,
      created_by, quote_data,
    } = req.body;

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    // Generate quote number
    const { data: numResult, error: numErr } = await supabase
      .rpc('generate_quote_number', { p_tenant_id: tenant_id });

    if (numErr) {
      console.error('[Quote Create] quote number generation failed:', numErr);
      res.status(500).json({ error: numErr.message });
      return;
    }

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        tenant_id,
        quote_number: numResult,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        property_address: property_address || null,
        system_size_kw: system_size_kw || null,
        quote_value: quote_value || null,
        status: 'Draft',
        expiry_date: expiry_date || null,
        created_by: created_by || null,
        quote_data: quote_data || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Quote Create]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Quote Create]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
