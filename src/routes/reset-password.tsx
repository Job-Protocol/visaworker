import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { acceptCookiesOnSignIn } from "@/ee";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — visaworker.ai" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase's recovery link puts a session into the URL fragment; the
    // client picks it up automatically. We just wait until a session exists.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    acceptCookiesOnSignIn();
    toast.success("Password updated");
    navigate({ to: "/projects" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-4xl text-navy">Choose a new password</h1>

        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">
            This link is invalid or has expired. <Link to="/forgot-password" className="underline">Request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="rp-password" className="eyebrow text-muted-foreground">New password</Label>
              <Input
                id="rp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-navy focus-visible:ring-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-confirm" className="eyebrow text-muted-foreground">Confirm password</Label>
              <Input
                id="rp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-navy focus-visible:ring-0"
              />
            </div>
            <Button type="submit" disabled={busy}
              className="h-12 w-full rounded-none bg-navy text-paper tracking-wide hover:bg-navy-deep">
              {busy ? "Updating…" : "Update password →"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
