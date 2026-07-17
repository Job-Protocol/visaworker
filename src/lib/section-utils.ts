// Small helpers shared by the Sections sidebar and command palette.

const LATEX_MACRO_RE = /\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g;
const LATEX_ENV_RE = /\\begin\{[^}]*\}|\\end\{[^}]*\}/g;
const LATEX_COMMENT_RE = /(^|[^\\])%[^\n]*/g;

export function wordCountFromTex(tex: string | null | undefined): number {
  if (!tex) return 0;
  const cleaned = tex
    .replace(LATEX_COMMENT_RE, "$1")
    .replace(LATEX_ENV_RE, " ")
    .replace(LATEX_MACRO_RE, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
}


// "just now" / "2m ago" / "3h ago" / "Apr 4"
export function relTimeShort(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isRecentAgentEdit(
  updatedAt: string,
  source: string | null,
  now = Date.now(),
  windowMs = 10_000,
): boolean {
  if (!source || source === "manual_edit") return false;
  const t = new Date(updatedAt).getTime();
  return now - t < windowMs;
}
