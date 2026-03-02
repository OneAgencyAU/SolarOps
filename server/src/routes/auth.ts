import { Router, Request, Response } from 'express';
import passport from '../config/passport';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

router.get('/api/auth/google', (req: Request, res: Response) => {
  const { tenant_id, user_id } = req.query;

  if (!tenant_id || !user_id) {
    res.status(400).json({ error: 'tenant_id and user_id are required' });
    return;
  }

  (req.session as any).firebaseUid = user_id;

  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    accessType: 'offline',
    prompt: 'consent',
    state: tenant_id as string,
  } as any)(req, res);
});

router.get(
  '/api/auth/google/callback',
  (req: Request, res: Response, next) => {
    passport.authenticate('google', (err: any, user: any) => {
      if (err || !user) {
        console.error('[Google OAuth] Callback error:', err);
        res.redirect('/connections?error=auth_failed');
        return;
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Google OAuth] Login error:', loginErr);
          res.redirect('/connections?error=auth_failed');
          return;
        }
        res.redirect('/connections?connected=true');
      });
    })(req, res, next);
  }
);

router.get('/api/auth/google/status', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;

  if (!tenant_id) {
    res.json({ connected: false, email: null, lastSync: null });
    return;
  }

  const { data, error } = await supabase
    .from('google_connections')
    .select('google_email, last_sync')
    .eq('tenant_id', tenant_id)
    .maybeSingle();

  if (error) {
    console.error('[Google Status] Supabase error:', error);
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.json({ connected: false, email: null, lastSync: null });
    return;
  }

  res.json({
    connected: true,
    email: data.google_email,
    lastSync: data.last_sync,
  });
});

router.delete('/api/auth/google/disconnect', async (req: Request, res: Response) => {
  const { tenant_id } = req.query;

  if (!tenant_id) {
    res.status(400).json({ error: 'tenant_id is required' });
    return;
  }

  const { error } = await supabase
    .from('google_connections')
    .delete()
    .eq('tenant_id', tenant_id);

  if (error) {
    console.error('[Google Disconnect] Supabase error:', error);
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

export default router;
