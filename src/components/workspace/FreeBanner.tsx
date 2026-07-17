import { ArrowUpRight, Lock } from "lucide-react";
import { useProjectBilling, useUnlockCheckout } from "@/components/workspace/TokenMeter";
import { CASE_PRICE_CENTS, FREE_MESSAGE_LIMIT } from "@/ee";

// Thin ribbon shown above the workspace when the current project is on the
// free tier. Nudges the user to unlock the case for full access.
export function FreeBanner({ projectId }: { projectId: string }) {
  const { data: billing } = useProjectBilling(projectId);
  const unlock = useUnlockCheckout(projectId);
  const used = Number(billing?.free_messages_used ?? 0);
  const remaining = Math.max(0, FREE_MESSAGE_LIMIT - used);

  return (
    <div className="relative z-30 flex h-8 shrink-0 items-center justify-between gap-3 border-b border-crimson/40 bg-crimson px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Free preview · {remaining} message{remaining === 1 ? "" : "s"} left · unlock to draft, download, and file
        </span>
      </div>
      <button
        type="button"
        onClick={() => unlock.mutate()}
        disabled={unlock.isPending}
        className="flex shrink-0 items-center gap-1 rounded-sm bg-paper/15 px-2 py-0.5 hover:bg-paper/25 disabled:opacity-60"
      >
        {unlock.isPending ? "Opening…" : `Unlock $${(CASE_PRICE_CENTS / 100).toFixed(0)}`}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}
