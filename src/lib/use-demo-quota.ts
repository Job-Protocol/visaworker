// Client-side, per-browser message quota for the shared /demo account.
// This is a friction gate, not a security control: incognito / devtools /
// clearing storage bypasses it. The real backstop is the case token budget
// on the server. We just want casual visitors to sign up after a few turns.
//
// The quota resets on the same quarter-hour boundary as the demo reset
// (see DemoBanner) — so the counter mental model matches "resets in NMIN".
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isDemoUser } from "./demo-config";

export const DEMO_MESSAGE_LIMIT = 3;
const STORAGE_KEY = "vw_demo_msg_quota_v1";

type Stored = { window: number; count: number };

// Same 15-minute grid as pg_cron reset / DemoBanner countdown.
function currentWindow(now = new Date()): number {
  return Math.floor(now.getTime() / (15 * 60 * 1000));
}

function read(): Stored {
  if (typeof window === "undefined") return { window: currentWindow(), count: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { window: currentWindow(), count: 0 };
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.window !== currentWindow()) return { window: currentWindow(), count: 0 };
    return parsed;
  } catch {
    return { window: currentWindow(), count: 0 };
  }
}

function write(next: Stored) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore — private mode, etc.
  }
}

export function useDemoQuota() {
  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: 60_000,
  });
  const isDemo = isDemoUser(userId);

  const [state, setState] = useState<Stored>(() => read());

  // Roll over when the 15-min window ticks so a returning session starts fresh.
  useEffect(() => {
    if (!isDemo) return;
    const id = window.setInterval(() => {
      const w = currentWindow();
      setState((prev) => (prev.window === w ? prev : { window: w, count: 0 }));
    }, 15_000);
    return () => window.clearInterval(id);
  }, [isDemo]);

  const increment = useCallback(() => {
    if (!isDemo) return;
    setState((prev) => {
      const w = currentWindow();
      const base = prev.window === w ? prev : { window: w, count: 0 };
      const next = { window: w, count: base.count + 1 };
      write(next);
      return next;
    });
  }, [isDemo]);

  const count = isDemo ? state.count : 0;
  const exhausted = isDemo && count >= DEMO_MESSAGE_LIMIT;

  return { isDemo, count, limit: DEMO_MESSAGE_LIMIT, exhausted, increment };
}
