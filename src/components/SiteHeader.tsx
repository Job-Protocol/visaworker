import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { SealMark } from "@/components/SealMark";
import { GitHubStarInline } from "@/components/GitHubStarButton";

type CurrentPage = "home" | "open-source" | "for-lawyers" | null;

interface SiteHeaderProps {
  current?: CurrentPage;
  cta?: {
    label: string;
    shortLabel?: string;
    href: string;
    external?: boolean;
  };
}

const DEFAULT_CTA = {
  label: "Start for free",
  shortLabel: "Start",
  href: "/auth",
  external: false,
};

/**
 * Two-tier editorial masthead used across all marketing pages.
 * Utility strip (GitHub · Open source · FAQ / For lawyers · Sign in) sits above
 * the main row with wordmark + primary anchors + CTA. Highlights the active page.
 */
export function SiteHeader({ current = null, cta = DEFAULT_CTA }: SiteHeaderProps) {
  const isActive = (page: CurrentPage) =>
    current === page ? "text-crimson" : "hover:text-ink";

  const primaryActive = (page: CurrentPage) =>
    current === page ? "text-crimson" : "text-ink/70 hover:text-crimson";

  const CtaLink = ({ className = "" }: { className?: string }) => {
    const inner = (
      <>
        <span>{cta.label}</span>
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </>
    );
    const classes = `group inline-flex items-center gap-2 rounded-none border-b-2 border-crimson-deep bg-crimson px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-paper shadow-none transition-all hover:-translate-y-px hover:bg-crimson-deep ${className}`;
    if (cta.external || cta.href.startsWith("#") || cta.href.startsWith("http")) {
      return (
        <a
          href={cta.href}
          className={classes}
          {...(cta.external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link to={cta.href} className={classes}>
        {inner}
      </Link>
    );
  };

  return (
    <header className="relative z-30 border-b border-ink/10 bg-paper/80 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10">
        {/* Utility strip */}
        <div className="hidden items-center justify-between border-b border-ink/5 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/55 md:flex">
          <div className="flex items-center gap-5">
            <GitHubStarInline />
            <span className="h-3 w-px bg-ink/10" aria-hidden />
            <Link
              to="/open-source"
              className="group inline-flex items-center gap-1 rounded-none border border-crimson/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-crimson transition-all hover:bg-crimson hover:text-paper"
            >
              Open source
              <ArrowUpRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <span className="h-3 w-px bg-ink/10" aria-hidden />
            <Link to="/" hash="faq" className="transition-colors hover:text-ink">
              FAQ
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/for-lawyers" className={`transition-colors ${isActive("for-lawyers")}`}>
              For lawyers
            </Link>
            <span className="h-3 w-px bg-ink/10" aria-hidden />
            <Link to="/auth" className="transition-colors hover:text-ink">
              Sign in
            </Link>
          </div>
        </div>

        {/* Main nav */}
        <div className="flex items-center justify-between gap-8 py-4 sm:py-5">
          <div className="flex items-center gap-10 lg:gap-14">
            <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SealMark className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
              <span className="truncate font-serif text-[20px] leading-none tracking-tight text-ink sm:text-[24px] md:text-[26px]">
                visaworker<span className="italic text-crimson">.ai</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-8 text-[12px] font-semibold uppercase tracking-[0.22em] lg:flex">
              <Link to="/" hash="how" className={`nav-link transition-colors ${primaryActive(null)}`}>
                Process
              </Link>
              <Link to="/" hash="what" className={`nav-link transition-colors ${primaryActive(null)}`}>
                Output
              </Link>
              <Link to="/" hash="pricing" className={`nav-link transition-colors ${primaryActive(null)}`}>
                Pricing
              </Link>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/auth"
              className="text-sm font-medium text-ink/70 hover:text-ink sm:block md:hidden"
            >
              Sign in
            </Link>
            {<CtaLink />}
          </div>
        </div>
      </div>
    </header>
  );
}
