import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://solar-ops.replit.app/api/auth/gmail/callback'
  );
}

router.get('/api/auth/gmail', (req: Request, res: Response) => {
  const tenant_id = req.query.tenant_id as string;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state: tenant_id,
    prompt: 'consent',
  });
  res.redirect(url);
});

router.get('/api/auth/gmail/callback', async (req: Request, res: Response) => {
  const { code, state: tenant_id } = req.query;
  if (!code || !tenant_id) { res.status(400).send('Missing code or state'); return; }
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const { error } = await supabase.from('inbox_connections').upsert({
      tenant_id: tenant_id as string,
      provider: 'gmail',
      email: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,provider' });

    if (error) { res.status(500).send('Failed to save connection'); return; }
    res.redirect(`/inbox?connected=gmail`);
  } catch (err: any) {
    console.error('[Gmail OAuth] Callback error:', err);
    res.status(500).send('OAuth failed: ' + err.message);
  }
});

router.get('/api/inbox/connections', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data, error } = await supabase
    .from('inbox_connections')
    .select('id, provider, email, updated_at')
    .eq('tenant_id', tenant_id as string);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post('/api/inbox/sync', async (req: Request, res: Response) => {
  const { tenant_id } = req.body;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  try {
    const { data: connections } = await supabase
      .from('inbox_connections')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'gmail');

    if (!connections || connections.length === 0) {
      res.json({ synced: 0, message: 'No Gmail connection found' });
      return;
    }

    const conn = connections[0];
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
    });

    oauth2Client.on('tokens', async (tokens) => {
      await supabase.from('inbox_connections').update({
        access_token: tokens.access_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', conn.id);
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'in:inbox -category:promotions -category:social',
    });

    const messages = listRes.data.messages || [];
    let synced = 0;

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });

      const headers = full.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/) || [null, from, from];
      const fromName = (fromMatch[1] || '').trim().replace(/^"|"$/g, '');
      const fromEmail = fromMatch[2] || from;
      const subject = getHeader('Subject');
      const dateStr = getHeader('Date');
      const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      let bodyText = '';
      const extractBody = (part: any): string => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          for (const p of part.parts) {
            const text = extractBody(p);
            if (text) return text;
          }
        }
        return '';
      };
      bodyText = extractBody(full.data.payload);
      if (!bodyText && full.data.snippet) bodyText = full.data.snippet;

      const preview = bodyText.slice(0, 120).replace(/\n/g, ' ');

      const { error: upsertError } = await supabase.from('inbox_emails').upsert({
        tenant_id,
        connection_id: conn.id,
        provider: 'gmail',
        external_id: msg.id!,
        from_name: fromName,
        from_email: fromEmail,
        subject,
        body_text: bodyText,
        body_preview: preview,
        received_at: receivedAt,
        is_read: !full.data.labelIds?.includes('UNREAD'),
      }, { onConflict: 'tenant_id,external_id' });

      if (!upsertError) synced++;
    }

    await supabase.from('inbox_connections').update({ updated_at: new Date().toISOString() }).eq('id', conn.id);
    res.json({ synced, total: messages.length });
  } catch (err: any) {
    console.error('[Inbox Sync] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/inbox/emails', async (req: Request, res: Response) => {
  const { tenant_id, limit = '50' } = req.query;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { data, error } = await supabase
    .from('inbox_emails')
    .select('*')
    .eq('tenant_id', tenant_id as string)
    .order('received_at', { ascending: false })
    .limit(Number(limit));
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.delete('/api/inbox/connections/:provider', async (req: Request, res: Response) => {
  const { tenant_id } = req.body;
  const { provider } = req.params;
  if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
  const { error } = await supabase
    .from('inbox_connections')
    .delete()
    .eq('tenant_id', tenant_id)
    .eq('provider', provider);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
