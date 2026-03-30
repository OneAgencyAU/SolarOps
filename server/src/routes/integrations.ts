import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

// Get integration status for a provider (never exposes client_secret)
router.get('/api/integrations/status', async (req: Request, res: Response) => {
  try {
    const { tenant_id, provider } = req.query;
    if (!tenant_id || !provider) {
      res.status(400).json({ error: 'tenant_id and provider are required' });
      return;
    }

    const { data, error } = await supabase
      .from('integrations')
      .select('id, tenant_id, provider, site_url, client_id, connected_at, is_active')
      .eq('tenant_id', tenant_id as string)
      .eq('provider', provider as string)
      .maybeSingle();

    if (error) {
      console.error('[Integration Status]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data || !data.is_active) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      site_url: data.site_url,
      client_id: data.client_id,
      connected_at: data.connected_at,
    });
  } catch (err: any) {
    console.error('[Integration Status]', err);
    res.status(500).json({ error: err.message });
  }
});

// Save (upsert) integration credentials
router.post('/api/integrations/connect', async (req: Request, res: Response) => {
  try {
    const { tenant_id, provider, site_url, client_id, client_secret } = req.body;

    if (!tenant_id || !provider || !site_url || !client_id || !client_secret) {
      res.status(400).json({ error: 'All fields are required: tenant_id, provider, site_url, client_id, client_secret' });
      return;
    }

    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        tenant_id,
        provider,
        site_url,
        client_id,
        client_secret,
        connected_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: 'tenant_id,provider' })
      .select('id, tenant_id, provider, site_url, client_id, connected_at, is_active')
      .single();

    if (error) {
      console.error('[Integration Connect]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[Integration Connect]', err);
    res.status(500).json({ error: err.message });
  }
});

// Disconnect (soft-delete — sets is_active to false)
router.post('/api/integrations/disconnect', async (req: Request, res: Response) => {
  try {
    const { tenant_id, provider } = req.body;
    if (!tenant_id || !provider) {
      res.status(400).json({ error: 'tenant_id and provider are required' });
      return;
    }

    const { error } = await supabase
      .from('integrations')
      .update({ is_active: false })
      .eq('tenant_id', tenant_id)
      .eq('provider', provider);

    if (error) {
      console.error('[Integration Disconnect]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Integration Disconnect]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
