import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Retell from 'retell-sdk';
import multer from 'multer';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// ──────────────────────────────────────────────────────────────
// Phone number validation (AU mobile + landline)
// ──────────────────────────────────────────────────────────────
function normaliseAUPhone(raw: string): { valid: boolean; e164: string; reason?: string } {
  const cleaned = raw.replace(/[\s\-()]/g, '');

  // Already E.164
  if (/^\+614\d{8}$/.test(cleaned)) return { valid: true, e164: cleaned };
  if (/^\+61[2378]\d{8}$/.test(cleaned)) return { valid: true, e164: cleaned };

  // Local mobile 04XX
  if (/^04\d{8}$/.test(cleaned)) return { valid: true, e164: `+61${cleaned.slice(1)}` };

  // Local landline 02/03/07/08
  if (/^0[2378]\d{8}$/.test(cleaned)) return { valid: true, e164: `+61${cleaned.slice(1)}` };

  return { valid: false, e164: '', reason: `Invalid AU number: ${raw}` };
}

// ──────────────────────────────────────────────────────────────
// CSV parsing
// ──────────────────────────────────────────────────────────────
function parseCSV(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ──────────────────────────────────────────────────────────────
// Campaign CRUD
// ──────────────────────────────────────────────────────────────

// Create campaign (as draft)
router.post('/api/campaigns/create', async (req: Request, res: Response) => {
  try {
    const {
      tenant_id, name, script_template, script_prompt, voice_id,
      caller_id, call_window_start, call_window_end, call_window_days,
      on_interest, transfer_number, max_concurrent, voicemail_action,
    } = req.body;

    if (!tenant_id || !name) {
      res.status(400).json({ error: 'tenant_id and name are required' });
      return;
    }

    const { data, error } = await supabase
      .from('outbound_campaigns')
      .insert({
        tenant_id,
        name,
        status: 'draft',
        script_template: script_template || null,
        script_prompt: script_prompt || null,
        voice_id: voice_id || '11labs-Adrian',
        caller_id: caller_id || null,
        call_window_start: call_window_start || null,
        call_window_end: call_window_end || null,
        call_window_days: call_window_days || null,
        on_interest: on_interest || 'offer_choice',
        transfer_number: transfer_number || null,
        max_concurrent: max_concurrent || 3,
        voicemail_action: voicemail_action || 'leave_message',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Campaign Create]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Campaign Create]', err);
    res.status(500).json({ error: err.message });
  }
});

// Update campaign (draft only)
router.put('/api/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, ...updates } = req.body;

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    // Only allow updates to draft campaigns
    const { data: existing, error: fetchErr } = await supabase
      .from('outbound_campaigns')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ error: `Cannot edit campaign with status "${existing.status}"` });
      return;
    }

    // Strip fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.retell_batch_call_id;
    delete updates.started_at;
    delete updates.completed_at;
    delete updates.calls_made;
    delete updates.calls_answered;
    delete updates.calls_interested;
    delete updates.callbacks_booked;

    const { data, error } = await supabase
      .from('outbound_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[Campaign Update]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Campaign Update]', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete campaign (draft only)
router.delete('/api/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('outbound_campaigns')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id as string)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ error: `Cannot delete campaign with status "${existing.status}"` });
      return;
    }

    // Contacts cascade-delete via FK
    const { error } = await supabase
      .from('outbound_campaigns')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id as string);

    if (error) {
      console.error('[Campaign Delete]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Campaign Delete]', err);
    res.status(500).json({ error: err.message });
  }
});

