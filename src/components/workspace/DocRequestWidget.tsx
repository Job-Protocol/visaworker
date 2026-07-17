// Inline document-upload widget rendered inside an assistant message
// when the agent calls the `request_documents` tool. Users drop files
// into named slots or an extras area; each upload hits
// /api/attachments/ingest and is tagged with request_id + slot_key so
// the agent can see which slot was fulfilled by which file.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, FileText, Loader2, Paperclip, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type DocRequestItem = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
};

type UploadRow = {
  id: string;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
  slot_key: string | null;
  created_at: string;
};

type NotifyBlock = {
  slot_key: string | null;
  slot_label: string | null;
  upload_id: string;
  title: string;
  mime_type: string | null;
};

const ACCEPT =
  "application/pdf,.pdf,.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp,image/gif";

const IDLE_MS = 6000; // wait this long after last upload before auto-notify

export function DocRequestWidget({
  projectId,
  toolUseId,
  title,
  items,
  onNotify,
}: {
  projectId: string;
  toolUseId: string;
  title?: string;
  items: DocRequestItem[];
  onNotify: (text: string) => void;
}) {
  const qc = useQueryClient();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [showExtras, setShowExtras] = useState(false);
  const [dragOverCard, setDragOverCard] = useState(false);
  const notifyBuffer = useRef<NotifyBlock[]>([]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightCount = useRef(0);
  const notifiedIds = useRef<Set<string>>(new Set());

  // Resolve the DB row backing this widget so we can tag uploads.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      const { data } = await supabase
        .from("document_requests")
        .select("id")
        .eq("tool_use_id", toolUseId)
        .maybeSingle();
      if (cancelled) return;
      const id = (data as { id?: string } | null)?.id ?? null;
      if (id) setRequestId(id);
      else if (attempts++ < 5) setTimeout(tick, 500);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [toolUseId]);

  const uploadsQ = useQuery({
    queryKey: ["doc-request-uploads", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("id, title, mime_type, size_bytes, slot_key, created_at")
        .eq("request_id", requestId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as UploadRow[];
    },
  });

  const uploads = uploadsQ.data ?? [];
  const bySlot = useMemo(() => {
    const m = new Map<string, UploadRow[]>();
    for (const u of uploads) {
      const key = u.slot_key ?? "__extra__";
      const arr = m.get(key) ?? [];
      arr.push(u);
      m.set(key, arr);
    }
    return m;
  }, [uploads]);

  const requiredItems = items.filter((i) => i.required !== false);
  const requiredDone = requiredItems.filter((i) => (bySlot.get(i.key)?.length ?? 0) > 0).length;
  const requiredTotal = requiredItems.length;
  const allRequiredDone = requiredTotal > 0 && requiredDone === requiredTotal;

  const flushNotify = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    const buf = notifyBuffer.current.filter((b) => !notifiedIds.current.has(b.upload_id));
    notifyBuffer.current = [];
    if (!buf.length) return;
    for (const b of buf) notifiedIds.current.add(b.upload_id);
    const header = title ? `Uploaded documents (${title})` : "Uploaded documents";
    const lines = buf.map((b) => {
      const slotName = b.slot_label ?? (b.slot_key ? b.slot_key : "extra");
      return `- [${slotName}] upload_id=${b.upload_id} title="${b.title}" mime=${b.mime_type ?? "?"}`;
    });
    onNotify(`${header}:\n\n${lines.join("\n")}`);
  }, [onNotify, title]);

  const armIdleFlush = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (inflightCount.current > 0) {
        armIdleFlush();
        return;
      }
      flushNotify();
    }, IDLE_MS);
  }, [flushNotify]);

  // Auto-fire when all required slots become filled (and nothing in flight).
  useEffect(() => {
    if (allRequiredDone && inflightCount.current === 0 && notifyBuffer.current.length > 0) {
      flushNotify();
    }
  }, [allRequiredDone, flushNotify, uploads.length]);

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );

  async function uploadFile(file: File, slotKey: string | null) {
    if (!requestId) {
      toast.error("Widget not ready yet — try again in a moment");
      return;
    }
    const busyKey = slotKey ?? "__extra__";
    setBusySlots((s) => new Set(s).add(busyKey));
    inflightCount.current += 1;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("project_id", projectId);
      fd.append("target", "upload");
      fd.append("request_id", requestId);
      if (slotKey) fd.append("slot_key", slotKey);
      // Do NOT send `title` — let the endpoint keep the original filename.
      const res = await fetch("/api/attachments/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Upload failed (${res.status})`);
      const slot = items.find((i) => i.key === slotKey);
      notifyBuffer.current.push({
        slot_key: slotKey,
        slot_label: slot?.label ?? null,
        upload_id: j.upload?.id ?? "",
        title: j.upload?.title ?? file.name,
        mime_type: j.upload?.mime_type ?? null,
      });
      qc.invalidateQueries({ queryKey: ["doc-request-uploads", requestId] });
      qc.invalidateQueries({ queryKey: ["uploads", projectId] });
      armIdleFlush();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      inflightCount.current = Math.max(0, inflightCount.current - 1);
      setBusySlots((s) => {
        const n = new Set(s);
        n.delete(busyKey);
        return n;
      });
    }
  }

  async function removeUpload(uploadId: string) {
    const { error } = await supabase.from("uploads").delete().eq("id", uploadId);
    if (error) {
      toast.error(error.message);
      return;
    }
    notifyBuffer.current = notifyBuffer.current.filter((b) => b.upload_id !== uploadId);
    qc.invalidateQueries({ queryKey: ["doc-request-uploads", requestId] });
    qc.invalidateQueries({ queryKey: ["uploads", projectId] });
  }

  const extras = bySlot.get("__extra__") ?? [];
  const totalUploaded = uploads.length;
  const progressPct = requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 0;

  return (
    <div
      className={`rounded-lg border bg-parchment/60 p-4 transition ${
        dragOverCard ? "border-navy ring-1 ring-navy/30" : "border-navy/40"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverCard(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOverCard(false);
      }}
      onDrop={(e) => {
        // Only handle drops that weren't consumed by a specific slot.
        if (e.defaultPrevented) return;
        e.preventDefault();
        setDragOverCard(false);
        if (e.dataTransfer.files.length) {
          for (const f of Array.from(e.dataTransfer.files)) void uploadFile(f, null);
          setShowExtras(true);
        }
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-serif text-sm text-navy">
          {title ?? "Please upload the following documents"}
        </p>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {requiredDone}/{requiredTotal} required
        </span>
      </div>

      {requiredTotal > 0 && (
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((it) => {
          const rows = bySlot.get(it.key) ?? [];
          const busy = busySlots.has(it.key);
          return (
            <li key={it.key}>
              <SlotRow
                label={it.label}
                description={it.description}
                required={it.required !== false}
                files={rows}
                busy={busy}
                onFiles={(files) => {
                  for (const f of Array.from(files)) void uploadFile(f, it.key);
                }}
                onRemove={removeUpload}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        {!showExtras && extras.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-navy"
          >
            <Plus className="h-3 w-3" /> Add other files
          </button>
        ) : (
          <SlotRow
            label="Other files"
            description="Anything else you think might help"
            required={false}
            files={extras}
            busy={busySlots.has("__extra__")}
            onFiles={(files) => {
              for (const f of Array.from(files)) void uploadFile(f, null);
            }}
            onRemove={removeUpload}
          />
        )}
      </div>

      {totalUploaded > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
          <span className="text-[11px] text-muted-foreground">
            {allRequiredDone
              ? "All required documents uploaded."
              : `Waiting on ${requiredTotal - requiredDone} more`}
          </span>
          <Button
            size="sm"
            variant={allRequiredDone ? "default" : "outline"}
            className="h-7 gap-1 text-xs"
            onClick={flushNotify}
            disabled={notifyBuffer.current.length === 0 && notifiedIds.current.size > 0 && inflightCount.current === 0 && notifyBuffer.current.length === 0}
          >
            <Check className="h-3 w-3" />
            {notifiedIds.current.size > 0 ? "Send update" : "Send to assistant"}
          </Button>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SlotRow({
  label,
  description,
  required,
  files,
  busy,
  onFiles,
  onRemove,
}: {
  label: string;
  description?: string;
  required: boolean;
  files: UploadRow[];
  busy: boolean;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const done = files.length > 0;

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`rounded-md border px-2.5 py-2 text-xs transition ${
        dragOver
          ? "border-navy bg-navy/5"
          : done
            ? "border-emerald-600/40 bg-emerald-50/40"
            : "border-dashed border-border bg-background hover:border-navy/60"
      }`}
    >
      <div
        className="flex cursor-pointer items-center gap-2"
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
            done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-border text-muted-foreground"
          }`}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : done ? (
            <Check className="h-3 w-3" />
          ) : (
            <Paperclip className="h-3 w-3" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-foreground">
            {label}
            {!required && (
              <span className="ml-1 text-[10px] text-muted-foreground">(optional)</span>
            )}
          </span>
          {description && !done && (
            <span className="truncate text-[10px] text-muted-foreground">{description}</span>
          )}
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <Upload className="h-3 w-3" />
          {done ? "Add another" : "Drop or click"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-1.5 space-y-1 border-t border-emerald-600/20 pt-1.5">
          {files.map((u) => (
            <li
              key={u.id}
              className="group flex items-center gap-1.5 text-[11px] text-foreground/80"
            >
              <FileText className="h-3 w-3 shrink-0 text-emerald-700" />
              <span className="min-w-0 flex-1 truncate">{u.title}</span>
              {u.size_bytes != null && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatSize(u.size_bytes)}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(u.id);
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label={`Remove ${u.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
