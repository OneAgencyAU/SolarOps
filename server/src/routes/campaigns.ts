// Run in Supabase: CREATE TABLE IF NOT EXISTS outbound_campaigns (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id text, name text, campaign_type text, script text, lead_count integer, retell_batch_id text, status text, created_at timestamptz DEFAULT now());

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Retell from 'retell-sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });

const router = Router();

router.post('/api/campaigns/create', async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, campaign_type, script, leads, voice = 'brooke' } = req.body;
    if (!tenant_id || !name || !leads || !Array.isArray(leads)) {
      res.status(400).json({ error: 'tenant_id, name and leads array are required' });
      return;
    }

    const { data: voiceConfig, error: configErr } = await supabase
      .from('voice_config')
      .select('retell_agent_id, retell_agent_id_jake, retell_agent_id_brooke, telnyx_number')
      .eq('tenant_id', tenant_id)
      .single();

    if (configErr || !voiceConfig?.telnyx_number) {
      res.status(400).json({ error: 'Voice agent not configured for this tenant' });
      return;
    }

    const selectedAgentId =
      voice === 'jake'   ? (voiceConfig.retell_agent_id_jake   || voiceConfig.retell_agent_id) :
      voice === 'brooke' ? (voiceConfig.retell_agent_id_brooke || voiceConfig.retell_agent_id) :
                           voiceConfig.retell_agent_id;

    if (!selectedAgentId) {
      res.status(400).json({ error: 'No agent ID found for this tenant' });
      return;
    }

    const tasks = leads.map((lead: { name: string; phone: string; custom_vars?: Record<string, string> }) => ({
      to_number: lead.phone,
      retell_llm_dynamic_variables: {
        customer_name: lead.name,
        ...(lead.custom_vars || {}),
      },
      metadata: {
        tenant_id,
        campaign_name: name,
      },
    }));

    const batchRes = await fetch('https://api.retellai.com/v2/create-batch-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: voiceConfig.telnyx_number,
        override_agent_id: selectedAgentId,
        name,
        tasks,
      }),
    });

    const batchData = await batchRes.json() as { batch_call_id?: string; error?: string };
    console.log('[Campaigns] Retell batch response:', JSON.stringify(batchData));

    if (!batchRes.ok) {
      res.status(502).json({ error: batchData.error || 'Retell batch call failed' });
      return;
    }

    const { error: insertErr } = await supabase.from('outbound_campaigns').insert({
      tenant_id,
      name,
      campaign_type,
      script,
      voice,
      lead_count: leads.length,
      retell_batch_id: batchData.batch_call_id || null,
      status: 'sent',
      created_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error('[Campaigns] Supabase insert error:', insertErr);
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.json({ success: true, batch_id: batchData.batch_call_id, lead_count: leads.length });
  } catch (err: any) {
    console.error('[Campaigns] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/campaigns/list', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data, error } = await supabase
    .from('outbound_campaigns')
    .select('*')
    .eq('tenant_id', tenant_id as string)
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  const { id } = req.params;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data, error } = await supabase
    .from('outbound_campaigns')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant_id as string)
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || null);
});

export default router;
