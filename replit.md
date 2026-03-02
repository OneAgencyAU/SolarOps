# SolarOps

Solar operations management platform.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Node.js + Express + TypeScript (port 8000)
- **Database**: Supabase (PostgreSQL) — see database rules below
- **Auth**: Firebase Authentication (Google Sign-In only)
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
│       │   └── PlaceholderPage.tsx
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
│           └── auth.ts        # Google OAuth endpoints (/api/auth/google/*)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # tables + RLS enabled
│       ├── 002_rls_policies.sql     # permissive SELECT policies for anon key
│       ├── 003_fix_user_id_type.sql # users.id and tenant_memberships.user_id changed to TEXT
│       ├── 004_add_name_fields.sql  # users.first_name and users.last_name columns added
│       └── 005_google_connections.sql # google_connections table + unique index + RLS
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
- `google_connections` — stores Google OAuth tokens (`id UUID`, `tenant_id UUID FK`, `user_id TEXT FK`, `google_email TEXT`, `access_token TEXT`, `refresh_token TEXT`, `scopes TEXT[]`, `connected_at`, `last_sync`). Unique index on `(tenant_id, user_id)`.
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
| `GOOGLE_CLIENT_ID` | Backend (OAuth) |
| `GOOGLE_CLIENT_SECRET` | Backend (OAuth) |
| `SESSION_SECRET` | Backend (express-session) |

## Pages Built

- `/login` — Google Sign-In only, clean Apple-style white card on `#f5f5f7`
- `/onboarding` — First name, Last name, Business name form; submits to `/api/onboarding`
- `/dashboard` — Bento grid layout with: Today's Summary hero card (white, grid-column 1/5, grid-row 1/2), Weekly Activity line chart (recharts, grid-column 5/13, grid-row 1/2), Emails Drafted, Emails Sent, Avg Response Time stat cards, Voice Agent Live Status card with pulsing dot, Top Enquiry Types donut chart (recharts), Open/Resolved Tickets split card, Recent Activity feed. Summary card shows section label, live date, 3 metric rows (calls/emails/time saved with dividers), and footer links to /helpdesk and /inbox-assistant. All static placeholder data. Time period selector (This Week / This Month / All Time) — UI only, not yet functional.
- `/voice-agent` — Full configuration UI with two-column layout. Left column: Agent Identity (name, greeting, tone), Business Hours (toggle + time range), Call Routing (New Enquiry + Existing Customer paths), Escalation Settings (phone number, safety keywords tags, escalation message). Right column: Live Script Preview (reactive to greeting input), 3 stat cards (Calls Handled, Avg Call Duration, Callback Requests), Recent Calls log with outcome pills, Phone Number Setup with progress steps, Quick Tips card. Status toggle (LIVE/OFFLINE) in header. Save Configuration button. All UI only — no Vapi/Telnyx integration yet.
- `/inbox-assistant` — Two-panel layout filling viewport height. Left panel (38%): inbox selector dropdown (support@/sales@/info@), filter pills (All/Urgent/New Lead/Support with counts), 4 clickable email cards with sender, subject, preview, time, tag pills. Right panel (62%): thread header with subject + sender meta + urgency/action badges, AI Summary box (blue tint), email body, divider, AI Draft textarea (editable, per-email state), Regenerate button, action row (Create Ticket, Link to Ticket, Approve & Send). Green success toast on approve. Stats bar above panels. All static placeholder data — no Gmail/API integration yet.
- `/helpdesk` — Kanban board layout with 4 columns: New, In Progress, Waiting on Customer, Closed. Quick stats bar (Open, Urgent, Overdue, Resolved Today). Search bar + Source and Priority filter pills. 13 ticket cards across columns with ID, title, customer, source icon, priority pill, assignee, SLA timer/overdue indicator. Slide-in ticket detail panel (480px, smooth animation, overlay) with AI Summary box, 4 tabs (Details, Transcript, Notes, Timeline), assignee dropdown. All static placeholder data — no backend connected yet.
- `/activity-log` — Full activity log table with 15 rows of realistic placeholder data. Stats bar (247 Actions Today, 12 Pending Review, 3 Errors, 99.2% Success Rate). Search + date range dropdown + Module/Type/Status filter pills. Table columns: Time, Module (coloured icon), Action, Details, User/Trigger, Status. Click any row opens slide-in drawer with timestamp, module, details, trigger pill, raw JSON log, Re-run Action + Mark as Reviewed buttons. Pagination footer. Added to sidebar nav between Helpdesk and Connections. All static placeholder data.
- `/connections` — Google Workspace OAuth fully integrated using passport-google-oauth20. Real OAuth flow: Connect button initiates Google consent, tokens stored in Supabase `google_connections` table. Connected state shows real email address and relative last-synced time from database. Disconnect endpoint removes row from database. Success/error toasts on redirect. Manage modal with inbox toggles and permissions. Available Connectors 2×2 grid: Microsoft 365, Simpro, Voice Platform, Xero — all Coming Soon. Deployed and working on https://solar-ops.replit.app
- `/settings` — Two-column scrollable settings page. Left column: Workspace card (business name input, logo upload placeholder, timezone dropdown, industry dropdown, Save Changes button) and Notifications card (5 toggle rows for urgent tickets, callbacks, SLA, daily summary, draft ready; notification email input with Save) and AI Behaviour card (8 rows: Human approval required — locked ON; Auto-tag enquiry type, AI summary on tickets, Suggest escalation, Signature on drafts, Smart follow-up detection — all toggles; Tone preference — pill selector: Professional / Friendly / Formal; Confidence threshold — range slider 60–95%, default 75%; blue info box at bottom). Right column: Team Members card (email + role invite row, 3 member rows with avatar circles, name, email, role pills, You badge, Remove on hover), Billing & Plan card (gradient blue→purple plan card, Active status pill, renewal date, 3 usage stat pills, pilot billing note), Time Saved Calculation card (admin hourly rate, mins per call, mins per email, working hours per day, working days per week, module checkboxes — Voice Agent / Inbox Assistant / Helpdesk, live preview calculation box). All static — no backend connected yet.

