// Token meter + top-up / unlock button. Fetches project_billing and renders a
// compact progress bar. When budget is exhausted (paid case) or the free-tier
// caps are hit, use <BudgetExhaustedCard /> instead.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createTopupCheckout, getProjectBilling, unlockCaseCheckout } from "@/ee";
import {
  CASE_PRICE_CENTS,
  DEFAULT_CASE_TOKEN_BUDGET,
  FREE_MESSAGE_LIMIT,
  NUDGE_THRESHOLD,
  TOPUP_PRICE_CENTS,
  TOPUP_TOKEN_AMOUNT,
  formatTokens,
} from "@/ee";
import { Lock, Zap } from "lucide-react";
import { ByokPanel } from "@/components/workspace/ByokPanel";

export function useProjectBilling(projectId: string) {
  const fetchBilling = useServerFn(getProjectBilling);
  return useQuery({
    queryKey: ["project_billing", projectId],
    queryFn: () => fetchBilling({ data: { project_id: projectId } }),
    refetchInterval: 15_000,
  });
}

export function useTopupCheckout(projectId: string) {
  const startCheckout = useServerFn(createTopupCheckout);
  return useMutation({
    mutationFn: async () => startCheckout({ data: { project_id: projectId } }),
    onSuccess: (res) => {
      if ("bypass" in res && res.bypass) {
        toast.success(`+${(TOPUP_TOKEN_AMOUNT / 1_000_000).toFixed(0)}M tokens (bypass)`);
        return;
      }
      if ("url" in res && res.url) window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnlockCheckout(projectId: string) {
  const startCheckout = useServerFn(unlockCaseCheckout);
  return useMutation({
    mutationFn: async () => startCheckout({ data: { project_id: projectId } }),
    onSuccess: (res) => {
      if ("bypass" in res && res.bypass) {
        toast.success("Case unlocked (bypass)");
        return;
      }
      if ("url" in res && res.url) window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function BudgetRing({
  projectId,
  size = 20,
  stroke = 2.5,
  children,
}: {
  projectId: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const { data } = useProjectBilling(projectId);
  if (!data) return children ? <>{children}</> : null;

  const isFree = data.status === "free";
  const isBypass = data.status === "bypass";

  let pct = 0;
  let tooltip = "";

  if (isFree) {
    const used = Math.min(Number(data.free_messages_used ?? 0), FREE_MESSAGE_LIMIT);
    pct = FREE_MESSAGE_LIMIT > 0 ? used / FREE_MESSAGE_LIMIT : 0;
    tooltip = `${used} of ${FREE_MESSAGE_LIMIT} free preview messages used`;
  } else if (!isBypass) {
    const budget = Math.max(Number(data.token_budget ?? DEFAULT_CASE_TOKEN_BUDGET), 1);
    const used = Math.min(Number(data.tokens_used ?? 0), budget);
    pct = budget > 0 ? used / budget : 0;
    tooltip = `${formatTokens(used)} / ${formatTokens(budget)} tokens used`;
  }

  if (isBypass) {
    tooltip = "Unlimited budget";
  }

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(pct, 1));
  const center = size / 2;

  let colorClass = "text-muted-foreground";
  if (!isBypass) {
    if (pct >= 0.9) colorClass = "text-destructive";
    else if (pct >= 0.7) colorClass = "text-crimson";
    else if (pct >= 0.4) colorClass = "text-navy";
  }

  const ring = (
    <div
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      aria-label={!children ? tooltip : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/60"
        />
        {!isBypass && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={colorClass}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
              transition: "stroke-dashoffset 0.4s ease",
            }}
          />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
      {isBypass && !children && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] leading-none text-muted-foreground">
          ∞
        </span>
      )}
    </div>
  );

  if (children) return ring;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{ring}</TooltipTrigger>
        <TooltipContent side="right" className="text-[11px]">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TokenMeter({ projectId }: { projectId: string }) {
  const { data } = useProjectBilling(projectId);
  const topup = useTopupCheckout(projectId);
  const unlock = useUnlockCheckout(projectId);
  if (!data) return null;
  const isFree = data.status === "free";
  const isBypass = data.status === "bypass";

  if (isFree) {
    const usedMsgs = Number(data.free_messages_used ?? 0);
    return (
      <div className="flex flex-col gap-2 rounded-md border border-crimson/25 bg-crimson/5 p-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-crimson">
            <Lock className="h-3 w-3" /> Free preview
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {usedMsgs}<span className="opacity-50">/</span>{FREE_MESSAGE_LIMIT}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => unlock.mutate()}
          disabled={unlock.isPending}
          className="h-7 w-full text-xs"
        >
          {unlock.isPending ? "…" : `Unlock — $${(CASE_PRICE_CENTS / 100).toFixed(0)}`}
        </Button>
        <ByokPanel projectId={projectId} compact />
      </div>
    );
  }


  const budget = Number(data.token_budget ?? DEFAULT_CASE_TOKEN_BUDGET);
  const used = Number(data.tokens_used ?? 0);
  const pct = budget > 0 ? Math.min(used / budget, 1) : 0;
  // Only surface the meter as the case nears its budget. Stay out of the way otherwise.
  if (pct < NUDGE_THRESHOLD || isBypass) return null;
  const barColor = pct >= 0.9 ? "bg-red-500" : "bg-navy";

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatTokens(used)}<span className="opacity-50"> / </span>{formatTokens(budget)}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => topup.mutate()}
          disabled={topup.isPending}
          className="h-6 gap-1 px-2 text-[11px]"
        >
          <Zap className="h-3 w-3" />
          {topup.isPending ? "…" : `Top up $${(TOPUP_PRICE_CENTS / 100).toFixed(0)}`}
        </Button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}



export function BudgetExhaustedCard({ projectId }: { projectId: string }) {
  const { data } = useProjectBilling(projectId);
  const topup = useTopupCheckout(projectId);
  const unlock = useUnlockCheckout(projectId);
  const isFree = data?.status === "free";

  if (isFree) {
    return (
      <div className="mb-3 rounded-lg border border-navy/30 bg-navy/5 p-4">
        <p className="font-serif text-base text-navy">
          Free preview limit reached
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You've used your {FREE_MESSAGE_LIMIT} free assistant messages on this petition.
          Unlock the case for <strong>${(CASE_PRICE_CENTS / 100).toFixed(0)}</strong> to keep
          drafting, get the full {(DEFAULT_CASE_TOKEN_BUDGET / 1_000_000).toFixed(0)}M-token budget,
          and download your PDF, source files, and exhibits.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button size="sm" onClick={() => unlock.mutate()} disabled={unlock.isPending}>
            <Lock className="mr-1 h-3.5 w-3.5" />
            {unlock.isPending ? "Redirecting…" : `Unlock — $${(CASE_PRICE_CENTS / 100).toFixed(0)}`}
          </Button>
          <ByokPanel projectId={projectId} compact />
        </div>
      </div>
    );
  }

  if (data?.ai_mode === "byok") {
    // Managed budget doesn't apply — user's key is footing the bill.
    return null;
  }


  return (
    <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4">
      <p className="font-serif text-base text-red-700 dark:text-red-400">
        Case budget exhausted
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Your assistant has used all included tokens for this petition. Top up{" "}
        <strong>+{(TOPUP_TOKEN_AMOUNT / 1_000_000).toFixed(0)}M tokens for ${(TOPUP_PRICE_CENTS / 100).toFixed(0)}</strong>{" "}
        to keep drafting. PDF preview, exhibits, and letters still work.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Button size="sm" onClick={() => topup.mutate()} disabled={topup.isPending}>
          <Zap className="mr-1 h-3.5 w-3.5" />
          {topup.isPending ? "Redirecting…" : `Top up $${(TOPUP_PRICE_CENTS / 100).toFixed(0)}`}
        </Button>
        <ByokPanel projectId={projectId} compact />
      </div>
    </div>
  );
}
