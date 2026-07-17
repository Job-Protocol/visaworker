import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { seedProjectSections } from "@/lib/templates.functions";
import { createCaseCheckout, createFreeProject, getProjectBySessionId } from "@/ee";
import { resolveReferralCode } from "@/ee";
import { CASE_PRICE_CENTS, FREE_MESSAGE_LIMIT } from "@/ee";
import { readRefCookie, REFERRAL_DISCOUNT_CENTS } from "@/ee";
import { track } from "@/ee";
import { fbTrack, getFbCookies } from "@/ee";
import { getAttribution } from "@/lib/utm";
import { setByokKey as setByokKeyFn } from "@/lib/ai-config.functions";


import { toast } from "sonner";



export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Petitions — visaworker.ai" },
      { name: "description", content: "Your active immigration petition workspaces." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { checkout?: string; session_id?: string } => ({
    checkout: (s.checkout as string | undefined) ?? undefined,
    session_id: (s.session_id as string | undefined) ?? undefined,
  }),
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pollSession = useServerFn(getProjectBySessionId);
  const seed = useServerFn(seedProjectSections);

  // Post-checkout polling: wait for webhook to create the project row.
  useEffect(() => {
    if (search.checkout === "cancel") {
      toast.info("Checkout canceled");
      router.navigate({ to: "/projects", search: {}, replace: true });
      return;
    }
    if (search.checkout !== "success" || !search.session_id) return;
    const sid = search.session_id;
    const t = toast.loading("Finalizing your case…");
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const res = await pollSession({ data: { session_id: sid } });
        if (res.ready && res.project_id) {
          try { await seed({ data: { projectId: res.project_id } }); } catch { /* non-fatal */ }
          track("checkout_completed", { kind: "case", project_id: res.project_id });
          // Meta Pixel Purchase — client-side. Dedupes with the CAPI event
          // via eventID (both sides use `stripe_${session_id}`).
          fbTrack("Purchase", { value: 249, currency: "USD", eventID: `stripe_${sid}` });
          toast.dismiss(t);
          toast.success("Case created");
          qc.invalidateQueries({ queryKey: ["projects"] });
          router.navigate({ to: "/projects/$id", params: { id: res.project_id }, replace: true });
          return;
        }
      } catch { /* keep polling */ }
      if (attempts > 40) {
        toast.dismiss(t);
        toast.error("Payment received but case is taking a moment. Refresh in a few seconds.");
        router.navigate({ to: "/projects", search: {}, replace: true });
        return;
      }
      setTimeout(tick, 1500);
    };
    tick();
    return () => { cancelled = true; toast.dismiss(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.checkout, search.session_id]);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Petitions">
      <div className="mx-auto max-w-[1400px] px-8 py-14">
        <div className="mb-12 flex items-end justify-between border-b border-border pb-8">
          <div>
            <span className="eyebrow text-crimson">Docket</span>
            <h1 className="mt-3 font-serif text-5xl leading-tight text-navy md:text-6xl">
              Your petitions
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Each petition is its own workspace — sections, exhibits, and an
              assistant thread, kept private to your account.
            </p>
          </div>
          <NewProjectButton />
        </div>

        {!projects ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="relative overflow-hidden border border-border bg-parchment p-16 text-center shadow-plate">
            <div className="absolute inset-x-0 top-0 h-1 bg-crimson" />
            <p className="eyebrow text-crimson">Empty docket</p>
            <p className="mt-4 font-serif text-3xl text-navy">No petitions on file.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Open a new matter — O-1A, EB-1A, or NIW — and your assistant will meet you inside.
            </p>
            <div className="mt-8"><NewProjectButton /></div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="group relative flex flex-col justify-between overflow-hidden border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-navy hover:shadow-plate"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-crimson opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 border border-navy/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-navy">
                    <span className="h-1.5 w-1.5 rounded-full bg-crimson" />
                    {p.visa_type}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="font-serif text-2xl leading-tight text-navy">{p.name}</h3>
                  {p.beneficiary_name && (
                    <p className="mt-2 font-serif italic text-muted-foreground">In re: {p.beneficiary_name}</p>
                  )}
                  {p.field && <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{p.field}</p>}
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                  <div className="h-px w-8 bg-navy transition-all group-hover:w-16" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-navy opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "byok">("choose");
  const [beneficiary, setBeneficiary] = useState("");
  const [visaType, setVisaType] = useState<"EB-1A" | "O-1A" | "NIW">("EB-1A");
  const [byokKey, setByokKey] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const seed = useServerFn(seedProjectSections);

  const startCheckout = useServerFn(createCaseCheckout);
  const startFree = useServerFn(createFreeProject);
  const saveByokKey = useServerFn(setByokKeyFn);

  // Detect whether the user already has a free case in progress — if so, the
  // "Start free" button is hidden (the RPC would reject anyway).
  const { data: hasFreeCase } = useQuery({
    queryKey: ["has-free-case"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_billing")
        .select("project_id, projects!inner(owner_id)")
        .eq("status", "free")
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  // Resolve referral cookie (if any) to know whether to show discounted price.
  const [refCode, setRefCode] = useState<string | null>(null);
  useEffect(() => { setRefCode(readRefCookie()); }, []);
  const resolveRef = useServerFn(resolveReferralCode);
  const { data: refData } = useQuery({
    queryKey: ["ref-resolve", refCode],
    queryFn: () => resolveRef({ data: { code: refCode! } }),
    enabled: !!refCode,
    staleTime: 5 * 60 * 1000,
  });
  const hasValidRef = !!refData?.valid;
  const priceCents = hasValidRef ? CASE_PRICE_CENTS - REFERRAL_DISCOUNT_CENTS : CASE_PRICE_CENTS;

  const create = useMutation({
    mutationFn: async () => {
      const ben = beneficiary.trim();
      track("checkout_started", { kind: "case", visa_type: visaType, has_ref_code: !!refCode });
      const attribution = { ...(getAttribution() ?? {}), ...getFbCookies() };
      fbTrack("InitiateCheckout", { value: priceCents / 100, currency: "USD" });
      return startCheckout({
        data: {
          name: ben,
          visa_type: visaType,
          beneficiary_name: ben,
          field: null,
          ref_code: refCode,
          attribution,
        },
      });
    },
    onSuccess: async (res) => {
      if ("bypass" in res && res.bypass) {
        try { await seed({ data: { projectId: res.project_id } }); } catch { /* non-fatal */ }
        track("project_created", { visa_type: visaType, source: "bypass" });
        qc.invalidateQueries({ queryKey: ["projects"] });
        setOpen(false);
        toast.success("Petition created (bypass)");
        navigate({ to: "/projects/$id", params: { id: res.project_id } });
        return;
      }
      if ("url" in res && res.url) {
        window.location.href = res.url;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startFreeMut = useMutation({
    mutationFn: async () => {
      const ben = beneficiary.trim();
      return startFree({
        data: {
          name: ben,
          visa_type: visaType,
          beneficiary_name: ben,
          field: null,
          ref_code: refCode,
        },
      });
    },
    onSuccess: async (res) => {
      try { await seed({ data: { projectId: res.project_id } }); } catch { /* non-fatal */ }
      track("project_created", { visa_type: visaType, source: "free", ref_code_attached: !!refCode });
      fbTrack("Lead", { content_name: `Free case — ${visaType}` });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["has-free-case"] });
      setOpen(false);
      toast.success("Free preview started");
      navigate({ to: "/projects/$id", params: { id: res.project_id } });
    },
    onError: (e: Error) => {
      if (e.message.includes("free_case_already_exists")) {
        toast.error("You already have a free case in progress. Unlock it to start another.");
      } else {
        toast.error(e.message);
      }
    },
  });

  const byokMut = useMutation({
    mutationFn: async () => {
      const ben = beneficiary.trim();
      // 1. Create the underlying free project (BYOK sits on top of a free case row).
      const proj = await startFree({
        data: {
          name: ben,
          visa_type: visaType,
          beneficiary_name: ben,
          field: null,
          ref_code: refCode,
        },
      });
      // 2. Attach + verify the Anthropic key. On success the server flips
      //    billing to `bypass` so the case is fully unlocked.
      await saveByokKey({ data: { project_id: proj.project_id, api_key: byokKey.trim() } });
      try { await seed({ data: { projectId: proj.project_id } }); } catch { /* non-fatal */ }
      return proj;
    },
    onSuccess: (res) => {
      track("project_created", { visa_type: visaType, source: "byok", ref_code_attached: !!refCode });
      fbTrack("Lead", { content_name: `BYOK case — ${visaType}` });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["has-free-case"] });
      setOpen(false);
      toast.success("Petition created — using your Anthropic key");
      navigate({ to: "/projects/$id", params: { id: res.project_id } });
    },
    onError: (e: Error) => {
      if (e.message.includes("free_case_already_exists")) {
        toast.error("You already have a free case in progress. Open it and add your key from the workspace.");
      } else {
        toast.error(e.message);
      }
    },
  });

  const visaOptions: { value: "EB-1A" | "O-1A" | "NIW"; label: string; sub: string }[] = [
    { value: "EB-1A", label: "EB-1A", sub: "Extraordinary Ability" },
    { value: "O-1A", label: "O-1A", sub: "Nonimmigrant Extraordinary" },
    { value: "NIW", label: "NIW", sub: "National Interest Waiver" },
  ];

  const busy = create.isPending || startFreeMut.isPending || byokMut.isPending;

  // Reset step when dialog closes.
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setStep("choose");
      setByokKey("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>New petition</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "choose" ? "New petition" : "Bring your own Anthropic key"}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="p-ben">Beneficiary name</Label>
                <Input
                  id="p-ben"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="Jane Doe"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Visa type</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {visaOptions.map((v) => {
                    const active = visaType === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVisaType(v.value)}
                        className={`border p-3 text-left transition-colors ${
                          active
                            ? "border-navy bg-navy text-parchment"
                            : "border-border bg-card hover:border-navy"
                        }`}
                      >
                        <div className="font-mono text-xs uppercase tracking-widest">{v.label}</div>
                        <div className={`mt-1 text-[11px] ${active ? "text-parchment/80" : "text-muted-foreground"}`}>
                          {v.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Start free</strong> — {FREE_MESSAGE_LIMIT}-message preview on us.{" "}
                  <strong>Bring your own key</strong> — full workspace, you pay Anthropic directly (~$3–8/case).{" "}
                  <strong>Pay &amp; unlock</strong> — ${(priceCents / 100).toFixed(0)}, we handle the AI
                  {hasValidRef && (
                    <>
                      {" "}
                      <span className="text-crimson">
                        (referral: ${(REFERRAL_DISCOUNT_CENTS / 100).toFixed(0)} off ${(CASE_PRICE_CENTS / 100).toFixed(0)})
                      </span>
                    </>
                  )}.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              {!hasFreeCase && (
                <Button
                  variant="outline"
                  onClick={() => startFreeMut.mutate()}
                  disabled={!beneficiary.trim() || busy}
                >
                  {startFreeMut.isPending ? "Starting…" : "Start free"}
                </Button>
              )}
              {!hasFreeCase && (
                <Button
                  variant="outline"
                  onClick={() => setStep("byok")}
                  disabled={!beneficiary.trim() || busy}
                  className="border-navy/40 text-navy hover:bg-navy/5 hover:text-navy"
                >
                  Bring your own key
                </Button>
              )}
              <Button onClick={() => create.mutate()} disabled={!beneficiary.trim() || busy}>
                {create.isPending ? "Starting checkout…" : `Pay & unlock — $${(priceCents / 100).toFixed(0)}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "byok" && (
          <>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Paste your Anthropic API key. The full workspace unlocks immediately and Anthropic bills you
                directly — expect ~$3–8 for a full petition draft. Nothing to us.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="p-byok" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Anthropic API key
                  </Label>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-navy underline decoration-dotted underline-offset-2"
                  >
                    Get one at console.anthropic.com ↗
                  </a>
                </div>
                <Input
                  id="p-byok"
                  type="password"
                  value={byokKey}
                  onChange={(e) => setByokKey(e.target.value)}
                  placeholder="sk-ant-api03-…"
                  className="font-mono text-xs"
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Stored encrypted at rest. Used only to run this case. Remove any time from the workspace settings.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setStep("choose")} disabled={byokMut.isPending}>
                Back
              </Button>
              <Button
                onClick={() => byokMut.mutate()}
                disabled={!beneficiary.trim() || byokKey.trim().length < 20 || byokMut.isPending}
              >
                {byokMut.isPending ? "Verifying key…" : "Verify & create petition"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

