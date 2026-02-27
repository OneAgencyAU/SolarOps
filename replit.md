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

## Development

```bash
npm run dev        # Start both frontend and backend
npm run dev:client # Vite only
npm run dev:server # Express only (tsx watch)
```
