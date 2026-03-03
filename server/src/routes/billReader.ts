import { Router, Request, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

router.post('/api/bill-reader/check', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filename = req.file.originalname;
    const visionClient = getVisionClient();

    let sampleText = '';

    if (req.file.mimetype === 'application/pdf') {
      const request = {
        requests: [
          {
            inputConfig: {
              content: req.file.buffer.toString('base64'),
              mimeType: 'application/pdf',
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const, maxResults: 1 }],
            pages: [1],
          },
        ],
      };
      const [result] = await visionClient.batchAnnotateFiles(request);
      const page = result.responses?.[0]?.responses?.[0];
      sampleText = (page?.fullTextAnnotation?.text || '').slice(0, 500);
    } else {
      const [result] = await visionClient.textDetection({
        image: { content: req.file.buffer.toString('base64') },
      });
      sampleText = (result.fullTextAnnotation?.text || '').slice(0, 500);
    }

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `You are a document classifier. Based on this filename and text sample, determine if this is an Australian electricity bill. Respond with JSON only:\n{\n  "isBill": true/false,\n  "confidence": 0.0-1.0,\n  "reason": "brief explanation"\n}\nFilename: ${filename}\nText sample: ${sampleText}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock?.text || '{}';
    const classification = JSON.parse(raw);

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
      const [result] = await visionClient.textDetection({
        image: { content: req.file.buffer.toString('base64') },
      });
      fullText = result.fullTextAnnotation?.text || '';
    }

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are an Australian electricity bill parser.\nExtract the following fields from this bill text.\nIf a field is not found, return null.\nRespond with JSON only, no other text:\n{\n  "nmi": "string | null",\n  "retailer": "string | null",\n  "customerName": "string | null",\n  "propertyAddress": "string | null",\n  "billingPeriod": {\n    "from": "string | null",\n    "to": "string | null",\n    "days": "number | null"\n  },\n  "usage": {\n    "dailyAvgKwh": "number | null",\n    "totalKwh": "number | null",\n    "peakKwh": "number | null",\n    "offPeakKwh": "number | null",\n    "shoulderKwh": "number | null"\n  },\n  "rates": {\n    "supplyCharge": "number | null",\n    "usageRate": "number | null",\n    "peakRate": "number | null",\n    "offPeakRate": "number | null",\n    "feedInTariff": "number | null"\n  },\n  "totals": {\n    "totalAmount": "number | null",\n    "gstAmount": "number | null"\n  },\n  "existingSolar": "boolean | null",\n  "existingBattery": "boolean | null",\n  "meterType": "string | null",\n  "meterCondition": "string | null",\n  "confidenceScore": "number"\n}\nBill text: ${fullText}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock?.text || '{}';
    const extracted = JSON.parse(raw);

    res.json({ extracted, rawOcrText: fullText });
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

export default router;
