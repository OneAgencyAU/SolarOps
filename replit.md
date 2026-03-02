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
│       └── index.ts           # Express API (Supabase secret key)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # tables + RLS enabled
│       ├── 002_rls_policies.sql     # permissive SELECT policies for anon key
│       ├── 003_fix_user_id_type.sql # users.id and tenant_memberships.user_id changed to TEXT
│       └── 004_add_name_fields.sql  # users.first_name and users.last_name columns added
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

## Pages Built

- `/login` — Google Sign-In only, clean Apple-style white card on `#f5f5f7`
- `/onboarding` — First name, Last name, Business name form; submits to `/api/onboarding`
- `/dashboard` — Bento grid layout with: Today's Summary hero card (white, grid-column 1/5, grid-row 1/2), Weekly Activity line chart (recharts, grid-column 5/13, grid-row 1/2), Emails Drafted, Emails Sent, Avg Response Time stat cards, Voice Agent Live Status card with pulsing dot, Top Enquiry Types donut chart (recharts), Open/Resolved Tickets split card, Recent Activity feed. Summary card shows section label, live date, 3 metric rows (calls/emails/time saved with dividers), and footer links to /helpdesk and /inbox-assistant. All static placeholder data. Time period selector (This Week / This Month / All Time) — UI only, not yet functional.
- `/voice-agent` — Full configuration UI with two-column layout. Left column: Agent Identity (name, greeting, tone), Business Hours (toggle + time range), Call Routing (New Enquiry + Existing Customer paths), Escalation Settings (phone number, safety keywords tags, escalation message). Right column: Live Script Preview (reactive to greeting input), 3 stat cards (Calls Handled, Avg Call Duration, Callback Requests), Recent Calls log with outcome pills, Phone Number Setup with progress steps, Quick Tips card. Status toggle (LIVE/OFFLINE) in header. Save Configuration button. All UI only — no Vapi/Telnyx integration yet.
- `/inbox-assistant` — Two-panel layout filling viewport height. Left panel (38%): inbox selector dropdown (support@/sales@/info@), filter pills (All/Urgent/New Lead/Support with counts), 4 clickable email cards with sender, subject, preview, time, tag pills. Right panel (62%): thread header with subject + sender meta + urgency/action badges, AI Summary box (blue tint), email body, divider, AI Draft textarea (editable, per-email state), Regenerate button, action row (Create Ticket, Link to Ticket, Approve & Send). Green success toast on approve. Stats bar above panels. All static placeholder data — no Gmail/API integration yet.
- `/helpdesk` — Kanban board layout with 4 columns: New, In Progress, Waiting on Customer, Closed. Quick stats bar (Open, Urgent, Overdue, Resolved Today). Search bar + Source and Priority filter pills. 13 ticket cards across columns with ID, title, customer, source icon, priority pill, assignee, SLA timer/overdue indicator. Slide-in ticket detail panel (480px, smooth animation, overlay) with AI Summary box, 4 tabs (Details, Transcript, Notes, Timeline), assignee dropdown. All static placeholder data — no backend connected yet.
- `/connections` — Active Connections section (Google Workspace card with status pill, last sync, Manage/Disconnect buttons) and Available Connectors grid (Microsoft 365, Simpro, Voice Platform, Xero — all Coming Soon, disabled). Manage button opens a modal with inbox toggles (support@/sales@/info@) and permissions list. All UI only — no OAuth yet.
- `/settings` — Full settings page with 5 card sections: (1) Workspace — business name input, logo placeholder with upload button, timezone dropdown (Adelaide/Sydney/Melbourne/Brisbane/Perth), industry dropdown, Save Changes button. (2) Team Members — invite row (email input + role dropdown + Send Invite button), 3 member rows with avatar circles, name, email, role pills (Admin blue / Agent grey), "You" badge on current user, Remove button on hover for others. (3) Billing & Plan — gradient plan card (blue→purple) with "Pilot Plan", Active status pill with green dot, renewal date; 3 usage stat pills; info box about pilot billing. (4) Notifications — 5 toggle rows (urgent tickets, callbacks, SLA, daily summary, draft ready) with custom CSS toggle switches (blue on, grey off), notification email input with Save. (5) Time Saved Calculation — admin hourly rate ($42/hr), minutes per call (4), minutes per email (6) with inline Save buttons; live preview calculation box. All static placeholder data — no backend connected yet.

## Integrations Pending
- Voice Agent: Vapi.ai or Telnyx (decision: use Vapi for prototype, migrate to Telnyx for production). Needs: API key, phone number provisioning, webhook endpoint for call transcripts.
- Inbox Assistant: Google Workspace OAuth (Gmail read + draft scope)
- Connections page: Google OAuth setup flow

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
