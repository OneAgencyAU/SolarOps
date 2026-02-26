import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 8000;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SolarOps API' });
});

app.listen(PORT, () => {
  console.log(`SolarOps API running on port ${PORT}`);
});
