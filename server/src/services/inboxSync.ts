import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://solar-ops.replit.app/api/auth/gmail/callback'
  );
}

export async function syncGmailForTenant(tenant_id: string): Promise<{ synced: number; total: number }> {
  const { data: connections } = await supabase
    .from('inbox_connections')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('provider', 'gmail');

  if (!connections || connections.length === 0) {
    return { synced: 0, total: 0 };
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
    const messageId = getHeader('Message-ID');

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
      message_id: messageId || null,
    }, { onConflict: 'tenant_id,external_id' });

    if (!upsertError) synced++;
  }

  await supabase.from('inbox_connections').update({ updated_at: new Date().toISOString() }).eq('id', conn.id);
  return { synced, total: messages.length };
}
