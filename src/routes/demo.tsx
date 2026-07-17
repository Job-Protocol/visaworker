// Public /demo route — signs the visitor into the shared demo account and
// drops them straight into the real /projects/$id workspace on the seeded
// Elon Musk EB-1A case.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PROJECT_ID, DEMO_USER_ID } from "@/lib/demo-config";
import { SealMark } from "@/components/SealMark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live EB-1A demo — drafted by an AI agent · visaworker.ai" },
      {
        name: "description",
        content:
          "Open the real visaworker.ai workspace on a live EB-1A petition for Elon Musk. Chat, edit sections, capture exhibits, build the PDF. No sign-up.",
      },
      { property: "og:title", content: "Live EB-1A demo — drafted by an AI agent · visaworker.ai" },
      {
        property: "og:description",
        content:
          "Open the real visaworker.ai workspace on a live EB-1A petition for Elon Musk. Chat, edit sections, capture exhibits, build the PDF. No sign-up.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://visaworker.ai/demo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Live EB-1A demo — drafted by an AI agent · visaworker.ai" },
      {
        name: "twitter:description",
        content:
          "Open the real visaworker.ai workspace on a live EB-1A petition for Elon Musk. Chat, edit sections, capture exhibits, build the PDF. No sign-up.",
      },
      { property: "og:image", content: "https://visaworker.ai/og-demo.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "visaworker.ai — a live EB-1A petition drafted by an AI agent." },
      { name: "twitter:image", content: "https://visaworker.ai/og-demo.png" },
      { name: "twitter:image:alt", content: "visaworker.ai — a live EB-1A petition drafted by an AI agent." },
    ],
    links: [{ rel: "canonical", href: "https://visaworker.ai/demo" }],
  }),
  component: DemoEntry,
});

function DemoEntry() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        // If already signed in as any user, sign them out first — /demo must
        // land on the demo account, not the visitor's own.
        const { data: existing } = await supabase.auth.getUser();
        if (existing.user && existing.user.id !== DEMO_USER_ID) {
          await supabase.auth.signOut();
        }
        if (!existing.user || existing.user.id !== DEMO_USER_ID) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
          });
          if (signInError) throw signInError;
        }
        navigate({
          to: "/projects/$id",
          params: { id: DEMO_PROJECT_ID },
          replace: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      {error ? (
        <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-crimson" />
          <h1 className="mb-2 font-serif text-xl text-foreground">
            The demo is temporarily unavailable
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {error}
          </p>
          <Button asChild size="sm" className="rounded-none bg-navy text-paper hover:bg-navy-deep">
            <a href="/">Back to home</a>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <SealMark className="h-10 w-10" />
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Opening the sample case…</span>
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Loading the real workspace on a seeded EB-1A petition for Elon Musk.
            This is a shared sandbox that resets every 15 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
