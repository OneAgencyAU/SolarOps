import { Router, Request, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/gif',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

const router = Router();

function getVisionClient() {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (apiKey) {
    return new ImageAnnotatorClient({ apiKey });
  }
  return new ImageAnnotatorClient();
}

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseClaudeJson(raw: string): any {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    console.error('[Bill Reader] JSON parse failed. Raw Claude response:', raw);
    return {};
  }
}

async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const convert = (await import('heic-convert')).default;
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const result = await convert({
    buffer: arrayBuffer,
    format: 'JPEG',
    quality: 0.9,
  });
  return Buffer.from(result);
}

async function getImageBuffer(file: Express.Multer.File): Promise<{ buffer: Buffer; mimetype: string }> {
  if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
    const jpegBuffer = await convertHeicToJpeg(file.buffer);
    return { buffer: jpegBuffer, mimetype: 'image/jpeg' };
  }
  return { buffer: file.buffer, mimetype: file.mimetype };
}

async function logUsage(params: {
  tenant_id?: string | null;
  module: string;
  customer_name?: string | null;
  retailer?: string | null;
  service: string;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd: number;
  status?: string;
}) {
  try {
    const { error } = await supabase.from('api_usage_log').insert({
      tenant_id: params.tenant_id || null,
      module: params.module,
      customer_name: params.customer_name || null,
      retailer: params.retailer || null,
      service: params.service,
      model: params.model || null,
      input_tokens: params.input_tokens ?? null,
      output_tokens: params.output_tokens ?? null,
      cost_usd: params.cost_usd,
      status: params.status || 'success',
    });
    if (error) {
      console.error('[Usage Log] Insert error:', error.message);
    }
  } catch (e) {
    console.error('[Usage Log] Failed to log usage:', e);
  }
}

router.post('/api/bill-reader/check', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filename = req.file.originalname;

    const BILL_FILENAME_KEYWORDS = [
      'agl', 'origin', 'amber', 'energyaustralia', 'alinta', 'ergon',
      'powershop', 'redenergy', 'actewagl', 'endeavour', 'bill',
      'electricity', 'invoice', 'energy',
    ];
    const lowerFilename = filename.toLowerCase();
    if (BILL_FILENAME_KEYWORDS.some((kw) => lowerFilename.includes(kw))) {
      res.json({ isBill: true, confidence: 1.0, reason: 'Filename indicates an electricity bill or energy document.' });
      return;
    }

    const anthropic = getAnthropicClient();
    const { buffer, mimetype } = await getImageBuffer(req.file);

    let messageContent: any[];

    if (req.file.mimetype === 'application/pdf') {
      const visionClient = getVisionClient();
      const request = {
        requests: [{
          inputConfig: { content: req.file.buffer.toString('base64'), mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const, maxResults: 1 }],
          pages: [1],
        }],
      };
      const [result] = await visionClient.batchAnnotateFiles(request);
      const page = result.responses?.[0]?.responses?.[0];
      const sampleText = (page?.fullTextAnnotation?.text || '').slice(0, 1500);
      messageContent = [{
        type: 'text',
        text: `Filename: ${filename}\nText sample: ${sampleText}`,
      }];
    } else {
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: buffer.toString('base64'),
          },
        },
        {
          type: 'text',
          text: `Filename: ${filename}\n\nIs this an Australian electricity bill or energy account document? Be generous — if there are ANY indicators like energy company names, electricity terms (kWh, NMI, supply charge, tariff, meter), or account/invoice language, classify as isBill: true. Only return false if clearly NOT an energy bill.\n\nRespond with JSON only:\n{"isBill": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`,
        },
      ];
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: messageContent }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock?.text || '{}';
    const classification = parseClaudeJson(raw);

    if (!classification.isBill && (classification.confidence ?? 1) >= 0.3) {
      classification.isBill = true;
    }

    const haikuInputTokens = message.usage?.input_tokens ?? null;
    const haikuOutputTokens = message.usage?.output_tokens ?? null;
    const haikuCost = (haikuInputTokens ?? 0) * 0.00000025 + (haikuOutputTokens ?? 0) * 0.00000125;

    await logUsage({
      module: 'bill_reader',
      service: 'claude_haiku',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: haikuInputTokens,
      output_tokens: haikuOutputTokens,
      cost_usd: haikuCost,
      status: classification.isBill ? 'success' : 'rejected',
    });

    res.json(classification);
  } catch (err: any) {
    console.error('[Bill Reader] Check error:', err);
    res.status(500).json({ error: err.message || 'Check failed' });
  }
});

