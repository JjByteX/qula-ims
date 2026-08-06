# Qula IMS — Tech Stack

## Connectivity Model

**Fully online. No offline mode.** The app requires an active connection to function; there is no local cache, sync queue, or conflict resolution layer. This is a deliberate choice for a small internal tool — it keeps the architecture simple (one source of truth, no sync complexity) at the cost of requiring connectivity to use the app at all.

## Team & Scale Assumptions

- 3 people total, 2 roles (superadmin + everyone else)
- Low request volume, low data volume (users, projects, budget lines, invoices/ARs, activity log)
- Team is comfortable running its own backend/DB (no requirement to avoid infra entirely)

## Stack

### Frontend
- **Next.js (App Router) + TypeScript** — single framework for pages, layouts, and API routes
- **shadcn/ui + Tailwind CSS** — component system and styling, palette per Mandatory_Colors.md
- **TanStack Query** — data fetching, caching within a session, loading/error state handling
- **react-hook-form + zod** — form state and validation; zod schemas shared between client and server validation

### Backend
- **Next.js API routes** — no separate backend service needed at this scale
- **Session-based auth** (email + password) via `lucia-auth` or `next-auth` credentials provider
  - "Remember me" → longer-lived session cookie
  - Forgot password → emailed reset link (single-use, expiring token)
  - No MFA (per spec)
  - Role check (`superadmin` vs. regular) done directly in route handlers/middleware — no permissions library needed for a two-role system

### Database
- **PostgreSQL**
- **Drizzle ORM** — keeps queries transparent and SQL-legible, which matters for the activity log and budget calculations (remaining budget, splitter math) where correctness needs to be easy to verify by reading the code

### File Storage
- **Cloudflare R2** (S3-compatible, no egress fees) for:
  - Profile pictures (2MB max, enforced client- and server-side)
  - Invoice & Acknowledgement Receipt PDFs

### Hosting
- **Single VPS** (e.g. Hetzner CX22 or DigitalOcean equivalent, ~$6–12/month) running **Docker Compose**:
  - Next.js app container
  - Postgres container
  - Caddy (reverse proxy + automatic HTTPS)
- Chosen over managed free tiers (Vercel + Neon/Supabase) because:
  - No cold-start delay from a paused/idle database
  - No ambiguity around free-tier commercial-use terms
  - Consistent, predictable performance for a fully-online tool where every action depends on the connection being fast
  - Cost is trivial at team scale (~$2–4/person/month)

### Monitoring (optional, add if needed)
- **Sentry** free tier for error tracking, once the team wants visibility beyond direct bug reports (3 known users can usually just report issues directly early on)
- **PostHog** free tier, only if usage analytics become useful — not essential for an internal 3-person tool

## Explicitly Not Used

- No offline-first / local-first data layer (PouchDB, ElectricSQL, service workers, etc.)
- No CRDT or peer-to-peer sync (Yjs, Automerge, WebRTC)
- No permissions/authorization library (CASL, Oso) — two roles don't need one
- No microservices — single Next.js app + single Postgres instance is sufficient
