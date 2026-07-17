# VisaWorker

Open-core AI-assisted drafting workspace for O-1A / EB-1A / NIW petitions.

Bring your own Anthropic API key, upload evidence, and produce a lawyer-ready
petition packet (letters + exhibits + compiled PDF).

> Hosted at **[visaworker.ai](https://visaworker.ai)** — this repo is the
> open-source core. The hosted service adds billing, referrals, transactional
> email, analytics, and the managed AI key (see [Open core](#open-core)).

## Quick start

```bash
bun install
cp .env.example .env    # fill in Supabase URL + publishable key
bun run dev
```

Then sign in, create a project, and paste your Anthropic API key in
Settings → AI Provider.

## Stack

- **Framework:** TanStack Start v1 (React 19, Vite 7, SSR on Cloudflare Workers)
- **Styling:** Tailwind CSS v4
- **DB / Auth:** Supabase (Postgres + RLS)
- **AI:** Anthropic Claude via BYOK
- **PDF:** SwiftLaTeX (WASM)

## Open core

This repo ships everything you need to self-host a working BYOK instance.
The following features live in the enterprise carve-out and are NOT included:

| Feature                | Where it lives      | Open build behavior       |
| ---------------------- | ------------------- | ------------------------- |
| Stripe billing         | `src/ee/billing`    | throws `ee_required`      |
| Referral program       | `src/ee/referrals`  | throws `ee_required`      |
| Transactional email    | `src/ee/email`      | throws `ee_required`      |
| PostHog + Meta pixels  | `src/ee/analytics`  | no-op                     |
| Managed Anthropic key  | `src/ee/ai-managed` | throws `ee_required` (use BYOK) |
| Lawyer intro flow      | `src/ee/lawyers`    | throws `ee_required`      |
| Admin dashboards       | `src/ee/admin`      | throws `ee_required`      |

Self-hosting docs, migration baseline, and full contribution guide are in
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Licenses

- Core code: [BUSL 1.1](./LICENSE) — converts to Apache 2.0 after 4 years.
  Internal / self-hosted production use is permitted; running a competing
  hosted service is not.
- Trademarks: see [TRADEMARKS.md](./TRADEMARKS.md). Forks must rebrand.
- Third-party attributions: [NOTICE](./NOTICE).

## Security

See [SECURITY.md](./SECURITY.md).
