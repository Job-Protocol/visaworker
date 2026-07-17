import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — visaworker.ai" },
      { name: "description", content: "Request a password reset link for your visaworker.ai account." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/auth" className="eyebrow text-crimson">← Back to sign in</Link>
        <h1 className="mt-4 font-serif text-4xl text-navy">Reset your password</h1>
        <p className="mt-3 text-muted-foreground">
          Enter the email you signed up with. We'll send you a secure link to choose a new password.
        </p>

        {sent ? (
          <div className="mt-8 rounded-none border border-border bg-parchment p-6">
            <p className="text-sm text-navy">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
              Check your inbox (and spam folder).
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fp-email" className="eyebrow text-muted-foreground">Email</Label>
              <Input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-navy focus-visible:ring-0"
              />
            </div>
            <Button type="submit" disabled={busy}
              className="h-12 w-full rounded-none bg-navy text-paper tracking-wide hover:bg-navy-deep">
              {busy ? "Sending…" : "Send reset link →"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
