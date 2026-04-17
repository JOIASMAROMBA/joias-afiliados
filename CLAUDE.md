# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Next.js dev server (localhost:3000)
npm run build   # Production build
npm run start   # Serve built app
```

No test, lint, or typecheck scripts are configured. The project is plain JavaScript (no TypeScript); `jsconfig.json` only declares the `@/*` path alias, but the codebase imports via relative paths (`../../../../lib/...`) — follow the existing pattern.

## Deploy

Production lives on Vercel at `https://joias-afiliados-12hf.vercel.app` and auto-deploys on every push to `main` (GitHub: `JOIASMAROMBA/joias-afiliados`). There is no staging environment — merging to `main` is shipping.

## Architecture

Next.js 14 App Router affiliate portal for the Joias Maromba brand. Users are "afiliadas" who receive a fixed commission (default R$25, stored per-affiliate in `affiliates.commission_value`) whenever their `coupon_code` is used on the Loja Integrada store at `joiasmaromba.com.br`.

### Route layout

- `app/login`, `app/cadastro`, `app/esqueci-senha`, `app/como-funciona` — public pages
- `app/painel/page.js` — affiliate dashboard (~69 KB, single client component)
- `app/admin/page.js` — admin dashboard (~89 KB, single client component, gated by `affiliates.is_admin`)
- `app/api/**` — route handlers (all marked `export const dynamic = 'force-dynamic'`)

Both dashboards are deliberately monolithic single-file components with inline styles. There is no UI library and no Tailwind — styling is inline `style={{...}}` plus keyframes in `app/globals.css` and per-page `<style>` tags. When editing, extend the existing inline style pattern rather than introducing new conventions.

### Authentication — two parallel mechanisms

This is a crucial quirk: auth state lives in **two places** that must stay in sync.

1. **JWT session cookie** `joias_session` (httpOnly, 30d, signed with `AUTH_JWT_SECRET`). Used by server API routes via `requireSession` / `requireAdmin` in [lib/auth.js](lib/auth.js). Set on `/api/auth/login`, cleared on `/api/auth/logout`.
2. **localStorage** keys `affiliate_id`, `affiliate_name`, `affiliate_coupon`. Used by client pages (`painel`, `admin`) to decide routing before any API call. If the localStorage id exists but the JWT is gone/expired, the client will hit a 401 — API helpers in the pages detect this and `localStorage.clear() + router.push('/login')`.

Passwords use bcryptjs. [lib/auth.js:19](lib/auth.js#L19) `verifyPassword` has a **legacy plaintext migration path**: if `password_hash` doesn't start with `$2a/$2b/$2y$`, it compares as plaintext and flags `needsRehash`, which the login route then upgrades to a bcrypt hash. Do not remove this path without verifying every row is already bcrypt-hashed.

Rate limiting ([lib/rate-limit.js](lib/rate-limit.js)) logs every login attempt to the `login_attempts` table and blocks by IP (10 failures / 5 min) or coupon (5 failures / 15 min).

### Supabase — two clients

- [lib/supabase.js](lib/supabase.js) — anon client, bundled to the browser, used by client pages for read queries and real-time channels.
- [lib/supabase-admin.js](lib/supabase-admin.js) — service-role client, server-only, used in `app/api/**`. Falls back to anon key if `SUPABASE_SERVICE_ROLE_KEY` is missing, but inserts/updates from webhooks require the service role.

Coupon lookups use `.ilike('coupon_code', coupon)` (case-insensitive) everywhere — preserve this when writing new queries against `affiliates`.

The painel uses Supabase real-time channels (`supabase.channel(...).on('postgres_changes', ...)`) to refresh when `sales`, `rewards`, `withdrawals`, `posting_obligations`, or the affiliate row changes. If you add a new table that the painel displays, subscribe to it here or the UI won't update live.

### Key Supabase tables & views (inferred from queries)

Tables: `affiliates`, `sales`, `withdrawals`, `posts`, `posting_obligations`, `rewards`, `material_folders`, `material_files`, `login_attempts`.
Views: `affiliate_balance`, `affiliate_metrics`, `recent_posts`, `monthly_sales`, `monthly_top_affiliate`.

Schema changes require SQL run directly in Supabase — there is no migration tooling in the repo.

### Sales ingestion — two paths, both must dedupe

Sales arrive in the `sales` table via two independent ingestion routes that **both** deduplicate on `external_order_id`:

1. [app/api/webhook/loja-integrada/route.js](app/api/webhook/loja-integrada/route.js) — push webhook from Loja Integrada. Authenticates via `?secret=WEBHOOK_SECRET` query param using `safeEqual` (timing-safe compare). Only processes orders whose status matches `pago/paid/aprovado/approved/faturado/concluido`.
2. [app/api/sync-loja-integrada/route.js](app/api/sync-loja-integrada/route.js) — pull sync, also gated by `?secret=WEBHOOK_SECRET`. Tries five Loja Integrada auth modes in sequence (query params, header variants, bearer) because the API docs are inconsistent — if you touch this, preserve the fallback chain.

Both extract coupon from a list of possible payload shapes (`cupom`, `cupom_desconto`, `cupons[]`, `descontos[]`). Loja Integrada payloads vary; add to the `extractCouponCode` fallbacks rather than replacing.

### Bonus milestones

[lib/milestones.js](lib/milestones.js) defines the hardcoded bonus ladder (10 sales → R$50, … 200 sales → VIAGEM). The database also has a `rewards` table that admins edit via `/api/admin/rewards/*` — these two sources coexist; the hardcoded ladder drives the painel's [BonusPopup](components/BonusPopup.js) celebration, while the `rewards` table drives the admin-configurable reward list shown in the painel. Don't assume one is canonical.

### Security headers

[next.config.js](next.config.js) sets a strict CSP that allows `connect-src` only to `*.supabase.co` and `api.awsli.com.br`. If you integrate a new external API from the browser, update the CSP or the request will be blocked in production.

## Environment variables

Required (server will return `server_misconfigured` without these):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — required for login and all write routes
- `AUTH_JWT_SECRET` — required for session cookies
- `WEBHOOK_SECRET` — gates both sales ingestion routes

Optional:
- `LOJA_INTEGRADA_API_KEY`, `LOJA_INTEGRADA_APP_KEY` — only needed for `/api/sync-loja-integrada`
- `RESEND_API_KEY`, `EMAIL_FROM` — password-reset emails via Resend ([lib/email.js](lib/email.js)); without them, forgot-password silently no-ops

## Conventions worth following

- All UI copy is in Portuguese (pt-BR). Error messages surfaced to users are Portuguese; error codes in JSON responses (`invalid_credentials`, `rate_limited`, etc.) are English snake_case and mapped to pt-BR in the page components.
- Coupon codes are displayed and stored uppercase (`setCoupon(e.target.value.toUpperCase())`).
- Money: commission is stored as a number (reais), displayed with `R$` prefix.
- Theme colors: gold `#FFD700` / `#C9A961` / `#E8CF8B` on black `#000`. Keep this palette when adding UI.
