# SolarOps — Project Context for Claude Code

## CRITICAL RULES — READ FIRST

1. **Only change what is explicitly asked.** Do not refactor, rename, reorganise, or "improve" existing files unless specifically instructed.
2. **Do not touch working features.** The modules listed under "Working Features" below are complete and in production. Modifying them risks breaking the live app.
3. **If you need to modify a shared file** (App.tsx, routes/index.ts, server/index.ts, sidebar components), make the MINIMUM change possible and list exactly what you changed.
4. **Ask before acting** if a task could be interpreted multiple ways. A clarifying question is always better than building the wrong thing.
5. **Build features one at a time.** Complete one, confirm it works, then move to the next.
6. **New features should ADD files** where possible rather than modifying existing ones.

---

## Project Overview

SolarOps is a multi-tenant AI operations platform for Australian solar businesses. Built by Alex (Trips) at ONE AGENCY. Live at solarops.com.au. First pilot client: Sol Energy (contacts: Nat Elliott, Simon).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript (Vite) |
| Backend | Express + TypeScript (tsx watch for dev, compiled JS for prod) |
| Database | Supabase (PostgreSQL) |
| Auth | Firebase Auth (Google OAuth via passport-google-oauth20) |
| Voice | Retell AI (orchestration) + Telnyx (telephony/SIP) |
| AI | Anthropic Claude API (Haiku for classification, Sonnet for extraction), Google Cloud Vision API (OCR) |
| Workflow | n8n |
| Hosting | Replit Autoscale (1 vCPU, 512MB RAM) |
| Domain | solarops.com.au (GoDaddy DNS) |
| Source Control | GitHub |

---

## Working Features — DO NOT TOUCH

These are complete and deployed. Do not modify unless explicitly asked:

- **Login page** — Split-screen with aurora canvas, Google OAuth, floating UI cards
- **Onboarding** — Multi-tenant workspace creation, feature preview cards
- **Bill & NMI Reader** — Google Vision OCR → Claude Haiku pre-check → Claude Sonnet extraction. Supports JPG/PNG/PDF/WebP/HEIC. Saves to `bill_extractions`. Contact field extraction, copy icons, View Original, delete.
- **Inbox Assistant** — Gmail OAuth (passport-google-oauth20), email sync, AI draft generation (Claude Sonnet), approve & send, mark as read, reply threading (In-Reply-To/References headers), auto-poll every 3 min.
- **Microsoft 365 connector** — @azure/msal-node OAuth, built but not fully tested
- **Voice Agent setup wizard** — 3-step: Telnyx AU number search/purchase → Retell agent creation (Jake + Brooke agents) → call forwarding instructions. Dashboard with live/offline toggle, call stats, recent calls.
- **Usage page** — Real data from api_usage_log. Per-tenant, module filter, daily spend chart, budget tracker.
- **Activity Log** — UI complete (table, stats bar, filter pills, detail drawer). No backend.
- **Settings page** — UI complete (workspace, notifications, AI behaviour, team, billing, time-saved). No backend.
- **Privacy Policy / Terms of Service** — Static pages at /privacy and /terms

### Files NOT to touch (unless explicitly asked):
```
client/src/pages/LoginPage.tsx
client/src/pages/OnboardingPage.tsx
client/src/pages/BillReaderPage.tsx
client/src/pages/InboxAssistantPage.tsx
client/src/pages/UsagePage.tsx
client/src/pages/HelpDeskPage.tsx
client/src/pages/SettingsPage.tsx
server/src/routes/bill-reader.ts
server/src/routes/inbox.ts
server/src/routes/usage.ts
server/src/routes/auth.ts
server/src/routes/microsoft.ts
```

---

## Current Focus: Outbound Voice Agent

The outbound campaign feature is the PRIORITY build. See `docs/outbound-agent-prd.md` for full spec.

