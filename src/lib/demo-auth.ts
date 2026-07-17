// Server-side sign-in for the shared public demo account.
//
// The demo password is a real credential (it matches the value hashed into
// auth.users), so it must never ship in the client bundle. It lives only in
// the server env — DEMO_USER_PASSWORD (and optionally DEMO_USER_EMAIL) — and
// this server function performs the password grant on the server, returning
// just the resulting session tokens to the browser. The client then adopts
// the session with supabase.auth.setSession(...).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_DEMO_EMAIL = "demo@visaworker.ai";

export const demoSignIn = createServerFn({ method: "POST" }).handler(async () => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.DEMO_USER_EMAIL ?? DEFAULT_DEMO_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!url || !anonKey) {
    throw new Error("Demo is unavailable: Supabase server env is not configured.");
  }
  if (!password) {
    throw new Error("Demo is unavailable: DEMO_USER_PASSWORD is not set.");
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error("Demo is unavailable: could not sign in to the demo account.");
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
});
