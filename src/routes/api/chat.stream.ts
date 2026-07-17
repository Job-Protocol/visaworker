// POST /api/chat/stream — SSE-streamed agent turn. Emits text deltas as they
// arrive from Claude and status events at each turn-step boundary. The user
// aborting the fetch (client Stop button) cancels the turn.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/chat/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          project_id?: string;
          user_text?: string;
          images?: { media_type: string; data: string }[];
        };
        if (!body.project_id || (!body.user_text && !body.images?.length)) {
          return new Response("Bad Request", { status: 400 });
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
        if (!u.user) return new Response("Unauthorized", { status: 401 });

        const { data: p } = await supabase
          .from("projects")
          .select("id")
          .eq("id", body.project_id)
          .maybeSingle();
        if (!p) return new Response("Project not found", { status: 404 });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const emit = (evt: unknown) => {
              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(evt)}\n\n`),
                );
              } catch {
                // controller may be closed if client disconnected
              }
            };
            // Keep-alive comment every 15s to defeat proxy idle timeouts.
            const ka = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(`: keep-alive\n\n`));
              } catch {
                /* closed */
              }
            }, 15000);

            try {
              const { runTurnStream } = await import("@/lib/agent-turn.server");
              await runTurnStream(
                supabase,
                body.project_id!,
                body.user_text ?? "",
                body.images,
                request.signal,
                emit,
              );
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              emit({ type: "error", error: msg });
            } finally {
              clearInterval(ka);
              try {
                controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`));
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
          cancel() {
            // Client aborted; request.signal will fire and the turn loop
            // notices between/within steps.
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
