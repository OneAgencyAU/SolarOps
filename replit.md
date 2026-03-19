# SolarOps

Solar operations management platform for Australian solar businesses.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Node.js + Express + TypeScript (port 8000)
- **Database**: Supabase (PostgreSQL) — see database rules below
- **Auth**: Firebase Authentication (Google Sign-In only)
- **AI**: Anthropic Claude (Haiku for validation, Sonnet for extraction/drafting)
- **OCR**: Google Cloud Vision API
- **Email**: Gmail API (via Google OAuth 2.0) + Microsoft Graph API (via MSAL)
- **Routing**: React Router v6
- **Runner**: `concurrently` starts both dev servers from `npm run dev`

## Project Structure

```
/
├── client/                    # React + Vite frontend
│   ├── index.html
│   └── src/
│       ├── main.tsx           # Entry point
│       ├── App.tsx            # Router + AuthProvider
│       ├── contexts/
│       │   └── AuthContext.tsx  # user, tenant, firstName, lastName, loading, signOut
│       ├── components/
│       │   ├── Layout.tsx     # Sidebar + topbar shell
│       │   └── ProtectedRoute.tsx
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── OnboardingPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── BillReaderPage.tsx
│       │   ├── UsagePage.tsx
│       │   ├── InboxAssistantPage.tsx
│       │   ├── VoiceAgentPage.tsx
│       │   ├── HelpdeskPage.tsx
│       │   ├── ActivityLogPage.tsx
│       │   ├── ConnectionsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── PrivacyPolicyPage.tsx  # /privacy — no auth required
│       │   └── TermsOfServicePage.tsx # /terms — no auth required
│       ├── lib/
│       │   ├── firebase.ts    # app, auth, googleProvider
│       │   └── supabase.ts    # supabase client (publishable key)
│       └── styles/            # Per-component CSS files
├── server/
│   └── src/
│       ├── index.ts           # Express API (Supabase secret key, session, passport)
│       ├── config/
│       │   └── passport.ts    # Google OAuth strategy (passport-google-oauth20)
│       └── routes/
│           ├── auth.ts        # Google OAuth endpoints (/api/auth/google/*)
│           ├── billReader.ts  # Bill OCR + extraction endpoints
│           ├── usage.ts       # API usage log endpoints
│           ├── inbox.ts       # Gmail OAuth + email sync + draft + send endpoints
│           ├── microsoft.ts   # Microsoft 365 OAuth + Graph API email endpoints
│           ├── voice.ts       # Retell AI + Telnyx voice agent endpoints
│           └── campaigns.ts   # Outbound campaign management endpoints
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       ├── 003_fix_user_id_type.sql
│       ├── 004_add_name_fields.sql
│       ├── 005_google_connections.sql
│       ├── 006_bill_extractions.sql
│       ├── 007_api_usage_log.sql
│       ├── 008_bill_extractions_processing_ms.sql
│       ├── 009_voice_tables.sql
│       ├── 010_voice_retell_telnyx.sql
│       └── 011_inbox_emails_message_id.sql
├── vite.config.ts             # Port 5000, /api proxy → 8000
├── tsconfig.json              # Client TypeScript config
├── tsconfig.server.json       # Server TypeScript config
└── package.json
```

## Auth Flow

1. User visits any route → redirected to `/login` if unauthenticated
2. User clicks "Continue with Google" → Firebase Google Sign-In popup
3. After sign-in:
   - New user → insert into Supabase `users` → redirect to `/onboarding`
   - Existing user with tenant → redirect to `/dashboard`
   - Existing user without tenant → redirect to `/onboarding`
4. Onboarding: enter business name → server checks for existing `tenant_memberships` row first to prevent duplicate key errors → if none found, creates `tenants` + `tenant_memberships` (role: admin) → redirects to `/dashboard`
5. If user already has a tenant membership, `/api/onboarding` returns `{ already_exists: true }` and the frontend redirects straight to `/dashboard` without inserting anything
6. All `/dashboard`, `/voice-agent`, etc. routes require both auth + tenant membership
7. `/privacy` and `/terms` are accessible without login

## Database Pattern

**NEVER use Replit's built-in database. Always use Supabase.**

### Write vs Read split