## Google OAuth Flow

1. User clicks "Connect" on Google Workspace card → `GET /api/auth/google?tenant_id=X&user_id=Y`
2. Server stores `firebaseUid` in session, passes `tenant_id` as OAuth `state` parameter
3. Redirects to Google consent screen (scopes: profile, email, gmail.readonly, gmail.compose)
4. Google redirects back to `GET /api/auth/google/callback`
5. Passport strategy extracts `state` (tenant_id) and `session.firebaseUid`, upserts into `google_connections`
6. On success: redirects to `/connections?connected=true` → frontend shows green toast
7. On failure: redirects to `/connections?error=auth_failed` → frontend shows red toast
8. Callback URL hardcoded to `https://solar-ops.replit.app/api/auth/google/callback`

## Integrations Complete
- **Google OAuth (Gmail)**: `passport-google-oauth20` + `express-session`. Scopes: profile, email, gmail.readonly, gmail.compose. Tokens upserted into Supabase `google_connections` table. Callback URL: `https://solar-ops.replit.app/api/auth/google/callback`. Working on production deployment.

## Integrations Pending
- Voice Agent: Vapi.ai or Telnyx (decision: use Vapi for prototype, migrate to Telnyx for production). Needs: API key, phone number provisioning, webhook endpoint for call transcripts.
- Inbox Assistant: Uses Google OAuth tokens stored in `google_connections` table (Gmail read + compose scopes already granted)

## UI Components & Design Tokens

- **recharts** installed for `LineChart` and `PieChart` (donut)
- **Bento grid**: CSS Grid 12-column, `gap: 16px`, named grid positions per card
- **Hero card**: `#4F8EF7` background, white text, radial white glow top-right
- **Stat cards**: white, `border-radius: 20px`, `box-shadow: 0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)`
- **Hover effect on stat cards**: `transform: translateY(-2px)`, shadow increase
- **Pulsing dot animation**: CSS `@keyframes pulse`, opacity `1→0.4→1`, 2s infinite
- **Activity feed rows**: hover background `#f5f5f7`, bottom border `1px solid #f5f5f7`
- **Time period pills**: active = `#1d1d1f` background + white text; inactive = transparent + `#6e6e73`
- **Design colours**: `#1d1d1f` (primary text), `#6e6e73` (secondary), `#4F8EF7` (accent blue), `#34C759` (green), `#FF453A` (red), `#f5f5f7` (page bg), `#ffffff` (card bg), `#e5e5e7` (borders)
- **Mobile**: all bento cards stack to `grid-column: 1 / -1` under 768px

## Development

```bash
npm run dev        # Start both frontend and backend
npm run dev:client # Vite only
npm run dev:server # Express only (tsx watch)
```
