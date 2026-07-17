import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

// Compute ms until the next quarter-hour boundary (:00, :15, :30, :45) —
// that's when pg_cron re-seeds the shared demo project.
function msUntilNextReset(now: Date) {
  const next = new Date(now);
  const m = now.getMinutes();
  const nextQuarter = Math.floor(m / 15) * 15 + 15;
  next.setMinutes(nextQuarter, 0, 0);
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}MIN`;
}

// Thin ribbon shown above the workspace when the current user is the shared
// demo account. Reminds visitors that edits are visible to everyone and
// shows a live countdown to the next reset (every 15 minutes).
export function DemoBanner() {
  const [remaining, setRemaining] = useState(() => msUntilNextReset(new Date()));

  useEffect(() => {
    const tick = () => setRemaining(msUntilNextReset(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative z-30 flex h-8 shrink-0 items-center justify-between gap-3 border-b border-crimson/40 bg-crimson px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Shared live demo on Elon Musk · resets in{" "}
          <span className="tabular-nums normal-case tracking-normal">
            {formatCountdown(remaining)}
          </span>
        </span>
      </div>
      <Link
        to="/auth"
        className="flex shrink-0 items-center gap-1 rounded-sm bg-paper/15 px-2 py-0.5 hover:bg-paper/25"
      >
        Open your own case
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
