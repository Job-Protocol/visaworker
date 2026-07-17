import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper text-foreground">
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-foreground/70 transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            visaworker.ai
          </Link>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/50">
            Legal
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-crimson">
          Last updated · {updated}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <div className="legal-prose mt-10">{children}</div>

        <div className="mt-16 flex items-center justify-between border-t border-foreground/10 pt-6 text-sm text-foreground/60">
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
          <a href="mailto:legal@visaworker.ai" className="hover:text-foreground">
            legal@visaworker.ai
          </a>
        </div>
      </main>

      <style>{`
        .legal-prose { color: color-mix(in oklab, var(--foreground) 82%, transparent); }
        .legal-prose h2 {
          font-family: var(--font-serif, ui-serif, Georgia, serif);
          font-size: 1.5rem;
          line-height: 1.25;
          color: var(--foreground);
          margin-top: 2.5rem;
          margin-bottom: 0.75rem;
        }
        .legal-prose h3 {
          font-weight: 600;
          font-size: 1rem;
          color: var(--foreground);
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
          letter-spacing: 0.01em;
        }
        .legal-prose p { margin: 0 0 1rem 0; line-height: 1.7; }
        .legal-prose ul { list-style: disc; padding-left: 1.25rem; margin: 0 0 1rem 0; }
        .legal-prose li { margin-bottom: 0.35rem; line-height: 1.65; }
        .legal-prose a { color: var(--crimson); text-decoration: underline; text-underline-offset: 3px; }
        .legal-prose strong { color: var(--foreground); }
      `}</style>
    </div>
  );
}
