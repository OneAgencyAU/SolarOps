# SolarOps Outbound Voice Agent — Product Requirements Document

**Version:** 1.0  
**Date:** 23 March 2026  
**Author:** Alex / ONE AGENCY  
**Status:** Ready for build  

---

## 1. Overview

### What This Is
An outbound AI voice agent that calls lists of customers on behalf of solar businesses, qualifies their interest (e.g., government battery rebate eligibility), and either transfers them live to a human or books a callback — logging everything to the SolarOps dashboard.

### Why It Matters
- Neither Sadie AI nor Sophiie AI offers outbound calling. This is SolarOps's primary competitive differentiator.
- The first use case (Sol Energy battery rebate reactivation) has immediate, tangible ROI — every qualified callback is potential revenue Sol Energy would otherwise miss.
- Outbound campaigns are the "wedge" product — they demonstrate value before the client even commits to the full platform.

### Who It's For
- **End user:** Solar business owner/manager (e.g., Nat & Simon at Sol Energy)
- **Caller (recipient):** Past customers of the solar business who haven't engaged recently

### Success Criteria
- A solar business can upload a contact list, configure a campaign, launch it, and see results — all self-serve
- The AI agent can hold a natural 1-2 minute conversation, qualify interest, and either transfer live or book a callback
- Every call is logged with transcript, outcome, and next action in the dashboard
- The demo to Sol Energy shows real calls being made and results appearing in real-time

---

## 2. Tech Stack (Existing)

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Backend | Express + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Firebase Auth (Google OAuth) |
| Voice | Retell AI (orchestration) + Telnyx (telephony, SIP) |
| AI | Retell LLM (Claude 4.5 Sonnet on Retell) |
| Deployment | Replit (Autoscale) |
| Source Control | GitHub → pull to Replit |

---

## 3. Feature Specification

### 3.1 Campaign Creation Flow

**Page:** `/voice-agent` → "Outbound Campaigns" tab (alongside existing "Inbound Agent" tab)

**Step 1: Upload Contacts**
- Upload a CSV file with columns: `phone_number` (required, E.164 format), `customer_name`, plus optional custom columns (e.g., `system_size`, `install_date`, `suburb`, `last_service_date`)
- Show a preview table of the first 5-10 rows after upload
- Validate phone numbers (must be AU mobile +614 or landline +612/3/7/8 format)
- Show count: "142 valid contacts, 3 invalid (skipped)"
- Invalid numbers shown with reason (wrong format, missing, duplicate)

**Step 2: Configure Campaign**
- **Campaign name** — free text (e.g., "Battery Rebate — March 2026")
- **Script/prompt selection** — choose from pre-built templates or create custom:
  - Template 1: "Battery Rebate Reactivation" (pre-written for the government rebate use case)
  - Template 2: "Maintenance Check-In" (annual service reminder)
  - Template 3: "New Product Announcement" (e.g., new battery offering)
  - Custom: free text prompt editor
- **Voice selection** — dropdown of available Retell voices (default: 11labs-Adrian, AU male)
- **Caller ID** — the tenant's Telnyx number (auto-populated from `voice_config`)
- **Call window** — start time, end time (e.g., 9:00 AM - 5:00 PM AEST), which days of week
- **On interested customer** — what happens when the AI qualifies someone as interested:
  - Option A: "Transfer live to team" — enters a transfer phone number
  - Option B: "Book a callback" — captures preferred callback time (today/tomorrow, morning/afternoon)
  - Option C: "Both — offer the choice" — AI asks "Would you like me to connect you now, or would you prefer a callback at a time that suits?"
- **Max concurrent calls** — slider (1-10, default 3)
- **Voicemail handling** — what to do if voicemail is reached:
  - Leave a short message (configurable)
  - Hang up (no message)

**Step 3: Review & Launch**
- Summary card showing: campaign name, contact count, script preview, call window, estimated duration, estimated cost
- "Launch Campaign" button (with confirmation modal)
- "Schedule for later" option with date/time picker
- "Save as Draft" to come back later

### 3.2 Campaign Dashboard (Active/Completed Campaigns)

**Campaign List View**
- Table/card list of all campaigns with: name, status (Draft / Scheduled / Active / Paused / Completed), contacts count, calls made, calls answered, interested leads, date created
- Status badges with colour coding
- Click to open campaign detail

