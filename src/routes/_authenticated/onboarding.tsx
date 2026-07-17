import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { track } from "@/ee";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "A quick handshake — visaworker.ai" },
      { name: "description", content: "The pact between visaworker.ai and you before you begin." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingPage,
});

type Pact = { title: string; body: string };

const usToYou: Pact[] = [
  {
    title: "We will guard your work like it's our own.",
    body:
      "Your case lives in a per-account vault with row-level security in the database — no other user can ever query your rows. Traffic is TLS-encrypted, secrets sit in an isolated vault, and payments go through Stripe (we never see your card).",
  },
  {
    title: "We will never train on your petition.",
    body:
      "The documents, drafts, and evidence you bring in are used to draft your petition — that's it. We don't sell your data and we don't feed your content to third-party training pipelines.",
  },
  {
    title: "We will be honest about what the tool can do.",
    body:
      "This is drafting software with a very good AI paralegal behind it. It's not magic and it's not a lawyer. When we're uncertain, we'll tell you. When something is a limitation, we'll say so out loud.",
  },
  {
    title: "We will keep the exit unlocked.",
    body:
      "You can export your case as a PDF and delete your account and its data at any time from the account page.",
  },
];

const youToUs: Pact[] = [
  {
    title: "You'll treat this as a tool, not a lawyer.",
    body:
      "visaworker.ai is not a law firm and does not represent you. Nothing produced here is legal advice, and using it doesn't create an attorney-client relationship. For legal advice about your case, talk to a licensed immigration attorney.",
  },
  {
    title: "You'll expect no guaranteed outcome.",
    body:
      "USCIS decisions depend on many things outside anyone's control. We don't promise approval, RFE avoidance, or any specific processing time. A well-drafted petition is still a petition.",
  },
  {
    title: "You'll review everything before you file.",
    body:
      "AI can be confident and wrong at the same time. Every draft, quote, citation, and exhibit needs your eyes (and ideally your attorney's) before it goes anywhere near USCIS.",
  },
  {
    title: "You'll bring accurate facts.",
    body:
      "The petition is only as good as what you give it. Upload real evidence, describe your accomplishments honestly, and let us know when something isn't quite right.",
  },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [ackNotLegal, setAckNotLegal] = useState(false);
  const [ackResponsible, setAckResponsible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ready = ackNotLegal && ackResponsible && agreed;

  useEffect(() => {
    track("onboarding_started");
  }, []);

  async function accept() {
    if (!ready || submitting) return;
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      toast.error("Session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("user_id", uid);
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    track("onboarding_completed");
    // First real activation event — a completed signup that made it through
    // the disclaimer. Fires only once per account.
    track("signup_completed", { method: "confirmed" });
    navigate({ to: "/projects" });
  }

  return (
    <div className="min-h-screen bg-paper text-foreground">
      {/* Header */}
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Seal />
            <span className="font-serif text-xl italic tracking-tight">
              visaworker<span className="text-crimson not-italic">.ai</span>
            </span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/50">
            Getting Started
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
        {/* Hero */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-crimson">
            Before we begin
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-foreground sm:text-5xl md:text-6xl">
            A short handshake between the two of us.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-foreground/70 sm:text-lg">
            Immigration work is personal. Before you upload the story of your
            career, we want to be clear about what we owe you — and what we're
            asking from you in return.
          </p>
        </div>

        {/* The pact */}
        <div className="relative mt-14 grid gap-10 md:mt-20 md:grid-cols-2 md:gap-14">
          {/* Center rule (desktop) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-foreground/10 md:block"
          />

          <PactColumn
            eyebrow="From us"
            heading="What we promise you"
            items={usToYou}
            accent="us"
          />
          <PactColumn
            eyebrow="From you"
            heading="What we ask in return"
            items={youToUs}
            accent="you"
          />
        </div>

        {/* Sign the pact */}
        <div className="mx-auto mt-16 max-w-2xl md:mt-24">
          <div className="rounded-sm border border-foreground/15 bg-paper p-6 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/50">
              Countersign
            </p>
            <p className="mt-3 font-serif text-2xl leading-snug text-foreground">
              Sound fair? Sign the handshake and let's get to work.
            </p>

            <div className="mt-6 space-y-4">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={ackNotLegal}
                  onCheckedChange={(v) => setAckNotLegal(!!v)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed text-foreground/80">
                  I understand <strong className="text-foreground">visaworker.ai is not a law firm</strong>,
                  does not represent me, and nothing produced here is legal
                  advice or creates an attorney-client relationship.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={ackResponsible}
                  onCheckedChange={(v) => setAckResponsible(!!v)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed text-foreground/80">
                  I understand no outcome is guaranteed and that{" "}
                  <strong className="text-foreground">
                    I am solely responsible for the accuracy
                  </strong>{" "}
                  of every draft, citation, and exhibit before I use or submit
                  it.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(!!v)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed text-foreground/80">
                  I agree to the{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-crimson underline underline-offset-2"
                  >
                    Terms
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-crimson underline underline-offset-2"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </div>

            <Button
              className="mt-6 w-full rounded-sm"
              size="lg"
              disabled={!ready || submitting}
              onClick={accept}
            >
              {submitting ? "Setting things up…" : "Agree and continue"}
            </Button>

            <p className="mt-4 text-center text-xs text-foreground/50">
              You can revisit these terms at any time from your account.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function PactColumn({
  eyebrow,
  heading,
  items,
  accent,
}: {
  eyebrow: string;
  heading: string;
  items: Pact[];
  accent: "us" | "you";
}) {
  return (
    <section>
      <p
        className={
          "text-[10px] font-bold uppercase tracking-[0.22em] " +
          (accent === "us" ? "text-crimson" : "text-foreground/60")
        }
      >
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-foreground sm:text-3xl">
        {heading}
      </h2>

      <ol className="mt-8 space-y-8">
        {items.map((item, i) => (
          <li key={item.title} className="relative pl-10">
            <span
              aria-hidden
              className={
                "absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold " +
                (accent === "us"
                  ? "border-crimson/30 bg-crimson/5 text-crimson"
                  : "border-foreground/25 bg-foreground/[0.03] text-foreground/70")
              }
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-serif text-lg leading-snug text-foreground">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              {item.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Seal() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="18" className="text-navy" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="20" r="14.5" className="text-navy" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      <path d="M20 8l2.5 5.2 5.7.6-4.2 3.9 1.2 5.6L20 20.5 14.8 23.3l1.2-5.6L11.8 13.8l5.7-.6L20 8z"
        className="text-crimson" fill="currentColor" />
    </svg>
  );
}
