import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { track } from "@/ee";
import { evaluateSignupEmail } from "@/ee";
import { acceptCookiesOnSignIn } from "@/ee";
import statueOfLibertyAsset from "@/assets/statue-of-liberty.jpg.asset.json";
const statueOfLiberty = statueOfLibertyAsset.url;

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Sign in — visaworker.ai" },
      { name: "description", content: "Sign in or request access to the visaworker.ai petition workspace." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sign in — visaworker.ai" },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const screenEmail = useServerFn(evaluateSignupEmail);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/projects" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    track("login_started", { method: "password" });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    acceptCookiesOnSignIn();
    toast.success("Signed in");
    navigate({ to: "/projects" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    track("signup_started", { method: "password" });

    // AI-driven email screen — blocks disposable / obviously fake addresses
    // before hitting Supabase. Fails open on model/network errors.
    try {
      const verdict = await screenEmail({ data: { email } });
      if (!verdict.allow) {
        setBusy(false);
        track("signup_blocked", { reason: "email_screen" });
        return toast.error(verdict.reason || "Please use a real personal or work email.");
      }
    } catch {
      // fail-open
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/projects` },
    });
    if (error) {
      setBusy(false);
      return toast.error(getAuthErrorMessage(error));
    }
    if (!data.session) {
      setBusy(false);
      track("signup_email_pending");
      toast.success("Account created — check your email to confirm it.");
      return;
    }
    acceptCookiesOnSignIn();
    setBusy(false);
    track("signup_completed", { method: "password" });
    toast.success("Welcome to visaworker.ai");
    navigate({ to: "/projects" });
  }

  async function resendConfirmation() {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/projects` },
    });
    setBusy(false);
    if (error) return toast.error(getAuthErrorMessage(error));
    toast.success("Confirmation email sent — use the newest link.");
  }

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-8 py-4 md:px-16 md:py-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="visaworker.ai">
          <Seal />
          <span className="font-serif text-lg italic tracking-tight text-navy/90">
            visaworker<span className="text-crimson not-italic">.ai</span>
          </span>
        </Link>

        <div className="mx-auto w-full max-w-md flex-1 py-4 md:py-6">
          <span className="eyebrow text-crimson">Access</span>
          <h1 className="mt-2 font-serif text-3xl leading-[1.05] text-navy md:text-4xl">
            Return to<span className="italic"> the record.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your workspace, or request access to begin a new petition.
          </p>

          <div className="mt-5">
            <Tabs defaultValue="signin">
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-none border border-border bg-parchment p-0">
                <TabsTrigger
                  value="signin"
                  className="h-full rounded-none border-r border-border tracking-wide data-[state=active]:bg-navy data-[state=active]:text-paper"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="h-full rounded-none tracking-wide data-[state=active]:bg-navy data-[state=active]:text-paper"
                >
                  Create account
                </TabsTrigger>
              </TabsList>

              <div className="relative min-h-[320px]">
                <TabsContent value="signin" className="mt-0">
                  <form onSubmit={signIn} className="mt-5 space-y-3">
                    <Field id="signin-email" label="Email" type="email" value={email} onChange={setEmail} />
                    <Field id="signin-password" label="Password" type="password" value={password} onChange={setPassword} />
                    <Button
                      type="submit"
                      disabled={busy}
                      className="h-11 w-full rounded-none bg-navy text-paper tracking-wide hover:bg-navy-deep"
                    >
                      {busy ? "Signing in…" : "Sign in →"}
                    </Button>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={resendConfirmation}
                        disabled={busy}
                        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-navy disabled:opacity-60"
                      >
                        Resend confirmation
                      </button>
                      <Link to="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-navy">
                        Forgot password?
                      </Link>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={signUp} className="mt-5 space-y-3">
                    <Field id="signup-email" label="Email" type="email" value={email} onChange={setEmail} />
                    <Field id="signup-password" label="Password" type="password" value={password} onChange={setPassword} />
                    <Button
                      type="submit"
                      disabled={busy}
                      className="h-11 w-full rounded-none bg-crimson text-paper tracking-wide hover:bg-crimson-deep"
                    >
                      {busy ? "Creating…" : "Create account →"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      By creating an account you agree to our terms. We&rsquo;ll email you a confirmation link.
                    </p>
                  </form>
                </TabsContent>
              </div>
            </Tabs>

            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-navy" />
              Your data and files are encrypted and never sold.
            </p>
          </div>
        </div>

        <footer className="mt-auto flex flex-col items-center gap-2 pt-4 text-[11px] leading-relaxed text-muted-foreground/70">
          <span>© {new Date().getFullYear()} visaworker.ai · Not legal advice.</span>
        </footer>
      </div>

      <div className="relative hidden overflow-hidden bg-parchment md:block">
        <img
          src={statueOfLiberty}
          alt="Statue of Liberty rendered as a navy etched engraving on parchment"
          width={896}
          height={1408}
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-parchment via-parchment/40 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-[3px] bg-crimson" />
        <div className="absolute inset-y-0 left-[3px] w-px bg-navy/20" />
        <div className="pointer-events-none absolute inset-0 bg-paper-grain opacity-40" />
      </div>
    </div>
  );
}

function getAuthErrorMessage(error: { message: string; status?: number; code?: string }) {
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    /rate limit/i.test(error.message)
  ) {
    return "Too many signup emails were requested for this project. Please wait a few minutes, then try again.";
  }

  return error.message;
}

function Field({
  id, label, type, value, onChange,
}: {
  id: string; label: string; type: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="eyebrow text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="h-11 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-navy focus-visible:ring-0"
      />
    </div>
  );
}

function Seal() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="18" className="text-navy" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="20" r="14.5" className="text-navy" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      <path
        d="M20 8l2.5 5.2 5.7.6-4.2 3.9 1.2 5.6L20 20.5 14.8 23.3l1.2-5.6L11.8 13.8l5.7-.6L20 8z"
        className="text-crimson"
        fill="currentColor"
      />
    </svg>
  );
}
