import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, BadgeCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { FirmLogo } from "@/components/FirmLogo";
import { fetchFirmBySlug, type Firm } from "@/lib/firms";
import { track } from "@/ee";

const firmQuery = (slug: string) =>
  queryOptions({
    queryKey: ["firm", slug],
    queryFn: async () => {
      const firm = await fetchFirmBySlug(slug);
      if (!firm) throw notFound();
      return firm;
    },
    staleTime: 5 * 60_000,
  });

const KIND_LABEL = {
  boutique: "Boutique immigration firm",
  big: "Full-service (Big Law)",
  platform: "Immigration platform",
  "new-wave": "New wave immigration platform",
} as const;

function clampDescription(text: string, max = 155): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function firmSummary(firm: Firm): string {
  const bits: string[] = [];
  bits.push(firm.price_label);
  if (firm.hq) bits.push(firm.hq);
  const visas = firm.visa_types.slice(0, 3).join(", ");
  if (visas) bits.push(visas);
  return bits.join(" · ");
}

export const Route = createFileRoute("/find-a-lawyer/$slug")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(firmQuery(params.slug)),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-paper p-10 text-ink">
      <p className="font-serif text-2xl">Couldn't load that firm.</p>
      <p className="mt-2 text-sm text-ink/60">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader
        current="find-a-lawyer"
        cta={{ label: "Start your petition", shortLabel: "Start", href: "/auth" }}
      />
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Firm not found</h1>
        <p className="mt-4 text-ink/70">
          That firm isn't listed in the directory.{" "}
          <Link to="/find-a-lawyer" className="text-crimson underline hover:text-crimson-deep">
            Back to the directory
          </Link>
          .
        </p>
      </div>
    </div>
  ),
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Firm not found — visaworker.ai" }, { name: "robots", content: "noindex" }],
      };
    }
    const firm = loaderData as Firm;
    const url = `https://visaworker.ai/find-a-lawyer/${params.slug}`;
    const title = `${firm.name} — immigration lawyer cost & fees`;
    const description = clampDescription(
      firm.notes
        ? `${firm.notes} ${firmSummary(firm)}.`
        : `${firm.name}: ${firmSummary(firm)}. Compare with other O-1, EB-1A, and NIW firms on visaworker.ai.`,
    );
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LegalService",
            name: firm.name,
            url: firm.website_url ?? url,
            areaServed: "US",
            serviceType: firm.visa_types
              .map((v) => `${v} visa petition`)
              .concat("US immigration law"),
            address: firm.hq ? { "@type": "PostalAddress", addressLocality: firm.hq } : undefined,
            foundingDate: firm.founded_year ? String(firm.founded_year) : undefined,
            priceRange:
              firm.price_low_usd && firm.price_high_usd
                ? `$${firm.price_low_usd.toLocaleString()}–$${firm.price_high_usd.toLocaleString()}`
                : firm.price_label,
            description: firm.notes ?? undefined,
          }),
        },
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
              { "@type": "ListItem", position: 3, name: firm.name, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: FirmDetail,
});