**Campaign Detail View — the main dashboard**

Top stats bar (4 cards):
- **Calls Made** — X / Total (with progress ring)
- **Answered** — count + % of total
- **Interested / Qualified** — count + % of answered
- **Callbacks Booked** — count

**Call Results Table** (main content area):
| Column | Description |
|--------|------------|
| Contact Name | From CSV |
| Phone Number | Masked partially (0412 ***  678) |
| Status | `completed` / `no_answer` / `voicemail` / `busy` / `callback_booked` / `transferred` / `not_interested` / `do_not_call` |
| Outcome | AI-determined: `interested` / `not_interested` / `callback_requested` / `already_has_battery` / `wrong_number` / `do_not_call` |
| Duration | Call length |
| Callback Time | If booked (e.g., "Tomorrow, afternoon") |
| Actions | View transcript / Play recording / Mark follow-up |

**Call Detail Drawer** (slides in from right when clicking a row):
- Full transcript (speaker-labelled: AI / Customer)
- Audio player for call recording
- AI-generated call summary (1-2 sentences)
- Outcome classification
- Customer sentiment (positive / neutral / negative)
- Extracted data: name confirmed, interest level, callback preference, any questions asked
- Action buttons: "Mark as followed up", "Add note", "Remove from future campaigns"

### 3.3 Campaign Controls

- **Pause / Resume** — stop calling mid-campaign, resume later
- **Cancel** — stop and mark remaining contacts as "not called"
- **Export results** — download CSV of all call outcomes
- **Retry failed** — re-queue contacts that were `no_answer` or `busy`

### 3.4 Outbound Agent Prompt (Battery Rebate Template)

This is the default prompt for the battery rebate use case. It gets passed to Retell AI as the agent's system prompt, with dynamic variables from the CSV injected per call.

```
## Identity
You are calling on behalf of {{business_name}}. Your name is {{agent_name}}. You are friendly, natural, and Australian. You speak conversationally — not like a robot or telemarketer.

## Context
You are calling {{customer_name}} who is an existing customer of {{business_name}}. They previously had solar panels installed. You are reaching out about the government battery rebate that could save them significant money on a home battery system.

## Your Task
1. Greet them warmly and confirm you're speaking with {{customer_name}}
2. Briefly explain why you're calling — their solar company wanted to let them know about the government battery rebate
3. Ask if they've heard about the rebate or if they already have a battery
4. If interested: ask if they'd like to speak with someone from the team now, or if they'd prefer a callback at a time that suits
5. If they want to speak now: transfer the call to {{transfer_number}}
6. If they want a callback: ask what day (today/tomorrow/this week) and time (morning/afternoon) works best
7. Thank them and wrap up

## Rules
- Keep the call under 2 minutes unless the customer wants to chat
- Never promise specific savings amounts, prices, or rebate values
- If they ask technical questions about batteries, say "That's a great question — the team can give you all the details on that"
- If they say they're not interested, thank them and end the call politely
- If they say "take me off your list" or "don't call again", say "Absolutely, I'll make sure you're removed. Sorry to have bothered you" and end the call
- If you reach voicemail: "Hi {{customer_name}}, this is {{agent_name}} calling from {{business_name}}. We wanted to let you know about the government battery rebate that could save you money on a home battery. Give us a call back on {{agent_number}} when you get a chance. Thanks!"
- Always be respectful of their time
- Use Australian English (e.g., "no worries", "cheers")

## Current Time
It is currently {{current_time_Australia/Sydney}}.
```

### 3.5 Post-Call Analysis Fields (Retell Configuration)

| Field | Type | Values |
|-------|------|--------|
| spoke_with_target | Boolean | Did we reach the intended person? |
| customer_interest | Selector | `interested` / `not_interested` / `already_has_battery` / `wants_more_info` / `do_not_call` |
| outcome | Selector | `callback_booked` / `transferred_live` / `not_interested` / `voicemail_left` / `no_answer` / `wrong_number` / `do_not_call` |
| callback_preference | Text | Free text (e.g., "Tomorrow afternoon", "Wednesday morning") |
| questions_asked | Text | What the customer asked about |
| call_summary | Text | 1-2 sentence summary |
| sentiment | Selector | `positive` / `neutral` / `negative` |

