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
