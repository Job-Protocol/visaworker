// Capture UTM params + fbclid from the URL on first visit and persist to a
// 90-day cookie so attribution survives across pages, signup, and checkout.
// Client-only.

const COOKIE_NAME = "vw_attrib";
const COOKIE_DAYS = 90;

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  landing_path?: string;
  first_seen?: string;
};

function writeCookie(name: string, value: string, days: number) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; samesite=lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAttribution(): Attribution | null {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return null;
  }
}

/**
 * Run once on app boot. If URL carries utm_* or fbclid, capture them.
 * Preserves the first-touch attribution: existing cookie wins.
 */
export function captureAttributionFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const existing = getAttribution();
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const captured: Attribution = {};
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) captured[key] = v;
    }
    const fbclid = params.get("fbclid");
    if (fbclid) captured.fbclid = fbclid;

    // Nothing new — keep first-touch untouched.
    if (Object.keys(captured).length === 0) return;

    // First-touch attribution: don't overwrite an existing cookie.
    if (existing) return;

    captured.landing_path = url.pathname;
    captured.first_seen = new Date().toISOString();
    writeCookie(COOKIE_NAME, JSON.stringify(captured), COOKIE_DAYS);
  } catch {
    /* ignore */
  }
}
