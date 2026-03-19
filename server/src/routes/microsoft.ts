import { Router, Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

const MS_CLIENT_ID = process.env.MS_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';
const MS_TENANT_ID = process.env.MS_TENANT_ID || 'common';

const msalConfig = {
  auth: {
    clientId: MS_CLIENT_ID,
    clientSecret: MS_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${MS_TENANT_ID}`,
  },
};

const SCOPES = ['Mail.Read', 'Mail.ReadWrite', 'Mail.Send', 'User.Read', 'offline_access'];

function getRedirectUri() {
  return `${process.env.APP_URL || 'https://solarops.com.au'}/api/auth/microsoft/callback`;
}

function cleanMsEmail(mail: string | undefined, upn: string | undefined): string {
  if (mail) return mail;
  if (!upn) return '';
  if (!upn.includes('#EXT#')) return upn;
  const beforeExt = upn.split('#EXT#')[0];
  const lastUnderscore = beforeExt.lastIndexOf('_');
  if (lastUnderscore === -1) return beforeExt;
  return beforeExt.slice(0, lastUnderscore) + '@' + beforeExt.slice(lastUnderscore + 1);
}

function getMsalClient() {
  return new ConfidentialClientApplication(msalConfig);
}

async function getAccessToken(tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from('tenant_connections')
    .select('ms_access_token, ms_refresh_token')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!data?.ms_access_token) return null;

  try {
    const cca = getMsalClient();
    const result = await cca.acquireTokenByRefreshToken({
      refreshToken: data.ms_refresh_token,
      scopes: SCOPES.filter(s => s !== 'offline_access'),
    });
    if (result?.accessToken && result.accessToken !== data.ms_access_token) {
      await supabase.from('tenant_connections').update({
        ms_access_token: result.accessToken,
      }).eq('tenant_id', tenantId);
      return result.accessToken;
    }
  } catch {}

  return data.ms_access_token;
}

async function graphFetch(accessToken: string, url: string, options: any = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

router.get('/api/auth/microsoft', (req: Request, res: Response) => {
  const { tenant_id, user_id } = req.query;
  if (!tenant_id || !user_id) {
    res.status(400).json({ error: 'tenant_id and user_id required' });
    return;
  }

  (req.session as any).ms_tenant_id = tenant_id;
  (req.session as any).ms_user_id = user_id;

  const cca = getMsalClient();
  cca.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: getRedirectUri(),
    state: tenant_id as string,
  }).then(url => {
    res.redirect(url);
  }).catch(err => {
    console.error('[Microsoft OAuth] Auth URL error:', err);
    res.redirect('/connections?error=ms_auth_failed');
  });
});

router.get('/api/auth/microsoft/callback', async (req: Request, res: Response) => {
  const { code, state: tenant_id } = req.query;
  if (!code || !tenant_id) {
    res.redirect('/connections?error=ms_auth_failed');
    return;
  }

  try {
    const cca = getMsalClient();
    const tokenResponse = await cca.acquireTokenByCode({
      code: code as string,
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
    });

    const accessToken = tokenResponse.accessToken;

    const profile = await graphFetch(accessToken, 'https://graph.microsoft.com/v1.0/me') as { mail?: string; userPrincipalName?: string; displayName?: string };
    const email = cleanMsEmail(profile.mail, profile.userPrincipalName);

    const refreshToken = (tokenResponse as any)?.refreshToken ||
      (tokenResponse as any)?.tokenCache?.serialize?.() || '';

    let storedRefreshToken = refreshToken;
    if (typeof refreshToken !== 'string') {
      try {
        const serialized = cca.getTokenCache().serialize();
        const parsed = JSON.parse(serialized);
        const rtKeys = Object.keys(parsed.RefreshToken || {});
        if (rtKeys.length > 0) {
          storedRefreshToken = parsed.RefreshToken[rtKeys[0]].secret;
        }
      } catch {}
    }

    const { data: existing } = await supabase
      .from('tenant_connections')
      .select('id')
      .eq('tenant_id', tenant_id as string)
      .maybeSingle();

    if (existing) {
      await supabase.from('tenant_connections').update({
        ms_access_token: accessToken,
        ms_refresh_token: storedRefreshToken || null,
        ms_email: email,
        ms_connected_at: new Date().toISOString(),
        ms_last_sync: new Date().toISOString(),
      }).eq('tenant_id', tenant_id as string);
    } else {
      await supabase.from('tenant_connections').insert({
        tenant_id: tenant_id as string,
        ms_access_token: accessToken,
        ms_refresh_token: storedRefreshToken || null,
        ms_email: email,
        ms_connected_at: new Date().toISOString(),
        ms_last_sync: new Date().toISOString(),
      });
    }

    res.redirect('/connections?ms_connected=true');
  } catch (err: any) {
    console.error('[Microsoft OAuth] Callback error:', err);
    res.redirect('/connections?error=ms_auth_failed');
  }
});

router.get('/api/auth/microsoft/status', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) {
    res.json({ connected: false, email: null, lastSync: null });
    return;
  }

  const { data, error } = await supabase
    .from('tenant_connections')
    .select('ms_email, ms_connected_at, ms_last_sync')
    .eq('tenant_id', tenant_id as string)
    .maybeSingle();

  if (error || !data || !data.ms_email) {
    res.json({ connected: false, email: null, lastSync: null });
    return;
  }

  let email = data.ms_email;
  if (email.includes('#EXT#')) {
    email = cleanMsEmail(undefined, email);
    await supabase
      .from('tenant_connections')
      .update({ ms_email: email })
      .eq('tenant_id', tenant_id as string);
  }

  res.json({
    connected: true,
    email,
    lastSync: data.ms_last_sync,
  });
});

router.delete('/api/auth/microsoft/disconnect', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  const { error } = await supabase
    .from('tenant_connections')
    .update({
      ms_access_token: null,
      ms_refresh_token: null,
      ms_email: null,
      ms_connected_at: null,
      ms_last_sync: null,
    })
    .eq('tenant_id', tenant_id as string);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

router.get('/api/microsoft/emails', async (req: Request, res: Response) => {
  const { tenant_id, folder = 'inbox', limit = '20' } = req.query;
  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  try {
    const accessToken = await getAccessToken(tenant_id as string);
    if (!accessToken) {
      res.status(401).json({ error: 'No Microsoft connection found' });
      return;
    }

    const top = Math.min(Number(limit) || 20, 50);
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,conversationId,body`;

    const data = await graphFetch(accessToken, url) as { value?: any[] };
    const messages = data.value || [];

    const formatted = messages.map((msg: any) => ({
      id: msg.id,
      external_id: msg.id,
      threadId: msg.conversationId,
      subject: msg.subject || '(no subject)',
      from_name: msg.from?.emailAddress?.name || '',
      from_email: msg.from?.emailAddress?.address || '',
      body_preview: msg.bodyPreview || '',
      body_text: msg.body?.content || msg.bodyPreview || '',
      received_at: msg.receivedDateTime,
      is_read: msg.isRead,
      provider: 'microsoft',
      tenant_id,
    }));

    for (const email of formatted) {
      await supabase.from('inbox_emails').upsert({
        tenant_id: tenant_id as string,
        provider: 'microsoft',
        external_id: email.external_id,
        from_name: email.from_name,
        from_email: email.from_email,
        subject: email.subject,
        body_text: email.body_text,
        body_preview: email.body_preview,
        received_at: email.received_at,
        is_read: email.is_read,
      }, { onConflict: 'tenant_id,external_id' }).then(() => {});
    }

    await supabase.from('tenant_connections').update({
      ms_last_sync: new Date().toISOString(),
    }).eq('tenant_id', tenant_id as string);

    res.json(formatted);
  } catch (err: any) {
    console.error('[Microsoft Emails] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/microsoft/email/:id', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;
  const { id } = req.params;
  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  try {
    const accessToken = await getAccessToken(tenant_id as string);
    if (!accessToken) {
      res.status(401).json({ error: 'No Microsoft connection found' });
      return;
    }

    const msg = await graphFetch(accessToken, `https://graph.microsoft.com/v1.0/me/messages/${id}`) as {
      id: string;
      subject?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
      receivedDateTime?: string;
      body?: { content?: string };
      internetMessageId?: string;
      conversationId?: string;
    };

    res.json({
      id: msg.id,
      subject: msg.subject,
      from: {
        name: msg.from?.emailAddress?.name || '',
        email: msg.from?.emailAddress?.address || '',
      },
      date: msg.receivedDateTime,
      body: msg.body?.content || '',
      headers: {
        messageId: msg.internetMessageId || null,
        conversationId: msg.conversationId || null,
      },
    });
  } catch (err: any) {
    console.error('[Microsoft Email] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/microsoft/draft', async (req: Request, res: Response) => {
  const { tenant_id, to, subject, body, replyToMessageId } = req.body;
  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }

  try {
    const accessToken = await getAccessToken(tenant_id);
    if (!accessToken) {
      res.status(401).json({ error: 'No Microsoft connection found' });
      return;
    }

    let draft: any;

    if (replyToMessageId) {
      draft = await graphFetch(accessToken, `https://graph.microsoft.com/v1.0/me/messages/${replyToMessageId}/createReply`, {
        method: 'POST',
        body: JSON.stringify({
          comment: body || '',
        }),
      });

      if (draft?.id && body) {
        await graphFetch(accessToken, `https://graph.microsoft.com/v1.0/me/messages/${draft.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            body: { contentType: 'Text', content: body },
          }),
        });
      }
    } else {
      draft = await graphFetch(accessToken, 'https://graph.microsoft.com/v1.0/me/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject || '',
          body: { contentType: 'Text', content: body || '' },
          toRecipients: to ? [{ emailAddress: { address: to } }] : [],
          isDraft: true,
        }),
      });
    }

    res.json({ draftId: draft?.id || null, success: true });
  } catch (err: any) {
    console.error('[Microsoft Draft] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/microsoft/send', async (req: Request, res: Response) => {
  const { tenant_id, draftId } = req.body;
  if (!tenant_id || !draftId) {
    res.status(400).json({ error: 'tenant_id and draftId required' });
    return;
  }

  try {
    const accessToken = await getAccessToken(tenant_id);
    if (!accessToken) {
      res.status(401).json({ error: 'No Microsoft connection found' });
      return;
    }

    await graphFetch(accessToken, `https://graph.microsoft.com/v1.0/me/messages/${draftId}/send`, {
      method: 'POST',
    });

    await supabase.from('tenant_connections').update({
      ms_last_sync: new Date().toISOString(),
    }).eq('tenant_id', tenant_id);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Microsoft Send] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
