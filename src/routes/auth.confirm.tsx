import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { acceptCookiesOnSignIn } from "@/ee";

type Search = {
  token_hash?: string;
  token?: string;
  type?: string;
  action?: string;
  next?: string;
};

const confirmingTokens = new Set<string>();

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token_hash: typeof s.token_hash === "string" ? s.token_hash : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    action: typeof s.action === "string" ? s.action : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: ConfirmPage,
  head: () => ({
    meta: [
      { title: "Confirming — visaworker.ai" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ConfirmPage() {
  const { token_hash, token, type, action, next } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokenHash = token_hash ?? token;
      const verifyType = normalizeVerifyType(type, action);

      if (!tokenHash || !verifyType) {
        setError("This confirmation link is missing required parameters.");
        setStatus("error");
        return;
      }

      const dest = safeNext(next) ?? "/projects";

      // If a session already exists in this tab, don't re-consume the token —
      // just forward the user into the app.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        navigate({ to: dest, replace: true });
        return;
      }

      const storageKey = `auth-confirmed:${tokenHash}`;
      if (sessionStorage.getItem(storageKey) === "true") {
        navigate({ to: dest, replace: true });
        return;
      }
      if (confirmingTokens.has(tokenHash)) return;
      confirmingTokens.add(tokenHash);

      const { data, error } = await supabase.auth.verifyOtp({
        type: verifyType,
        token_hash: tokenHash,
      });
      confirmingTokens.delete(tokenHash);
      if (error) {
        if (cancelled) return;
        setError(error.message || "This link is invalid or has expired.");
        setStatus("error");
        return;
      }
      sessionStorage.setItem(storageKey, "true");
      acceptCookiesOnSignIn();

      // verifyOtp returns a session for signup / magiclink / invite / recovery.
      // Make sure it's persisted before we navigate so the _authenticated gate
      // sees the signed-in user on the next route (no manual re-login needed).
      for (let i = 0; i < 100; i++) {
        const { data: s } = await supabase.auth.getSession();
        if (data.session || s.session) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled) return;
      navigate({ to: dest, replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [token_hash, token, type, action, next, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {status === "working" ? (
          <>
            <h1 className="text-xl font-semibold">Confirming your email…</h1>
            <p className="text-muted-foreground">Hang tight, this only takes a moment.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">We couldn't confirm this link</h1>
            <p className="text-muted-foreground">{error}</p>
            <a href="/auth" className="underline">Return to sign in</a>
          </>
        )}
      </div>
    </main>
  );
}

function normalizeVerifyType(type?: string, action?: string) {
  const value = type ?? action;
  if (!value) return null;
  if (value === "signup" || value === "magiclink" || value === "login") return "email" as const;
  if (value === "email_change_current" || value === "email_change_new") return "email_change" as const;
  return value as "email" | "recovery" | "invite" | "email_change";
}

function safeNext(next?: string): string | null {
  if (!next) return null;
  try {
    // Only allow same-origin paths.
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    const u = new URL(next);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return u.pathname + u.search + u.hash;
    }
  } catch {
    /* ignore */
  }
  return null;
}
