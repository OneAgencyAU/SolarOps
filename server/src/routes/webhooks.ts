import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const router = Router();

router.post('/api/webhooks/:source', async (req: Request, res: Response) => {
  const source = req.params.source;
  const body = req.body;

  try {
    await supabase.from('automation_jobs').insert({
      tenant_id: body.tenant_id || 'system',
      job_type: 'webhook_event',
      status: 'pending',
      payload: { source, body },
      next_run_at: new Date().toISOString(),
    });
    console.log(`[Webhook] Received from ${source}`);
  } catch (err: any) {
    console.error(`[Webhook] Error storing event from ${source}:`, err.message);
  }

  res.status(200).json({ received: true });
});

export default router;
