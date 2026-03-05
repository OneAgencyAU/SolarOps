import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();
const VAPI_API_KEY = process.env.VAPI_API_KEY!;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID!;

router.post('/api/voice/setup', async (req: Request, res: Response) => {
  try {
    const { tenant_id, business_name = 'Sol Energy', notification_email, greeting, tone, escalation_phone, escalation_message, keywords } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const toneDesc = tone === 'Formal' ? 'formal and professional' : tone === 'Professional' ? 'professional but approachable' : 'warm and friendly';
    const safetyWords = (keywords || ['fire','smoke','outage','emergency','sparks']).join(', ');

    const systemPrompt = `You are a ${toneDesc} AI receptionist for ${business_name}, an Australian solar energy company. Your job is to answer inbound calls and create callback requests.

IMPORTANT RULES:
- Speak in a natural Australian tone
- Never make up pricing, rebate amounts, or technical details
- Never promise specific timeframes
- If caller mentions any of these emergency keywords: ${safetyWords} — immediately say "${escalation_message || "I'm connecting you with our team right away. Please hold."}" and end the call
- Always confirm details back to the caller before ending

CALL FLOW:
1. Greet: "${greeting || `Thanks for calling ${business_name}, you've reached our AI receptionist. I'm here to take your details and arrange a callback. Is that okay?`}"
2. Ask: New or existing customer?
3. Collect: First name, suburb, best callback number, email (optional), reason for calling
4. Ask: Best callback time — today or tomorrow, morning (8am–12pm) or afternoon (12pm–5pm)?
5. Confirm all details back
6. Close: "Perfect — someone from the ${business_name} team will call you back at your requested time. Have a great day!"`;

    const { data: existing } = await supabase
      .from('voice_config')
      .select('assistant_id')
      .eq('tenant_id', tenant_id)
      .single();

    let assistantId = existing?.assistant_id;

    if (assistantId) {
      await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${business_name} Receptionist`,
          model: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', systemPrompt, temperature: 0.7 },
          voice: { provider: 'playht', voiceId: 'jennifer' },
          firstMessage: greeting || `Thanks for calling ${business_name}. You've reached our AI receptionist. I'm here to take your details and arrange a callback. Is that okay?`,
          transcriber: { provider: 'deepgram', language: 'en-AU' },
          maxDurationSeconds: 300,
        }),
      });
    } else {
      const createRes = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${business_name} Receptionist`,
          model: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', systemPrompt, temperature: 0.7 },
          voice: { provider: 'playht', voiceId: 'jennifer' },
          firstMessage: greeting || `Thanks for calling ${business_name}. You've reached our AI receptionist.`,
          transcriber: { provider: 'deepgram', language: 'en-AU' },
          maxDurationSeconds: 300,
        }),
      });
      const createText = await createRes.text();
      console.log('[Voice Setup] Vapi create status:', createRes.status);
      console.log('[Voice Setup] Vapi create response:', createText);
      if (!createRes.ok) {
        res.status(500).json({ error: 'Vapi assistant creation failed', details: createText });
        return;
      }
      const assistant = JSON.parse(createText) as { id: string };
      assistantId = assistant.id;

      await fetch(`https://api.vapi.ai/phone-number/${VAPI_PHONE_NUMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId }),
      });
    }

    await supabase.from('voice_config').upsert({
      tenant_id,
      assistant_id: assistantId,
      business_name,
      notification_email,
      phone_number: '+61485016654',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    res.json({ success: true, assistant_id: assistantId });
  } catch (err: any) {
    console.error('[Voice Setup]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/voice/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('[Voice Webhook] type:', event.type);

    if (event.type === 'end-of-call-report') {
      const call = event.call || {};
      const analysis = event.analysis || {};
      const transcript = event.transcript || '';
      const summary = analysis.summary || event.summary || '';
      const structured = analysis.structuredData || {};

      const extract = (label: string) => {
        const regex = new RegExp(`${label}[:\\s]+([^\\n,]+)`, 'i');
        const match = (summary + ' ' + transcript).match(regex);
        return match ? match[1].trim() : null;
      };

      let tenant_id = null;
      if (call.assistantId) {
        const { data: cfg } = await supabase
          .from('voice_config')
          .select('tenant_id')
          .eq('assistant_id', call.assistantId)
          .single();
        if (cfg) tenant_id = cfg.tenant_id;
      }

      const duration = call.endedAt && call.startedAt
        ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
        : null;

      await supabase.from('voice_calls').upsert({
        tenant_id,
        vapi_call_id: call.id,
        caller_number: call.customer?.number || null,
        caller_name: structured.name || extract('name'),
        caller_email: structured.email || extract('email'),
        caller_suburb: structured.suburb || extract('suburb'),
        reason: structured.reason || extract('reason'),
        call_type: structured.callType || 'unknown',
        callback_window: structured.callbackWindow || extract('callback'),
        transcript,
        summary,
        status: 'completed',
        duration_seconds: duration,
      }, { onConflict: 'vapi_call_id' });

      if (duration !== null) {
        await supabase.from('api_usage_log').insert({
          tenant_id,
          module: 'voice_agent',
          service: 'vapi',
          cost_usd: (duration / 60) * 0.05,
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
  const { data, error } = await supabase
    .from('voice_calls')
    .select('*')
    .eq('tenant_id', tenant_id as string)
    .order('created_at', { ascending: false })
    .limit(Number(limit));
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get('/api/voice/config', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data } = await supabase
    .from('voice_config')
    .select('*')
    .eq('tenant_id', tenant_id as string)
    .single();
  res.json(data || null);
});

router.post('/api/voice/toggle', async (req: Request, res: Response) => {
  try {
    const { tenant_id, is_live } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: config } = await supabase
      .from('voice_config')
      .select('assistant_id')
      .eq('tenant_id', tenant_id)
      .single();

    if (config?.assistant_id) {
      await fetch(`https://api.vapi.ai/phone-number/${VAPI_PHONE_NUMBER_ID}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: is_live ? config.assistant_id : null }),
      });
    }

    await supabase.from('voice_config')
      .update({ is_live, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