All Supabase **writes** (INSERT, UPDATE, DELETE) go through the Express backend using `SUPABASE_SECRET_KEY`, which is the service role key and bypasses RLS entirely. Never perform writes from the frontend.

Frontend **reads** (SELECT) use the anon/publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`). RLS is enabled on all tables with permissive `SELECT` policies (`USING (true)`) so the anon key can read freely.

### Why this split?

Supabase RLS policies use `auth.uid()` which only works with Supabase Auth sessions. This app uses Firebase Auth, so `auth.uid()` is always `null` for frontend requests. User-scoped RLS policies are therefore not usable from the frontend — writes must go through the backend service role instead.

### Firebase UID type

Firebase user IDs (e.g. `xt5XTE5MXGTpTYizQpR9ILmqEwD3`) are plain strings, not UUIDs. For this reason:
- `users.id` is `TEXT` (not `UUID`)
- `tenant_memberships.user_id` is `TEXT` (not `UUID`)
- Do not use `UUID` type for any column that stores a Firebase UID

### Schema (Supabase)

- `tenants` — organisations (`id UUID`, `name TEXT`, `slug TEXT UNIQUE`, `created_at`)
- `users` — mirrors Firebase Auth users (`id TEXT` = Firebase UID, `email`, `display_name`, `avatar_url`, `first_name TEXT`, `last_name TEXT`)
- `tenant_memberships` — links users to tenants (`tenant_id UUID`, `user_id TEXT`, `role TEXT`)
- `google_connections` — stores Google OAuth tokens for Connections page (`id UUID`, `tenant_id UUID FK`, `user_id TEXT FK`, `google_email TEXT`, `access_token TEXT`, `refresh_token TEXT`, `scopes TEXT[]`, `connected_at`, `last_sync`). Unique index on `(tenant_id, user_id)`.
- `bill_extractions` — OCR bill results (`id UUID`, `tenant_id UUID`, `customer_name`, `nmi`, `retailer`, `address`, `billing_period_start`, `billing_period_end`, `total_amount`, `daily_avg_kwh`, `supply_charge`, `usage_rate`, `fit_rate`, `solar_detected BOOL`, `battery_detected BOOL`, `meter_type`, `raw_ocr_text`, `confidence_score`, `status`, `processing_ms`, `created_at`)
- `api_usage_log` — tracks all AI/OCR API calls per tenant (`id UUID`, `tenant_id UUID`, `module TEXT`, `service TEXT`, `model TEXT`, `input_tokens INT`, `output_tokens INT`, `cost_usd NUMERIC`, `status TEXT`, `created_at`). Filtered with `.or(tenant_id.eq.${id},tenant_id.is.null)` to support legacy NULL rows.
- `tenant_connections` — Microsoft 365 OAuth tokens per tenant (`tenant_id TEXT PK`, `ms_access_token TEXT`, `ms_refresh_token TEXT`, `ms_email TEXT`, `ms_connected_at TIMESTAMPTZ`, `ms_last_sync TIMESTAMPTZ`). Used for Microsoft Graph API email access.
- `inbox_connections` — Gmail OAuth tokens per tenant (`tenant_id UUID`, `provider TEXT`, `email TEXT`, `access_token TEXT`, `refresh_token TEXT`, `token_expiry TIMESTAMPTZ`, `updated_at`). Unique on `(tenant_id, provider)`.
- `inbox_emails` — synced Gmail messages (`id UUID`, `tenant_id UUID`, `connection_id UUID`, `provider TEXT`, `external_id TEXT`, `from_name TEXT`, `from_email TEXT`, `subject TEXT`, `body_text TEXT`, `body_preview TEXT`, `received_at TIMESTAMPTZ`, `is_read BOOL`, `message_id TEXT`). Unique on `(tenant_id, external_id)`.
- `inbox_drafts` — AI-generated reply drafts (`id UUID`, `tenant_id UUID`, `email_id UUID`, `draft_text TEXT`, `ai_summary TEXT`, `status TEXT` [pending/sent], `created_at`, `updated_at`)
- `voice_config` — AI receptionist config per tenant (`tenant_id UUID`, `assistant_id TEXT`, `retell_agent_id TEXT`, `business_name TEXT`, `notification_email TEXT`, `phone_number TEXT`, `telnyx_number TEXT`, `telnyx_number_id TEXT`, `is_live BOOL`, `onboarding_step INT DEFAULT 1`, `created_at`, `updated_at`). Unique on `tenant_id`.
- `outbound_campaigns` — outbound call campaigns (`id UUID`, `tenant_id TEXT`, `name TEXT`, `campaign_type TEXT`, `script TEXT`, `lead_count INT`, `retell_batch_id TEXT`, `status TEXT`, `created_at TIMESTAMPTZ`)
- `voice_calls` — inbound call records (`id UUID`, `tenant_id UUID`, `vapi_call_id TEXT UNIQUE`, `caller_number TEXT`, `caller_name TEXT`, `caller_email TEXT`, `caller_suburb TEXT`, `reason TEXT`, `call_type TEXT`, `callback_window TEXT`, `transcript TEXT`, `summary TEXT`, `status TEXT`, `duration_seconds INT`, `created_at`)
- Row Level Security is enabled on all tables; SELECT is open via policy, writes use service role

## Environment Secrets

All required secrets are stored in Replit's Secrets pane:

| Secret | Used by |
|--------|---------|
| `VITE_FIREBASE_API_KEY` | Frontend |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend |
| `VITE_FIREBASE_PROJECT_ID` | Frontend |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend |
| `VITE_FIREBASE_APP_ID` | Frontend |
| `VITE_SUPABASE_URL` | Frontend + Backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend |
| `SUPABASE_SECRET_KEY` | Backend |
| `GOOGLE_CLIENT_ID` | Backend (OAuth — Connections page + Gmail inbox) |
| `GOOGLE_CLIENT_SECRET` | Backend (OAuth — Connections page + Gmail inbox) |
| `MS_CLIENT_ID` | Backend (Microsoft 365 OAuth — Outlook inbox) |
| `MS_CLIENT_SECRET` | Backend (Microsoft 365 OAuth — Outlook inbox) |
| `MS_TENANT_ID` | Backend (Microsoft 365 OAuth — defaults to 'common') |
| `APP_URL` | Backend (Microsoft OAuth redirect URI base — defaults to solarops.com.au) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Backend (Cloud Vision OCR) |
| `ANTHROPIC_API_KEY` | Backend (Claude Haiku + Sonnet) |
| `SESSION_SECRET` | Backend (express-session) |
| `RETELL_API_KEY` | Backend (Retell AI voice agent) |
| `TELNYX_API_KEY` | Backend (Telnyx telephony — number purchase) |
| `PRODUCTION_URL` | Backend |

## Pages & Features

### Live / Production

- `/login` — Split screen. Left: dark with floating orbs, stats, testimonial. Right: white, Google Sign-In, legal links to /terms and /privacy.
- `/onboarding` — Workspace setup form (first name, last name, business name, industry, team size). Prevents duplicate tenant creation.
- `/dashboard` — Bento grid with recharts charts. Static placeholder data.
- `/bill-reader` — **COMPLETE & LIVE**. Full OCR pipeline: Google Cloud Vision → Claude Haiku (validation) → Claude Sonnet (extraction). Supports JPG/PNG/PDF/HEIC/WebP (max 10MB). Extracts NMI, retailer, customer, address, billing period, usage, tariffs, solar/battery detection. Saves to `bill_extractions`. Real stats per tenant (bills processed, accuracy, avg processing time). Sanitisation validates 6 field ranges; nulls out + caps confidence on ≥2 failures.
- `/usage` — **COMPLETE & LIVE**. Real data from `api_usage_log`. Per-tenant filtering with `.or()` for legacy NULL rows. Module filter pill bar, cost by module breakdown, daily spend recharts line chart, monthly budget tracker. Extraction cost log table. Limit 100 rows.
- `/inbox-assistant` — **COMPLETE & LIVE**. Gmail OAuth flow at `/api/auth/gmail`. Syncs 20 emails, upserts to `inbox_emails`. AI draft generation (Claude Sonnet) + summary via `/api/inbox/draft`. Approve & send via Gmail API (`/api/inbox/send`). Mark as read in Gmail (`/api/inbox/mark-read`). Unread indicator (blue dot, bold text). Completed tab for sent emails (hidden from All filter). Disconnect clears Supabase emails + drafts. Auto-polls every 3 minutes. Draft textarea is read-only after sending.
- `/connections` — Google Workspace OAuth (passport-google-oauth20). Tokens stored in `google_connections`. Connect/disconnect working.
- `/voice-agent` — **COMPLETE & LIVE**. Self-serve onboarding: Step 1 (Telnyx AU number search + purchase), Step 2 (configure Retell AI agent — name, greeting, tone, email), Step 3 (call forwarding instructions per carrier). Full dashboard after onboarding: live/offline toggle, call stats, recent calls with transcript detail panel. Webhook logs calls to `voice_calls`. Uses Retell AI (11labs-Matilda voice, en-AU) + Telnyx for telephony.
- `/helpdesk` — UI only. Kanban board, ticket detail panel. No backend connected.
- `/activity-log` — UI only. Log table with drawer. No backend connected.
- `/settings` — UI only. Workspace, notifications, AI behaviour, team, billing, time-saved cards. No backend connected.
- `/privacy` — Privacy Policy page. No auth required.
- `/terms` — Terms of Service page. No auth required.

## API Routes

### Bill Reader (`/api/bill-reader`)
- `POST /check` — Google Vision sample OCR → Claude Haiku validation. Returns `{ isBill, confidence, reason }`.
- `POST /extract` — Google Vision full OCR → Claude Sonnet structured extraction. Returns full bill fields + confidence score.
- `POST /save` — Saves extraction result to `bill_extractions` table.

### Usage (`/api/usage`)
- `GET /summary` — Aggregated cost totals by service for a given month + tenant.
- `GET /log` — Paginated extraction log (up to 100 rows) for a given month + tenant.
- `GET /daily` — Daily spend aggregation for recharts chart.
- `GET /by_module` — Cost breakdown by module (bill_reader, inbox_assistant, etc.).

### Inbox (`/api/inbox` + `/api/auth/gmail`)
- `GET /api/auth/gmail` — Initiates Gmail OAuth flow.
- `GET /api/auth/gmail/callback` — OAuth callback, stores tokens in `inbox_connections`.
- `GET /api/inbox/connections` — Lists active connections for a tenant.
- `DELETE /api/inbox/connections/:provider` — Disconnects a provider.
- `POST /api/inbox/sync` — Fetches 20 emails from Gmail, upserts to `inbox_emails`.
- `GET /api/inbox/emails` — Returns stored emails for a tenant.
- `DELETE /api/inbox/emails` — Deletes all emails + drafts for a tenant (used on disconnect).
- `POST /api/inbox/draft` — Generates AI summary + draft reply via Claude Sonnet, saves to `inbox_drafts`. Returns existing draft if already generated.
- `DELETE /api/inbox/drafts/:id` — Deletes a specific draft.
- `POST /api/inbox/send` — Sends reply via Gmail API, marks draft as sent + email as read.
- `POST /api/inbox/mark-read` — Marks email as read in Supabase + removes UNREAD label in Gmail.

### Microsoft 365 (`/api/auth/microsoft` + `/api/microsoft`)
- `GET /api/auth/microsoft` — Initiates Microsoft OAuth flow via MSAL.
- `GET /api/auth/microsoft/callback` — OAuth callback, stores tokens in `tenant_connections`.
- `GET /api/auth/microsoft/status` — Returns connection status (connected, email, lastSync).
- `DELETE /api/auth/microsoft/disconnect` — Clears Microsoft tokens from `tenant_connections`.
- `GET /api/microsoft/emails` — Fetches emails from Graph API, also syncs to `inbox_emails`.
- `GET /api/microsoft/email/:id` — Gets a single email from Graph API.
- `POST /api/microsoft/draft` — Creates a draft in Outlook (supports reply via `replyToMessageId`).
- `POST /api/microsoft/send` — Sends a draft via Graph API.

### Voice Agent (`/api/voice`)
- `GET /api/voice/numbers/search?state=SA` — Search available AU phone numbers on Telnyx by state.
- `POST /api/voice/numbers/purchase` — Purchase a Telnyx number and save to `voice_config`.
- `POST /api/voice/setup` — Create/update Retell AI agent + LLM with system prompt. Imports Telnyx number to Retell.
- `POST /api/voice/webhook` — Retell webhook for `call_ended` events. Extracts caller details, logs to `voice_calls` and `api_usage_log`.
- `GET /api/voice/calls?tenant_id=X` — List recent calls for a tenant.
- `GET /api/voice/config?tenant_id=X` — Get voice config for a tenant.
- `POST /api/voice/toggle` — Toggle agent live/offline.

### Campaigns (`/api/campaigns`)
- `POST /api/campaigns/create` — Create outbound batch call campaign via Retell. Looks up tenant's `retell_agent_id` + `telnyx_number` from `voice_config`, posts to Retell `/v2/create-batch-call`, saves to `outbound_campaigns`.
- `GET /api/campaigns/list?tenant_id=X` — List all campaigns for tenant, ordered by created_at desc.
- `GET /api/campaigns/:id?tenant_id=X` — Get single campaign by id.

## AI Models

- `claude-haiku-4-5-20251001` — Bill pre-check (fast/cheap validation)
- `claude-sonnet-4-5` — Bill extraction + inbox draft generation
- Google Cloud Vision — Full OCR for bill images/PDFs

## Sanity Check Ranges (Bill Extraction)

Nulls out fields + caps confidence if ≥2 failures:
- Supply charge: $0.30–$5/day
- Usage rate: 5–60 c/kWh
- Feed-in tariff: 1–20 c/kWh
- Total amount: $10–$5,000
- Daily avg: 0.5–150 kWh/day

## Google OAuth Flows

### Connections Page (google_connections)
1. `GET /api/auth/google?tenant_id=X&user_id=Y` → Google consent
2. Callback upserts tokens into `google_connections`
3. Redirect to `/connections?connected=true`
4. Callback URL: `https://solarops.com.au/api/auth/google/callback`