---

## 4. Database Schema (New Tables)

### `outbound_campaigns` (already partially exists)
```sql
CREATE TABLE outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, active, paused, completed, cancelled
  script_template TEXT, -- template name or 'custom'
  script_prompt TEXT NOT NULL, -- full prompt text
  voice_id TEXT DEFAULT '11labs-Adrian',
  caller_id TEXT, -- telnyx number
  call_window_start TIME, -- e.g., 09:00
  call_window_end TIME, -- e.g., 17:00
  call_window_days TEXT[], -- e.g., ['mon','tue','wed','thu','fri']
  on_interest TEXT DEFAULT 'offer_choice', -- transfer_live, book_callback, offer_choice
  transfer_number TEXT, -- number to transfer to if live transfer
  max_concurrent INTEGER DEFAULT 3,
  voicemail_action TEXT DEFAULT 'leave_message', -- leave_message, hang_up
  total_contacts INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_interested INTEGER DEFAULT 0,
  callbacks_booked INTEGER DEFAULT 0,
  retell_batch_call_id TEXT, -- Retell's batch call ID
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `outbound_contacts`
```sql
CREATE TABLE outbound_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES outbound_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  custom_data JSONB, -- all extra CSV columns stored here
  status TEXT DEFAULT 'pending', -- pending, calling, completed, no_answer, voicemail, busy, failed, skipped, do_not_call
  outcome TEXT, -- interested, not_interested, callback_booked, transferred, already_has_battery, wrong_number, do_not_call
  callback_preference TEXT,
  sentiment TEXT,
  call_summary TEXT,
  questions_asked TEXT,
  transcript TEXT,
  recording_url TEXT,
  retell_call_id TEXT,
  call_duration INTEGER, -- seconds
  call_cost DECIMAL(10,4),
  called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `campaign_templates`
```sql
CREATE TABLE campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, -- NULL = system template, UUID = tenant custom
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  category TEXT, -- rebate, maintenance, announcement, custom
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Endpoints (New)

### Campaign CRUD
- `POST /api/campaigns/create` — Create new campaign (draft)
- `GET /api/campaigns/list?tenant_id=X` — List all campaigns
- `GET /api/campaigns/:id?tenant_id=X` — Get campaign detail with stats
- `PUT /api/campaigns/:id` — Update campaign (while in draft)
- `DELETE /api/campaigns/:id` — Delete draft campaign

### Campaign Actions
- `POST /api/campaigns/:id/launch` — Launch campaign (creates Retell batch call)
- `POST /api/campaigns/:id/pause` — Pause active campaign
- `POST /api/campaigns/:id/resume` — Resume paused campaign
- `POST /api/campaigns/:id/cancel` — Cancel campaign

### Contacts
- `POST /api/campaigns/:id/contacts/upload` — Upload CSV, parse, validate, store
- `GET /api/campaigns/:id/contacts` — List contacts with status/outcome
- `GET /api/campaigns/:id/contacts/:contact_id` — Get contact detail (transcript, recording, etc.)
- `POST /api/campaigns/:id/contacts/export` — Export results as CSV
- `POST /api/campaigns/:id/contacts/retry` — Re-queue no_answer/busy contacts

### Webhook
- `POST /api/campaigns/webhook` — Retell webhook for outbound call events (call_ended, call_analyzed)

### Templates
- `GET /api/campaigns/templates?tenant_id=X` — List available templates (system + tenant custom)
- `POST /api/campaigns/templates` — Create custom template

---

## 6. Retell AI Integration Details

### Creating the Outbound Agent
For each campaign launch, we create (or reuse) a Retell agent configured with:
- The campaign's script prompt (with dynamic variable placeholders)
- The selected voice ID
- Post-call analysis fields (as defined in 3.5)
- Guardrails enabled: `regulated_professional_advice` (for solar/electrical)
- Knowledge base: tenant's business KB (if configured)
- Warm transfer enabled with `transfer_number` from campaign config

### Launching Batch Calls
Use Retell's batch call API:
```javascript
const batchCall = await retellClient.batchCall.create({
  from_number: campaign.caller_id,
  agent_id: outboundAgentId,
  // Contact list with dynamic variables passed per-call
  tasks: contacts.map(c => ({
    to_number: c.phone_number,
    retell_llm_dynamic_variables: {
      customer_name: c.customer_name || 'there',
      business_name: tenantConfig.business_name,
      agent_name: tenantConfig.agent_name || 'the team',
      transfer_number: campaign.transfer_number || '',
      agent_number: campaign.caller_id,
      ...c.custom_data // spread any extra CSV columns
    }
  })),
  // Schedule and limits
  scheduled_time: campaign.scheduled_at || undefined,
});
```

### Webhook Processing
On `call_analyzed` event:
1. Match `retell_call_id` to `outbound_contacts` row
2. Update status, outcome, sentiment, call_summary, transcript, recording_url, call_duration, call_cost
3. Update campaign aggregate counters (calls_made++, calls_answered++, etc.)
4. If outcome = `callback_booked`, send email notification to tenant's notification_email
5. If outcome = `transferred_live`, log the transfer event
6. If outcome = `do_not_call`, flag contact for exclusion from future campaigns

---

## 7. UI Pages & Navigation

### Navigation Structure
```
Voice Agent (existing page)
├── Inbound Agent (existing tab)
└── Outbound Campaigns (new tab)
    ├── Campaign List (default view)
    ├── New Campaign (creation wizard)
    └── Campaign Detail (dashboard per campaign)
