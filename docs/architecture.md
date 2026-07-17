# Architecture

High-level map of the open edition. See `src/routes/README.md` for the
route conventions and `src/ee/README.md` for the enterprise boundary.

## Stack

- **Frontend + backend:** [TanStack Start](https://tanstack.com/start)
  v1 on Vite 7, targeting Cloudflare Workers (nodejs_compat).
- **UI:** React 19, Tailwind v4, shadcn/Radix components.
- **Database + auth + storage:** Supabase (Postgres + RLS).
- **AI:** Anthropic Claude via the official SDK, BYOK per project
  (see `docs/byok.md`).
- **PDF rendering:** SwiftLaTeX (WASM) in the browser for previews;
  server-side compile for final artifacts.

## Directory layout

```text
src/
  routes/            file-based TanStack routes
    api/             HTTP endpoints (chat stream, attachments, etc.)
    api/public/      webhooks + cron (unauthenticated on published site)
    _authenticated/  route gate for signed-in surface
  components/        UI (workspace panes, shell, marketing sections)
  lib/               server functions, agent turn/tools, PDF/LaTeX,
                     exhibit + section utilities
  integrations/supabase/  generated client + auth middleware + admin
                          client (server-only)
  ee/                ENTERPRISE — closed in the open build (see below)
supabase/
  migrations/        open-edition schema baseline
docs/
  self-host.md       running your own instance
  byok.md            AI key handling
  architecture.md    this file
  oss/               internals: manifest, README swap, gitignore swap
scripts/
  build-public-repo.sh    produce the OSS mirror tree
  dump-open-schema.sh     regenerate the open baseline from a live DB
  generate-open-types.mjs strip EE surface out of supabase/types.ts
```

## Data flow — a single agent turn

1. Browser calls the `chat.stream` server function with a project id
   and the user's message.
2. Server function loads the project (RLS scopes to the owner),
   decrypts the Anthropic key with `BYOK_ENCRYPTION_KEY`, and calls
   `runAgentTurn` (`src/lib/agent-turn.server.ts`).
3. The agent loop streams tokens back, invoking tools defined in
   `src/lib/agent-tools.server.ts` — `set_section_body`,
   `add_exhibit`, `compile_latex`, `review_exhibit`, etc. Tool calls
   run under the same server function's Supabase client (RLS still
   applies) or the admin client for metering (open edition: no-op).
4. Section edits go through `set_section_body`, which snapshots a
   version row via a Postgres trigger so history is preserved.

## Enterprise boundary

Everything under `src/ee/` is closed source in the hosted build. The
public repo swaps in stub barrels (`src/ee/index.stub.ts` and
`src/ee/server.stub.ts`) that either throw `ee_required` or return
safe defaults (paywall off, analytics off). Deep imports from
`@/ee/*` are banned by ESLint — only the `@/ee` and `@/ee/server`
barrels are allowed from open code. A compile-time parity check in
`src/ee/_parity.ts` fails typecheck if the stubs drift from the real
barrels.

See `src/ee/README.md` and `docs/oss/ee-db-manifest.json` for the
list of enterprise-only tables, functions, and columns.