### What already exists for outbound:
- `server/src/routes/voice.ts` — has existing campaign endpoints (POST /api/campaigns/create, GET /api/campaigns/list, GET /api/campaigns/:id)
- `server/src/routes/campaigns.ts` — may exist as separate file
- `outbound_campaigns` table in Supabase — partially built
- `VoiceAgentPage.tsx` — has some outbound campaign UI
- Known bug: campaign launch returns HTML instead of JSON (Retell API call failing)

### Approach:
1. **Read what exists first** — understand current outbound code before writing anything new
2. **Gap analysis** — compare existing code against the PRD
3. **Extend, don't rebuild** — build on top of what's there
4. **Phase by phase** from the PRD build order

---

## Key Configuration

### Active Test Account
- Tenant ID: `7e213070-59bf-4640-8961-0c21355bb804`
- Previous (deleted): `xt5XTE5MXGTpTYizQpR9ILmqEwD3`

### Telnyx
- AU number: +61240727423
- SIP connection exists but inbound speech response is broken (parked issue)
- CPS default 1, max 16

### Retell AI
- Voice IDs: use `11labs-Adrian` (AU male), NOT `11labs-Matilda`
- TypeScript SDK may require `as any` casts
- Webhook event to listen for: `call_analyzed` (includes transcript, summary, sentiment, custom analysis)
- Knowledge base: first 10 free, $8/mo each after
- Post-call analysis: configure custom fields per agent
- Guardrails: enable `regulated_professional_advice` for solar/electrical

### Environment Variables (in Replit Secrets)
```
RETELL_API_KEY
TELNYX_API_KEY
SUPABASE_URL
SUPABASE_KEY
FIREBASE_* (multiple)
ANTHROPIC_API_KEY
GOOGLE_CLOUD_VISION_KEY
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID
```

---

## Known Issues / Gotchas

1. **Google Auth blocks sign-in from Replit console** — debug via browser console, network tab, or Supabase SQL queries only
2. **Replit Autoscale requires explicit republish** — `npm run build` alone doesn't update production. Must also republish from Publishing tab.
3. **Dev server runs TypeScript source** (tsx watch), **production runs compiled JS** (dist/) — they can differ. Always check both.
4. **Supabase .maybeSingle()** returns null silently if SELECT has a column that doesn't exist in the table — check for error field in response
5. **Service worker caching** can intercept API requests — unregister and disable cache when debugging
6. **localhost:8000 in fetch calls** — old pattern that breaks in production. Always use relative URLs (`/api/...`). Several files were swept but new pages added after the sweep may still have it.
7. **Telnyx API** — `filter[phone_number]` can fail silently. List all and filter client-side. `webhook_event_url` not `webhook_url`. Unassign number before deleting connection (422).

---

## Coding Conventions

- **Frontend**: React functional components, TypeScript, CSS files per page (not modules), relative API URLs
- **Backend**: Express Router, TypeScript, Supabase client for DB, try/catch with `console.error('[Tag]', error)` pattern
- **API pattern**: `/api/{module}/{action}` (e.g., `/api/campaigns/create`, `/api/voice/config`)
- **Supabase**: use `.from('table').select(...)` pattern, always check for error alongside data
- **Auth**: Firebase token in Authorization header, tenant_id from token or query param
- **No console.log in production** — use console.error for errors, remove debug logs before committing

---

## Replit-Specific (if deploying from Replit)

- Run command: `npm run build && npm start` (or `tsx watch server/src/index.ts` for dev)
- After code changes: Shell → `npm run build` → Publishing tab → Republish
- Preview in real browser tab, not Replit Preview pane
- All prompts to Replit Agent follow format: `Mode: Agent Power: [Lite⚡/Economy/Power] · App Testing: OFF · Code Optimisations: OFF`

---

## File Structure (key paths)

```
client/
  src/
    pages/           — one file per page
    components/      — shared components (Sidebar, etc.)
    App.tsx          — routing
    main.tsx         — entry point
server/
  src/
    routes/          — Express routers (voice.ts, inbox.ts, bill-reader.ts, etc.)
    index.ts         — server entry, route registration, middleware
docs/
  outbound-agent-prd.md  — full PRD for outbound campaign feature
```