```

### Design Direction
- Consistent with existing SolarOps UI (clean, professional, dark sidebar + white content area)
- Campaign cards with status badges and key metrics
- Campaign detail is the "hero" page — this is what you demo to Sol Energy
- Real-time feel: stats should update as calls complete (poll every 10-15 seconds during active campaigns)
- Call detail drawer slides in from right (same pattern as existing voice agent call detail)

---

## 8. Build Order (for Claude Code)

### Phase 1: Database & API (backend)
1. Create Supabase tables (`outbound_campaigns`, `outbound_contacts`, `campaign_templates`)
2. Seed system templates (battery rebate, maintenance, announcement)
3. Build campaign CRUD endpoints
4. Build CSV upload + validation endpoint
5. Build campaign launch endpoint (Retell batch call integration)
6. Build webhook handler for outbound call events
7. Build contacts list/detail/export endpoints

### Phase 2: Frontend — Campaign List & Creation
8. Add "Outbound Campaigns" tab to Voice Agent page
9. Build campaign list view (cards/table with status, stats)
10. Build campaign creation wizard (3 steps: upload → configure → review)
11. CSV upload component with preview table and validation
12. Script template selector with prompt editor
13. Campaign settings form (voice, window, interest handling, etc.)
14. Review summary and launch confirmation

### Phase 3: Frontend — Campaign Dashboard
15. Campaign detail page with top stats bar
16. Call results table with status/outcome columns
17. Call detail drawer (transcript, recording player, summary, sentiment)
18. Campaign controls (pause, resume, cancel, retry, export)
19. Real-time polling for active campaigns

### Phase 4: Polish & Demo Prep
20. Pre-load battery rebate template with polished prompt
21. Test end-to-end: upload CSV → launch → calls made → results in dashboard
22. Export functionality
23. Email notifications for qualified leads

---

## 9. Demo Script for Sol Energy

"Here's what we built for you. I've uploaded a list of 20 past customers who installed solar with you but don't have a battery yet. Watch this..."

1. Show the campaign creation — CSV uploaded, battery rebate template selected, call window set
2. Launch the campaign
3. Watch calls go out in real-time — status updates appearing in the dashboard
4. Click into a completed call — show the transcript, the AI's summary, the customer's interest level
5. Show a "callback booked" result — "This customer wants a call back tomorrow afternoon"
6. Show the export button — "You can download all qualified leads as a CSV any time"

**The pitch:** "Every name on this list is a customer who already trusts you. The AI just had a 90-second conversation with each of them about the battery rebate. Three of them want a callback this week. How many would your team have gotten to manually?"

---

## 10. Estimated Costs Per Campaign

For a 200-contact campaign (typical sol energy customer list):
- ~60% answer rate = 120 calls connected
- ~2 min average call = 240 minutes
- At ~$0.12/min all-in (Retell + Telnyx) = ~$28.80 total campaign cost
- At $299/month SolarOps subscription, that's one campaign paying for itself if it generates even 1-2 battery sales leads

This is the ROI story for the demo.