router.post('/api/bill-reader/extract', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const extractStart = Date.now();

    const visionClient = getVisionClient();
    let fullText = '';

    if (req.file.mimetype === 'application/pdf') {
      const request = {
        requests: [
          {
            inputConfig: {
              content: req.file.buffer.toString('base64'),
              mimeType: 'application/pdf',
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
          },
        ],
      };
      const [result] = await visionClient.batchAnnotateFiles(request);
      const responses = result.responses?.[0]?.responses || [];
      fullText = responses.map((r) => r.fullTextAnnotation?.text || '').join('\n');
    } else {
      const { buffer } = await getImageBuffer(req.file);
      const [result] = await visionClient.textDetection({
        image: { content: buffer.toString('base64') },
      });
      fullText = result.fullTextAnnotation?.text || '';
    }

    await logUsage({
      module: 'bill_reader',
      service: 'google_vision',
      model: null,
      input_tokens: null,
      output_tokens: null,
      cost_usd: 0.0015,
      status: 'success',
    });

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are an Australian electricity bill parser.\nExtract the following fields from this bill text.\nIf a field is not found, return null.\nRespond with JSON only, no other text:\n{\n  "nmi": "string | null",\n  "retailer": "string | null",\n  "customerName": "string | null",\n  "propertyAddress": "string | null",\n  "billingPeriod": {\n    "from": "string | null",\n    "to": "string | null",\n    "days": "number | null"\n  },\n  "usage": {\n    "dailyAvgKwh": "number | null",\n    "totalKwh": "number | null",\n    "peakKwh": "number | null",\n    "offPeakKwh": "number | null",\n    "shoulderKwh": "number | null"\n  },\n  "rates": {\n    "supplyCharge": "number | null",\n    "usageRate": "number | null",\n    "peakRate": "number | null",\n    "offPeakRate": "number | null",\n    "feedInTariff": "number | null"\n  },\n  "totals": {\n    "totalAmount": "number | null",\n    "gstAmount": "number | null"\n  },\n  "existingSolar": "boolean | null",\n  "existingBattery": "boolean | null",\n  "meterType": "string | null",\n  "meterCondition": "string | null",\n  "confidenceScore": "number"\n}\nFor "billingPeriod.days": calculate the exact number of days between the from and to dates and return as an integer. Do not return null if you have both dates.\nBill text: ${fullText}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock?.text || '{}';
    console.log('[Bill Reader] Extract raw Claude response:', raw);
    const extracted = parseClaudeJson(raw);
    console.log('[Bill Reader] Extract parsed fields:', JSON.stringify(extracted, null, 2));

    if (extracted.confidenceScore !== undefined) {
      if (extracted.confidenceScore > 1) {
        extracted.confidenceScore = extracted.confidenceScore / 100;
      }
    } else {
      extracted.confidenceScore = 0.85;
    }

    const sonnetInputTokens = message.usage?.input_tokens ?? null;
    const sonnetOutputTokens = message.usage?.output_tokens ?? null;
    const sonnetCost =
      (sonnetInputTokens ?? 0) * 0.000003 + (sonnetOutputTokens ?? 0) * 0.000015;

    await logUsage({
      module: 'bill_reader',
      customer_name: extracted.customerName || null,
      retailer: extracted.retailer || null,
      service: 'claude_sonnet',
      model: 'claude-sonnet-4-5',
      input_tokens: sonnetInputTokens,
      output_tokens: sonnetOutputTokens,
      cost_usd: sonnetCost,
      status: 'success',
    });

    console.log('[Bill Reader] Final confidenceScore:', extracted.confidenceScore);
    res.json({ extracted, rawOcrText: fullText, processingMs: Date.now() - extractStart });
  } catch (err: any) {
    console.error('[Bill Reader] Extract error:', err);
    res.status(500).json({ error: err.message || 'Extraction failed' });
  }
});

router.post('/api/bill-reader/save', async (req: Request, res: Response) => {
  try {
    const {
      tenant_id,
      file_name,
      nmi,
      retailer,
      customer_name,
      property_address,
      billing_period_from,
      billing_period_to,
      billing_days,
      daily_avg_kwh,
      total_kwh,
      supply_charge,
      usage_rate,
      feed_in_tariff,
      total_amount,
      existing_solar,
      existing_battery,
      meter_type,
      raw_ocr_text,
      confidence_score,
      processing_ms,
    } = req.body;

    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    const { data, error } = await supabase
      .from('bill_extractions')
      .insert({
        tenant_id,
        file_name,
        source: 'manual',
        nmi,
        retailer,
        customer_name,
        property_address,
        billing_period_from: billing_period_from || null,
        billing_period_to: billing_period_to || null,
        billing_days,
        daily_avg_kwh,
        total_kwh,
        supply_charge,
        usage_rate,
        feed_in_tariff,
        total_amount,
        existing_solar,
        existing_battery,
        meter_type,
        raw_ocr_text,
        confidence_score,
        processing_ms: processing_ms ?? null,
        status: 'extracted',
      })
      .select()
      .single();

    if (error) {
      console.error('[Bill Reader] Save error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[Bill Reader] Save error:', err);
    res.status(500).json({ error: err.message || 'Save failed' });
  }
});

router.get('/api/bill-reader/stats', async (req: Request, res: Response) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    if (!tenant_id) { res.status(400).json({ error: 'tenant_id required' }); return; }
    const { data, error } = await supabase
      .from('bill_extractions')
      .select('confidence_score, processing_ms')
      .eq('tenant_id', tenant_id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const total = data?.length || 0;
    const accurate = data?.filter(r => (r.confidence_score ?? 0) >= 0.8).length || 0;
    const withTiming = data?.filter(r => r.processing_ms != null) || [];
    const avgMs = withTiming.length > 0
      ? withTiming.reduce((sum: number, r: any) => sum + r.processing_ms, 0) / withTiming.length
      : null;
    res.json({
      billsProcessed: total,
      accuracy: total > 0 ? Math.round((accurate / total) * 1000) / 10 : null,
      avgProcessingSeconds: avgMs != null ? Math.round(avgMs / 100) / 10 : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/bill-reader/recent', async (req: Request, res: Response) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id required' });
      return;
    }
    const { data, error } = await supabase
      .from('bill_extractions')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
