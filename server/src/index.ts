import express, { Request, Response } from 'express';
import session from 'express-session';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import passport from './config/passport';
import authRoutes from './routes/auth';
import billReaderRoutes from './routes/billReader';
import usageRoutes from './routes/usage';
import inboxRouter from './routes/inbox';
import voiceRouter from './routes/voice';

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'solarops-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(authRoutes);
app.use(billReaderRoutes);
app.use(usageRoutes);
app.use(inboxRouter);
app.use(voiceRouter);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'SolarOps API' });
});

app.post('/api/users', async (req: Request, res: Response) => {
  const { id, email, display_name, avatar_url } = req.body;

  if (!id || !email) {
    res.status(400).json({ error: 'id and email are required' });
    return;
  }

  const { data, error } = await supabase
    .from('users')
    .upsert({ id, email, display_name, avatar_url }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/users] Supabase error:', error);
    res.status(500).json({ error: error.message, code: error.code, details: error.details, hint: error.hint });
    return;
  }

  res.json(data);
});

app.post('/api/onboarding', async (req: Request, res: Response) => {
  const { user_id, email, display_name, avatar_url, first_name, last_name, business_name } = req.body;

  if (!user_id || !email || !business_name) {
    res.status(400).json({ error: 'user_id, email, and business_name are required' });
    return;
  }

  const { error: userErr } = await supabase
    .from('users')
    .upsert({ id: user_id, email, display_name, avatar_url, first_name, last_name }, { onConflict: 'id' });

  if (userErr) {
    console.error('[POST /api/onboarding] user upsert error:', userErr);
    res.status(500).json({ error: userErr.message, code: userErr.code, details: userErr.details, hint: userErr.hint });
    return;
  }

  const { data: existingMembership, error: memberCheckErr } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user_id)
    .maybeSingle();

  if (memberCheckErr) {
    console.error('[POST /api/onboarding] membership check error:', memberCheckErr);
    res.status(500).json({ error: memberCheckErr.message, code: memberCheckErr.code, details: memberCheckErr.details, hint: memberCheckErr.hint });
    return;
  }

  if (existingMembership) {
    console.log('[POST /api/onboarding] user already has tenant, skipping creation:', user_id);
    res.json({ already_exists: true });
    return;
  }

  const slug = business_name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ name: business_name.trim(), slug })
    .select()
    .single();

  if (tenantErr) {
    console.error('[POST /api/onboarding] tenant insert error:', tenantErr);
    res.status(500).json({ error: tenantErr.message, code: tenantErr.code, details: tenantErr.details, hint: tenantErr.hint });
    return;
  }

  const { error: memberErr } = await supabase
    .from('tenant_memberships')
    .insert({ tenant_id: tenant.id, user_id, role: 'admin' });

  if (memberErr) {
    console.error('[POST /api/onboarding] membership insert error:', memberErr);
    res.status(500).json({ error: memberErr.message, code: memberErr.code, details: memberErr.details, hint: memberErr.hint });
    return;
  }

  res.json(tenant);
});

const clientDist = path.join(__dirname, '../../../dist/client');
app.use(express.static(clientDist));
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SolarOps API running on port ${PORT}`);
});
