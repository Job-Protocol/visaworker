// POST /api/chat — start or continue an agent turn.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
          if (!token) return json({ error: "Missing bearer token" }, 401);

          const body = (await request.json()) as {
            project_id?: string;
            user_text?: string;
            images?: { media_type: string; data: string }[];
          };
          if (!body.project_id || (!body.user_text && !body.images?.length)) {
            return json({ error: "project_id and user_text (or images) required" }, 400);
          }

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            },
          );

          const { data: userRes, error: uErr } = await supabase.auth.getUser();
          if (uErr || !userRes.user) return json({ error: "Unauthorized" }, 401);

          // Verify ownership via RLS: a simple read.
          const { data: p } = await supabase.from("projects").select("id").eq("id", body.project_id).maybeSingle();
          if (!p) return json({ error: "Project not found" }, 404);

          const { runTurn } = await import("@/lib/agent-turn.server");
          const outcome = await runTurn(supabase, body.project_id, body.user_text ?? "", body.images);
          return json(outcome);

        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("chat error", e);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
