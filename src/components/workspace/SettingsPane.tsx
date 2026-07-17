import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Clock, Mail, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TokenMeter, useProjectBilling } from "@/components/workspace/TokenMeter";
import { ByokPanel } from "@/components/workspace/ByokPanel";
import { DEMO_PROJECT_ID } from "@/lib/demo-config";
import { deleteProject } from "@/lib/projects.functions";
import {
  requestLawyerIntro,
  getMyLawyerIntroRequests,
} from "@/ee";
import { track } from "@/ee";
import { formatTokens } from "@/ee";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function SettingsPane({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isDemo = projectId === DEMO_PROJECT_ID;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: billing } = useProjectBilling(projectId);

  const fetchIntros = useServerFn(getMyLawyerIntroRequests);
  const { data: introData } = useQuery({
    queryKey: ["lawyer_intro_requests"],
    queryFn: () => fetchIntros(),
  });
  const introForThisCase = useMemo(
    () => (introData?.requests ?? []).find((r) => r.project_id === projectId),
    [introData, projectId],
  );

  // Lawyer intro dialog
  const submitIntro = useServerFn(requestLawyerIntro);
  const [introOpen, setIntroOpen] = useState(false);
  const [introNote, setIntroNote] = useState("");
  const introMut = useMutation({
    mutationFn: () => {
      track("lawyer_intro_requested", { project_id: projectId });
      return submitIntro({
        data: { project_id: projectId, note: introNote.trim() || undefined },
      });
    },
    onSuccess: () => {
      toast.success("Request sent — we'll be in touch shortly.");
      setIntroNote("");
      setIntroOpen(false);
      qc.invalidateQueries({ queryKey: ["lawyer_intro_requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete confirmation
  const runDelete = useServerFn(deleteProject);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const deleteMut = useMutation({
    mutationFn: () => runDelete({ data: { project_id: projectId } }),
    onSuccess: () => {
      toast.success("Case deleted.");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.removeQueries({ queryKey: ["project", projectId] });
      navigate({ to: "/projects", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const status = billing?.status;
  const statusLabel =
    status === "bypass"
      ? "Unlimited"
      : status === "paid"
        ? "Paid"
        : status === "free"
          ? "Free preview"
          : status ?? "—";
  const statusClass =
    status === "paid" || status === "bypass"
      ? "border-navy/60 text-navy"
      : "border-crimson/50 text-crimson";

  const budget = Number(billing?.token_budget ?? 0);
  const used = Number(billing?.tokens_used ?? 0);
  const remaining = Math.max(budget - used, 0);

  const nameMatches = confirmText.trim() === (project?.name ?? "").trim();

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <header className="relative border-b border-border pb-4">
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
          aria-label="Close settings"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Case settings
        </p>
        <h1 className="mt-1 font-serif text-2xl text-ink">
          {project?.name ?? "Case"}
        </h1>
      </header>

      {/* Overview */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 font-serif text-lg text-navy">Overview</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Visa type">
            {project?.visa_type ? (
              <Badge variant="outline" className="border-navy/60 text-navy">
                {project.visa_type}
              </Badge>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Status">
            <Badge variant="outline" className={statusClass}>
              {statusLabel}
            </Badge>
          </Field>
          <Field label="Beneficiary">{project?.beneficiary_name || "—"}</Field>
          <Field label="Field">{project?.field || "—"}</Field>
          <Field label="Started" icon={<Calendar className="h-3.5 w-3.5" />}>
            {formatDate(project?.created_at)}
          </Field>
          <Field label="Last updated" icon={<Clock className="h-3.5 w-3.5" />}>
            {formatDate(project?.updated_at)}
          </Field>
        </dl>
      </section>

      {/* Budget */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 font-serif text-lg text-navy">Budget &amp; usage</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Tokens power the assistant's drafting, exhibit reads, and compiles.
        </p>

        {status && status !== "free" && status !== "bypass" && (
          <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Budget" value={formatTokens(budget)} />
            <Stat label="Used" value={formatTokens(used)} />
            <Stat label="Remaining" value={formatTokens(remaining)} />
          </dl>
        )}
        {status === "bypass" && (
          <p className="mb-4 text-sm text-muted-foreground">
            This case has an unlimited budget.
          </p>
        )}

        <TokenMeter projectId={projectId} />

        {billing?.paid_at && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Unlocked on {formatDate(billing.paid_at)}
          </p>
        )}
      </section>

      {/* AI provider */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 font-serif text-lg text-navy">AI provider</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          By default we handle the model bill (part of your $249 unlock). Prefer to pay Anthropic directly? Paste your own key and this case becomes free forever.
        </p>
        <ByokPanel projectId={projectId} />
      </section>


      {/* Lawyer intro */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 font-serif text-lg text-navy">
          Immigration lawyer
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          We can introduce you to a vetted attorney to review this case.
        </p>

        {introForThisCase ? (
          <div className="rounded-md border border-navy/20 bg-navy/5 p-3 text-sm text-navy">
            <div className="flex items-center gap-2 font-medium">
              <Mail className="h-4 w-4" /> Introduction requested
            </div>
            <p className="mt-1 text-xs text-navy/80">
              Requested on {formatDate(introForThisCase.created_at)} — we'll be
              in touch shortly.
            </p>
          </div>
        ) : (
          <Dialog open={introOpen} onOpenChange={setIntroOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isDemo}
                className="border-navy/60 text-navy hover:bg-navy/5 hover:text-navy"
              >
                Request an introduction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Talk to an immigration lawyer</DialogTitle>
                <DialogDescription>
                  We'll introduce you to a vetted attorney for this case. No
                  obligation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Anything specific? (optional)
                </label>
                <Textarea
                  value={introNote}
                  onChange={(e) => setIntroNote(e.target.value.slice(0, 500))}
                  placeholder="Timeline, prior filings, specific questions…"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-right font-mono text-[10px] text-muted-foreground">
                  {introNote.length}/500
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIntroOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => introMut.mutate()}
                  disabled={introMut.isPending}
                  className="bg-navy text-paper hover:bg-navy-deep"
                >
                  {introMut.isPending ? "Sending…" : "Send request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {isDemo && !introForThisCase && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Not available on the demo case.
          </p>
        )}
      </section>

      {/* Danger zone */}
      {!isDemo && (
        <div className="pt-4 pb-8">
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(o) => {
              setDeleteOpen(o);
              if (!o) setConfirmText("");
            }}
          >
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-destructive"
              >
                Delete this case
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this case?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to permanently delete{" "}
                  <span className="font-medium text-foreground">
                    {project?.name}
                  </span>{" "}
                  along with all of its sections, exhibits, letters, and chat
                  history.
                  <br />
                  <br />
                  <span className="font-medium text-destructive">
                    This action is irreversible and non-refundable.
                  </span>{" "}
                  Any tokens or budget already spent on this case will not be
                  returned.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Type the case name to confirm
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={project?.name ?? ""}
                  autoFocus
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!nameMatches || deleteMut.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (nameMatches) deleteMut.mutate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMut.isPending ? "Deleting…" : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