function FirmDetail() {
  const firm = Route.useLoaderData() as Firm;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="h-1 w-full bg-gradient-to-r from-navy via-paper to-crimson" />
      <SiteHeader
        current="find-a-lawyer"
        cta={{ label: "Start your petition", shortLabel: "Start", href: "/auth" }}
      />

      <nav className="mx-auto max-w-[900px] px-6 pt-8 text-[11px] uppercase tracking-[0.18em] text-ink/55 md:px-10">
        <Link to="/find-a-lawyer" className="hover:text-crimson">
          ← All firms
        </Link>
      </nav>

      <header className="mx-auto max-w-[900px] px-6 pt-6 pb-4 md:px-10">
        <div className="flex flex-wrap items-start gap-5">
          <FirmLogo href={firm.website_url} name={firm.name} logoUrl={firm.logo_url} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink/50">
              {KIND_LABEL[firm.kind]}
              {firm.founded_year ? <> · Est. {firm.founded_year}</> : null}
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-ink md:text-5xl">
              {firm.name}
            </h1>
            {firm.hq ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[14px] text-ink/70">
                <MapPin className="h-4 w-4 text-ink/45" />
                {firm.hq}
                {firm.offices && firm.offices !== "—" ? (
                  <span className="text-ink/50"> · {firm.offices}</span>
                ) : null}
              </p>
            ) : null}
            {firm.is_partner ? (
              <div className="mt-4 inline-flex items-center gap-1.5 bg-crimson px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-paper">
                <BadgeCheck className="h-3.5 w-3.5" /> VisaWorker partner
                {firm.partner_discount_label ? ` · ${firm.partner_discount_label}` : ""}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[900px] px-6 py-8 md:px-10">
        {firm.notes ? (
          <p className="max-w-2xl text-[16px] leading-relaxed text-ink/80">{firm.notes}</p>
        ) : null}

        <dl className="mt-10 grid gap-6 border-t border-ink/10 pt-8 sm:grid-cols-2 md:grid-cols-3">
          <DetailBlock label="Legal fee">
            <div className="font-serif text-xl text-ink">{firm.price_label}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink/50">
              {firm.transparency === "published"
                ? "Published"
                : firm.transparency === "partial"
                  ? "Partial / tiered"
                  : firm.transparency === "estimate"
                    ? "Third-party estimate"
                    : "Quote only"}
            </div>
          </DetailBlock>
          <DetailBlock label="Visa focus">
            {firm.visa_types.length > 0 ? firm.visa_types.join(" · ") : "Not specified"}
          </DetailBlock>
          <DetailBlock label="Success rate">
            {firm.success_rate_label ?? "Not published"}
          </DetailBlock>
          <DetailBlock label="Founded">{firm.founded_year ?? "—"}</DetailBlock>
          <DetailBlock label="Headquarters">{firm.hq ?? "—"}</DetailBlock>
          <DetailBlock label="Offices">{firm.offices ?? "—"}</DetailBlock>
        </dl>

        {firm.website_url ? (
          <a
            href={firm.website_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("firm_detail_website_clicked", { firm: firm.slug })}
            className="mt-8 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-crimson hover:text-crimson-deep"
          >
            Visit {firm.name} <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </section>

      {firm.is_partner ? (
        <aside className="border-y border-crimson/30 bg-crimson/[0.04] py-12">
          <div className="mx-auto max-w-[900px] px-6 md:px-10">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">
              <Sparkles className="h-3 w-3" /> Partner rate
            </div>
            <h2 className="mt-3 font-serif text-2xl text-ink md:text-3xl">
              Draft in VisaWorker, file with {firm.name}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/75">
              {firm.partner_blurb ??
                `${firm.name} honors a VisaWorker partner rate — at least 15% below their standard flat fee — on petitions you draft here first.`}
            </p>
            <Button
              asChild
              className="mt-6 h-12 rounded-none bg-crimson px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-paper hover:bg-crimson-deep"
            >
              <Link
                to="/auth"
                onClick={() => track("firm_detail_partner_cta_clicked", { firm: firm.slug })}
              >
                Start a draft
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      ) : (
        <aside className="border-t border-ink/10 bg-parchment/60 py-12">
          <div className="mx-auto max-w-[900px] px-6 md:px-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">
              Want a partner rate instead?
            </div>
            <h2 className="mt-3 font-serif text-2xl text-ink md:text-3xl">
              Draft with VisaWorker, file with a network partner
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/70">
              Network partner firms honor at least a 15% discount off their standard flat fee on
              petitions drafted here first — a cheaper way to get an attorney's name on the filing.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-6 h-12 rounded-none border-ink/25 bg-paper px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-ink hover:border-crimson hover:bg-paper hover:text-crimson"
            >
              <Link to="/find-a-lawyer">See partner firms</Link>
            </Button>
          </div>
        </aside>
      )}

      <footer className="border-t border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-ink/60 md:px-10">
          <p className="tracking-wide">
            © {new Date().getFullYear()} visaworker.ai · Not legal advice · Non-partner listings
            shown for comparison and not affiliated with VisaWorker.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/" className="hover:text-crimson">Home</Link>
            <Link to="/find-a-lawyer" className="hover:text-crimson">All firms</Link>
            <Link to="/for-lawyers" className="hover:text-crimson">For lawyers</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">{label}</dt>
      <dd className="mt-2 text-[14px] leading-relaxed text-ink/85">{children}</dd>
    </div>
  );
}
