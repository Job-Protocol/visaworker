import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { MarketDirectory, type VisaFilter } from "@/routes/find-a-lawyer";

export interface VisaHubCopy {
  visa: VisaFilter;
  h1: string;
  eyebrow: string;
  intro: string;
  body: string;
}

export function VisaHubPage({ copy }: { copy: VisaHubCopy }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="h-1 w-full bg-gradient-to-r from-navy via-paper to-crimson" />
      <SiteHeader
        current="find-a-lawyer"
        cta={{ label: "Start your petition", shortLabel: "Start", href: "/auth" }}
      />

      <nav className="mx-auto max-w-[1100px] px-6 pt-8 text-[11px] uppercase tracking-[0.18em] text-ink/55 md:px-10">
        <Link to="/find-a-lawyer" className="hover:text-crimson">
          ← All immigration firms
        </Link>
      </nav>

      <header className="mx-auto max-w-[1100px] px-6 pt-6 pb-12 md:px-10 md:pt-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">
          {copy.eyebrow}
        </div>
        <h1 className="mt-4 max-w-[900px] font-serif text-[40px] leading-[1.05] text-ink md:text-[56px] md:leading-[1.02]">
          {copy.h1}
        </h1>
        <p className="mt-6 max-w-[720px] font-serif text-lg italic leading-relaxed text-ink/75 md:text-[20px] md:leading-[1.55]">
          {copy.intro}
        </p>
        <p className="mt-6 max-w-[720px] text-[15px] leading-relaxed text-ink/70">
          {copy.body}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            className="h-12 rounded-none bg-crimson px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-paper hover:bg-crimson-deep"
          >
            <Link to="/auth">
              Start drafting free
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Link
            to="/find-a-lawyer"
            className="inline-flex h-12 items-center gap-2 border border-ink/25 bg-paper px-5 text-[11px] font-bold uppercase tracking-[0.2em] text-ink hover:border-crimson hover:text-crimson"
          >
            All firms
          </Link>
        </div>
      </header>

      <section className="border-t border-ink/10 bg-paper py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <MarketDirectory presetVisa={copy.visa} />
        </div>
      </section>

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

export function visaHubHead(params: { path: string; title: string; description: string }) {
  const url = `https://visaworker.ai${params.path}`;
  return {
    meta: [
      { title: params.title },
      { name: "description", content: params.description },
      { property: "og:title", content: params.title },
      { property: "og:description", content: params.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: params.title },
      { name: "twitter:description", content: params.description },
    ],
    links: [{ rel: "canonical", href: url }],
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
            { "@type": "ListItem", position: 3, name: params.title, item: url },
          ],
        }),
      },
    ],
  };
}
