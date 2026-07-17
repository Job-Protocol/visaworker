# Contributing to VisaWorker

Thanks for considering a contribution. A few things up front so nobody's
time is wasted.

## What we accept

- **Bug fixes** — always welcome. Please include reproduction steps.
- **New visa types / country-specific templates** — very welcome. These live
  under `src/lib/petition-templates.ts` and the section files it references.
- **Prompt improvements** — welcome, but include before/after examples on
  a real (synthetic) petition so we can evaluate quality regression.
- **Documentation** — always welcome.
- **UI polish and accessibility fixes** — welcome.

## What we're careful about

- **Large refactors without a prior issue.** Please open an issue first so
  we can align on the shape of the change.
- **New third-party dependencies.** We audit for license (must be
  permissive: MIT / Apache-2.0 / BSD) and for security surface.
- **Changes to `ee/` or `src/ee/`.** These directories are proprietary and
  not accepting external contributions. See `ee/LICENSE`.

## Development setup

1. Clone the repo.
2. `bun install`.
3. Copy `.env.example` to `.env` and fill in at minimum:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — a local
     Supabase instance works fine (`supabase start`).
   - `BYOK_ENCRYPTION_KEY` — 64 hex chars (`openssl rand -hex 32`).
   - Skip `ANTHROPIC_API_KEY` — the open build requires end-users to use
     BYOK. Managed keys are an EE feature.
4. `bun dev`.

## Contributor License Agreement

By submitting a pull request, you agree that your contribution is licensed
under the same terms as the file you're modifying (BUSL 1.1 for files
outside `ee/`), and that VisaWorker, Inc. may relicense your contribution
under the Change License (Apache 2.0) when that transition occurs.

## Code style

- TypeScript, strict mode. Run `bunx tsgo` before submitting.
- Prettier config lives in `.prettierrc`. Run `bunx prettier --write .`
  before submitting.
- Follow the existing file/route conventions — this is a TanStack Start
  project; see `AGENTS.md` for the important stack rules.

## Trademark

Please read `TRADEMARKS.md`. "VisaWorker" is not licensed for use in
forks — pick your own name if you're shipping a derivative product.
