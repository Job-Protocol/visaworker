// POST /api/chat/resume — browser posts compile result, we resume the agent turn.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
          if (!token) return json({ error: "Missing bearer token" }, 401);

          const body = (await request.json()) as {
            project_id?: string;
            request_id?: string;
            ok?: boolean;
            log?: string;
            pdf_path?: string | null;
            error_lines?: string[] | null;
          };
          if (!body.project_id || !body.request_id) {
            return json({ error: "project_id and request_id required" }, 400);
          }

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            },
          );
          const { data: u } = await supabase.auth.getUser();
          if (!u.user) return json({ error: "Unauthorized" }, 401);

          const { resumeFromCompile } = await import("@/lib/agent-turn.server");
          const outcome = await resumeFromCompile(supabase, body.project_id, {
            request_id: body.request_id,
            ok: !!body.ok,
            log: body.log ?? "",
            pdf_path: body.pdf_path ?? null,
            error_lines: body.error_lines ?? null,
          });
          return json(outcome);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("chat resume error", e);
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
