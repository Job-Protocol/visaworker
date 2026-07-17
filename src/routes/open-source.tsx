import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SealMark } from "@/components/SealMark";
import { SiteHeader } from "@/components/SiteHeader";
import {
  ArrowUpRight,
  Check,
  ClipboardCheck,
  Code2,
  Copy,
  GitBranch,
  KeyRound,
  Scale,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";

const GITHUB_URL = "https://github.com/Job-Protocol/visaworker";

export const Route = createFileRoute("/open-source")({
  component: OpenSourcePage,
  head: () => ({
    meta: [
      { title: "Open source — visaworker.ai" },
      {
        name: "description",
        content:
          "VisaWorker is open source under BUSL 1.1. Self-host the full drafting workspace, bring your own Anthropic key, read every prompt. The hosted service pays the bills.",
      },
      { property: "og:title", content: "Open source — visaworker.ai" },
      {
        property: "og:description",
        content:
          "Self-host the full drafting workspace, bring your own Anthropic key, read every prompt. BUSL 1.1 open-core.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://visaworker.ai/open-source" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Open source — visaworker.ai" },
      {
        name: "twitter:description",
        content:
          "Self-host the full drafting workspace, bring your own Anthropic key, read every prompt.",
      },
    ],
    links: [{ rel: "canonical", href: "https://visaworker.ai/open-source" }],
  }),
});

function OpenSourcePage() {
  return (
    <div className="relative min-h-screen bg-paper text-ink">
      <div className="h-1 w-full bg-gradient-to-r from-navy via-paper to-crimson" />

      {/* Nav */}
      <SiteHeader
        current="open-source"
        cta={{ label: "View on GitHub", href: GITHUB_URL, external: true }}
      />




      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink/10 bg-paper">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 8%, oklch(0.78 0.13 82 / 0.16), transparent 55%), radial-gradient(circle at 85% 92%, oklch(0.51 0.19 27 / 0.09), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1100px] px-6 pt-20 pb-24 text-center md:px-10 md:pt-28 md:pb-32">
          <div className="mx-auto flex max-w-[520px] items-center gap-4 text-[10px] font-bold uppercase tracking-[0.32em] text-ink/50">
            <span className="h-px flex-1 bg-ink/20" />
            <span>Source available · BUSL 1.1</span>
            <span className="h-px flex-1 bg-ink/20" />
          </div>

          <h1 className="mx-auto mt-10 max-w-[900px] font-serif text-[46px] leading-[1.02] text-ink sm:text-[64px] md:text-[84px] md:leading-[0.98]">
            Read the prompts <span className="italic text-crimson">that draft your petition.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-[680px] text-[17px] leading-relaxed text-ink/70 md:text-[19px]">
            Every prompt, every tool call, every LaTeX template behind an O-1A, EB-1A, or NIW draft —
            published under a source-available license you can audit, fork, and self-host. Bring your
            own Anthropic key. Your case never touches our servers.
          </p>


          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-none border-b-2 border-crimson-deep bg-crimson px-6 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-none transition-all hover:-translate-y-px hover:bg-crimson-deep"
            >
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                Clone the repo
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-none border-2 border-ink/20 bg-transparent px-6 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent hover:text-ink"
            >
              <Link to="/auth">Try the hosted version</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-ink/45">
            One repo · Two licenses · Zero telemetry when self-hosted
          </p>
        </div>
      </section>

      {/* Why open source */}
      <section className="border-b border-ink/10 bg-paper py-24 md:py-32">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="max-w-[720px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-navy">
              Why open source
            </div>
            <h2 className="mt-4 font-serif text-[36px] leading-tight text-ink md:text-[52px]">
              The prompts are the product. Hiding them was never going to work.
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-ink/70">
              An AI that drafts a legal filing has to earn trust. You can't earn it behind a curtain.
              So we published the curtain. Read the system prompt. Read the tool schemas. Read the
              LaTeX skeleton the agent uses to build a petition. Then decide.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden border border-ink/15 bg-ink/15 md:grid-cols-3">
            <Pillar
              icon={KeyRound}
              title="BYOK by default"
              body="Self-host with your own Anthropic key. Your prompts and case data go directly to Anthropic. We're not in the loop."
            />
            <Pillar
              icon={Code2}
              title="Prompts published"
              body="agent-turn, agent-tools, petition-templates, exhibit-review, letters — all in the tree. Fork, tune, or audit."
            />
            <Pillar
              icon={ShieldCheck}
              title="Trust, testable"
              body="No black box for the part that matters. If it drafts a bad section, you can see exactly why and fix it."
            />
          </div>
        </div>
      </section>

      {/* What's open vs closed */}
      <section className="border-b border-ink/10 bg-linen py-24 md:py-32">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="max-w-[720px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-navy">
              Open-core, honestly labeled
            </div>
            <h2 className="mt-4 font-serif text-[36px] leading-tight text-ink md:text-[52px]">
              What's in the repo. What isn't.
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-ink/70">
              Everything that drafts a petition is open. Everything that runs the hosted business —
              Stripe, referrals, the lawyer network, transactional email — lives in a{" "}
              <code className="border border-ink/15 bg-paper px-1.5 py-0.5 font-mono text-[13px] text-crimson">/ee</code>{" "}
              folder under a proprietary license. Self-hosters get working stubs; the hosted service
              runs the real thing.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            <SplitCard
              tag="Open · BUSL 1.1"
              title="The drafting workspace"
              items={[
                "Agent turn loop + full tool schemas",
                "O-1A / EB-1A / NIW petition templates",
                "Exhibit ingestion, OCR, review prompts",
                "Recommendation-letter drafting",
                "LaTeX pipeline (SwiftLaTeX WASM, in-browser)",
                "BYOK Anthropic client + AES-GCM key storage",
                "Supabase schema for projects, sections, exhibits, chat",
              ]}
            />
            <SplitCard
              tag="Enterprise · proprietary"
              title="What pays for the hosted service"
              items={[
                "Managed Anthropic billing (per-case Stripe checkout)",
                "Referral engine + credits + payouts",
                "Lawyer-network intros",
                "Lifecycle + transactional email templates",
                "Admin console",
                "PostHog + Meta Pixel + CAPI wiring",
              ]}
              muted
            />
          </div>

          <p className="mt-10 text-sm leading-relaxed text-ink/60">
            The boundary is enforced by CI: open code can only reach the enterprise surface through a
            single documented barrel with a no-op stub. Delete <code className="border border-ink/15 bg-paper px-1.5 py-0.5 font-mono text-[12px] text-crimson">/ee</code>{" "}
            and the app still builds, still drafts petitions — it just doesn't send emails or charge
            cards.
          </p>
        </div>
      </section>

      {/* Self-host quickstart */}
      <section className="border-b border-ink/10 bg-paper py-24 md:py-32">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.15fr] lg:gap-24">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-navy">
                Self-host
              </div>
              <h2 className="mt-4 font-serif text-[36px] leading-tight text-ink md:text-[48px]">
                Running your own copy takes about ten minutes.
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-ink/70">
                Supabase for storage. Bun for the dev server. Your own Anthropic key. That's the
                whole stack.
              </p>
              <ul className="mt-8 space-y-4 text-[15px] text-ink/80">
                <li className="flex items-start gap-3">
                  <Server className="mt-0.5 h-5 w-5 shrink-0 text-crimson" strokeWidth={1.5} />
                  <span>Deploy anywhere that runs a Cloudflare Worker or Node process.</span>
                </li>
                <li className="flex items-start gap-3">
                  <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-crimson" strokeWidth={1.5} />
                  <span>
                    Two-way sync with GitHub — edit locally, ship from Actions, or the other way
                    around.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Scale className="mt-0.5 h-5 w-5 shrink-0 text-crimson" strokeWidth={1.5} />
                  <span>
                    BUSL 1.1 converts to Apache 2.0 after four years. No lock-in on old code.
                  </span>
                </li>
              </ul>
            </div>

            <div className="border border-ink/15 bg-ink/[0.02] p-6 font-mono text-[13px] leading-relaxed text-ink/80 shadow-plate md:p-8">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-ink/50">
                <span className="h-2 w-2 rounded-full bg-crimson" />
                Terminal
              </div>
              <pre className="whitespace-pre-wrap break-words">
                <span className="text-ink/40"># clone</span>
                {"\n"}git clone {GITHUB_URL}.git
                {"\n"}cd visaworker
                {"\n\n"}<span className="text-ink/40"># install</span>
                {"\n"}bun install
                {"\n\n"}<span className="text-ink/40"># wire Supabase (local or hosted)</span>
                {"\n"}supabase link --project-ref $YOUR_REF
                {"\n"}supabase db push
                {"\n\n"}<span className="text-ink/40"># drop your Anthropic key in .env</span>
                {"\n"}<span className="text-crimson">BYOK_ENCRYPTION_KEY</span>=$(openssl rand -hex 32)
                {"\n\n"}<span className="text-ink/40"># go</span>
                {"\n"}bun run dev
              </pre>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent hover:text-ink"
            >
              <a
                href={`${GITHUB_URL}/blob/main/docs/self-host.md`}
                target="_blank"
                rel="noreferrer"
              >
                Self-host guide
                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent hover:text-ink"
            >
              <a href={`${GITHUB_URL}/blob/main/docs/byok.md`} target="_blank" rel="noreferrer">
                BYOK setup
                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent hover:text-ink"
            >
              <a
                href={`${GITHUB_URL}/blob/main/docs/architecture.md`}
                target="_blank"
                rel="noreferrer"
              >
                Architecture
                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Instruct your coding agent */}
      <section className="border-b border-ink/10 bg-ink py-24 text-paper md:py-32">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-crimson">
                Skip the reading
              </div>
              <h2 className="mt-4 font-serif text-[36px] leading-tight md:text-[52px]">
                Instruct your coding agent to do it for you.
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-paper/70">
                Paste this into Cursor, Claude Code, Codex, Windsurf, or any
                shell-capable agent. It installs, wires Supabase, asks for your
                keys, and boots the dev server.
              </p>

              <div className="mt-8">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-paper/40">
                  Works with
                </div>
                <ul className="mt-4 flex flex-wrap items-center gap-2">
                  {AGENTS.map((a) => (
                    <li key={a.name}>
                      <a
                        href={a.href(AGENT_PROMPT)}
                        target="_blank"
                        rel="noreferrer"
                        title={a.note ? `Open in ${a.name} — ${a.note}` : `Open in ${a.name} with the prompt`}
                        className="group inline-flex items-center gap-2 border border-paper/15 bg-paper/[0.04] px-3 py-2 transition-colors hover:border-crimson hover:bg-paper/[0.08]"
                      >
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${a.domain}&sz=64`}
                          alt=""
                          aria-hidden
                          className="h-4 w-4"
                          loading="lazy"
                        />
                        <span className="text-[12px] font-medium text-paper/85 group-hover:text-paper">{a.name}</span>
                        <ArrowUpRight className="h-3 w-3 text-paper/40 group-hover:text-crimson" />
                      </a>
                    </li>
                  ))}
                </ul>

              </div>

              <ul className="mt-8 space-y-3 text-[14px] text-paper/70">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
                  <span>Stops for your API key — nothing is auto-committed.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
                  <span>Leaves you with a running dev server, ready to draft.</span>
                </li>
              </ul>

            </div>

            <AgentPromptCard />
          </div>
        </div>
      </section>

      {/* Hosted vs self-hosted */}
      <section className="border-b border-ink/10 bg-linen py-24 md:py-32">
        <div className="mx-auto max-w-[1100px] px-6 md:px-10">
          <div className="max-w-[720px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-navy">
              Two ways to use it
            </div>
            <h2 className="mt-4 font-serif text-[36px] leading-tight text-ink md:text-[52px]">
              Run it yourself, or let us.
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            <PlanCard
              tag="Self-hosted · free"
              title="You run it"
              price="$0 + your Anthropic bill"
              body="Everything in the open repo. Your infra, your key, your data. Support is community-only."
              items={[
                "Full drafting workspace",
                "Bring your own Anthropic API key",
                "All prompts and templates included",
                "No telemetry, no lifecycle email",
                "Community support via GitHub Issues",
              ]}
              cta={{ label: "Clone on GitHub", href: GITHUB_URL, external: true }}
            />
            <PlanCard
              tag="Hosted · $249 / case"
              title="We run it"
              price="Flat, per petition"
              body="Managed Anthropic billing, deliverability, human support. The proceeds fund the open codebase."
              items={[
                "No key, no infra, no setup",
                "Human support during your filing",
                "Deliverability + tracked case comms",
                "Optional lawyer-network intro",
                "Same open codebase underneath",
              ]}
              cta={{ label: "Start a case", href: "/", external: false }}
              highlight
            />
          </div>
        </div>
      </section>

      {/* Trust / security */}
      <section className="border-b border-ink/10 bg-paper py-24 md:py-32">
        <div className="mx-auto max-w-[900px] px-6 text-center md:px-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-navy">
            Data & security
          </div>
          <h2 className="mt-4 font-serif text-[36px] leading-tight text-ink md:text-[48px]">
            Your case belongs to you.
          </h2>
          <p className="mt-6 text-[17px] leading-relaxed text-ink/70">
            Self-hosted: your prompts hit Anthropic directly with your key. Nothing routes through
            our servers. Hosted: BYOK keys are encrypted at rest with AES-256-GCM before they touch
            the database; the encryption key never leaves the server runtime; source is public so
            you can verify.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent"
            >
              <Link to="/privacy">Privacy policy</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent"
            >
              <a
                href={`${GITHUB_URL}/blob/main/SECURITY.md`}
                target="_blank"
                rel="noreferrer"
              >
                Security policy
                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-ink/60 md:px-10">
          <p className="tracking-wide">
            © {new Date().getFullYear()} visaworker.ai · Not legal advice · Your data stays yours.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/" className="hover:text-crimson">Home</Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-crimson">
              GitHub
            </a>
            <Link to="/terms" className="hover:text-crimson">Terms</Link>
            <Link to="/privacy" className="hover:text-crimson">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <Icon className="h-6 w-6 text-crimson" strokeWidth={1.5} />
      <h3 className="mt-5 font-serif text-xl leading-tight text-ink md:text-2xl">{title}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-ink/70">{body}</p>
    </div>
  );
}

function SplitCard({
  tag,
  title,
  items,
  muted,
}: {
  tag: string;
  title: string;
  items: string[];
  muted?: boolean;
}) {
  return (
    <div
      className={`border p-8 shadow-plate md:p-10 ${
        muted ? "border-ink/15 bg-paper" : "border-crimson bg-paper"
      }`}
    >
      <div
        className={`inline-block text-[10px] font-bold uppercase tracking-[0.24em] ${
          muted ? "text-navy" : "text-crimson"
        }`}
      >
        {tag}
      </div>
      <h3 className="mt-3 font-serif text-2xl leading-tight text-ink md:text-3xl">{title}</h3>
      <ul className="mt-6 space-y-3">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm text-ink/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCard({
  tag,
  title,
  price,
  body,
  items,
  cta,
  highlight,
}: {
  tag: string;
  title: string;
  price: string;
  body: string;
  items: string[];
  cta: { label: string; href: string; external: boolean };
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col border p-8 shadow-plate md:p-10 ${
        highlight ? "border-crimson bg-paper" : "border-ink/15 bg-paper"
      }`}
    >
      <div
        className={`inline-block text-[10px] font-bold uppercase tracking-[0.24em] ${
          highlight ? "text-crimson" : "text-navy"
        }`}
      >
        {tag}
      </div>
      <h3 className="mt-3 font-serif text-2xl leading-tight text-ink md:text-3xl">{title}</h3>
      <p className="mt-4 font-serif text-2xl text-crimson">{price}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/70">{body}</p>
      <ul className="mt-6 space-y-3">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm text-ink/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Button
          asChild
          className={
            highlight
              ? "w-full rounded-none border-b-2 border-crimson-deep bg-crimson px-5 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-none hover:-translate-y-px hover:bg-crimson-deep"
              : "w-full rounded-none border-2 border-ink/20 bg-transparent px-5 py-5 text-[11px] font-bold uppercase tracking-[0.2em] text-ink shadow-none hover:border-ink hover:bg-transparent"
          }
          variant={highlight ? "default" : "outline"}
        >
          {cta.external ? (
            <a href={cta.href} target="_blank" rel="noreferrer">
              {cta.label}
              <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
            </a>
          ) : (
            <Link to={cta.href}>{cta.label}</Link>
          )}
        </Button>
      </div>
    </div>
  );
}

const AGENTS: { name: string; domain: string; href: (prompt: string) => string; note?: string }[] = [
  {
    name: "Claude",
    domain: "claude.com",
    href: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  },
  {
    name: "ChatGPT",
    domain: "openai.com",
    href: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`,
  },
  {
    name: "Cursor",
    domain: "cursor.com",
    href: (p) => `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(p)}`,
    note: "Opens the Cursor desktop app",
  },
  {
    name: "Windsurf",
    domain: "windsurf.com",
    href: () => "https://windsurf.com/",
  },
  {
    name: "Zed",
    domain: "zed.dev",
    href: () => "https://zed.dev/",
  },
];


const AGENT_PROMPT = `Self-host VisaWorker for me. It's a TanStack Start app on Cloudflare Workers, Supabase for data, BYOK Anthropic key.

1. Clone https://github.com/Job-Protocol/visaworker and cd into it.
2. Run \`bun install\` (or \`npm install\` if bun is missing).
3. Create .env from .env.example. Ask me for:
   - Supabase URL, publishable key, service-role key, and project ref
   - Anthropic API key
   Then generate BYOK_ENCRYPTION_KEY with \`openssl rand -hex 32\` and write it to .env.
4. Run \`supabase link --project-ref <ref>\` and \`supabase db push\`. Show the migration list first.
5. Run \`bun run dev\` and report the preview URL.

Rules:
- Never commit secrets. Confirm .env is in .gitignore before any git add.
- /ee is proprietary and stubbed in the open build. \`ee_required\` errors are expected; note and continue.
- Ask before installing anything outside the lockfile.`;


function AgentPromptCard() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard denied — select-all fallback would go here.
    }
  }

  return (
    <div className="border border-paper/15 bg-paper/[0.03] shadow-plate">
      <div className="flex items-center justify-between gap-3 border-b border-paper/10 px-5 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-paper/50">
          <Terminal className="h-3.5 w-3.5" />
          Agent prompt
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy prompt"
          className="inline-flex items-center gap-2 rounded-none border border-paper/20 bg-transparent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-paper transition-colors hover:border-crimson hover:text-crimson"
        >
          {copied ? (
            <>
              <ClipboardCheck className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words px-5 py-5 font-mono text-[12.5px] leading-relaxed text-paper/85">
        {AGENT_PROMPT}
      </pre>
      <div className="border-t border-paper/10 px-5 py-3 text-[11px] text-paper/50">
        Paste into Cursor, Claude Code, Codex, Windsurf, or your terminal-based agent of choice.
      </div>
    </div>
  );
}
