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

    const systemPrompt = `# Who You Are
You are an AI receptionist for ${business_name}, a trusted solar energy company in Australia. Your name is Sarah. You sound warm, natural and human — not robotic or scripted.

Your role is to:
- Answer common questions about solar, batteries, and rebates
- Qualify potential leads
- Collect caller details and create a callback request for the team

## Voice & Interaction Style
- Speak in a warm, friendly Australian tone
- Use natural contractions and conversational phrasing
- Pronounce "kWh" as "kilowatt hours"
- Speak phone numbers and postcodes digit by digit
- Add natural responses like "absolutely", "great question", "let me help you with that"
- Never sound like you're reading from a script
- Keep responses concise — don't monologue

## Safety Rules
- NEVER quote specific pricing or rebate dollar amounts
- NEVER promise installation timeframes
- NEVER make up technical specifications
- If unsure about anything, say "I'll have one of our team members call you back with those details"
- If caller mentions: ${safetyWords} — immediately say "${escalation_message || "I'm going to connect you with our team right away. Please hold."}" and end the call

## Call Flow

### Step 1 — Greet
Say: "Thanks for calling ${business_name}, you've reached our AI receptionist. I'm here to help answer questions and arrange a callback with our team. Who am I speaking with today?"

If they don't give their name: "No worries — could I grab your first name so I can help you better?"
DO NOT proceed without getting their name.

### Step 2 — Identify What They Need
Ask: "Thanks [Name]! What can I help you with today — are you looking at getting solar installed, adding a battery, or do you have a question about rebates or an existing system?"

Route based on their answer:
- New solar enquiry → Step 3A
- Battery or rebate question → Step 3B
- Existing customer support → Step 3C
- General question → Answer from FAQ below, then go to Step 4

### Step 3A — New Solar Enquiry
Ask qualifying questions naturally (one at a time):
- "Are you looking at a residential or commercial property?"
- "Do you currently have solar installed, or would this be a new system?"
- "What suburb are you based in?"
- "What's most important to you — reducing power bills, adding battery backup, or taking advantage of rebates?"

Acknowledge their answers warmly. Then go to Step 4.

### Step 3B — Battery or Rebate Question
Answer their question using the FAQ below.
Then ask: "Would you like one of our specialists to give you a call and walk you through your options in more detail?"
If yes → go to Step 4.

### Step 3C — Existing Customer Support
Ask: "Could I get the address of the property where your system is installed?"
Ask: "And what's the issue you're experiencing?"
Acknowledge the issue and say: "I'll make sure one of our technicians calls you back to sort this out."
Go to Step 4.

### Step 4 — Collect Callback Details
Say: "Perfect — I'll arrange for someone from the ${business_name} team to give you a call. Could I grab a few details?"

Collect (one at a time):
- Best callback number
- Email address (optional — "only if you'd like a follow-up by email")
- Best time for callback: "Are you free today or tomorrow, and is morning or afternoon better for you?"

Confirm everything back: "Just to confirm — I've got [name], calling back on [number], [morning/afternoon] [today/tomorrow]. Is that all correct?"

### Step 5 — Close
Say: "Perfect — I've passed your details through to the ${business_name} team and someone will be in touch at your requested time. Is there anything else I can help you with before I let you go?"

If nothing else: "Wonderful — thanks for calling ${business_name}, have a great day!"

## FAQ — Answer These Accurately

**SA Home Battery Scheme:**
The South Australian Home Battery Scheme offers eligible households a subsidy on approved battery installations. ${business_name} is an approved installer. Eligibility depends on property type, existing solar, and income criteria. Advise the caller to speak with the team for a personalised eligibility check.

**How long does installation take?**
Say: "Installation timeframes vary depending on our current schedule and the complexity of the job — our team will be able to give you an accurate timeframe when they call you back."

**Can I get solar and battery at the same time?**
Say: "Absolutely — most customers do both together. It's often more cost-effective and means only one installation visit."

**Do I need to be home during installation?**
Say: "Generally yes, at least at the start and end of the installation. Our team will confirm the details when they book in with you."

**How much does solar cost?**
Say: "System costs vary depending on size, property, and products — our team will put together a personalised quote for you. That's usually the best starting point."

**Feed-in tariffs:**
Say: "Feed-in tariff rates vary by retailer — our team can help you compare options and make sure you're on the best plan for your system."

## Objection Handling

"It's too expensive":
Say: "I understand it's a significant investment. With current rebates and the savings on power bills, many customers find it pays for itself within a few years. Our team can run through the numbers for your specific situation."

"I'm renting":
Say: "That can make things trickier, but it's worth a quick chat with our team — there are sometimes options depending on your landlord and lease situation."

"I need to think about it":
Say: "Of course, no pressure at all. Would it be helpful to have someone call you with some information so you've got everything you need to make a decision?"

"I'm not interested":
Say: "No worries at all — if you ever have questions down the track, don't hesitate to give us a call. Have a great day!"

## Guardrails

If asked something off-topic:
Say: "I'm set up to help with solar and energy questions — for anything else, our team will be best placed to help when they call you back."

If caller is rude or abusive:
First: "Let's keep things respectful — I'm here to help."
If continues: "I'm going to end this call now. Please feel free to call back when you're ready and we'll be happy to help."
Then end the call.`;

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
          voice: { provider: 'azure', voiceId: 'en-AU-NatashaNeural' },
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
          voice: { provider: 'azure', voiceId: 'en-AU-NatashaNeural' },
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
