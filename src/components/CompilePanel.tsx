import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { buildTemplate } from "@/lib/template-engine";
import { extractErrorLines } from "@/lib/pdftex-engine";
import { compileLatexProject } from "@/lib/latex-compile.functions";
import { buildCompileResources } from "@/lib/build-compile-zip";
import { loadPdf, savePdf } from "@/lib/pdf-cache";
import { DEMO_PROJECT_ID } from "@/lib/demo-config";
import { useProjectBilling, useUnlockCheckout } from "@/components/workspace/TokenMeter";
import { CASE_PRICE_CENTS } from "@/ee";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Lock } from "lucide-react";

type Props = { projectId: string };


export function CompilePanel({ projectId }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [log, setLog] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const compile = useServerFn(compileLatexProject);
  const { data: billing } = useProjectBilling(projectId);
  const isFreeTier = billing?.status === "free";
  const unlock = useUnlockCheckout(projectId);


  const { data: bundle, refetch } = useQuery({
    queryKey: ["compile-bundle", projectId],
    queryFn: async () => loadBundle(projectId),
  });

  // Restore last-compiled PDF from IndexedDB on mount / project switch,
  // and refresh whenever the compile driver signals a new build.
  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;

    async function refresh(reason: "mount" | "updated") {
      let blob = await loadPdf(projectId).catch(() => null);
      if (!blob && projectId === DEMO_PROJECT_ID && reason === "mount") {
        blob = await fetch("/demo/elon-musk-eb1a.pdf")
          .then((r) => (r.ok ? r.blob() : null))
          .catch(() => null);
      }
      if (cancelled || !blob) return;
      const next = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return next;
      });
      currentUrl = next;
      setStatus(reason === "updated" ? "Updated to latest version" : "Showing your last preview");
    }

    void refresh("mount");

    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId && detail.projectId !== projectId) return;
      void refresh("updated");
    };
    window.addEventListener("visaworker:pdf-updated", onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("visaworker:pdf-updated", onUpdated);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setPdfUrl(null);
    };
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function runCompile() {
    setBusy(true);
    setStatus("Preparing your petition…");
    try {
      const b = (await refetch()).data ?? bundle;
      if (!b) throw new Error("Couldn't load your petition files");
      const { files, mainFile } = buildTemplate(b, "compile");
      const { resources } = await buildCompileResources(files, mainFile, b.exhibits);
      setStatus("Building your PDF…");
      const result = await compile({ data: { resources, mainFile, command: "pdflatex" } });
      setLog(result.log);
      if (result.ok && result.base64) {
        const bin = atob(result.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes.buffer], { type: "application/pdf" });
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(blob));
        setStatus("Done");
        toast.success("PDF ready");
        void savePdf(projectId, blob)
          .then(() => {
            window.dispatchEvent(
              new CustomEvent("visaworker:pdf-updated", { detail: { projectId } }),
            );
          })
          .catch(() => {});
      } else {
        setStatus("Needs fixes");
        const errs = extractErrorLines(result.log);
        toast.error(errs[0] || "Couldn't build the PDF — see details below");
        window.dispatchEvent(
          new CustomEvent("visaworker:compile-error", {
            detail: { projectId, errors: errs, log: result.log, nonce: crypto.randomUUID() },
          }),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("Error");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }



  async function downloadZip() {
    setBusy(true);
    try {
      const b = (await refetch()).data ?? bundle;
      if (!b) throw new Error("Couldn't load your petition files");
      const { files } = buildTemplate(b, "export");
      const zip = new JSZip();
      for (const [path, src] of Object.entries(files)) zip.file(path, src);
      // Download exhibit PDFs if any
      for (const ex of b.exhibits) {
        if (!ex.storage_path) throw new Error(`Exhibit ${ex.label} has no uploaded file yet`);
        const { data, error } = await supabase.storage.from("exhibits").download(ex.storage_path);
        if (error || !data) throw new Error(`Could not download exhibit ${ex.label}`);
        const mime = ex.mime_type ?? "application/pdf";
        const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "pdf";
        const cleanLabel = ex.label.replace(/[^a-zA-Z0-9_-]/g, "");
        zip.file(`exhibits/${cleanLabel}.${ext}`, data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${b.project.name.replace(/[^a-z0-9]+/gi, "_")}.zip`);
    } finally {
      setBusy(false);
    }
  }



  const errorLines = useMemo(() => extractErrorLines(log), [log]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={runCompile} disabled={busy}>
          {busy ? "Working…" : "Build PDF"}
        </Button>
        {isFreeTier ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => unlock.mutate()}
            disabled={unlock.isPending}
            title={`Unlock this case ($${(CASE_PRICE_CENTS / 100).toFixed(0)}) to download source files`}
          >
            <Lock className="mr-1 h-3 w-3" />
            {unlock.isPending ? "…" : `Unlock to download — $${(CASE_PRICE_CENTS / 100).toFixed(0)}`}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={downloadZip} disabled={busy}>
            Download source files
          </Button>
        )}
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>

      {pdfUrl ? (
        <iframe
          title="preview"
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          className="min-h-[500px] w-full flex-1 rounded border border-border bg-white"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded border border-dashed border-border p-8 text-sm text-muted-foreground">
          Click "Build PDF" to preview your petition.
        </div>
      )}


      {errorLines.length > 0 && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <p className="font-medium text-destructive">Issues to fix</p>
          <ul className="mt-1 space-y-1 font-mono text-destructive">
            {errorLines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {log && (
        <details className="rounded border border-border p-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Details</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">{log}</pre>
        </details>
      )}
    </div>
  );
}

async function loadBundle(projectId: string) {
  const [{ data: project }, { data: sections }, { data: exhibits }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("sections").select("*").eq("project_id", projectId).order("order_index"),
    supabase.from("exhibits").select("*").eq("project_id", projectId).order("order_index"),
  ]);
  if (!project) throw new Error("Project not found");
  const exhibitList = exhibits ?? [];
  const nonPdfIds = exhibitList
    .filter((e: any) => e.mime_type && e.mime_type !== "application/pdf")
    .map((e: any) => e.id);
  const cacheById = new Map<string, string>();
  if (nonPdfIds.length) {
    const { data: caches } = await supabase
      .from("exhibit_cache")
      .select("exhibit_id, extracted_text")
      .in("exhibit_id", nonPdfIds);
    for (const c of caches ?? [])
      cacheById.set((c as any).exhibit_id, (c as any).extracted_text ?? "");
  }
  return {
    project,
    sections: sections ?? [],
    exhibits: exhibitList.map((e: any) => ({
      ...e,
      extracted_text: cacheById.get(e.id) ?? null,
    })),
  };
}
