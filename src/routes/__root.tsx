import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/ee";
import { MetaPixel } from "@/ee";
import { CookieBanner } from "@/ee";
import { getPostHogConfig } from "@/ee";
import { captureAttributionFromUrl } from "../lib/utm";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-foreground">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">This page isn't part of the record.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f7f4ec" },
      { title: "visaworker.ai — AI drafting agent for your immigration petition" },
      {
        name: "description",
        content:
          "The AI drafting agent for your O-1A, EB-1A, or NIW petition. Real drafts, real exhibits, filing-ready PDF. Free to try. $249 to unlock.",
      },
      { property: "og:site_name", content: "visaworker.ai" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@visaworkerai" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "visaworker.ai" },
      { property: "og:title", content: "visaworker.ai — AI drafting agent for your immigration petition" },
      { name: "twitter:title", content: "visaworker.ai — AI drafting agent for your immigration petition" },
      {
        property: "og:description",
        content:
          "The AI drafting agent for your O-1A, EB-1A, or NIW petition. Real drafts, real exhibits, filing-ready PDF. Free to try. $249 to unlock.",
      },
      {
        name: "twitter:description",
        content:
          "The AI drafting agent for your O-1A, EB-1A, or NIW petition. Real drafts, real exhibits, filing-ready PDF. Free to try. $249 to unlock.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Work+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  loader: async () => getPostHogConfig(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const posthogConfig = Route.useLoaderData();

  useEffect(() => {
    captureAttributionFromUrl();
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <PostHogProvider apiKey={posthogConfig.apiKey} host={posthogConfig.host}>
      <QueryClientProvider client={queryClient}>
        {posthogConfig.metaPixelId && <MetaPixel pixelId={posthogConfig.metaPixelId} />}
        <Outlet />
        <Toaster />
        <CookieBanner />
      </QueryClientProvider>
    </PostHogProvider>

  );
}
