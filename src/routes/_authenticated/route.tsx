import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Gate: require completing the disclaimer/onboarding flow first.
    if (location.pathname !== "/onboarding") {
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!prof?.onboarded_at) {
        throw redirect({ to: "/onboarding" });
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