// List campaigns
router.get('/api/campaigns/list', async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data, error } = await supabase
      .from('outbound_campaigns')
      .select('*')
      .eq('tenant_id', tenant_id as string)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Campaign List]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch (err: any) {
    console.error('[Campaign List]', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single campaign with contact stats
router.get('/api/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    const { id } = req.params;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data, error } = await supabase
      .from('outbound_campaigns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id as string)
      .single();

    if (error) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Campaign Get]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// CSV Upload + Validation
// ──────────────────────────────────────────────────────────────
router.post('/api/campaigns/:id/contacts/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant_id = req.body.tenant_id;

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    // Verify campaign exists and is draft
    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'draft') {
      res.status(400).json({ error: `Cannot upload contacts to campaign with status "${campaign.status}"` });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { headers, rows } = parseCSV(req.file.buffer);

    if (rows.length === 0) {
      res.status(400).json({ error: 'CSV file is empty or has no data rows' });
      return;
    }

    // Find phone_number column (accept common variations)
    const phoneCol = headers.find(h =>
      ['phone_number', 'phone', 'mobile', 'number', 'tel', 'telephone'].includes(h)
    );
    if (!phoneCol) {
      res.status(400).json({
        error: 'CSV must have a phone number column (phone_number, phone, mobile, number, tel)',
        headers,
      });
      return;
    }

    // Find name column
    const nameCol = headers.find(h =>
      ['customer_name', 'name', 'full_name', 'contact_name', 'first_name'].includes(h)
    );

    // Known columns that go into dedicated fields
    const knownCols = new Set([phoneCol, nameCol].filter(Boolean));

    // Validate and build contacts
    const valid: { phone_number: string; customer_name: string | null; custom_data: Record<string, string> }[] = [];
    const invalid: { row: number; phone: string; reason: string }[] = [];
    const seenPhones = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawPhone = row[phoneCol] || '';

      if (!rawPhone) {
        invalid.push({ row: i + 2, phone: rawPhone, reason: 'Missing phone number' });
        continue;
      }

      const { valid: isValid, e164, reason } = normaliseAUPhone(rawPhone);
      if (!isValid) {
        invalid.push({ row: i + 2, phone: rawPhone, reason: reason! });
        continue;
      }

      if (seenPhones.has(e164)) {
        invalid.push({ row: i + 2, phone: rawPhone, reason: 'Duplicate phone number' });
        continue;
      }
      seenPhones.add(e164);

      // Collect extra columns into custom_data
      const custom_data: Record<string, string> = {};
      for (const h of headers) {
        if (!knownCols.has(h) && row[h]) {
          custom_data[h] = row[h];
        }
      }

      valid.push({
        phone_number: e164,
        customer_name: nameCol ? (row[nameCol] || null) : null,
        custom_data: Object.keys(custom_data).length > 0 ? custom_data : {},
      });
    }

    if (valid.length === 0) {
      res.status(400).json({
        error: 'No valid contacts found in CSV',
        invalid,
        valid_count: 0,
        invalid_count: invalid.length,
      });
      return;
    }

    // Delete any existing contacts for this campaign (re-upload replaces)
    await supabase
      .from('outbound_contacts')
      .delete()
      .eq('campaign_id', id);

    // Insert contacts in batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE).map(c => ({
        campaign_id: id,
        tenant_id,
        phone_number: c.phone_number,
        customer_name: c.customer_name,
        custom_data: c.custom_data,
        status: 'pending',
      }));

      const { error: insertErr } = await supabase
        .from('outbound_contacts')
        .insert(batch);

      if (insertErr) {
        console.error('[Contact Upload]', insertErr);
        res.status(500).json({ error: insertErr.message });
        return;
      }
    }

    // Update campaign total_contacts
    await supabase
      .from('outbound_campaigns')
      .update({
        total_contacts: valid.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.json({
      success: true,
      valid_count: valid.length,
      invalid_count: invalid.length,
      invalid: invalid.slice(0, 20), // Return first 20 invalid for display
      preview: valid.slice(0, 10).map(c => ({
        phone_number: c.phone_number,
        customer_name: c.customer_name,
        custom_data: c.custom_data,
      })),
    });
  } catch (err: any) {
    console.error('[Contact Upload]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// Contacts: list, detail, export, retry
// ──────────────────────────────────────────────────────────────

// List contacts for a campaign
router.get('/api/campaigns/:id/contacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, limit = '100', offset = '0' } = req.query;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data, error, count } = await supabase
      .from('outbound_contacts')
      .select('*', { count: 'exact' })
      .eq('campaign_id', id)
      .eq('tenant_id', tenant_id as string)
      .order('created_at', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error('[Contact List]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ contacts: data || [], total: count || 0 });
  } catch (err: any) {
    console.error('[Contact List]', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single contact detail
router.get('/api/campaigns/:id/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const { id, contactId } = req.params;
    const { tenant_id } = req.query;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data, error } = await supabase
      .from('outbound_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('campaign_id', id)
      .eq('tenant_id', tenant_id as string)
      .single();

    if (error) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Contact Detail]', err);
    res.status(500).json({ error: err.message });
  }
});

// Export contacts as CSV
router.post('/api/campaigns/:id/contacts/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: contacts, error } = await supabase
      .from('outbound_contacts')
      .select('*')
      .eq('campaign_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Contact Export]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    if (!contacts || contacts.length === 0) {
      res.status(404).json({ error: 'No contacts found' });
      return;
    }

    const csvHeaders = [
      'customer_name', 'phone_number', 'status', 'outcome',
      'sentiment', 'call_summary', 'callback_preference',
      'call_duration', 'called_at',
    ];

    const escapeCSV = (val: string | null | undefined) => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines = [csvHeaders.join(',')];
    for (const c of contacts) {
      csvLines.push(csvHeaders.map(h => escapeCSV((c as any)[h])).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${id}-results.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err: any) {
    console.error('[Contact Export]', err);
    res.status(500).json({ error: err.message });
  }
});

// Retry failed contacts (no_answer, busy)
router.post('/api/campaigns/:id/contacts/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (!['completed', 'paused'].includes(campaign.status)) {
      res.status(400).json({ error: `Cannot retry contacts for campaign with status "${campaign.status}"` });
      return;
    }

    const { data: retryable, error: countErr } = await supabase
      .from('outbound_contacts')
      .select('id', { count: 'exact' })
      .eq('campaign_id', id)
      .in('status', ['no_answer', 'busy', 'failed']);

    if (countErr) {
      res.status(500).json({ error: countErr.message });
      return;
    }

    const { error: updateErr } = await supabase
      .from('outbound_contacts')
      .update({
        status: 'pending',
        outcome: null,
        retell_call_id: null,
        call_duration: null,
        call_cost: null,
        called_at: null,
        transcript: null,
        recording_url: null,
        call_summary: null,
        sentiment: null,
      })
      .eq('campaign_id', id)
      .in('status', ['no_answer', 'busy', 'failed']);

    if (updateErr) {
      console.error('[Contact Retry]', updateErr);
      res.status(500).json({ error: updateErr.message });
      return;
    }

    const retryCount = retryable?.length || 0;

    // Reset campaign status to allow re-launch
    if (retryCount > 0) {
      await supabase
        .from('outbound_campaigns')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    res.json({ success: true, retry_count: retryCount });
  } catch (err: any) {
    console.error('[Contact Retry]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// Contact Actions: Follow-up, Note, Exclude
// ──────────────────────────────────────────────────────────────

// Mark contact as followed up
router.post('/api/campaigns/:id/contacts/:contactId/follow-up', async (req: Request, res: Response) => {
  try {
    const { id, contactId } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { error } = await supabase
      .from('outbound_contacts')
      .update({ followed_up: true })
      .eq('id', contactId)
      .eq('campaign_id', id)
      .eq('tenant_id', tenant_id);

    if (error) {
      console.error('[Contact Follow-up]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Contact Follow-up]', err);
    res.status(500).json({ error: err.message });
  }
});

// Add note to contact
router.post('/api/campaigns/:id/contacts/:contactId/note', async (req: Request, res: Response) => {
  try {
    const { id, contactId } = req.params;
    const { tenant_id, note } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
    if (!note || !note.trim()) { res.status(400).json({ error: 'note is required' }); return; }

    const { error } = await supabase
      .from('outbound_contacts')
      .update({ notes: note.trim() })
      .eq('id', contactId)
      .eq('campaign_id', id)
      .eq('tenant_id', tenant_id);

    if (error) {
      console.error('[Contact Note]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Contact Note]', err);
    res.status(500).json({ error: err.message });
  }
});

// Exclude contact from future campaigns
router.post('/api/campaigns/:id/contacts/:contactId/exclude', async (req: Request, res: Response) => {
  try {
    const { id, contactId } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { error } = await supabase
      .from('outbound_contacts')
      .update({ excluded: true })
      .eq('id', contactId)
      .eq('campaign_id', id)
      .eq('tenant_id', tenant_id);

    if (error) {
      console.error('[Contact Exclude]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Contact Exclude]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// Campaign Actions: Launch, Pause, Resume, Cancel
// ──────────────────────────────────────────────────────────────

// Helper: ensure a dedicated outbound Retell agent exists for this tenant
async function ensureOutboundAgent(tenantId: string, scriptPrompt: string, voiceId: string, transferNumber?: string | null): Promise<{ agentId: string; error?: string }> {
  const { data: config, error: cfgErr } = await supabase
    .from('voice_config')
    .select('retell_agent_id_outbound, business_name, telnyx_number')
    .eq('tenant_id', tenantId)
    .single();

  console.error('[ensureOutboundAgent] voice_config lookup for tenant:', tenantId);
  console.error('[ensureOutboundAgent] result:', config ? {
    retell_agent_id_outbound: config.retell_agent_id_outbound || '(null)',
    business_name: config.business_name || '(null)',
    telnyx_number: config.telnyx_number || '(null)',
  } : 'NOT FOUND', 'error:', cfgErr?.message || 'none');

  if (cfgErr || !config) {
    return { agentId: '', error: 'Voice config not found for tenant' };
  }

  const businessName = config.business_name || 'the team';

  // Build tools: end_call + optional transfer_call
  const generalTools: any[] = [
    { type: 'end_call' as const, name: 'end_call', description: 'End the call when conversation is complete or customer wants to stop' },
  ];

  if (transferNumber) {
    generalTools.push({
      type: 'transfer_call' as const,
      name: 'transfer_to_team',
      description: 'Transfer the call to the business team when the customer wants to speak with someone now',
      speak_during_execution: true,
      execution_message_description: 'Let me connect you with the team now. Just one moment.',
      transfer_destination: { type: 'predefined' as const, number: transferNumber },
      transfer_option: { type: 'warm_transfer' as const, prompt: 'Introduce the customer and summarise their interest.' },
    });
  }

  // Create or update the LLM response engine
  const llmParams: any = {
    model: 'claude-4.5-sonnet' as any,
    general_prompt: scriptPrompt,
    begin_message: null, // Agent speaks first based on prompt
    general_tools: generalTools,
    default_dynamic_variables: {
      business_name: businessName,
      agent_name: 'the team',
      transfer_number: transferNumber || '',
      agent_number: config.telnyx_number || '',
      customer_name: 'there',
    },
  };

  if (config.retell_agent_id_outbound) {
    // Update existing agent's LLM
    try {
      const agent = await retell.agent.retrieve(config.retell_agent_id_outbound);
      const llmId = (agent.response_engine as any)?.llm_id;

      if (llmId) {
        await retell.llm.update(llmId, llmParams);
      }

      // Update agent voice if changed
      await retell.agent.update(config.retell_agent_id_outbound, {
        voice_id: voiceId,
        agent_name: `${businessName} - Outbound`,
      });

      return { agentId: config.retell_agent_id_outbound };
    } catch (err: any) {
      console.error('[Outbound Agent] Failed to update existing agent, creating new one:', err.message);
    }
  }

  // Create new LLM + agent
  try {
    const llm = await retell.llm.create(llmParams);

    const agent = await retell.agent.create({
      voice_id: voiceId,
      response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
      agent_name: `${businessName} - Outbound`,
      language: 'en-AU',
      webhook_url: 'https://solarops.com.au/api/campaigns/webhook',
      post_call_analysis_data: [
        { type: 'boolean' as const, name: 'spoke_with_target', description: 'Did we reach and speak with the intended person?' },
        { type: 'enum' as const, name: 'customer_interest', description: 'Customer interest level', choices: ['interested', 'not_interested', 'already_has_battery', 'wants_more_info', 'do_not_call'] },
        { type: 'enum' as const, name: 'outcome', description: 'Call outcome', choices: ['callback_booked', 'transferred_live', 'not_interested', 'voicemail_left', 'no_answer', 'wrong_number', 'do_not_call'] },
        { type: 'string' as const, name: 'callback_preference', description: 'When the customer wants a callback (e.g. "Tomorrow afternoon", "Wednesday morning")' },
        { type: 'string' as const, name: 'questions_asked', description: 'Questions the customer asked during the call' },
        { type: 'string' as const, name: 'call_summary', description: '1-2 sentence summary of the call' },
        { type: 'enum' as const, name: 'sentiment', description: 'Customer sentiment', choices: ['positive', 'neutral', 'negative'] },
      ],
      guardrail_config: {
        output_topics: ['regulated_professional_advice'],
      },
    });

    // Store the outbound agent ID
    await supabase
      .from('voice_config')
      .update({
        retell_agent_id_outbound: agent.agent_id,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return { agentId: agent.agent_id };
  } catch (err: any) {
    console.error('[Outbound Agent] Creation failed:', err);
    return { agentId: '', error: err.message };
  }
}

// Helper: convert HH:MM time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Launch campaign
router.post('/api/campaigns/:id/launch', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'draft') {
      res.status(400).json({ error: `Cannot launch campaign with status "${campaign.status}"` });
      return;
    }

    if (!campaign.script_prompt) {
      res.status(400).json({ error: 'Campaign has no script prompt configured' });
      return;
    }

    // Fetch pending contacts
    const { data: contacts, error: contactErr } = await supabase
      .from('outbound_contacts')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'pending');

    if (contactErr || !contacts || contacts.length === 0) {
      res.status(400).json({ error: 'No pending contacts to call' });
      return;
    }

    // Get voice config for caller ID
    const { data: voiceConfig } = await supabase
      .from('voice_config')
      .select('telnyx_number, business_name')
      .eq('tenant_id', tenant_id)
      .single();

    if (!voiceConfig?.telnyx_number) {
      res.status(400).json({ error: 'No Telnyx number configured for this tenant' });
      return;
    }

    const callerNumber = campaign.caller_id || voiceConfig.telnyx_number;
    const businessName = voiceConfig.business_name || 'the team';

    // Ensure outbound agent exists
    console.error('[Campaign Launch] tenant_id:', tenant_id, 'callerNumber:', callerNumber);

    const { agentId, error: agentErr } = await ensureOutboundAgent(
      tenant_id,
      campaign.script_prompt,
      campaign.voice_id || '11labs-Adrian',
      campaign.transfer_number,
    );

    console.error('[Campaign Launch] ensureOutboundAgent result — agentId:', agentId, 'error:', agentErr || 'none');

    if (!agentId) {
      res.status(500).json({ error: `Failed to create outbound agent: ${agentErr}` });
      return;
    }

    // Build batch call tasks — use retell_llm_dynamic_variables per task for personalisation
    const tasks = contacts.map((c: any) => ({
      to_number: c.phone_number,
      retell_llm_dynamic_variables: {
        customer_name: c.customer_name || 'there',
        business_name: businessName,
        agent_name: 'the team',
        transfer_number: campaign.transfer_number || '',
        agent_number: callerNumber,
        ...(c.custom_data || {}),
      },
      metadata: {
        campaign_id: id,
        contact_id: c.id,
        tenant_id,
      },
    }));

    // Build call time window if configured
    let callTimeWindow: any = undefined;
    if (campaign.call_window_start && campaign.call_window_end) {
      const startMin = timeToMinutes(campaign.call_window_start);
      const endMin = timeToMinutes(campaign.call_window_end);

      if (startMin < endMin) {
        const dayMap: Record<string, string> = {
          mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
          thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
        };
        const days = campaign.call_window_days?.map((d: string) => dayMap[d]).filter(Boolean);

        callTimeWindow = {
          timezone: 'Australia/Sydney',
          windows: [{ start: startMin, end: endMin }],
          ...(days && days.length > 0 ? { day: days } : {}),
        };
      }
    }

    // Launch via Retell SDK — agent_id at top level, not per-task override
    console.error('[Campaign Launch] Creating batch call with agentId:', agentId, 'from:', callerNumber, 'tasks:', tasks.length);
    const batchResult = await retell.batchCall.createBatchCall({
      from_number: callerNumber,
      agent_id: agentId,
      name: campaign.name,
      tasks,
      ...(callTimeWindow ? { call_time_window: callTimeWindow } : {}),
      ...(campaign.scheduled_at ? { trigger_timestamp: new Date(campaign.scheduled_at).getTime() } : {}),
    } as any);

    // Update campaign status
    await supabase
      .from('outbound_campaigns')
      .update({
        status: 'active',
        retell_batch_call_id: batchResult.batch_call_id,
        caller_id: callerNumber,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Mark contacts as calling
    await supabase
      .from('outbound_contacts')
      .update({ status: 'calling' })
      .eq('campaign_id', id)
      .eq('status', 'pending');

    res.json({
      success: true,
      batch_call_id: batchResult.batch_call_id,
      total_tasks: batchResult.total_task_count,
      contacts_queued: contacts.length,
    });
  } catch (err: any) {
    console.error('[Campaign Launch]', err);
    res.status(500).json({ error: err.message });
  }
});

// Pause campaign
router.post('/api/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'active') {
      res.status(400).json({ error: `Cannot pause campaign with status "${campaign.status}"` });
      return;
    }

    await supabase
      .from('outbound_campaigns')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Mark remaining calling contacts back to pending
    await supabase
      .from('outbound_contacts')
      .update({ status: 'pending' })
      .eq('campaign_id', id)
      .eq('status', 'calling');

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Campaign Pause]', err);
    res.status(500).json({ error: err.message });
  }
});

// Resume campaign
router.post('/api/campaigns/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'paused') {
      res.status(400).json({ error: `Cannot resume campaign with status "${campaign.status}"` });
      return;
    }

    await supabase
      .from('outbound_campaigns')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Campaign Resume]', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel campaign
router.post('/api/campaigns/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (!['active', 'paused', 'draft'].includes(campaign.status)) {
      res.status(400).json({ error: `Cannot cancel campaign with status "${campaign.status}"` });
      return;
    }

    await supabase
      .from('outbound_campaigns')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Mark remaining pending/calling contacts as skipped
    await supabase
      .from('outbound_contacts')
      .update({ status: 'skipped' })
      .eq('campaign_id', id)
      .in('status', ['pending', 'calling']);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Campaign Cancel]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// Webhook: Retell outbound call events
// ──────────────────────────────────────────────────────────────
router.post('/api/campaigns/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (event.event !== 'call_analyzed' && event.event !== 'call_ended') {
      res.json({ received: true });
      return;
    }

    const call = event.data || event.call || {};
    const metadata = call.metadata || {};
    const campaignId = metadata.campaign_id;
    const contactId = metadata.contact_id;
    const tenantId = metadata.tenant_id;

    if (!campaignId || !contactId) {
      // Not an outbound campaign call — ignore
      res.json({ received: true });
      return;
    }

    const analysis = call.call_analysis || {};
    const customData = analysis.custom_analysis_data || {};

    const duration = call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : null;

    // Determine status and outcome from Retell data
    const disconnectReason = call.disconnect_reason || '';
    let status = 'completed';
    let outcome = customData.outcome || null;

    if (disconnectReason === 'no_answer' || disconnectReason === 'dial_no_answer') {
      status = 'no_answer';
      outcome = outcome || 'no_answer';
    } else if (disconnectReason === 'busy' || disconnectReason === 'dial_busy') {
      status = 'busy';
      outcome = outcome || 'busy';
    } else if (disconnectReason === 'voicemail_reached') {
      status = 'voicemail';
      outcome = outcome || 'voicemail_left';
    } else if (disconnectReason === 'error' || disconnectReason === 'dial_failed') {
      status = 'failed';
      outcome = outcome || 'failed';
    } else {
      status = 'completed';
    }

    // Map custom analysis outcomes
    if (customData.outcome === 'callback_booked') status = 'callback_booked';
    if (customData.outcome === 'transferred_live') status = 'transferred';
    if (customData.outcome === 'do_not_call') status = 'do_not_call';

    // Update the contact
    const { error: contactErr } = await supabase
      .from('outbound_contacts')
      .update({
        status,
        outcome: outcome || customData.customer_interest || null,
        sentiment: customData.sentiment || analysis.user_sentiment || null,
        call_summary: customData.call_summary || analysis.call_summary || null,
        callback_preference: customData.callback_preference || null,
        questions_asked: customData.questions_asked || null,
        transcript: call.transcript || null,
        recording_url: call.recording_url || null,
        retell_call_id: call.call_id || null,
        call_duration: duration,
        call_cost: duration ? parseFloat(((duration / 60) * 0.12).toFixed(4)) : null,
        called_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (contactErr) {
      console.error('[Campaign Webhook] Contact update error:', contactErr);
    }

    // Update campaign aggregate counters
    if (campaignId) {
      // Fetch current counts from contacts table
      const { data: contacts } = await supabase
        .from('outbound_contacts')
        .select('status, outcome')
        .eq('campaign_id', campaignId);

      if (contacts) {
        const callsMade = contacts.filter(c => c.status !== 'pending' && c.status !== 'calling' && c.status !== 'skipped').length;
        const callsAnswered = contacts.filter(c => ['completed', 'callback_booked', 'transferred', 'do_not_call'].includes(c.status)).length;
        const callsInterested = contacts.filter(c => c.outcome === 'interested' || c.outcome === 'callback_booked' || c.outcome === 'transferred_live' || c.outcome === 'wants_more_info').length;
        const callbacksBooked = contacts.filter(c => c.outcome === 'callback_booked' || c.status === 'callback_booked').length;
        const allDone = contacts.every(c => c.status !== 'pending' && c.status !== 'calling');

        const updateData: any = {
          calls_made: callsMade,
          calls_answered: callsAnswered,
          calls_interested: callsInterested,
          callbacks_booked: callbacksBooked,
          updated_at: new Date().toISOString(),
        };

        if (allDone) {
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
        }

        await supabase
          .from('outbound_campaigns')
          .update(updateData)
          .eq('id', campaignId);
      }
    }

    // Log usage
    if (duration && tenantId) {
      await supabase.from('api_usage_log').insert({
        tenant_id: tenantId,
        module: 'outbound_campaign',
        service: 'retell',
        cost_usd: parseFloat(((duration / 60) * 0.12).toFixed(4)),
        status: 'success',
      });
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Campaign Webhook]', err);
    res.status(200).json({ received: true });
  }
});

// ──────────────────────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────────────────────

// List templates (system + tenant custom)
router.get('/api/campaigns/templates', async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }

    const { data, error } = await supabase
      .from('campaign_templates')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenant_id}`)
      .order('is_system', { ascending: false })
      .order('name');

    if (error) {
      console.error('[Templates List]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch (err: any) {
    console.error('[Templates List]', err);
    res.status(500).json({ error: err.message });
  }
});

// Create custom template
router.post('/api/campaigns/templates', async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, description, prompt_template, category } = req.body;
    if (!tenant_id || !name || !prompt_template) {
      res.status(400).json({ error: 'tenant_id, name, and prompt_template are required' });
      return;
    }

    const { data, error } = await supabase
      .from('campaign_templates')
      .insert({
        tenant_id,
        name,
        description: description || null,
        prompt_template,
        category: category || 'custom',
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Template Create]', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Template Create]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
