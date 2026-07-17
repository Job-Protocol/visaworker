import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { track } from "@/ee";
import { useProjectBilling } from "@/components/workspace/TokenMeter";
import { CASE_PRICE_CENTS } from "@/ee";
import {
  ArrowDownAZ,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { LettersSection } from "./LettersSection";
import { ExhibitReviewDialog } from "./ExhibitReviewDialog";
import { captureUrlAsExhibit } from "@/lib/webcapture.functions";
import { compactLabels, reorderExhibits } from "@/lib/exhibits.functions";
import { cn } from "@/lib/utils";

const ACCEPT =
  "application/pdf,.pdf,.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

type ExhibitRow = {
  id: string;
  created_at: string;
  label: string;
  title: string;
  mime_type: string;
  order_index: number;
  original_filename: string | null;
  page_count: number | null;
  project_id: string;
  size_bytes: number | null;
  storage_path: string | null;
  tags: string[];
  original_page_count: number | null;
  included_pages: number[] | null;
  review_status: string | null;
  ai_recommendation: {
    keep?: number[];
    drop?: number[];
    reasons?: Record<string, string>;
    summary?: string;
    confidence?: number;
    relevance?: string;
    model?: string;
    created_at?: string;
  } | null;
  trimmed_at: string | null;
};

type Kind = "pdf" | "docx" | "web" | "text" | "other";

function kindOf(m?: string | null): Kind {
  if (!m) return "other";
  if (m === "application/pdf") return "pdf";
  if (m.includes("wordprocessingml")) return "docx";
  if (m === "image/png" || m === "image/jpeg" || m === "image/webp") return "web";
  if (m === "text/markdown" || m === "text/plain") return "text";
  return "other";
}

function mimeLabel(m?: string | null): string {
  const k = kindOf(m);
  return { pdf: "PDF", docx: "DOCX", web: "WEB", text: "TXT", other: "FILE" }[k];
}

function formatBytes(b?: number | null): string | null {
  if (!b || b <= 0) return null;
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const KIND_META: Record<Kind, { icon: typeof FileText; label: string }> = {
  pdf:   { icon: FileText, label: "PDF"  },
  docx:  { icon: FileText, label: "DOCX" },
  web:   { icon: Globe,    label: "WEB"  },
  text:  { icon: FileText, label: "TXT"  },
  other: { icon: Paperclip,label: "FILE" },
};


export function ExhibitsPane({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<ExhibitRow | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ExhibitRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureStealth, setCaptureStealth] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const captureFn = useServerFn(captureUrlAsExhibit);
  const reorderFn = useServerFn(reorderExhibits);
  const compactFn = useServerFn(compactLabels);
  const { data: billing } = useProjectBilling(projectId);

  async function triggerAgent(userText: string) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      (window as unknown as { __agentBusy?: boolean }).__agentBusy = true;
      qc.invalidateQueries({ queryKey: ["messages", projectId] });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, user_text: userText }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Agent trigger failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent trigger failed");
    } finally {
      qc.invalidateQueries({ queryKey: ["messages", projectId] });
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
    }
  }

  const capture = useMutation({
    mutationFn: async () => {
      const url = captureUrl.trim();
      if (!url) throw new Error("URL required");
      return captureFn({
        data: {
          projectId,
          url,
          title: captureTitle.trim() || undefined,
          stealth: captureStealth || undefined,
        },
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
      if (r.warnings?.length) for (const w of r.warnings) toast.warning(w);
      toast.success(`Captured as ${r.exhibit.label}`);
      setCaptureOpen(false);
      const capturedUrl = captureUrl.trim();
      const capturedTitle = captureTitle.trim();
      setCaptureUrl("");
      setCaptureTitle("");
      setCaptureStealth(false);
      void triggerAgent(
        `I just captured a webpage as exhibit ${r.exhibit.label}${
          capturedTitle ? ` ("${capturedTitle}")` : ""
        } from ${capturedUrl}. Please review it, extract anything relevant to the petition, and update the strategy or sections as appropriate.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: exhibits } = useQuery({
    queryKey: ["exhibits", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exhibits")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index");
      if (error) throw error;
      return data as ExhibitRow[];
    },
    refetchInterval: 3000,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const form = new FormData();
      form.append("file", file);
      form.append("project_id", projectId);
      form.append("target", "exhibit");
      const res = await fetch("/api/attachments/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Upload failed");
      if (j.warnings?.length) for (const w of j.warnings) toast.warning(w);
      return { result: j, file };
    },
    onSuccess: ({ result, file }) => {
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
      const label = result?.exhibit?.label || result?.label;
      const review = result?.review as
        | { status: string; kept_pages: number[]; original_page_count: number; summary?: string }
        | undefined;
      if (review?.status === "rejected") {
        toast.warning(
          `${label ?? "Exhibit"} looks irrelevant to this petition${review.summary ? ` — ${review.summary}` : ""}.`,
        );
      } else if (review && review.kept_pages.length && review.kept_pages.length < review.original_page_count) {
        toast.success(
          `${label ?? "Exhibit"} added · AI kept ${review.kept_pages.length}/${review.original_page_count} pages`,
        );
      } else {
        toast.success(label ? `Added exhibit ${label}` : "Exhibit added");
      }
      void triggerAgent(
        `I just uploaded a new exhibit${label ? ` (${label})` : ""}: "${file.name}"${
          file.type ? ` (${file.type})` : ""
        }. Please review it, extract anything relevant to the petition, and update the strategy or sections as appropriate.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (ex: ExhibitRow) => {
      if (ex.storage_path) {
        await supabase.storage.from("exhibits").remove([ex.storage_path]);
      }
      const { error } = await supabase.from("exhibits").delete().eq("id", ex.id);
      if (error) throw error;
      return ex;
    },
    onSuccess: (ex) => {
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
      toast.success(`Deleted ${ex.label}`);
      void triggerAgent(
        `I just deleted exhibit ${ex.label} ("${ex.title || ex.original_filename || "untitled"}"). Its stable label was \`${ex.label}\`. Please search every section for \`\\exhibit{${ex.label}}\` and \`\\exhibitp{${ex.label}}\` (and \`\\exhibittitle{${ex.label}}\`) — for each hit, either remove the sentence or repoint it to a still-existing exhibit that supports the same claim. Do NOT rewrite any other exhibit citations — display numbers for the remaining exhibits will renumber automatically. If the deleted exhibit was load-bearing evidence, note what we now need to backfill.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replace = useMutation({
    mutationFn: async ({ ex, file }: { ex: ExhibitRow; file: File }) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const form = new FormData();
      form.append("file", file);
      form.append("project_id", projectId);
      form.append("target", "exhibit");
      form.append("replace_exhibit_id", ex.id);
      const res = await fetch("/api/attachments/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Replace failed");
      if (j.warnings?.length) for (const w of j.warnings) toast.warning(w);
      return { ex, file, result: j };
    },
    onSuccess: ({ ex, file }) => {
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
      toast.success(`Updated ${ex.label}`);
      void triggerAgent(
        `I just uploaded a newer version of exhibit ${ex.label} ("${ex.title || ex.original_filename || "untitled"}"). The exhibit id, label, and order are unchanged, so existing citations still resolve — but the underlying file is now "${file.name}"${file.type ? ` (${file.type})` : ""}. Please re-read the new version, confirm any quotes/page cites still match, and update anything that's now inaccurate. Flag material differences.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (exhibitIds: string[]) => {
      return reorderFn({ data: { projectId, exhibitIds } });
    },
    onMutate: async (exhibitIds) => {
      await qc.cancelQueries({ queryKey: ["exhibits", projectId] });
      const prev = qc.getQueryData<ExhibitRow[]>(["exhibits", projectId]);
      if (prev) {
        const byId = new Map(prev.map((r) => [r.id, r]));
        const next = exhibitIds
          .map((id, i) => {
            const row = byId.get(id);
            if (!row) return null;
            return { ...row, order_index: (i + 1) * 10 };
          })
          .filter((x): x is ExhibitRow => !!x);
        qc.setQueryData(["exhibits", projectId], next);
      }
      return { prev };
    },
    onError: (e: Error, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["exhibits", projectId], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
    },
  });

  const compact = useMutation({
    mutationFn: async () => compactFn({ data: { projectId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
      if (r.renamed === 0) {
        toast.success("Labels are already compact");
        return;
      }
      toast.success(`Renamed ${r.renamed} label${r.renamed === 1 ? "" : "s"}`);
      const summary = r.mapping
        .map((m) => `${m.old_label} → ${m.new_label}`)
        .join(", ");
      void triggerAgent(
        `I just compacted exhibit labels so they match the current filing order (ex01..exN). The following renames were applied and every \\exhibit{}/\\exhibitp{}/\\exhibittitle{} citation was rewritten in-place: ${summary}. Storage paths were also renamed. Please re-run validate_latex + list_exhibit_citations to confirm nothing is orphaned, then request_compile.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    track("exhibit_uploaded", {
      project_id: projectId,
      source: "file",
      count: files.length,
    });
    try {
      for (const f of Array.from(files)) {
        await upload.mutateAsync(f);
      }
    } finally {
      setUploading(false);
    }
  }

  async function openExhibit(e: ExhibitRow) {
    if (!e.storage_path) {
      toast.error("No file attached to this exhibit yet");
      return;
    }
    if (billing?.status === "free") {
      toast.error(`Unlock this case ($${(CASE_PRICE_CENTS / 100).toFixed(0)}) to download exhibits.`);
      return;
    }
    const { data, error } = await supabase.storage
      .from("exhibits")
      .createSignedUrl(e.storage_path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Could not open exhibit");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  // Full ordered list — display numbers (1..N) and neighbor ids for reorder.
  const ordered = useMemo(
    () => [...(exhibits ?? [])].sort((a, b) => a.order_index - b.order_index),
    [exhibits],
  );
  const displayNumberById = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((ex, i) => m.set(ex.id, i + 1));
    return m;
  }, [ordered]);
  const needsCompact = useMemo(
    () =>
      ordered.some(
        (ex, i) => ex.label !== `ex${String(i + 1).padStart(2, "0")}`,
      ),
    [ordered],
  );

  function moveExhibit(id: string, dir: -1 | 1) {
    const idx = ordered.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    reorder.mutate(next.map((e) => e.id));
  }


  const allTags = useMemo(() => {
    const s = new Set<string>();
    (exhibits ?? []).forEach((e) => e.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [exhibits]);

  const counts = useMemo(() => {
    const c: Record<"all" | Kind, number> = {
      all: 0,
      pdf: 0,
      docx: 0,
      web: 0,
      text: 0,
      other: 0,
    };
    (exhibits ?? []).forEach((e) => {
      c.all++;
      c[kindOf(e.mime_type)]++;
    });
    return c;
  }, [exhibits]);

  const filtered = useMemo(() => {
    if (!exhibits) return [];
    const q = query.trim().toLowerCase();
    return exhibits.filter((e) => {
      if (kindFilter !== "all" && kindOf(e.mime_type) !== kindFilter) return false;
      if (activeTag && !e.tags?.includes(activeTag)) return false;
      if (q) {
        const hay = `${e.label} ${e.title} ${e.original_filename ?? ""} ${
          e.tags?.join(" ") ?? ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [exhibits, query, kindFilter, activeTag]);

  const totalPages = useMemo(
    () => (exhibits ?? []).reduce((n, e) => n + (e.page_count ?? 0), 0),
    [exhibits],
  );
  const totalBytes = useMemo(
    () => (exhibits ?? []).reduce((n, e) => n + (e.size_bytes ?? 0), 0),
    [exhibits],
  );

  return (
    <div
      className="relative space-y-8"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <LettersSection projectId={projectId} />

      {/* ─── Docket header ───────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="font-serif text-xl leading-none tracking-tight text-foreground">
              Exhibits
            </h2>
            <span className="text-xs text-muted-foreground">Docket</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                const target = replaceTarget;
                e.currentTarget.value = "";
                setReplaceTarget(null);
                if (f && target) replace.mutate({ ex: target, file: f });
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  {uploading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-3.5 w-3.5" />
                  )}
                  File exhibit
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload file…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCaptureOpen(true)}>
                  <Globe className="mr-2 h-4 w-4" />
                  Capture webpage…
                </DropdownMenuItem>
                {ordered.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={!needsCompact || compact.isPending}
                      onClick={() => {
                        if (!needsCompact || compact.isPending) return;
                        const ok = window.confirm(
                          "Compact labels?\n\nEvery exhibit label will be rewritten to ex01..exN to match the current order, every citation in every section will be rewritten to match, and the storage files will be renamed. This runs in one pass.",
                        );
                        if (ok) compact.mutate();
                      }}
                    >
                      <ArrowDownAZ className="mr-2 h-4 w-4" />
                      {compact.isPending
                        ? "Compacting…"
                        : needsCompact
                          ? "Compact labels…"
                          : "Labels already compact"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="text-foreground font-semibold tabular-nums">{counts.all}</span> item{counts.all === 1 ? "" : "s"}
          </span>
          {totalPages > 0 && (
            <span>
              <span className="text-foreground font-semibold tabular-nums">{totalPages}</span> pages
            </span>
          )}
          {totalBytes > 0 && (
            <span>
              <span className="text-foreground font-semibold tabular-nums">{formatBytes(totalBytes)}</span>
            </span>
          )}
          {counts.all === 0 && (
            <span className="normal-case tracking-normal text-muted-foreground italic font-serif text-sm">
              Filings, evidence, and captured web pages for this matter.
            </span>
          )}
        </div>

        {/* Filters row — search + kind tabs, single line */}
        {counts.all > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exhibits, tags, filenames…"
                className="h-8 rounded-none border-0 border-b border-border bg-transparent pl-7 pr-6 text-sm shadow-none focus-visible:border-ring focus-visible:ring-0"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center">
              {(
                [
                  ["all", "All"],
                  ["pdf", "PDF"],
                  ["docx", "DOCX"],
                  ["web", "Web"],
                  ["text", "Text"],
                ] as const
              )
                .filter(([k]) => k === "all" || counts[k] > 0)
                .map(([k, label]) => {
                const n = counts[k];
                const disabled = k !== "all" && n === 0;

                const active = kindFilter === k;
                return (
                  <button
                    key={k}
                    disabled={disabled}
                    onClick={() => setKindFilter(k)}
                    className={cn(
                      "relative px-3 py-1 text-xs font-medium transition",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                      disabled && "cursor-not-allowed opacity-30 hover:text-muted-foreground",
                    )}
                  >
                    {label}
                    {n > 0 && <span className="ml-1 font-mono tabular-nums opacity-70">{n}</span>}
                    {active && (
                      <span className="absolute inset-x-2 -bottom-px h-[2px] bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <TagIcon className="h-3 w-3 text-muted-foreground" />
            {allTags.map((t) => {
              const active = activeTag === t;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTag(active ? null : t)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] transition",
                    active
                      ? "border-primary/60 bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Docket list ─────────────────────────────────────────── */}
      {!exhibits ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading exhibits…
        </div>
      ) : exhibits.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center gap-5 rounded-lg border border-border bg-secondary px-6 py-14 text-center transition hover:border-primary/30 hover:bg-secondary/80"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition group-hover:scale-105">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <div className="font-serif text-lg font-medium text-foreground">The docket is empty</div>
            <div className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              Drop PDFs, DOCX, TXT, or MD anywhere on this pane — or{" "}
              <span className="text-primary underline underline-offset-2">browse files</span>.
            </div>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="h-px w-8 bg-border" />
            <span>or</span>
            <span className="h-px w-8 bg-border" />
          </div>
          <span
            role="button"
            onClick={(ev) => {
              ev.stopPropagation();
              setCaptureOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] text-foreground shadow-sm transition hover:border-primary/40 hover:text-primary"
          >
            <Globe className="h-3.5 w-3.5" /> Capture a webpage
          </span>
        </button>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No exhibits match your filters.{" "}
          <button
            className="text-primary underline underline-offset-2"
            onClick={() => {
              setQuery("");
              setKindFilter("all");
              setActiveTag(null);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          {filtered.map((e) => {
            const k = kindOf(e.mime_type);
            const meta = KIND_META[k];
            const Icon = meta.icon;
            const size = formatBytes(e.size_bytes);
            const date = formatDate(e.created_at);
            const dispNum = displayNumberById.get(e.id) ?? 0;
            const canMoveUp = dispNum > 1;
            const canMoveDown = dispNum > 0 && dispNum < ordered.length;
            const stale = e.label !== `ex${String(dispNum).padStart(2, "0")}`;
            return (
              <li key={e.id} className="group relative">
                <button
                  type="button"
                  onClick={() => openExhibit(e)}
                  className="flex w-full items-center gap-5 bg-transparent px-2 py-4 text-left transition hover:bg-muted/50"
                >
                  {/* Left rail — display number */}
                  <div className="flex w-12 shrink-0 flex-col items-center border-r border-border pr-3">
                    <span className="text-lg font-medium leading-none tabular-nums text-foreground">
                      {dispNum || "—"}
                    </span>
                    <span
                      className={cn(
                        "mt-1 text-[10px] tabular-nums",
                        stale ? "text-destructive/80" : "text-muted-foreground",
                      )}
                      title={stale ? `Stable id ${e.label} (out of order — compact to renumber)` : `Stable id ${e.label}`}
                    >
                      {e.label}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="truncate text-sm font-medium leading-snug text-foreground">
                        {e.title || e.original_filename || "Untitled"}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-[10px] font-normal">
                        {meta.label}
                      </Badge>
                      {e.page_count ? <span>{e.page_count} pp</span> : null}
                      {size ? <span>{size}</span> : null}
                      {date ? <span>{date}</span> : null}
                      {(() => {
                        const s = e.review_status;
                        if (!s || s === "skipped" || s === "user_confirmed") return null;
                        const total = e.original_page_count ?? e.page_count ?? 0;
                        const kept = e.included_pages?.length ?? e.page_count ?? 0;
                        const map: Record<string, { label: string; cls: string }> = {
                          auto_applied: {
                            label: `AI trimmed ${kept}/${total}`,
                            cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                          },
                          needs_attention: {
                            label: "Needs review",
                            cls: "bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/20",
                          },
                          capped: {
                            label: `Capped at ${kept}`,
                            cls: "bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/20",
                          },
                          pending: {
                            label: "Awaiting review",
                            cls: "bg-muted text-muted-foreground border-border",
                          },
                          rejected: {
                            label: "AI: irrelevant",
                            cls: "bg-destructive/10 text-destructive border-destructive/20",
                          },
                        };
                        const m = map[s];
                        if (!m) return null;
                        return (
                          <Badge
                            variant="outline"
                            className={cn("rounded-sm px-1.5 py-0 text-[10px] font-normal", m.cls)}
                          >
                            {m.label}
                          </Badge>
                        );
                      })()}
                      {e.original_filename && e.original_filename !== e.title && (
                        <span className="max-w-[280px] truncate opacity-70">
                          {e.original_filename}
                        </span>
                      )}
                    </div>
                    {e.tags && e.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.tags.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="rounded-full px-2 py-0 text-[10px] font-normal"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right rail — actions, always visible but understated */}
                  <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Move ${e.label} up`}
                      title="Move up (renumbers display, keeps citations)"
                      aria-disabled={!canMoveUp || reorder.isPending}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (!canMoveUp || reorder.isPending) return;
                        moveExhibit(e.id, -1);
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent hover:text-foreground",
                        (!canMoveUp || reorder.isPending) && "pointer-events-none opacity-20",
                      )}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Move ${e.label} down`}
                      title="Move down (renumbers display, keeps citations)"
                      aria-disabled={!canMoveDown || reorder.isPending}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (!canMoveDown || reorder.isPending) return;
                        moveExhibit(e.id, 1);
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent hover:text-foreground",
                        (!canMoveDown || reorder.isPending) && "pointer-events-none opacity-20",
                      )}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                    <span className="mx-1 h-4 w-px bg-border" />
                    {k === "pdf" && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Review pages for ${e.label}`}
                        title="Review AI page selection"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setReviewTarget(e);
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setReviewTarget(e);
                          }
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent hover:text-foreground"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Replace file for ${e.label}`}
                      title="Upload a newer version (keeps citations)"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (replace.isPending) return;
                        setReplaceTarget(e);
                        replaceInputRef.current?.click();
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setReplaceTarget(e);
                          replaceInputRef.current?.click();
                        }
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent hover:text-foreground"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Delete ${e.label}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (remove.isPending) return;
                        const ok = window.confirm(
                          `Delete Exhibit ${dispNum} (stable label ${e.label}, "${e.title || e.original_filename || "untitled"}")?\n\nRemaining exhibits will renumber automatically in the PDF — existing citations to OTHER exhibits keep working. Your assistant will only be asked to clean up citations to \`${e.label}\` specifically.`,
                        );
                        if (ok) remove.mutate(e);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (remove.isPending) return;
                          const ok = window.confirm(
                            `Delete exhibit ${e.label}?`,
                          );
                          if (ok) remove.mutate(e);
                        }
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="mx-1 h-4 w-px bg-border" />
                    <ExternalLink className="h-3.5 w-3.5 opacity-40 group-hover:text-foreground group-hover:opacity-100" />
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}


      {/* Drag overlay */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary/60 bg-background/90 px-10 py-8 text-center shadow-xl">
            <Upload className="mx-auto h-6 w-6 text-primary" />
            <div className="mt-2 text-base font-semibold text-foreground">Drop to file as exhibit</div>
            <div className="mt-1 text-xs text-muted-foreground">
              PDF · DOCX · TXT · MD
            </div>
          </div>
        </div>
      )}

      {uploading && !dragOver && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs text-foreground shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Uploading & extracting…
        </div>
      )}

      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Capture webpage as exhibit
            </DialogTitle>
            <DialogDescription>
              We&rsquo;ll load the page as a public visitor, take a full-page screenshot,
              and stamp it with the URL and the timestamp. Auth-walled or paywalled pages
              will capture the logged-out view — for those, upload a manual PDF instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cap-url">URL</Label>
              <Input
                id="cap-url"
                type="url"
                placeholder="https://example.com/article"
                value={captureUrl}
                onChange={(e) => setCaptureUrl(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-title">Title (optional)</Label>
              <Input
                id="cap-title"
                placeholder="Defaults to the page title"
                value={captureTitle}
                onChange={(e) => setCaptureTitle(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background/40 p-2.5 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={captureStealth}
                onChange={(e) => setCaptureStealth(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">Enhanced proxy</span>
                <span className="block text-muted-foreground">
                  Route through Firecrawl&rsquo;s enhanced proxy for Cloudflare-protected
                  sites. Slower and uses extra Firecrawl credits.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCaptureOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => capture.mutate()}
              disabled={capture.isPending || !captureUrl.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {capture.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Capturing…
                </>
              ) : (
                "Capture"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExhibitReviewDialog
        exhibit={reviewTarget}
        open={!!reviewTarget}
        onOpenChange={(v) => { if (!v) setReviewTarget(null); }}
        onChanged={() => qc.invalidateQueries({ queryKey: ["exhibits", projectId] })}
      />
    </div>
  );
}
