import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestFirm } from "@/lib/firm-suggest.functions";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FirmLogo } from "@/components/FirmLogo";
import { track } from "@/ee";
import { fetchFirms, type Firm, type FirmKind, type Transparency } from "@/lib/firms";
import statueOfLibertyAsset from "@/assets/statue-of-liberty.jpg.asset.json";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  PenLine,
  Users,
  FileCheck2,
  MapPin,
  Search,
  X,
  BadgeCheck,
  Sparkles,
} from "lucide-react";

const firmsQuery = queryOptions({
  queryKey: ["firms"],
  queryFn: fetchFirms,
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/find-a-lawyer")({
  component: FindALawyer,
  loader: ({ context }) => context.queryClient.ensureQueryData(firmsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-paper p-10 text-ink">
      <p className="font-serif text-2xl">Couldn't load the firm directory.</p>
      <p className="mt-2 text-sm text-ink/60">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-10">Not found.</div>,
  head: () => {
    const title = "Immigration lawyer cost — compare O-1, EB-1A & NIW firms";
    const description =
      "Compare immigration lawyer fees for O-1, EB-1A and NIW petitions. Published prices, offices, and partner discounts side by side.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://visaworker.ai/find-a-lawyer" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { property: "og:image", content: "https://visaworker.ai/og-image.png" },
      ],
      links: [{ rel: "canonical", href: "https://visaworker.ai/find-a-lawyer" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://visaworker.ai/" },
              {
                "@type": "ListItem",
                position: 2,
                name: "Find an immigration lawyer",
                item: "https://visaworker.ai/find-a-lawyer",
              },
            ],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does an immigration lawyer cost for an O-1, EB-1A, or NIW petition?",
    a: "Legal fees for O-1, EB-1A, and NIW petitions typically range from about $6,000 at transparent boutique firms to $15,000+ at large full-service firms, plus USCIS government filing fees (roughly $1,015 for an EB-1A or NIW self-petition; O-1 fees vary by employer). Prices below are each firm's own published figure — many firms will not quote a number without a sales call.",
  },
  {
    q: "What's usually included in a flat immigration legal fee?",
    a: "A flat fee normally covers strategy, drafting the petition letter, preparing exhibits, filing with USCIS, and responding to Requests for Evidence (RFEs). Some firms bundle USCIS government filing fees into the flat rate; others charge legal fees only and pass filing fees through at cost. Always confirm what's included before signing.",
  },
  {
    q: "Why do so few firms publish prices?",
    a: "Immigration cases vary in complexity, so most firms prefer to quote only after a paid or unpaid consultation. That makes comparison shopping hard. This directory only lists a firm's own published figure where one exists, and flags every row as 'Published', 'Partial', 'Estimate', or 'Quote only' so you can tell what's really on offer.",
  },
  {
    q: "Can I file an O-1, EB-1A, or NIW petition without a lawyer?",
    a: "Yes. EB-1A and NIW allow self-petitioning, and O-1 can be filed by an employer or agent without outside counsel. Many petitioners draft the packet themselves — with or without AI tooling — and hire a lawyer only for review and filing, which is much cheaper than a full-service engagement.",
  },
  {
    q: "How does the VisaWorker partner rate work?",
    a: "You draft the petition in VisaWorker for a published software price. If you hand the completed draft to a network partner firm to review and file, that partner offers at least a 15% discount off their standard flat fee. Partners are independent law firms; they collect their fee directly.",
  },
];

/** Everything below is shared with the visa hub routes. */
export { MarketDirectory, VISA_FILTERS };
export type { VisaFilter };


const PARTNER_MIN_DISCOUNT = 15;

const KIND_LABEL: Record<FirmKind, string> = {
  boutique: "Boutique firm",
  big: "Big firm",
  platform: "Platform",
  "new-wave": "New wave",
};

const TRANSPARENCY_LABEL: Record<Transparency, string> = {
  published: "Published price",
  partial: "Partial / tiered",
  estimate: "Third-party estimate",
  quote: "Quote only",
};

const TRANSPARENCY_DOT: Record<Transparency, string> = {
  published: "bg-crimson",
  partial: "bg-navy",
  estimate: "bg-gold",
  quote: "bg-ink/30",
};

function FindALawyer() {
  return (
    <div className="relative min-h-screen bg-paper text-ink">
      <div className="h-1 w-full bg-gradient-to-r from-navy via-paper to-crimson" />

      <SiteHeader
        current="find-a-lawyer"
        cta={{ label: "Start your petition", shortLabel: "Start", href: "/auth" }}
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
        <img
          src={statueOfLibertyAsset.url}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[-16%] top-1/2 hidden h-[90%] w-auto -translate-y-1/2 select-none object-contain opacity-[0.12] grayscale lg:right-[-8%] lg:block lg:opacity-[0.16]"
          style={{
            maskImage: "linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 85%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 85%)",
          }}
        />
        <div className="relative mx-auto max-w-[1100px] px-6 pt-20 pb-20 text-center md:px-10 md:pt-28 md:pb-24">
          <div className="mx-auto flex max-w-[560px] items-center gap-4 text-[10px] font-bold uppercase tracking-[0.32em] text-ink/50">
            <span className="h-px flex-1 bg-ink/20" />
            <span>Compare the market · Get a partner rate</span>
            <span className="h-px flex-1 bg-ink/20" />
          </div>

          <h1 className="mx-auto mt-10 max-w-[920px] font-serif text-[40px] leading-[1.05] text-ink sm:text-[56px] md:text-[68px] md:leading-[1.02]">
            How much does an immigration lawyer cost for O-1, EB-1A & NIW?
          </h1>

          <p className="mx-auto mt-8 max-w-[640px] font-serif text-lg italic leading-relaxed text-ink/75 md:text-[22px] md:leading-[1.5]">
            Draft your O-1, EB-1A, or NIW petition here for a transparent, published
            price — then hand it to a network partner who files it at a partner rate.
          </p>

          <div className="mx-auto mt-8 max-w-[620px]">
            <div className="mx-auto h-px w-16 bg-gold" />
            <p className="mt-6 text-[15px] leading-relaxed text-ink/70 md:text-[16px]">
              Most of the market won't even tell you a number without a sales call.
              We put every firm in one table, marked partners, and made it filterable.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="shine-btn group h-14 rounded-none bg-crimson px-8 text-[12px] font-bold uppercase tracking-[0.2em] text-paper shadow-[6px_6px_0_0_var(--navy)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[8px_8px_0_0_var(--navy)]"
            >
              <Link to="/auth" onClick={() => track("find_lawyer_hero_cta_clicked")}>
                Start drafting free
                <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <a
              href="#market"
              className="group inline-flex h-14 items-center gap-2 border-2 border-ink/20 bg-paper px-6 text-[12px] font-bold uppercase tracking-[0.2em] text-ink transition-all hover:border-ink hover:bg-ink hover:text-paper"
            >
              Jump to firm directory
              <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
            </a>
          </div>

        </div>
      </section>

      {/* Three steps */}
      <section className="border-b border-ink/10 bg-parchment/40 py-24 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10">
          <div className="mb-14 max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">
              How this works
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              You draft. <span className="italic text-crimson">They review and file.</span> You save money.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink/70 md:text-lg">
              visaworker.ai builds the petition. An independent lawyer reviews and files it.
              You pay a flat software price plus a discounted attorney fee — instead of one
              opaque five-figure bill that bundles both.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              icon={PenLine}
              step="01"
              title="You draft with the agent"
              body="An AI agent that knows the adjudication standard drafts your letters, exhibits, and packet. A published software price — not a five-figure legal fee."
            />
            <StepCard
              icon={FileCheck2}
              step="02"
              title="They review and file"
              body={`Choose a network partner (or bring your own attorney) to review the draft and file with USCIS. Because the drafting is done, partners honor a partner rate — at least ${PARTNER_MIN_DISCOUNT}% below their standard fee.`}
            />
            <StepCard
              icon={Users}
              step="03"
              title="You save money"
              body="Compare the whole market below before you commit. Prices are shown in the open, grouped by kind and flagged by how transparent each firm is — no sales call required to find a number."
              highlight
            />
          </div>


          <div className="mt-10 max-w-3xl border-l-2 border-crimson bg-crimson/[0.04] px-5 py-4">
            <p className="text-[15px] font-medium leading-relaxed text-ink">
              Partner rows appear in the same directory as everyone else — flagged, not
              floated. Toggle the "Partners only" filter to see the shortlist. We refuse
              to hide the market you're comparing against.
            </p>
          </div>
        </div>
      </section>

      {/* The market table */}
      <section id="market" className="scroll-mt-24 bg-paper py-24 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="mb-10 max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
              The market, mapped
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              What an O-1, EB-1A, or NIW <span className="italic text-crimson">actually costs.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink/70 md:text-lg">
              Every price below is the firm's own published figure. Some flat fees bundle in
              USCIS filing costs; others cover legal work only and pass government fees through
              at cost. Always confirm what's included before you sign — in this market, the
              price itself matters less than whether you can find one at all.
            </p>
          </div>

          <MarketDirectory />

          <p className="mt-5 text-xs leading-relaxed text-ink/50">
            Fees are each firm's own published figure where one exists, or "quote-only" where
            none is posted. Headquarters, offices, founding year, and success rates are as each
            firm states them (rates are self-reported and unaudited). Ranges vary with case
            complexity, city, and RFE risk; nothing here is a quote for a specific case.
            Non-partner firms shown for comparison and not affiliated with VisaWorker.
            Partner firms are independent law practices we list for your convenience; we do not
            endorse them, supervise their work, or guarantee any outcome, and we do not receive
            referral fees or kickbacks. See our{" "}
            <Link to="/terms" className="underline decoration-ink/30 hover:text-crimson">
              Terms of Service
            </Link>{" "}
            for full details.
          </p>
        </div>
      </section>

      {/* FAQ (also emitted as FAQPage JSON-LD) */}
      <section id="faq" className="scroll-mt-24 border-t border-ink/10 bg-parchment/40 py-24 md:py-28">
        <div className="mx-auto max-w-[900px] px-6 md:px-10">
          <div className="max-w-2xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
              Common questions
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.05] text-ink sm:text-4xl md:text-5xl">
              What people ask about <span className="italic text-crimson">immigration lawyer costs.</span>
            </h2>
          </div>
          <div className="mt-10 divide-y divide-ink/10 border-t border-b border-ink/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
                  <h3 className="font-serif text-lg leading-snug text-ink md:text-xl">{f.q}</h3>
                  <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-ink/50 transition-transform group-open:rotate-180 group-open:text-crimson" />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/75">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Lawyer recruitment strip */}
      <section className="border-t border-ink/10 bg-navy py-20 text-paper md:py-24">
        <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-8 px-6 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="max-w-2xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              For immigration attorneys
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-[1.08] text-paper sm:text-4xl">
              Become a founding partner.
            </h2>

            <p className="mt-4 text-[15px] leading-relaxed text-paper/75 md:text-base">
              Get warm, pre-drafted, pre-qualified cases — and offer VisaWorker members your
              partner rate. No per-lead fees, no fee-splitting: petitioners pay you directly.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="shine-btn group h-14 shrink-0 rounded-none bg-crimson px-8 text-[12px] font-bold uppercase tracking-[0.2em] text-paper shadow-[6px_6px_0_0_var(--paper)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[8px_8px_0_0_var(--paper)]"
          >
            <Link to="/for-lawyers" onClick={() => track("find_lawyer_partner_cta_clicked")}>
              Apply to partner
              <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Button>

        </div>
      </section>

      <SiteFooter
        links={[
          { label: "Home", to: "/" },
          { label: "For lawyers", to: "/for-lawyers" },
          { label: "Terms", to: "/terms" },
          { label: "Privacy", to: "/privacy" },
        ]}
      />

      <style>{`
        .shine-btn { position: relative; overflow: hidden; }
        .shine-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: -75%;
          height: 100%;
          width: 50%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.28), transparent);
          transform: skewX(-20deg);
          transition: left 700ms cubic-bezier(0.2, 0.7, 0.2, 1);
          pointer-events: none;
        }
        .shine-btn:hover::after { left: 130%; }

        .gold-sweep {
          background-image: linear-gradient(
            90deg,
            currentColor 0%,
            currentColor 40%,
            var(--navy) 50%,
            currentColor 60%,
            currentColor 100%
          );
          background-size: 200% 100%;
          background-position: 100% 0;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .group:hover .gold-sweep { animation: navySweep 1.4s ease-in-out; }
        @keyframes navySweep {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .shine-btn::after, .gold-sweep { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  );
}


/* ────────────────────────────── Directory ────────────────────────────── */

type SortKey = "sort_order" | "name" | "price" | "founded";
type SortDir = "asc" | "desc";
type KindFilter = "all" | FirmKind;

const VISA_FILTERS = ["O-1", "EB-1A", "NIW"] as const;
type VisaFilter = (typeof VISA_FILTERS)[number];

function MarketDirectory({ presetVisa }: { presetVisa?: VisaFilter } = {}) {
  const { data: firms = [] } = useQuery(firmsQuery);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [visas, setVisas] = useState<VisaFilter[]>(presetVisa ? [presetVisa] : []);
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [partnersOnly, setPartnersOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);


  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const rows = firms.filter((f) => {
      if (kind !== "all" && f.kind !== kind) return false;
      if (publishedOnly && f.transparency !== "published" && f.transparency !== "partial")
        return false;
      if (partnersOnly && !f.is_partner) return false;
      if (visas.length > 0) {
        const set = f.visa_types.map((v) => v.toUpperCase());
        const hit = visas.some((v) => set.some((s) => s.includes(v)));
        if (!hit) return false;
      }
      if (q) {
        const hay = `${f.name} ${f.hq ?? ""} ${f.offices ?? ""} ${f.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "price": {
          const av = a.price_low_usd ?? Number.POSITIVE_INFINITY;
          const bv = b.price_low_usd ?? Number.POSITIVE_INFINITY;
          if (av === bv) return a.name.localeCompare(b.name);
          return (av - bv) * dir;
        }
        case "founded": {
          const av = a.founded_year ?? (sortDir === "asc" ? 9999 : 0);
          const bv = b.founded_year ?? (sortDir === "asc" ? 9999 : 0);
          if (av === bv) return a.name.localeCompare(b.name);
          return (av - bv) * dir;
        }
        default:
          if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
          return (a.sort_order - b.sort_order) * dir;
      }
    });

    return sorted;
  }, [firms, kind, visas, publishedOnly, partnersOnly, q, sortKey, sortDir]);

  const partnerCount = firms.filter((f) => f.is_partner).length;
  const totalCount = firms.length;
  const activeFilterCount =
    (kind !== "all" ? 1 : 0) +
    (visas.length > 0 ? 1 : 0) +
    (publishedOnly ? 1 : 0) +
    (partnersOnly ? 1 : 0) +
    (q ? 1 : 0);

  function toggleVisa(v: VisaFilter) {
    setVisas((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "sort_order" ? "asc" : "asc");
    }
  }

  function resetFilters() {
    setQuery("");
    setKind("all");
    setVisas([]);
    setPublishedOnly(false);
    setPartnersOnly(false);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 border border-ink/15 bg-parchment/60 p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          {/* Search */}
          <label className="block">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/50">
              Search
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Firm name, city, or focus…"
                className="w-full border border-ink/20 bg-paper py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none placeholder:text-ink/40 focus:border-crimson"
              />
            </div>
          </label>

          {/* Kind */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/50">Kind</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["all", "boutique", "big", "new-wave"] as KindFilter[]).map((k) => (
                <ChipButton key={k} active={kind === k} onClick={() => setKind(k)}>
                  {k === "all" ? "All" : k === "boutique" ? "Boutiques" : k === "big" ? "Big firms" : "New wave"}
                </ChipButton>
              ))}
            </div>
          </div>

          {/* Visa multi */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/50">Visa</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VISA_FILTERS.map((v) => (
                <ChipButton key={v} active={visas.includes(v)} onClick={() => toggleVisa(v)}>
                  {v}
                </ChipButton>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
          <ToggleCheck checked={publishedOnly} onChange={setPublishedOnly}>
            Published prices only
          </ToggleCheck>
          <ToggleCheck checked={partnersOnly} onChange={setPartnersOnly}>
            <span className="inline-flex items-center gap-1.5">
              VisaWorker partners
              <span className="border border-crimson bg-crimson/10 px-1 py-px font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-crimson">
                {partnerCount}
              </span>
            </span>
          </ToggleCheck>

          <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">
            <span>
              {filtered.length} of {totalCount} firms
            </span>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-crimson hover:text-crimson-deep"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table (md+) */}
      <div className="hidden overflow-x-auto border border-ink/15 bg-paper shadow-plate md:block">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-ink/15 bg-parchment text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">
              <SortableTh
                label="Firm"
                sortKey="name"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="px-4 py-4 md:px-6"
              />
              <th className="px-4 py-4 md:px-6">HQ · offices</th>
              <SortableTh
                label="Price"
                sortKey="price"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                className="px-4 py-4 md:px-6"
              />
              <th className="w-[1%] px-4 py-4 md:px-6" aria-label="Expand" />
            </tr>
          </thead>
          <tbody className="text-[14px]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-[13px] text-ink/50 md:px-6">
                  No firms match those filters.{" "}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-crimson underline hover:text-crimson-deep"
                  >
                    Reset filters
                  </button>
                  .
                </td>
              </tr>
            ) : (
              filtered.map((f) => (
                <FirmRow
                  key={f.id}
                  firm={f}
                  isOpen={expanded === f.id}
                  onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Card list (mobile) */}
      <div className="space-y-3 md:hidden">
        {/* Mobile sort */}
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/55">
          <span>Sort</span>
          <div className="flex flex-wrap justify-end gap-1.5">
            {(
              [
                { k: "sort_order" as SortKey, label: "Featured" },
                { k: "name" as SortKey, label: "A–Z" },
                { k: "price" as SortKey, label: "Price" },
                { k: "founded" as SortKey, label: "Founded" },
              ]
            ).map(({ k, label }) => {
              const active = sortKey === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleSort(k)}
                  className={`inline-flex items-center gap-1 border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                    active
                      ? "border-crimson text-crimson"
                      : "border-ink/20 text-ink/60"
                  }`}
                >
                  {label}
                  {active ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
                    ) : (
                      <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
                    )
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border border-ink/15 bg-paper px-4 py-10 text-center text-[13px] text-ink/50">
            No firms match those filters.{" "}
            <button
              type="button"
              onClick={resetFilters}
              className="text-crimson underline hover:text-crimson-deep"
            >
              Reset filters
            </button>
            .
          </div>
        ) : (
          filtered.map((f) => (
            <FirmCard
              key={f.id}
              firm={f}
              isOpen={expanded === f.id}
              onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
            />
          ))
        )}
      </div>

      <SuggestFirmForm />
    </>
  );
}

