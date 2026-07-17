// Watches compile_requests via realtime (with a slow safety poll), bundles
// the project into a zip in Supabase Storage, hands the signed URL to the
// compile server, uploads the resulting PDF, and POSTs /api/chat/resume.
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { buildTemplate } from "./template-engine";
import { compileLatexProject } from "./latex-compile.functions";
import { buildCompileResources } from "./build-compile-zip";
import { extractErrorLines } from "./pdftex-engine";
import { savePdf } from "./pdf-cache";
import { track } from "@/ee";

type Status = "idle" | "compiling" | "resuming";


type Options = {
  projectId: string;
  onStatusChange?: (s: Status) => void;
  onResume?: () => void;
};

export function useCompileDriver({ projectId, onStatusChange, onResume }: Options) {
  const busyRef = useRef(false);
  const compile = useServerFn(compileLatexProject);


  useEffect(() => {
    let stopped = false;

    const setStatus = (s: Status) => {
      onStatusChange?.(s);
      (window as unknown as { __agentBusy?: boolean }).__agentBusy = s !== "idle";
    };

    async function tick() {
      if (stopped || busyRef.current) return;
      try {
        const { data: rows } = await supabase
          .from("compile_requests")
          .select("*")
          .eq("project_id", projectId)
          .eq("status", "queued")
          .order("requested_at")
          .limit(1);
        const req = rows?.[0];
        if (!req) return;

        // Atomically claim
        const { data: claimed } = await supabase
          .from("compile_requests")
          .update({ status: "running" })
          .eq("id", req.id)
          .eq("status", "queued")
          .select()
          .maybeSingle();
        if (!claimed) return;

        busyRef.current = true;
        setStatus("compiling");
        const compileStartedAt = Date.now();
        track("compile_started", { project_id: projectId });

        // Load bundle
        const [{ data: project }, { data: sections }, { data: exhibits }] = await Promise.all([
          supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
          supabase.from("sections").select("*").eq("project_id", projectId).order("order_index"),
          supabase.from("exhibits").select("*").eq("project_id", projectId).order("order_index"),
        ]);
        if (!project) throw new Error("Project vanished");

        const { files, mainFile } = buildTemplate(
          { project, sections: sections ?? [], exhibits: exhibits ?? [] },
          "compile",
        );

        // Send tex files inline; exhibits go as signed URLs the compile
        // server fetches directly. Avoids the ~1MB nginx upload cap.
        const { resources } = await buildCompileResources(
          files,
          mainFile,
          exhibits ?? [],
        );
        const result = await compile({
          data: { resources, mainFile, command: "pdflatex" },
        });
        const errorLines = extractErrorLines(result.log);


        let pdfPath: string | null = null;
        if (result.ok && result.base64) {
          pdfPath = `${projectId}/latest.pdf`;
          const pdfBytes = base64ToBytes(result.base64);
          const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
          await supabase.storage
            .from("exhibits")
            .upload(pdfPath, pdfBlob, {
              upsert: true,
              contentType: "application/pdf",
            });
          // Persist locally and notify any open preview panels to reload.
          try {
            await savePdf(projectId, pdfBlob);
            window.dispatchEvent(
              new CustomEvent("visaworker:pdf-updated", { detail: { projectId } }),
            );
          } catch {
            // best-effort
          }
        }

        await supabase
          .from("compile_requests")
          .update({
            status: result.ok ? "done" : "error",
            log: result.log.slice(-8000),
            pdf_path: pdfPath,
            error_lines: errorLines,
            completed_at: new Date().toISOString(),
          })
          .eq("id", req.id);

        if (result.ok) {
          track("compile_succeeded", {
            project_id: projectId,
            duration_ms: Date.now() - compileStartedAt,
          });
        } else {
          // Bucket the failure reason so we don't leak raw LaTeX into events.
          const firstErr = (errorLines?.[0] ?? "").toLowerCase();
          const reason = firstErr.includes("missing") ? "missing_file"
            : firstErr.includes("undefined") ? "undefined_reference"
            : firstErr.includes("dimension") || firstErr.includes("overfull") ? "layout"
            : errorLines?.length ? "latex_error"
            : "compile_server_error";
          track("compile_failed", {
            project_id: projectId,
            duration_ms: Date.now() - compileStartedAt,
            reason,
          });
        }

        // Resume the agent turn
        setStatus("resuming");
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          await fetch("/api/chat/resume", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({
              project_id: projectId,
              request_id: req.id,
              ok: result.ok,
              log: result.log.slice(-6000),
              pdf_path: pdfPath,
              error_lines: errorLines,
            }),
          });
        }
        onResume?.();
      } catch (e) {
        console.error("compile driver", e);
      } finally {
        busyRef.current = false;
        setStatus("idle");
      }
    }

    // Realtime: react immediately when a compile is queued. Poll every 15s
    // as a safety net in case realtime drops.
    const channel = supabase
      .channel(`compile-driver-${projectId}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compile_requests", filter: `project_id=eq.${projectId}` },
        () => { void tick(); },
      )
      .subscribe();
    const timer = window.setInterval(tick, 15000);
    void tick();
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [projectId, onStatusChange, onResume, compile]);

}


function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
