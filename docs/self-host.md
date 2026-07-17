# Self-hosting the open edition

The open edition of VisaWorker is a full-stack TanStack Start app that
runs against a Supabase project you own. It ships without billing,
referrals, transactional email, ad pixels, or the lawyer-intro flow —
those features live in the closed `/ee` folder of the hosted product.

The open edition uses **BYOK (Bring Your Own Key)** for the AI provider:
every project stores an Anthropic API key, encrypted at rest, and calls
Anthropic directly. There is no managed AI key path in the open build.

## Prerequisites

- [Bun](https://bun.sh) 1.1+
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [Anthropic API key](https://console.anthropic.com) per end user
  (users paste theirs into the app; you don't need one to run the server)

## 1. Clone and install

```bash
git clone https://github.com/visaworker/visaworker.git
cd visaworker
bun install
```

## 2. Provision Supabase

Push the open-edition schema baseline to your Supabase project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The migrations under `supabase/migrations/` contain only the open schema
(projects, sections, exhibits, chat, letters, ai-config columns). The
EE-only tables (`project_billing`, `referrals`, `payouts`, etc.) are
absent by design — see `docs/oss/ee-db-manifest.json` for the full list.

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=<ref>

# Server-only
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
BYOK_ENCRYPTION_KEY=<32-byte hex, e.g. `openssl rand -hex 32`>
```

**`BYOK_ENCRYPTION_KEY` protects every user's Anthropic key at rest.**
Generate a fresh value for your deployment, back it up, and never rotate
it without re-encrypting every row in the `projects` table.

## 4. Run

```bash
bun run dev       # http://localhost:8080
bun run build     # production build (Cloudflare Workers target)
```

## Deploying

The default build target is Cloudflare Workers via TanStack Start's
Vite plugin. Any TanStack-supported target works — see the
[TanStack Start deployment docs](https://tanstack.com/start/latest).

## What's missing vs. the hosted product

Anything imported from `@/ee` or `@/ee/server` in this codebase is
replaced by a stub in the open edition that throws `ee_required` (or
returns a safe default: paywall off, analytics off, transactional email
off). If you want those features, use the hosted product at
[visaworker.ai](https://visaworker.ai) — or fork the boundary and wire
your own billing/email/analytics into the barrel.