function SortableTh({
  label,
  sortKey,
  current,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  const Icon = !active ? null : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1.5 uppercase tracking-[0.2em] transition-colors ${
          active ? "text-crimson" : "text-ink/55 hover:text-ink"
        }`}
      >
        {label}
        {Icon ? <Icon className="h-3 w-3" strokeWidth={2.5} /> : null}
      </button>
    </th>
  );
}

function SuggestFirmForm() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err" | "dup"; text: string } | null>(null);
  const suggest = useServerFn(suggestFirm);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (u: string) => suggest({ data: { url: u } }),
    onSuccess: (res) => {
      if (res.ok) {
        setMessage({
          kind: "ok",
          text: `Added "${res.firm.name}" to the directory. Thanks — it's live below.`,
        });
        setUrl("");
        qc.invalidateQueries({ queryKey: ["firms"] });
      } else if (res.reason === "duplicate") {
        setMessage({
          kind: "dup",
          text: `"${res.firm.name}" is already listed.`,
        });
      }
    },
    onError: (e) => {
      setMessage({
        kind: "err",
        text: e instanceof Error ? e.message : "Something went wrong.",
      });
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    let normalized = trimmed;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      new URL(normalized);
    } catch {
      setMessage({ kind: "err", text: "That doesn't look like a valid URL." });
      return;
    }
    track("find_lawyer_suggest_submitted", { host: new URL(normalized).hostname });
    mut.mutate(normalized);
  }

  return (
    <div className="mt-10 border border-ink/15 bg-parchment px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-navy">
            Missing a firm?
          </div>
          <h3 className="mt-3 font-serif text-2xl leading-[1.15] text-ink md:text-3xl">
            Suggest an <span className="italic text-crimson">immigration firm</span>.
          </h3>
          <p className="mt-3 text-[14px] leading-relaxed text-ink/70">
            Paste the firm's website. We fetch the page, pull out name, offices, and
            published pricing, and add it to the directory. US immigration law firms only.
          </p>
        </div>
        <form onSubmit={onSubmit} className="w-full max-w-md md:shrink-0">
          <label htmlFor="firm-url" className="sr-only">
            Firm website URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="firm-url"
              type="url"
              inputMode="url"
              placeholder="https://example-immigration.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={mut.isPending}
              className="min-w-0 flex-1 border border-ink/25 bg-paper px-3 py-3 text-[14px] text-ink outline-none focus:border-crimson"
              required
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={mut.isPending || !url.trim()}
              className="shine-btn h-[46px] shrink-0 rounded-none bg-crimson px-5 text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-[4px_4px_0_0_var(--navy)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[6px_6px_0_0_var(--navy)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_var(--navy)]"
            >
              {mut.isPending ? "Reviewing site…" : "Add firm"}
            </Button>

          </div>
          {mut.isPending ? (
            <p className="mt-3 text-[12px] text-ink/55">
              Fetching the page and extracting details — usually 10–20 seconds.
            </p>
          ) : null}
          {message ? (
            <p
              className={`mt-3 text-[13px] leading-relaxed ${
                message.kind === "ok"
                  ? "text-emerald-700"
                  : message.kind === "dup"
                    ? "text-ink/70"
                    : "text-crimson"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-crimson bg-crimson text-paper"
          : "border-ink/20 bg-paper text-ink/70 hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[12px] text-ink/75 hover:text-ink">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
          checked ? "border-crimson bg-crimson text-paper" : "border-ink/30 bg-paper"
        }`}
        aria-hidden
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

function FirmRow({
  firm: f,
  isOpen,
  onToggle,
}: {
  firm: Firm;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const partnerBorder = f.is_partner ? "border-l-2 border-l-crimson" : "border-l-2 border-l-transparent";
  return (
    <>
      <tr
        className={`group cursor-pointer border-b border-ink/10 transition-colors hover:bg-parchment/60 ${partnerBorder} ${
          isOpen ? "bg-parchment/60" : ""
        }`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <th scope="row" className="px-4 py-4 text-left align-top md:px-6">
          <div className="flex items-start gap-3">
            <FirmLogo href={f.website_url} name={f.name} logoUrl={f.logo_url} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-[16px] leading-tight text-ink group-hover:text-crimson">
                  {f.name}
                </span>
              </div>

              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/45">
                {KIND_LABEL[f.kind]}
                {f.founded_year ? <> · Est. {f.founded_year}</> : null}
              </div>
              {f.notes ? (
                <p className="mt-1 line-clamp-2 max-w-[42ch] text-[12.5px] font-normal leading-snug text-ink/60">
                  {f.notes}
                </p>
              ) : null}
            </div>
          </div>
        </th>
        <td className="px-4 py-4 align-top md:px-6">
          {f.hq ? (
            <div className="inline-flex items-start gap-1.5 text-[13px] text-ink/75">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" />
              <div>
                <div>{f.hq}</div>
                {f.offices && f.offices !== "—" ? (
                  <div className="text-[11.5px] text-ink/50">{f.offices}</div>
                ) : null}
              </div>
            </div>
          ) : (
            <span className="text-ink/40">—</span>
          )}
        </td>
        <td className="px-4 py-4 align-top md:px-6">
          <div className={f.transparency === "quote" ? "text-ink/60" : "text-ink/90"}>
            {f.price_label}
          </div>
          <div className="mt-1 inline-flex items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-ink/50">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TRANSPARENCY_DOT[f.transparency]}`} />
            {TRANSPARENCY_LABEL[f.transparency]}
          </div>
          {f.is_partner ? (
            <div className="mt-2 flex items-center gap-1 self-start whitespace-nowrap bg-crimson px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-paper">
              <BadgeCheck className="h-3 w-3" /> Partner
              {f.partner_discount_label ? ` · ${f.partner_discount_label}` : ""}
            </div>
          ) : null}
        </td>

        <td className="px-4 py-4 text-right align-top md:px-6">
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 text-ink/30 transition-transform ${
              isOpen ? "rotate-180 text-crimson" : ""
            }`}
            strokeWidth={2}
          />
        </td>
      </tr>
      {isOpen ? (
        <tr className={`border-b border-ink/10 bg-parchment/40 ${partnerBorder}`}>
          <td colSpan={4} className="px-4 py-6 md:px-8">
            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
              <div>
                {f.notes ? (
                  <p className="max-w-3xl text-[14px] leading-relaxed text-ink/75">{f.notes}</p>
                ) : null}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <DetailCell label="Founded" value={f.founded_year ?? "—"} />
                  <DetailCell label="Headquarters" value={f.hq ?? "—"} />
                  <DetailCell label="Offices" value={f.offices ?? "—"} />
                  <DetailCell label="Focus" value={f.visa_types.join(" · ") || "—"} />
                  <DetailCell label="Fee" value={f.price_label} />
                  <DetailCell label="Success rate" value={f.success_rate_label ?? "Not published"} />
                </div>

                {f.website_url ? (
                  <a
                    href={f.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-crimson hover:text-crimson-deep"
                  >
                    Visit firm <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>

              {f.is_partner ? (
                <aside className="border border-crimson/40 bg-crimson/[0.04] p-5">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">
                    <Sparkles className="h-3 w-3" /> VisaWorker partner
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink/80">
                    {f.partner_blurb ?? f.notes ?? ""}
                  </p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-serif text-2xl text-crimson">
                      {f.partner_discount_label ?? `≥ ${PARTNER_MIN_DISCOUNT}% off`}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-ink/50">
                      partner rate
                    </span>
                  </div>
                  <Button
                    asChild
                    className="shine-btn group mt-5 h-11 w-full rounded-none bg-crimson text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-[4px_4px_0_0_var(--navy)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[6px_6px_0_0_var(--navy)]"
                  >
                    <Link
                      to="/auth"
                      onClick={() => track("find_lawyer_partner_row_cta_clicked", { firm: f.slug })}
                    >
                      Talk to this partner
                      <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </aside>
              ) : (
                <aside className="border border-ink/15 bg-paper p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/50">
                    Prefer a partner rate?
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink/70">
                    Draft your petition in VisaWorker, then file with a network partner at least
                    {" "}
                    {PARTNER_MIN_DISCOUNT}% below their standard fee.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="group mt-5 h-11 w-full rounded-none border-2 border-ink/20 bg-paper text-[11px] font-bold uppercase tracking-[0.2em] text-ink transition-all hover:border-ink hover:bg-ink hover:text-paper"
                  >
                    <Link to="/auth">Start free draft</Link>
                  </Button>
                </aside>
              )}

            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function FirmCard({
  firm: f,
  isOpen,
  onToggle,
}: {
  firm: Firm;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const partnerBorder = f.is_partner ? "border-l-2 border-l-crimson" : "";
  return (
    <div className={`border border-ink/15 bg-paper shadow-plate ${partnerBorder}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 text-left"
      >
        <FirmLogo href={f.website_url} name={f.name} logoUrl={f.logo_url} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-serif text-[16px] leading-tight text-ink">{f.name}</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
            {KIND_LABEL[f.kind]}
            {f.hq ? <> · {f.hq}</> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[13px] font-medium text-ink/90">{f.price_label}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-ink/50">
              <span className={`h-1.5 w-1.5 rounded-full ${TRANSPARENCY_DOT[f.transparency]}`} />
              {TRANSPARENCY_LABEL[f.transparency]}
            </span>
            {f.is_partner ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap bg-crimson px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-paper">
                <BadgeCheck className="h-3 w-3" /> Partner
                {f.partner_discount_label ? ` · ${f.partner_discount_label}` : ""}
              </span>
            ) : null}
          </div>

        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-ink/40 transition-transform ${
            isOpen ? "rotate-180 text-crimson" : ""
          }`}
          strokeWidth={2}
        />
      </button>

      {isOpen ? (
        <div className="border-t border-ink/10 bg-parchment/40 px-4 py-5">
          {f.notes ? (
            <p className="text-[13.5px] leading-relaxed text-ink/75">{f.notes}</p>
          ) : null}

          <div className="mt-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">
              Focus
            </div>
            <div className="mt-1.5">
              <VisaChips visas={f.visa_types} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <DetailCell label="Founded" value={f.founded_year ?? "—"} />
            <DetailCell label="Offices" value={f.offices ?? "—"} />
            <DetailCell label="Fee" value={f.price_label} />
            <DetailCell
              label="Success rate"
              value={f.success_rate_label ?? "Not published"}
            />
          </div>

          {f.is_partner ? (
            <div className="mt-5 border border-crimson/40 bg-crimson/[0.04] p-4">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">
                <Sparkles className="h-3 w-3" /> VisaWorker partner
              </div>
              {f.partner_blurb ? (
                <p className="mt-2 text-[13px] leading-relaxed text-ink/80">
                  {f.partner_blurb}
                </p>
              ) : null}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-serif text-xl text-crimson">
                  {f.partner_discount_label ?? `≥ ${PARTNER_MIN_DISCOUNT}% off`}
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink/50">
                  partner rate
                </span>
              </div>
              <Button
                asChild
                className="shine-btn group mt-4 h-11 w-full rounded-none bg-crimson text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-[4px_4px_0_0_var(--navy)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[6px_6px_0_0_var(--navy)]"
              >
                <Link
                  to="/auth"
                  onClick={() =>
                    track("find_lawyer_partner_row_cta_clicked", { firm: f.slug })
                  }
                >
                  Talk to this partner
                  <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </Button>

            </div>
          ) : null}

          {f.website_url ? (
            <a
              href={f.website_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-crimson hover:text-crimson-deep"
            >
              Visit firm <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


function DetailCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">{label}</div>
      <div className="mt-1 text-[13px] text-ink/85">{value}</div>
    </div>
  );
}

function VisaChips({ visas }: { visas: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {visas.map((v) => (
        <span
          key={v}
          className="border border-ink/15 bg-paper px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/70"
        >
          {v}
        </span>
      ))}
    </div>
  );
}


function StepCard({
  icon: Icon,
  step,
  title,
  body,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  step: string;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden border p-8 shadow-plate transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(10,20,50,0.35)] md:p-10 ${
        highlight ? "border-crimson bg-paper" : "border-ink/15 bg-paper"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex h-10 w-10 items-center justify-center border border-navy/25 bg-parchment transition-all duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3 group-hover:border-crimson">
          <Icon className="h-5 w-5 text-navy transition-colors group-hover:text-crimson" strokeWidth={1.5} />
        </span>
        <span className="gold-sweep font-mono text-[11px] uppercase tracking-[0.2em] text-ink/35">{step}</span>
      </div>
      <h3 className="mt-5 font-serif text-2xl leading-tight text-ink">{title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{body}</p>
    </div>
  );

}
