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
│       │   └── AuthContext.tsx  # user, tenant, loading, signOut
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
│       └── 001_initial_schema.sql
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
4. Onboarding: enter business name → creates `tenants` + `tenant_memberships` (role: admin)
5. All `/dashboard`, `/voice-agent`, etc. routes require both auth + tenant membership

## Database Pattern

**NEVER use Replit's built-in database. Always use Supabase.**

- Frontend uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- Backend uses `VITE_SUPABASE_URL` + `SUPABASE_SECRET_KEY`

### Schema (Supabase)

- `tenants` — organisations (id, name, slug, created_at)
- `users` — mirrors Firebase Auth users (id = Firebase UID)
- `tenant_memberships` — links users to tenants with a role (agent/admin)
- Row Level Security is enabled on all tables

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