### Gmail Inbox (inbox_connections)
1. `GET /api/auth/gmail?tenant_id=X` → Google consent (gmail.readonly + gmail.send)
2. Callback upserts tokens into `inbox_connections`
3. Redirect to `https://solarops.com.au/inbox?connected=gmail`

## Design Tokens

- **Colours**: `#1d1d1f` (primary), `#6e6e73` (secondary), `#4F8EF7` (blue), `#34C759` (green), `#FF453A` (red), `#f5f5f7` (page bg), `#ffffff` (card bg), `#e5e5e7` (borders)
- **Font**: Inter (UI), DM Sans (login/onboarding)
- **Cards**: `border-radius: 20px`, `box-shadow: 0 2px 12px rgba(0,0,0,0.06)`
- **Charts**: recharts `LineChart`, `PieChart` (donut)

## Development

```bash
npm run dev        # Start both frontend and backend
npm run dev:client # Vite only
npm run dev:server # Express only (tsx watch)
```

## Deployment

- **Production URL**: https://solarops.com.au
- **Backup URL**: https://solar-ops.replit.app
- **Platform**: Replit Autoscale (1 vCPU, 0.5 GB RAM, 1 max machine)
- **Build command**: `npm install && npx vite build && npx tsc -p tsconfig.server.json`
- **Run command**: `node dist/server/src/index.js`
- **Static files**: React builds to `dist/client/`, served by Express in production
- **Dev**: Express PORT=8000, Vite on 5000. Production: Express PORT=5000 serving static `dist/client`

## Version Control
- GitHub connected
- Commit after every major feature or fix
- Never commit .env or secrets
- Branch strategy: main only for now

## What's Next (Pending)

- **Push to Simpro** — Wire up disabled "Push to Simpro" button on Bill Reader to Simpro API
- **Voice Agent** — Run 010_voice_retell_telnyx.sql migration in Supabase to add Retell/Telnyx columns
- **Helpdesk** — Backend ticket management (create, update, assign)
- **Activity Log** — Real data from audit trail
- **Settings** — Save workspace/notification/AI settings to Supabase
- **Inbox: Outlook** — ✅ DONE. Microsoft 365 OAuth + Graph API integration. Requires `tenant_connections` table in Supabase:
  ```sql
  CREATE TABLE IF NOT EXISTS tenant_connections (
    tenant_id TEXT PRIMARY KEY,
    ms_access_token TEXT,
    ms_refresh_token TEXT,
    ms_email TEXT,
    ms_connected_at TIMESTAMPTZ,
    ms_last_sync TIMESTAMPTZ
  );
  ```
  Also requires `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID`, and `APP_URL` env vars.
