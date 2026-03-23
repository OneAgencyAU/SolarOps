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

router.get('/api/voice/numbers/available', async (req: Request, res: Response) => {
  try {
    const [telnyxRes, { data: configs }] = await Promise.all([
      fetch('https://api.telnyx.com/v2/phone_numbers', {
        headers: { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
      }),
      supabase.from('voice_config').select('telnyx_number').not('telnyx_number', 'is', null),
    ]);

    const telnyxData = await telnyxRes.json() as { data: any[] };
    const owned: any[] = telnyxData.data || [];

    const assigned = new Set((configs || []).map((r: any) => r.telnyx_number).filter(Boolean));

    const unassigned = owned
      .filter((n: any) => !assigned.has(n.phone_number))
      .map((n: any) => ({
        phone_number: n.phone_number,
        status: n.status,
        region: n.region_information?.[0]?.region_name ?? null,
      }));

    res.json(unassigned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

    const telnyxHeaders = { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' };

    const orderRes = await fetch('https://api.telnyx.com/v2/number_orders', {
      method: 'POST',
      headers: telnyxHeaders,
      body: JSON.stringify({ phone_numbers: [{ phone_number }] }),
    });
    const order = await orderRes.json() as { data: { id: string, phone_numbers: any[] } };
    console.log('[Telnyx Purchase] Order:', JSON.stringify(order));

    let fqdnConnectionId: string | null = null;

    const fqdnListRes = await fetch('https://api.telnyx.com/v2/fqdn_connections', { headers: telnyxHeaders });
    const fqdnListData = await fqdnListRes.json() as { data: any[] };
    const existingFqdn = (fqdnListData.data || []).find((c: any) => /solarops/i.test(c.connection_name || ''));

    if (existingFqdn) {
      fqdnConnectionId = existingFqdn.id;
      console.log(`[Telnyx Purchase] Reusing existing FQDN connection: ${fqdnConnectionId}`);
    } else {
      console.log('[Telnyx Purchase] Creating new FQDN connection');
      const fqdnConnRes = await fetch('https://api.telnyx.com/v2/fqdn_connections', {
        method: 'POST',
        headers: telnyxHeaders,
        body: JSON.stringify({
          connection_name: 'solarops-retell',
          active: true,
          transport_protocol: 'UDP',
        }),
      });
      const fqdnConnData = await fqdnConnRes.json() as { data: { id: string } };
      if (fqdnConnData.data?.id) {
        fqdnConnectionId = fqdnConnData.data.id;
        console.log(`[Telnyx Purchase] Created FQDN connection: ${fqdnConnectionId}`);

        const fqdnTargetRes = await fetch('https://api.telnyx.com/v2/fqdns', {
          method: 'POST',
          headers: telnyxHeaders,
          body: JSON.stringify({
            fqdn_connection_id: fqdnConnectionId,
            fqdn: 'sip.retellai.com',
            port: 5060,
          }),
        });
        console.log(`[Telnyx Purchase] Added FQDN target: ${fqdnTargetRes.status}`);
      } else {
        console.error('[Telnyx Purchase] Failed to create FQDN connection:', JSON.stringify(fqdnConnData));
      }
    }

    if (fqdnConnectionId) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const lookupRes = await fetch(
        `https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(phone_number)}`,
        { headers: telnyxHeaders }
      );
      const lookupData = await lookupRes.json() as { data: any[] };
      const numberId = lookupData.data?.[0]?.id;
      if (numberId) {
        const patchRes = await fetch(`https://api.telnyx.com/v2/phone_numbers/${numberId}`, {
          method: 'PATCH',
          headers: telnyxHeaders,
          body: JSON.stringify({ connection_id: fqdnConnectionId }),
        });
        console.log(`[Telnyx Purchase] Assigned number to FQDN connection: ${patchRes.status}`);
      } else {
        console.warn('[Telnyx Purchase] Could not look up purchased number yet — assign-number will handle it');
      }
    }

    await supabase.from('voice_config').upsert({
      tenant_id,
      telnyx_number: phone_number,
      telnyx_number_id: order.data?.id,
      telnyx_connection_id: fqdnConnectionId,
      telnyx_connection_type: fqdnConnectionId ? 'fqdn' : null,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    res.json({ success: true, phone_number });
  } catch (err: any) {
    console.error('[Telnyx Purchase]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/voice/assign-number', async (req: Request, res: Response) => {
  try {
    const { tenant_id, phone_number: bodyPhone } = req.body;
    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    console.log(`[Assign Number] Starting for tenant ${tenant_id}`);

    const { data: config } = await supabase
      .from('voice_config')
      .select('telnyx_number, telnyx_connection_id, retell_agent_id, retell_agent_id_jake, retell_agent_id_brooke, voice')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    const phoneNumber = bodyPhone || config?.telnyx_number;
    if (!phoneNumber) {
      console.error('[Assign Number] No phone number found for tenant');
      res.status(400).json({ error: 'No phone number found — purchase a number first' });
      return;
    }

    const voicePref = config?.voice ?? 'brooke';
    const retellAgentId =
      (voicePref === 'jake' ? config?.retell_agent_id_jake : config?.retell_agent_id_brooke)
      || config?.retell_agent_id
      || null;
    console.log(`[Assign Number] Phone: ${phoneNumber}, voice: ${voicePref}, retell_agent_id: ${retellAgentId}`);

    const telnyxHeaders = { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' };
    const retellHeaders = { 'Authorization': `Bearer ${process.env.RETELL_API_KEY}`, 'Content-Type': 'application/json' };

    // === Step 1: Delete old IP connections ===
    if (config?.telnyx_connection_id) {
      console.log(`[Assign Number] Deleting old connection from config: ${config.telnyx_connection_id}`);
      const delRes = await fetch(`https://api.telnyx.com/v2/ip_connections/${config.telnyx_connection_id}`, {
        method: 'DELETE',
        headers: telnyxHeaders,
      });
      console.log(`[Assign Number] Deleted old IP connection: ${config.telnyx_connection_id} (status: ${delRes.status})`);
    }

    const ipListRes = await fetch('https://api.telnyx.com/v2/ip_connections', { headers: telnyxHeaders });
    const ipListData = await ipListRes.json() as { data: any[] };
    const solaropsConns = (ipListData.data || []).filter((c: any) => /solarops/i.test(c.connection_name || ''));
    for (const conn of solaropsConns) {
      console.log(`[Assign Number] Deleting stale IP connection: ${conn.id} (${conn.connection_name})`);
      await fetch(`https://api.telnyx.com/v2/ip_connections/${conn.id}`, { method: 'DELETE', headers: telnyxHeaders });
      console.log(`[Assign Number] Deleted old IP connection: ${conn.id}`);
    }

    // Also clean up any old FQDN connections with solarops name to avoid duplicates
    const fqdnListRes = await fetch('https://api.telnyx.com/v2/fqdn_connections', { headers: telnyxHeaders });
    const fqdnListData = await fqdnListRes.json() as { data: any[] };
    const oldFqdnConns = (fqdnListData.data || []).filter((c: any) => /solarops/i.test(c.connection_name || ''));
    for (const conn of oldFqdnConns) {
      console.log(`[Assign Number] Deleting old FQDN connection: ${conn.id} (${conn.connection_name})`);
      await fetch(`https://api.telnyx.com/v2/fqdn_connections/${conn.id}`, { method: 'DELETE', headers: telnyxHeaders });
      console.log(`[Assign Number] Deleted old FQDN connection: ${conn.id}`);
    }

    // === Step 2: Create new FQDN connection ===
    console.log('[Assign Number] Creating new FQDN connection');
    const fqdnConnRes = await fetch('https://api.telnyx.com/v2/fqdn_connections', {
      method: 'POST',
      headers: telnyxHeaders,
      body: JSON.stringify({
        connection_name: 'solarops-retell',
        active: true,
        transport_protocol: 'UDP',
      }),
    });
    const fqdnConnData = await fqdnConnRes.json() as { data: { id: string } };
    if (!fqdnConnData.data?.id) {
      console.error('[Assign Number] Failed to create FQDN connection:', JSON.stringify(fqdnConnData));
      res.status(500).json({ error: 'Failed to create FQDN connection on Telnyx' });
      return;
    }
    const fqdnConnectionId = fqdnConnData.data.id;
    console.log(`[Assign Number] Created FQDN connection: ${fqdnConnectionId}`);

    const fqdnTargetRes = await fetch('https://api.telnyx.com/v2/fqdns', {
      method: 'POST',
      headers: telnyxHeaders,
      body: JSON.stringify({
        fqdn_connection_id: fqdnConnectionId,
        fqdn: 'sip.retellai.com',
        port: 5060,
      }),
    });
    const fqdnTargetData = await fqdnTargetRes.json();
    console.log(`[Assign Number] Added FQDN target sip.retellai.com: ${fqdnTargetRes.status}`, JSON.stringify(fqdnTargetData));

    // === Step 3: Look up phone number and assign to FQDN connection ===
    const lookup1Res = await fetch(
      `https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
      { headers: telnyxHeaders }
    );
    const lookup1Data = await lookup1Res.json() as { data: any[] };
    console.log('[Assign Number] Telnyx lookup response (attempt 1):', JSON.stringify(lookup1Data));
    let numberResource = lookup1Data.data?.[0];

    if (!numberResource) {
      const stripped = phoneNumber.replace(/^\+/, '');
      const lookup2Res = await fetch(
        `https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(stripped)}`,
        { headers: telnyxHeaders }
      );
      const lookup2Data = await lookup2Res.json() as { data: any[] };
      console.log('[Assign Number] Telnyx lookup response (attempt 2, no +):', JSON.stringify(lookup2Data));
      numberResource = lookup2Data.data?.[0];
    }

    if (!numberResource) {
      const lookup3Res = await fetch('https://api.telnyx.com/v2/phone_numbers', { headers: telnyxHeaders });
      const lookup3Data = await lookup3Res.json() as { data: any[] };
      console.log('[Assign Number] Telnyx all numbers (attempt 3):', JSON.stringify(lookup3Data));
      const all: any[] = lookup3Data.data || [];
      const normalized = phoneNumber.replace(/\s+/g, '');
      numberResource = all.find((n: any) =>
        n.phone_number === normalized ||
        n.phone_number === normalized.replace(/^\+/, '') ||
        n.phone_number?.replace(/^\+/, '') === normalized.replace(/^\+/, '')
      );
    }

    if (!numberResource) {
      console.error('[Assign Number] Phone number not found on Telnyx after all attempts:', phoneNumber);
      res.status(404).json({ error: 'Number not found on Telnyx — it may not have been purchased successfully. Please go to Voice Agent setup to purchase a new number.' });
      return;
    }

    const numberId = numberResource.id;
    console.log(`[Assign Number] Found Telnyx number resource ID: ${numberId}`);

    const patchRes = await fetch(`https://api.telnyx.com/v2/phone_numbers/${numberId}`, {
      method: 'PATCH',
      headers: telnyxHeaders,
      body: JSON.stringify({ connection_id: fqdnConnectionId }),
    });
    const patchData = await patchRes.json();
    console.log(`[Assign Number] Assigned number to FQDN connection: ${patchRes.status}`);

    if (!patchRes.ok) {
      console.error('[Assign Number] Failed to assign number:', JSON.stringify(patchData));
      res.status(500).json({ error: 'Failed to assign number to FQDN connection' });
      return;
    }

    // === Step 4: Import number to Retell ===
    if (retellAgentId) {
      const importRes = await fetch('https://api.retellai.com/v2/import-phone-number', {
        method: 'POST',
        headers: retellHeaders,
        body: JSON.stringify({
          phone_number: phoneNumber,
          termination_uri: 'sip.telnyx.com',
          inbound_agent_id: retellAgentId,
        }),
      });
      console.log(`[Assign Number] Retell import status: ${importRes.status}`);
      if (importRes.status === 409) {
        console.log('[Assign Number] Number already imported to Retell — continuing');
      } else if (!importRes.ok) {
        const importErr = await importRes.text();
        console.warn('[Assign Number] Retell import warning:', importErr);
      }
    } else {
      console.log('[Assign Number] No retell_agent_id yet — skipping Retell import');
    }

    // === Step 5: Update Supabase ===
    await supabase.from('voice_config').upsert({
      tenant_id,
      telnyx_number: phoneNumber,
      telnyx_connection_id: fqdnConnectionId,
      telnyx_connection_type: 'fqdn',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    console.log(`[Assign Number] Complete for tenant ${tenant_id}`);
    res.json({ success: true, connection_id: fqdnConnectionId, connection_type: 'fqdn' });
  } catch (err: any) {
    console.error('[Assign Number] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/voice/setup', async (req: Request, res: Response) => {
  try {
    console.log('[Setup] Starting...');
    const { tenant_id, business_name = 'Sol Energy', notification_email, greeting, tone, phone_number, escalation_phone, escalation_message, keywords } = req.body;
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

    // Discover available voices first
    const voices = await retell.voice.list();
    const voiceList = voices.map(v => ({ id: v.voice_id, name: v.voice_name, gender: v.gender, provider: v.provider }));
    console.log('[Voice Setup] Available voices:', JSON.stringify(voiceList, null, 2));

    const maleVoiceId =
      voiceList.find(v => v.gender === 'male' && v.provider === 'elevenlabs')?.id ||
      voiceList.find(v => v.gender === 'male')?.id ||
      'retell-Cimo';

    const femaleVoiceId =
      voiceList.find(v => v.gender === 'female' && v.provider === 'elevenlabs')?.id ||
      voiceList.find(v => v.gender === 'female')?.id ||
      'retell-Aria';

    console.log('[Voice Setup] Using voices:', { maleVoice: maleVoiceId, femaleVoice: femaleVoiceId });

    const [jakeLlm, brookeLlm] = await Promise.all([
      retell.llm.create({ model: 'gpt-4o-mini' as any, general_prompt: systemPrompt, begin_message: beginMessage, general_tools: generalTools }),
      retell.llm.create({ model: 'gpt-4o-mini' as any, general_prompt: systemPrompt, begin_message: beginMessage, general_tools: generalTools }),
    ]);
    console.log('[Retell LLM Jake]', jakeLlm.llm_id, '[Retell LLM Brooke]', brookeLlm.llm_id);

    const existingJakeId = config?.retell_agent_id_jake;
    const existingBrookeId = config?.retell_agent_id_brooke;

    let jakeAgent: { agent_id: string };
    let brookeAgent: { agent_id: string };

    if (existingJakeId && existingBrookeId) {
      console.log('[Voice Setup] Updating existing agents:', existingJakeId, existingBrookeId);
      [jakeAgent, brookeAgent] = await Promise.all([
        retell.agent.update(existingJakeId, {
          voice_id: maleVoiceId,
          response_engine: { type: 'retell-llm', llm_id: jakeLlm.llm_id },
          agent_name: `${business_name} - Jake`,
          language: 'en-AU',
          webhook_url: 'https://solarops.com.au/api/voice/webhook',
        }),
        retell.agent.update(existingBrookeId, {
          voice_id: femaleVoiceId,
          response_engine: { type: 'retell-llm', llm_id: brookeLlm.llm_id },
          agent_name: `${business_name} - Brooke`,
          language: 'en-AU',
          webhook_url: 'https://solarops.com.au/api/voice/webhook',
        }),
      ]);
    } else {
      console.log('[Voice Setup] Creating new agents');
      [jakeAgent, brookeAgent] = await Promise.all([
        retell.agent.create({
          voice_id: maleVoiceId,
          response_engine: { type: 'retell-llm', llm_id: jakeLlm.llm_id },
          agent_name: `${business_name} - Jake`,
          language: 'en-AU',
          webhook_url: 'https://solarops.com.au/api/voice/webhook',
        }),
        retell.agent.create({
          voice_id: femaleVoiceId,
          response_engine: { type: 'retell-llm', llm_id: brookeLlm.llm_id },
          agent_name: `${business_name} - Brooke`,
          language: 'en-AU',
          webhook_url: 'https://solarops.com.au/api/voice/webhook',
        }),
      ]);
    }
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

    const telnyxNumber = phone_number || config?.telnyx_number || null;
    await supabase.from('voice_config').upsert({
      tenant_id,
      retell_agent_id: jakeAgent.agent_id,
      retell_agent_id_jake: jakeAgent.agent_id,
      retell_agent_id_brooke: brookeAgent.agent_id,
      business_name,
      notification_email,
      telnyx_number: telnyxNumber,
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
  const { data } = await supabase.from('voice_config').select('*').eq('tenant_id', tenant_id as string).maybeSingle();
  if (!data) { res.status(404).json({ error: 'No voice config found' }); return; }
  res.json(data);
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
