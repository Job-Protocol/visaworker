import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { AccountReferralCallout, LawyerIntroSection } from "@/ee";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { track } from "@/ee";
import {
  getAccountOverview,
  createTopupCheckout,
  unlockCaseCheckout,
} from "@/ee";
import {
  CASE_PRICE_CENTS,
  DEFAULT_CASE_TOKEN_BUDGET,
  TOPUP_PRICE_CENTS,
  TOPUP_TOKEN_AMOUNT,
  formatTokens,
} from "@/ee";

export const Route = createFileRoute("/_authenticated/account/")({
  head: () => ({
    meta: [
      { title: "Account — visaworker.ai" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const fetchOverview = useServerFn(getAccountOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["account_overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <AppShell title="Account">
      <div className="mx-auto max-w-4xl space-y-10 px-6 py-12">
        <header className="border-b border-border pb-6">
          <span className="eyebrow text-crimson">Account</span>
          <h1 className="mt-2 font-serif text-4xl text-navy">Your account & billing</h1>
        </header>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <ProfileSection email={data.email} bypass={data.profile.bypass_billing} />
            <AccountReferralCallout />
            <CasesSection projects={data.projects ?? []} />
            <LawyerIntroSection projects={data.projects ?? []} />
            <HistorySection events={data.events ?? []} projects={data.projects ?? []} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProfileSection({ email, bypass }: { email: string | null; bypass: boolean }) {
  return (
    <section className="border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl text-navy">Profile</h2>
        {bypass && (
          <Badge variant="outline" className="border-navy/60 text-navy">
            Bypass — no billing
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{email ?? "No email on file"}</p>
    </section>
  );
}

type ProjectRow = {
  id: string;
  name: string;
  visa_type: string;
  beneficiary_name: string | null;
  created_at: string;
  project_billing: {
    status: string | null;
    token_budget: number | null;
    tokens_used: number | null;
    paid_at: string | null;
    amount_cents: number | null;
    currency: string | null;
  } | null;
};

function CasesSection({ projects }: { projects: ProjectRow[] }) {
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="mb-4 font-serif text-2xl text-navy">Cases</h2>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cases yet.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <CaseRow key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function CaseRow({ project }: { project: ProjectRow }) {
  const b = project.project_billing;
  const budget = Number(b?.token_budget ?? DEFAULT_CASE_TOKEN_BUDGET);
  const used = Number(b?.tokens_used ?? 0);
  const pct = budget > 0 ? Math.min(used / budget, 1) : 0;
  const status = b?.status ?? "unknown";
  const isFree = status === "free";

  const topup = useServerFn(createTopupCheckout);
  const unlock = useServerFn(unlockCaseCheckout);
  const topupMut = useMutation({
    mutationFn: () => {
      track("topup_started", { project_id: project.id });
      return topup({ data: { project_id: project.id } });
    },
    onSuccess: (res) => {
      if ("bypass" in res && res.bypass) {
        track("topup_completed", { project_id: project.id, source: "bypass" });
        toast.success("Top-up applied (bypass)");
        return;
      }
      if ("url" in res && res.url) window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlockMut = useMutation({
    mutationFn: () => {
      track("checkout_started", { kind: "unlock", project_id: project.id });
      return unlock({ data: { project_id: project.id } });
    },
    onSuccess: (res) => {
      if ("bypass" in res && res.bypass) {
        track("checkout_completed", { kind: "unlock", project_id: project.id, source: "bypass" });
        toast.success("Case unlocked (bypass)");
        return;
      }
      if ("url" in res && res.url) window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const barColor = pct >= 0.9 ? "bg-red-500" : pct >= 0.7 ? "bg-navy" : "bg-navy";
  const statusBadge = ({
    paid: "border-green-500/50 text-green-700",
    bypass: "border-navy/60 text-navy",
    refunded: "border-red-500/50 text-red-700",
    pending: "border-muted-foreground/40 text-muted-foreground",
    free: "border-crimson/50 text-crimson",
  } as Record<string, string>)[status] ?? "border-muted-foreground/40 text-muted-foreground";

  return (
    <div className="flex flex-col gap-3 border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        to="/projects/$id"
        params={{ id: project.id }}
        className="min-w-0 flex-1 rounded-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-navy/50"
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-navy/30 text-navy">{project.visa_type}</Badge>
          <span className="font-serif text-lg text-navy truncate">{project.name}</span>
          <Badge variant="outline" className={statusBadge}>{status}</Badge>
        </div>
        {project.beneficiary_name && (
          <p className="mt-1 font-serif italic text-muted-foreground">In re: {project.beneficiary_name}</p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {formatTokens(used)} / {formatTokens(budget)} tokens
          </span>
        </div>
      </Link>
      {isFree ? (
        <Button
          size="sm"
          onClick={() => unlockMut.mutate()}
          disabled={unlockMut.isPending}
          className="bg-navy text-paper hover:bg-navy-deep"
        >
          {unlockMut.isPending ? "…" : `Subscribe — $${(CASE_PRICE_CENTS / 100).toFixed(0)}`}
        </Button>
      ) : status !== "refunded" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => topupMut.mutate()}
          disabled={topupMut.isPending}
        >
          {topupMut.isPending ? "…" : `Top up +${(TOPUP_TOKEN_AMOUNT / 1_000_000).toFixed(0)}M ($${(TOPUP_PRICE_CENTS / 100).toFixed(0)})`}
        </Button>
      )}
    </div>
  );
}

function HistorySection({
  events,
  projects,
}: {
  events: Array<{ id: string; type: string; amount_cents: number | null; currency: string | null; created_at: string; project_id: string | null }>;
  projects: ProjectRow[];
}) {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="mb-4 font-serif text-2xl text-navy">Payment history</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="pb-2">Date</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Case</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="py-2 font-mono text-xs">
                  {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                </td>
                <td className="py-2 capitalize">{e.type}</td>
                <td className="py-2 truncate">{(e.project_id && nameById.get(e.project_id)) || "—"}</td>
                <td className="py-2 text-right font-mono">
                  {e.amount_cents != null
                    ? `${(e.amount_cents / 100).toLocaleString("en-US", { style: "currency", currency: (e.currency ?? "usd").toUpperCase() })}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
