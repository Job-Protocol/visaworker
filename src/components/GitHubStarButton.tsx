import { useEffect, useState } from "react";
import { Github, Star } from "lucide-react";

const REPO = "Job-Protocol/visaworker";

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function useStars() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const cached = typeof window !== "undefined" ? window.sessionStorage.getItem("gh-stars") : null;
    if (cached) setStars(Number(cached));
    fetch(`https://api.github.com/repos/${REPO}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const count = data.stargazers_count as number;
        setStars(count);
        try {
          window.sessionStorage.setItem("gh-stars", String(count));
        } catch {
          // sessionStorage can throw (quota, private mode) — caching is best-effort.
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return stars;
}

/** Compact inline "GitHub 1.2k" link — for editorial utility strips. */
export function GitHubStarInline({ className = "" }: { className?: string }) {
  const stars = useStars();
  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noreferrer"
      aria-label="View on GitHub"
      className={`group inline-flex items-center gap-1.5 transition-colors hover:text-crimson ${className}`}
    >
      <Github className="h-3 w-3" />
      <span>GitHub</span>
      <span className="ml-1 font-mono text-[10px] tracking-normal text-ink/40 group-hover:text-crimson/60">
        {stars !== null ? formatStars(stars) : "—"}
      </span>
    </a>
  );
}

/** Split "Star | count" pill — for standalone placements. */
export function GitHubStarButton({ className = "" }: { className?: string }) {
  const stars = useStars();
  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noreferrer"
      aria-label="View on GitHub"
      className={`group inline-flex items-stretch overflow-hidden rounded-md border border-ink/15 bg-paper text-ink shadow-sm transition-colors hover:border-ink/40 ${className}`}
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium">
        <Github className="h-4 w-4" />
        <span className="hidden sm:inline">Star</span>
      </span>
      <span className="flex items-center gap-1 border-l border-ink/15 bg-ink/[0.03] px-2.5 py-1.5 text-[12px] font-semibold tabular-nums">
        <Star className="h-3.5 w-3.5 text-ink/50 group-hover:text-crimson" />
        {stars !== null ? formatStars(stars) : "—"}
      </span>
    </a>
  );
}
