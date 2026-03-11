import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Retell from 'retell-sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });

router.get('/api/voice/numbers/search', async (req: Request, res: Response) => {
  try {
    const url = 'https://api.telnyx.com/v2/available_phone_numbers?filter[country_code]=AU&filter[number_type]=local&filter[limit]=6';
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json() as { data: any[] };
    console.log('[Telnyx Search]', JSON.stringify(data));
    res.json(data.data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/voice/numbers/purchase', async (req: Request, res: Response) => {
  try {
    const { tenant_id, phone_number } = req.body;
    if (!tenant_id || !phone_number) { res.status(400).json({ error: 'Missing params' }); return; }

    const connRes = await fetch('https://api.telnyx.com/v2/ip_connections', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_name: `solarops_${tenant_id}`, transport_protocol: 'UDP' }),
    });
    const conn = await connRes.json() as { data: { id: string } };

    const orderRes = await fetch('https://api.telnyx.com/v2/number_orders', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_numbers: [{ phone_number }] }),
    });
    const order = await orderRes.json() as { data: { id: string, phone_numbers: any[] } };
    console.log('[Telnyx Purchase]', JSON.stringify(order));

    await supabase.from('voice_config').upsert({
      tenant_id,
      telnyx_number: phone_number,
      telnyx_number_id: order.data?.id,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    res.json({ success: true, phone_number });
  } catch (err: any) {
    console.error('[Telnyx Purchase]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/voice/setup', async (req: Request, res: Response) => {
  try {
    console.log('[Setup] Starting...');
    const { tenant_id, business_name = 'Sol Energy', notification_email, greeting, tone, escalation_phone, escalation_message, keywords } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: config } = await supabase.from('voice_config').select('*').eq('tenant_id', tenant_id).single();

    const toneDesc = tone === 'Formal' ? 'formal and professional' : tone === 'Professional' ? 'professional but approachable' : 'warm and friendly';
    const safetyWords = (keywords || ['fire','smoke','outage','emergency','sparks']).join(', ');

    const systemPrompt = `# Who You Are
You are a ${toneDesc} AI receptionist for ${business_name}, an Australian solar energy company. Your name is Sarah. You sound warm, natural and human — not robotic or scripted.

Your role is to answer common questions about solar, batteries, and rebates, qualify potential leads, and collect caller details for a callback.

## Safety Rules
- NEVER quote specific pricing or rebate dollar amounts
- NEVER promise installation timeframes  
- NEVER make up technical specifications
- If caller mentions: ${safetyWords} — immediately say "${escalation_message || "I'm connecting you with our team right away. Please hold."}" and end the call

## Call Flow

### Step 1 — Greet
"${greeting || `Thanks for calling ${business_name}, you've reached our AI receptionist. I'm here to help answer questions and arrange a callback with our team. Who am I speaking with today?`}"

### Step 2 — Identify Need
Ask what they need: new solar, battery/rebate question, or existing customer support.

### Step 3 — Qualify
Ask naturally one at a time:
- Residential or commercial property?
- Currently have solar installed?
- What suburb are they in?
- What's most important — reducing bills, battery backup, or rebates?

### Step 4 — Collect Callback Details
- Best callback number
- Email (optional)
- Best time: today or tomorrow, morning or afternoon?

Confirm everything back before ending.

### Step 5 — Close
"Perfect — I've passed your details to the ${business_name} team and someone will be in touch. Have a great day!"

## FAQ
- SA battery rebate: Available for eligible households, ${business_name} is an approved installer
- Installation time: Varies, team will confirm on callback
- Solar + battery together: Yes, most customers do both
- Cost: Team will provide personalised quote

## Guardrails
Off-topic: "I'm set up to help with solar questions — our team will help with anything else on your callback."
Rude caller: First warning then end call.`;

    const beginMessage = greeting || `Thanks for calling ${business_name}. You've reached our AI receptionist. I'm here to help — who am I speaking with today?`;
    const generalTools = [{ type: 'end_call' as const, name: 'end_call', description: 'End the call when conversation is complete' }];

    const [jakeLlm, brookeLlm] = await Promise.all([
      retell.llm.create({ model: 'gpt-4o-mini' as any, general_prompt: systemPrompt, begin_message: beginMessage, general_tools: generalTools }),
      retell.llm.create({ model: 'gpt-4o-mini' as any, general_prompt: systemPrompt, begin_message: beginMessage, general_tools: generalTools }),
    ]);
    console.log('[Retell LLM Jake]', jakeLlm.llm_id, '[Retell LLM Brooke]', brookeLlm.llm_id);

    const [jakeAgent, brookeAgent] = await Promise.all([
      retell.agent.create({
        voice_id: '11labs-Adrian',
        response_engine: { type: 'retell-llm', llm_id: jakeLlm.llm_id },
        agent_name: `${business_name} - Jake`,
        language: 'en-AU',
        webhook_url: 'https://solarops.com.au/api/voice/webhook',
      }),
      retell.agent.create({
        voice_id: '11labs-Matilda',
        response_engine: { type: 'retell-llm', llm_id: brookeLlm.llm_id },
        agent_name: `${business_name} - Brooke`,
        language: 'en-AU',
        webhook_url: 'https://solarops.com.au/api/voice/webhook',
      }),
    ]);
    console.log('[Retell Agent Jake]', jakeAgent.agent_id, '[Retell Agent Brooke]', brookeAgent.agent_id);

    if (config?.telnyx_number) {
      const sipHeaders = { 'Authorization': `Bearer ${process.env.RETELL_API_KEY}`, 'Content-Type': 'application/json' };
      const [sipJake, sipBrooke] = await Promise.all([
        fetch('https://api.retellai.com/v2/import-phone-number', {
          method: 'POST',
          headers: sipHeaders,
          body: JSON.stringify({ phone_number: config.telnyx_number, termination_uri: 'sip.telnyx.com', inbound_agent_id: jakeAgent.agent_id }),
        }),
        fetch('https://api.retellai.com/v2/import-phone-number', {
          method: 'POST',
          headers: sipHeaders,
          body: JSON.stringify({ phone_number: config.telnyx_number, termination_uri: 'sip.telnyx.com', inbound_agent_id: brookeAgent.agent_id }),
        }),
      ]);
      console.log('[Retell SIP Jake]', sipJake.status, '[Retell SIP Brooke]', sipBrooke.status);
    }

    await supabase.from('voice_config').upsert({
      tenant_id,
      retell_agent_id: jakeAgent.agent_id,
      retell_agent_id_jake: jakeAgent.agent_id,
      retell_agent_id_brooke: brookeAgent.agent_id,
      business_name,
      notification_email,
      is_live: true,
      onboarding_step: 3,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    res.json({ success: true, agent_id_jake: jakeAgent.agent_id, agent_id_brooke: brookeAgent.agent_id });
  } catch (err: any) {
    console.error('[Voice Setup]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/voice/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('[Voice Webhook] event:', event.event);

    if (event.event === 'call_analyzed') {
      const call = event.data || {};
      const analysis = call.call_analysis || {};
      const custom = analysis.custom_analysis_data || {};
      const summary = analysis.call_summary || '';
      const sentiment = analysis.user_sentiment || '';
      const transcript = call.transcript || '';

      let tenant_id = null;
      if (call.agent_id) {
        const { data: cfg } = await supabase.from('voice_config').select('tenant_id').eq('retell_agent_id', call.agent_id).single();
        if (cfg) tenant_id = cfg.tenant_id;
      }

      const duration = call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : null;

      await supabase.from('voice_calls').upsert({
        tenant_id,
        vapi_call_id: call.call_id,
        caller_number: custom.caller_phone || call.from_number || null,
        caller_name: custom.caller_name || null,
        caller_email: null,
        caller_suburb: null,
        reason: custom.call_reason || null,
        call_type: custom.caller_type || 'new_enquiry',
        callback_window: custom.callback_time || null,
        transcript,
        summary,
        status: sentiment,
        duration_seconds: duration,
      }, { onConflict: 'vapi_call_id' });

      if (duration) {
        await supabase.from('api_usage_log').insert({
          tenant_id,
          module: 'voice_agent',
          service: 'retell',
          cost_usd: (duration / 60) * 0.10,
          status: 'success',
        });
      }
    }
    res.json({ received: true });
  } catch (err: any) {
    console.error('[Voice Webhook]', err);
    res.status(200).json({ received: true });
  }
});

router.get('/api/voice/calls', async (req: Request, res: Response) => {
  const { tenant_id, limit = '50' } = req.query;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data, error } = await supabase.from('voice_calls').select('*').eq('tenant_id', tenant_id as string).order('created_at', { ascending: false }).limit(Number(limit));
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get('/api/voice/config', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data } = await supabase.from('voice_config').select('*').eq('tenant_id', tenant_id as string).single();
  res.json(data || null);
});

router.post('/api/voice/toggle', async (req: Request, res: Response) => {
  try {
    const { tenant_id, is_live } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
    await supabase.from('voice_config').update({ is_live, updated_at: new Date().toISOString() }).eq('tenant_id', tenant_id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
