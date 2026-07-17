import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { SealMark } from "@/components/SealMark";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendLawyerInquiry } from "@/ee";
import { track } from "@/ee";
import {
  ArrowUpRight,
  Check,
  LayoutDashboard,
  Palette,
  Users,
  Wallet,
  FileCheck2,
  Sparkles,
  PenLine,
  ShieldCheck,
} from "lucide-react";



export const Route = createFileRoute("/for-lawyers")({
  component: ForLawyers,
  head: () => ({
    meta: [
      { title: "The AI drafting agent for immigration firms — visaworker.ai" },
      {
        name: "description",
        content:
          "The AI drafting agent your firm hands to associates. Draft O-1A, EB-1A, and NIW petitions in a weekend. White-label PDFs, per-seat billing.",
      },
      { property: "og:title", content: "The AI drafting agent for immigration firms — visaworker.ai" },
      {
        property: "og:description",
        content:
          "The AI drafting agent your firm hands to associates. Draft O-1A, EB-1A, and NIW petitions in a weekend. White-label PDFs, per-seat billing.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://visaworker.ai/for-lawyers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "The AI drafting agent for immigration firms — visaworker.ai" },
      {
        name: "twitter:description",
        content:
          "The AI drafting agent your firm hands to associates. Draft O-1A, EB-1A, and NIW petitions in a weekend. White-label PDFs, per-seat billing.",
      },
      { property: "og:image", content: "https://visaworker.ai/og-for-lawyers.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "visaworker.ai — the AI drafting agent your firm hands to associates." },
      { name: "twitter:image", content: "https://visaworker.ai/og-for-lawyers.png" },
      { name: "twitter:image:alt", content: "visaworker.ai — the AI drafting agent your firm hands to associates." },
    ],
    links: [{ rel: "canonical", href: "https://visaworker.ai/for-lawyers" }],
  }),
});

function ForLawyers() {
  return (
    <div className="relative min-h-screen bg-paper text-ink">
      <div className="h-1 w-full bg-gradient-to-r from-navy via-paper to-crimson" />

      {/* Nav */}
      <SiteHeader
        current="for-lawyers"
        cta={{ label: "Talk to us", shortLabel: "Talk", href: "#contact" }}
      />


      {/* Hero — editorial full-page typography */}
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
          {/* Folio rule */}
          <div className="mx-auto flex max-w-[520px] items-center gap-4 text-[10px] font-bold uppercase tracking-[0.32em] text-ink/50">
            <span className="h-px flex-1 bg-ink/20" />
            <span>A note to immigration counsel</span>
            <span className="h-px flex-1 bg-ink/20" />
          </div>

          <h1 className="mx-auto mt-10 max-w-[900px] font-serif text-[46px] leading-[1.02] text-ink sm:text-[64px] md:text-[84px] md:leading-[0.98]">
            Drafting is a craft.
            <br />
            It should <span className="italic text-crimson">read like one.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-[640px] font-serif text-lg italic leading-relaxed text-ink/75 md:text-[22px] md:leading-[1.5]">
            A quiet workspace for O-1A, EB-1A, and NIW petitions — and, for every practice that opens an account, the first three cases are on the house.
          </p>

          <div className="mx-auto mt-8 max-w-[640px]">
            <div className="mx-auto h-px w-16 bg-gold" />
            <p className="mt-6 text-[15px] leading-relaxed text-ink/70 md:text-[16px]">
              Built by counsel who lost too many Sundays to the same paragraphs. It drafts in your firm's voice, ties every claim to a specific exhibit, and hands you a binder you'd be proud to sign. No trial clock. No credit card. You judge whether it's sharper than what you'd have drafted yourself.
            </p>
          </div>

          <div className="mt-11 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-none bg-crimson px-8 text-[12px] font-bold uppercase tracking-[0.2em] text-paper shadow-[6px_6px_0_0_var(--ink)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[8px_8px_0_0_var(--ink)]"
            >
              <a href="#contact" onClick={() => track("for_lawyers_cta_clicked", { location: "hero" })}>
                Claim your three free cases
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-14 rounded-none border-2 border-ink/20 bg-transparent px-6 text-[12px] font-bold uppercase tracking-[0.2em] text-ink hover:bg-ink hover:text-paper"
            >
              <Link to="/demo">Read a sample petition</Link>
            </Button>
          </div>

          {/* Footer folio */}
          <div className="mx-auto mt-16 max-w-[820px] border-t border-ink/15 pt-8">
            <dl className="grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink/50">The offer</dt>
                <dd className="mt-2 font-serif text-[22px] leading-tight text-navy">
                  Three cases, <span className="italic text-crimson">on us.</span>
                </dd>
                <p className="mt-1 text-[12px] text-ink/60">Per practice. No card, no clock.</p>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink/50">The scope</dt>
                <dd className="mt-2 font-serif text-[22px] leading-tight text-navy">O-1A · EB-1A · NIW.</dd>
                <p className="mt-1 text-[12px] text-ink/60">Extraordinary ability, start to filing.</p>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink/50">The output</dt>
                <dd className="mt-2 font-serif text-[22px] leading-tight text-navy">Your letterhead.</dd>
                <p className="mt-1 text-[12px] text-ink/60">White-label PDF, filed under your firm.</p>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Zigzag rows */}
      <section className="bg-paper py-24 md:py-28">
        <div className="mx-auto max-w-[1300px] space-y-24 px-6 md:space-y-32 md:px-10">
          <ZigRow
            eyebrow="The drafting"
            title={<>Written the way a partner would <span className="italic text-crimson">revise it.</span></>}
            body="Trained on the anatomy of an approvable record — how a sustained-acclaim argument is stitched to Exhibit 4-B, how a National Interest case is framed around the third prong. It writes to that bar, in your firm's voice, and leaves the citation trail behind."
            bullets={[
              "Every claim tied to a specific exhibit",
              "One-click RFE response drafts",
              "House style locked at the firm level",
            ]}
            mock={<DraftMock />}
          />
          <ZigRow
            reverse
            eyebrow="The workspace"
            title={<>One dashboard. <span className="italic text-crimson">Every matter, every role.</span></>}
            body="Partners see risk. Associates see the next thing to draft. Paralegals see what's still missing from the record. The client, if you invite them in, sees your firm — not ours."
            bullets={[
              "Roles for partners, associates, paralegals, and clients",
              "Filter by visa type, associate, or RFE risk",
              "Numbers you can quote in a partner meeting",
            ]}
            mock={<DashboardMock />}
          />
          <ZigRow
            eyebrow="The binder"
            title={<>White-label. Your cover, <span className="italic text-crimson">your letterhead.</span></>}
            body="Compiled petitions carry your firm's mark, letterhead, and tab structure. Nothing about the binder that lands on an adjudicator's desk suggests it was drafted anywhere but at your firm."
            bullets={[
              "Firm cover, letterhead, and tab order",
              "USCIS-ready compilation to a single PDF",
              "No visaworker.ai anywhere on the filed pages",
            ]}
            mock={<PdfMock />}
          />
        </div>
      </section>

      {/* Three ways to work with us */}
      <section className="border-t border-ink/10 bg-parchment py-24 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10">

          <div className="mb-14 max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">Three ways in</div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              Draft in-house. Send it to a client. <span className="italic text-crimson">Or just refer.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink/70 md:text-lg">
              Pick one. Most firms end up doing all three by the end of the quarter.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <PlanCard
              tag="Firm subscription"
              title="Your associates draft in it."
              price="First three cases free"
              subtitle="Then per seat, unlimited petitions."
              body="Every practice gets its first three petitions on us. Run a real O-1A, EB-1A, or NIW through the workspace before you spend a dollar — and keep going if it's sharper than what you'd have drafted yourself."
              items={[
                "Three cases free, per practice",
                "Unlimited petitions per seat after",
                "Multi-client dashboard, firm-wide",
                "White-label / co-branded PDFs",
                "Direct line to the team",
              ]}
            />

            <PlanCard
              tag="Client-paid"
              title="They pay. You stay in control."
              price="Flat, per matter"
              subtitle="For the ones that don't fit a full engagement."
              body="Create the matter inside your firm workspace and send the client a payment link. They pay visaworker.ai directly; the file stays in your dashboard, under your brand."
              items={[
                "You open the matter, client pays direct",
                "File stays inside your dashboard",
                "Client sees your firm's brand, not ours",
                "Nothing on your invoice, nothing in trust",
              ]}
            />
            <PlanCard
              tag="Referral partner"
              title="Send the ones you can't take."
              price="20% for life"
              subtitle="For the self-petitioners you'd otherwise turn away."
              body="For the founder, researcher, or engineer you can't take on today — send them here. You earn 20% of every paid petition they file, for the life of the account, and the relationship stays with your firm. Free preview and bring-your-own-key don't earn a cut — nobody paid us, so nobody pays you."
              items={[
                "20% of every paid petition",
                "Recurring for the life of the account",
                "Unique referral link plus a live dashboard",
                "First right of refusal on their next matter",
              ]}
              highlight
            />
          </div>

          <p className="mt-10 max-w-2xl text-sm text-ink/60">
            Referrers keep the relationship. When the same client comes back for the H-1B, the green card, or a family petition, they come back to you.
          </p>

        </div>
      </section>


      {/* Features */}
      <section className="bg-paper py-24 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10">
          <div className="mb-14 max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">Under the hood</div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              Case management. <span className="italic text-crimson">Not just drafting.</span>
            </h2>
          </div>
          <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={LayoutDashboard} title="Multi-client dashboard" body="Every open matter in one place. Filter by visa type, associate, status, or RFE risk." />
            <Feature icon={Users} title="Roles & permissions" body="Partners, associates, paralegals, and the client — each with the right level of access, nothing more." />
            <Feature icon={Palette} title="White-label output" body="Compiled PDFs carry your firm's cover, letterhead, and colors. None of ours." />
            <Feature icon={FileCheck2} title="Status you can quote" body="Sections drafted, exhibits captured, letters signed — visible at a glance, per case, per associate." />
            <Feature icon={Sparkles} title="Drafts in your voice" body="Tune tone and preferences at the firm level once. Every associate's draft comes out consistent." />
            <Feature icon={Wallet} title="Flexible billing" body="Per-seat firm subscription, or per-matter client-paid. Mix both across cases without switching tools." />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-ink/10 bg-parchment py-24 md:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 md:grid-cols-[1fr_1.1fr] md:px-10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">Talk to us</div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              Tell us about your <span className="italic text-crimson">practice.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink/70 md:text-lg">
              Number of attorneys, annual O-1A / EB-1A / NIW volume, and the billing model that fits. We reply within one business day, from a real inbox — no drip sequence, no sales cadence.
            </p>

            <div className="mt-8 space-y-2 text-sm text-ink/70">
              <p>Or email us directly:</p>
              <a href="mailto:lawyers@visaworker.ai" className="font-semibold text-crimson hover:text-crimson-deep">
                lawyers@visaworker.ai
              </a>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>

      <footer className="border-t border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-ink/60 md:px-10">
          <p className="tracking-wide">
            © {new Date().getFullYear()} visaworker.ai · Not legal advice · Your data stays yours.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/" className="hover:text-crimson">Home</Link>
            <Link to="/terms" className="hover:text-crimson">Terms</Link>
            <Link to="/privacy" className="hover:text-crimson">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({
  tag,
  title,
  price,
  subtitle,
  body,
  items,
  highlight,
}: {
  tag: string;
  title: string;
  price: string;
  subtitle: string;
  body: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`border p-8 shadow-plate md:p-10 ${
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
      <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-ink/50">{subtitle}</p>
      <p className="mt-5 font-serif text-2xl text-crimson">{price}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/70">{body}</p>
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

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8">
      <Icon className="h-6 w-6 text-crimson" strokeWidth={1.5} />
      <h3 className="mt-4 font-serif text-xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
    </div>
  );
}

function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const send = useServerFn(sendLawyerInquiry);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (!name || !email) {
      toast.error("Please add your name and work email.");
      return;
    }
    setSubmitting(true);
    track("for_lawyers_inquiry_submitted");
    try {
      await send({ data: { name, email } });
      setDone(true);
      toast.success("Thanks — we'll be in touch shortly.");
    } catch (err) {
      console.error("[lawyer-inquiry] send failed", err);
      toast.error("Something went wrong. Please email lawyers@visaworker.ai directly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="border border-ink/15 bg-paper p-8 shadow-plate md:p-10">
        <h3 className="font-serif text-2xl text-ink">Got it. Thank you.</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          Your inquiry landed in our inbox. We'll follow up within one business day at the
          work email you provided.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-ink/15 bg-paper p-8 shadow-plate md:p-10"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required maxLength={200} />
        </div>
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className="mt-6 h-12 w-full rounded-none bg-navy px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-paper hover:bg-navy-deep sm:w-auto"
      >
        {submitting ? "Sending…" : "Send inquiry"}
        <ArrowUpRight className="ml-1.5 h-4 w-4" />
      </Button>
      <p className="mt-3 text-xs text-ink/50">
        We'll reply from lawyers@visaworker.ai. No newsletter, no drip sequence.
      </p>
    </form>
  );
}

function ZigRow({
  eyebrow,
  title,
  body,
  bullets,
  mock,
  reverse,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
      <div className={reverse ? "md:order-2" : ""}>
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">{eyebrow}</div>
        <h2 className="mt-4 font-serif text-3xl leading-[1.1] text-ink sm:text-4xl md:text-[44px]">
          {title}
        </h2>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink/70 md:text-[17px]">{body}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[15px] text-ink/85">
              <Check className="mt-1 h-4 w-4 shrink-0 text-crimson" strokeWidth={3} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "md:order-1" : ""}>{mock}</div>
    </div>
  );
}

function MockFrame({
  children,
  dark,
  tag,
}: {
  children: React.ReactNode;
  dark?: boolean;
  tag: string;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2px] opacity-50 blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.78 0.13 82 / 0.22), transparent 70%)" }}
      />
      <div
        className={`relative border shadow-plate ${
          dark ? "border-navy-deep bg-navy text-paper" : "border-ink/15 bg-paper text-ink"
        }`}
      >
        <div
          className={`flex items-center justify-between border-b px-4 py-2.5 ${
            dark ? "border-paper/10 bg-navy-deep" : "border-ink/10 bg-parchment"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${dark ? "bg-paper/20" : "bg-ink/15"}`} />
            <span className={`h-2.5 w-2.5 rounded-full ${dark ? "bg-paper/20" : "bg-ink/15"}`} />
            <span className={`h-2.5 w-2.5 rounded-full ${dark ? "bg-paper/20" : "bg-ink/15"}`} />
          </div>
          <div
            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
              dark ? "text-paper/50" : "text-ink/50"
            }`}
          >
            {tag}
          </div>
          <div className="w-10" />
        </div>
        {children}
      </div>
    </div>
  );
}

function DraftMock() {
  return (
    <MockFrame tag="drafts / o-1a · cover letter">
      <div className="p-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/50">
          <PenLine className="h-3 w-3 text-crimson" /> Extraordinary ability · § 214.2(o)
        </div>
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-ink/85">
          Dr. Iyer's sustained international acclaim is evidenced by{" "}
          <span className="bg-gold/25 px-0.5">seven peer-reviewed publications cited over 4,200 times</span>,
          two international awards from bodies with a global candidate pool, and invitations to judge at
          three top-tier venues.
        </p>
        <div className="mt-4 space-y-2">
          <div className="h-2 w-11/12 rounded-full bg-ink/10" />
          <div className="h-2 w-10/12 rounded-full bg-ink/10" />
          <div className="h-2 w-9/12 rounded-full bg-ink/10" />
        </div>
        <div className="mt-5 border-l-2 border-crimson bg-crimson/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-crimson">
            <Sparkles className="h-3 w-3" /> RFE-proofing
          </div>
          <p className="mt-1 font-serif text-[13px] italic leading-snug text-ink/80">
            "Cite the 2023 AAO decision on original contributions here — mirrors your fact pattern."
          </p>
        </div>
      </div>
    </MockFrame>
  );
}

function DashboardMock() {
  return (
    <MockFrame dark tag="firm dashboard · 24 active matters">
      <div className="grid grid-cols-[120px_1fr]">
        <aside className="border-r border-paper/10 p-4">
          <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-paper/40">Filter</div>
          <ul className="space-y-2 text-[11px] text-paper/70">
            <li className="font-semibold text-gold">All (24)</li>
            <li>O-1A · 11</li>
            <li>EB-1A · 8</li>
            <li>NIW · 5</li>
            <li className="pt-2 text-paper/40">RFE risk ↑</li>
          </ul>
        </aside>
        <div className="p-4">
          {[
            { name: "Iyer, A.", type: "O-1A", who: "MW", risk: "Low", pct: 82, tone: "text-gold" },
            { name: "Chen, L.", type: "EB-1A", who: "JR", risk: "Med", pct: 54, tone: "text-paper" },
            { name: "Okafor, N.", type: "NIW", who: "MW", risk: "Low", pct: 91, tone: "text-gold" },
            { name: "Silva, R.", type: "O-1A", who: "AK", risk: "High", pct: 38, tone: "text-crimson" },
          ].map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-3 border-b border-paper/10 py-2.5 text-[11px] last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[14px] text-paper">{r.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-paper/40">{r.type}</div>
              </div>
              <div className="hidden w-14 text-[10px] uppercase tracking-widest text-paper/50 sm:block">
                {r.who}
              </div>
              <div className={`w-12 text-[10px] font-bold uppercase tracking-widest ${r.tone}`}>{r.risk}</div>
              <div className="w-20">
                <div className="h-1 w-full bg-paper/10">
                  <div className="h-full bg-gold" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockFrame>
  );
}

function PdfMock() {
  return (
    <MockFrame tag="compile · kessler & partners · o-1a binder">
      <div className="grid grid-cols-[1fr_140px] gap-0">
        <div className="border-r border-ink/10 p-6">
          <div className="mx-auto aspect-[3/4] max-w-[280px] border border-ink/15 bg-paper p-6 shadow-plate">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-crimson" />
              <div className="font-serif text-[13px] text-ink">Kessler &amp; Partners</div>
            </div>
            <div className="mt-8 font-serif text-[22px] leading-tight text-navy">
              Petition for
              <br />
              <span className="italic text-crimson">O-1A Nonimmigrant</span>
            </div>
            <div className="mt-2 font-serif text-[13px] text-ink/70">Dr. Anaya Iyer</div>
            <div className="mt-10 h-px w-1/3 bg-gold" />
            <div className="mt-2 text-[9px] uppercase tracking-[0.2em] text-ink/50">
              Volume I · Legal brief &amp; exhibits
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink/40">Tabs</div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-ink/70">
            <li>A · Cover letter</li>
            <li>B · Awards</li>
            <li>C · Publications</li>
            <li>D · Citations</li>
            <li>E · Press</li>
            <li>F · Judging</li>
            <li>G · Salary</li>
            <li className="pt-2 font-mono text-[10px] text-ink/40">142 pp · 3.4 MB</li>
          </ul>
        </div>
      </div>
    </MockFrame>
  );
}

