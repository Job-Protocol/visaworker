// Chat pane — talks to /api/chat and /api/chat/resume, renders assistant
// content blocks (text, thinking, tool_use, web_search_tool_result, tool_result).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCompileDriver } from "@/lib/use-compile-driver";
import { ChatMarkdown } from "./ChatMarkdown";
import { DocRequestWidget, type DocRequestItem } from "./DocRequestWidget";
import { NextStepsWidget, type NextStepSuggestion } from "./NextStepsWidget";
import { BudgetExhaustedCard, useProjectBilling } from "./TokenMeter";
import { DEFAULT_CASE_TOKEN_BUDGET, FREE_MESSAGE_LIMIT } from "@/ee";
import { saveProjectIntake } from "@/lib/intake.functions";
import { useDemoQuota } from "@/lib/use-demo-quota";
import { track } from "@/ee";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, Check, ChevronRight, Copy, Loader2, Paperclip, Plus, Square, X } from "lucide-react";
import {
  extractImageBlobs,
  isSupportedImageFile,
  prepareImageAttachment,
  type ImageAttachment,
} from "@/lib/paste-image";

type PendingAttachment = { id: string; file: File };


// Module-level guard so both mounted ChatPane instances (desktop + mobile
// layouts) don't each fire the auto-kickoff for the same project.
const kickoffDispatched = new Set<string>();
const seenCompileErrorNonces = new Set<string>();
const ATTACH_ACCEPT =
  "application/pdf,.pdf,.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

type Msg = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: unknown;
  created_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  visa_type: string;
  beneficiary_name: string | null;
  field: string | null;
  profile_data: Record<string, unknown> | null;
};

export type NavPane = "strategy" | "exhibits" | "sections" | "preview";

export function ChatPane({
  projectId,
  onNavigate,
  centered = false,
}: {
  projectId: string;
  onNavigate?: (pane: NavPane) => void;
  centered?: boolean;
}) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const [composerEmpty, setComposerEmpty] = useState(true);
  const [driverStatus, setDriverStatus] = useState<"idle" | "compiling" | "resuming">("idle");
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  // Streaming: the assistant's in-flight response text, shown live below the
  // persisted messages until the server appends the assistant row to the DB.
  const [liveText, setLiveText] = useState("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const atBottomRef = useRef(true);
  const scrollToBottomRef = useRef<(b?: ScrollBehavior) => void>(() => {});
  const attachInputRef = useRef<HTMLInputElement>(null);




  const { data: billing } = useProjectBilling(projectId);
  const isFreeTier = billing?.status === "free";
  const freeMessagesUsed = Number(billing?.free_messages_used ?? 0);
  // Free-tier hard message cap enforced server-side; reflected here for the UI.
  const freeExhausted = isFreeTier && freeMessagesUsed >= FREE_MESSAGE_LIMIT;
  const tokensExhausted =
    !!billing &&
    billing.status !== "bypass" &&
    Number(billing.tokens_used ?? 0) >= Number(billing.token_budget ?? DEFAULT_CASE_TOKEN_BUDGET);
  const budgetExhausted = tokensExhausted || freeExhausted;
  const demoQuota = useDemoQuota();
  const blocked = budgetExhausted || demoQuota.exhausted;

  const { data: project } = useQuery<ProjectRow | null>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, visa_type, beneficiary_name, field, profile_data")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProjectRow | null;
    },
  });

  const { data: messages } = useQuery<Msg[]>({
    queryKey: ["messages", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
    // Always poll at a low frequency as a fallback in case realtime drops;
    // faster while we know the agent is working. The realtime subscription
    // below is the primary path for freshness.
    refetchInterval: () => {
      const busy =
        (typeof window !== "undefined" &&
          (window as unknown as { __agentBusy?: boolean }).__agentBusy) ||
        driverStatus !== "idle";
      return busy ? 800 : 4000;
    },
    refetchIntervalInBackground: false,
  });


  // Realtime: any new message or compile_request update for this project
  // invalidates the messages query so the UI reflects server progress even
  // when no local mutation is pending (e.g. during /api/chat/resume turns).
  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}-activity-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", projectId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compile_requests", filter: `project_id=eq.${projectId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", projectId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, qc]);

  // Agent-driven workspace navigation. When an assistant message contains a
  // navigate_to tool_use, switch the user's active pane. Track seen ids so we
  // only fire once per call (not on every re-render / refetch / mount).
  const seenNavRef = useRef<Set<string>>(new Set());
  const navInitializedRef = useRef(false);
  useEffect(() => {
    if (!onNavigate || !messages?.length) return;
    let latest: { id: string; pane: NavPane } | null = null;
    for (const m of messages) {
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
      for (const b of m.content as any[]) {
        if (b?.type === "tool_use" && b?.name === "navigate_to") {
          const pane = b?.input?.pane as NavPane | undefined;
          const id = String(b?.id ?? "");
          if (id && pane && ["strategy", "exhibits", "sections", "preview"].includes(pane)) {
            latest = { id, pane };
          }
        }
      }
    }
    if (!latest) return;
    // On first mount, absorb existing history without navigating.
    if (!navInitializedRef.current) {
      navInitializedRef.current = true;
      seenNavRef.current.add(latest.id);
      return;
    }
    if (seenNavRef.current.has(latest.id)) return;
    seenNavRef.current.add(latest.id);
    onNavigate(latest.pane);
  }, [messages, onNavigate]);


  useCompileDriver({
    projectId,
    onStatusChange: setDriverStatus,
    onResume: () => qc.invalidateQueries({ queryKey: ["messages", projectId] }),
  });


  type SendArgs = { text: string; images?: ImageAttachment[] };
  const send = useMutation({
    mutationFn: async ({ text, images }: SendArgs) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      (window as unknown as { __agentBusy?: boolean }).__agentBusy = true;
      const userMsgCount = (messages ?? []).filter((m) => m.role === "user").length;
      track("message_sent", {
        project_id: projectId,
        has_images: !!images?.length,
        image_count: images?.length ?? 0,
      });
      if (userMsgCount === 0) {
        track("first_message_sent", { project_id: projectId });
      }


      const abort = new AbortController();
      streamAbortRef.current = abort;
      setLiveText("");

      let res: Response;
      try {
        res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            project_id: projectId,
            user_text: text,
            images: images?.map((i) => ({ media_type: i.media_type, data: i.data })),
          }),
          signal: abort.signal,
        });
      } catch (e) {
        if (abort.signal.aborted) return { cancelled: true } as const;
        throw e;
      }
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Chat failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let live = "";
      let finalKind: "final" | "paused" | "cancelled" | "error" = "final";
      let finalErr = "";
      let pendingFrame = false;


      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Parse SSE frames separated by blank lines.
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLines = frame
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart());
            if (dataLines.length === 0) continue;
            const raw = dataLines.join("\n");
            let evt: any;
            try {
              evt = JSON.parse(raw);
            } catch {
              continue;
            }
            if (evt.type === "text") {
              live += evt.delta ?? "";
              // Coalesce delta bursts into ~1 render per frame instead of
              // one setState per token, which was causing visible jitter.
              if (!pendingFrame) {
                pendingFrame = true;
                requestAnimationFrame(() => {
                  pendingFrame = false;
                  setLiveText(live);
                  if (atBottomRef.current) {
                    scrollToBottomRef.current?.("auto");
                  }
                });
              }
            } else if (evt.type === "assistant_saved") {
              // The assistant row is now in the DB. Refetch and only clear
              // the live buffer once the persisted message is present so the
              // UI never flickers to an empty state between the two.
              live = "";
              (async () => {
                try {
                  await qc.refetchQueries({ queryKey: ["messages", projectId] });
                } finally {
                  setLiveText("");
                }
              })();
            } else if (evt.type === "tool_saved") {
              qc.invalidateQueries({ queryKey: ["messages", projectId] });
            } else if (evt.type === "paused_compile") {
              finalKind = "paused";
              qc.invalidateQueries({ queryKey: ["messages", projectId] });
            } else if (evt.type === "cancelled") {
              finalKind = "cancelled";
            } else if (evt.type === "error") {
              finalKind = "error";
              finalErr = evt.error ?? "error";
            } else if (evt.type === "final") {
              finalKind = "final";
            }
          }
        }
      } finally {
        // Don't unconditionally clear — the assistant_saved handler above
        // handles the clean handoff to the persisted message. Only clear
        // here if the stream ended without ever emitting assistant_saved
        // (error / cancel mid-first-response).
        if (live) setLiveText("");
        streamAbortRef.current = null;
      }


      if (finalKind === "error") throw new Error(finalErr);
      return { kind: finalKind } as const;
    },
    onMutate: ({ text, images }: SendArgs) => {
      // Show the user's message immediately so they see it before the agent
      // starts working (server insert + realtime can take a beat).
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticContent: unknown = images && images.length
        ? [
            ...(text ? [{ type: "text", text }] : []),
            ...images.map((i) => ({
              type: "image",
              source: { type: "base64", media_type: i.media_type, data: i.data },
            })),
          ]
        : text;
      const optimistic: Msg = {
        id: optimisticId,
        role: "user",
        content: optimisticContent,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Msg[]>(["messages", projectId], (prev) =>
        prev ? [...prev, optimistic] : [optimistic],
      );
      requestAnimationFrame(() => scrollToBottom("smooth"));
      return { optimisticId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", projectId] });
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
      qc.invalidateQueries({ queryKey: ["exhibits", projectId] });
    },
    onError: (e: Error, _args, ctx) => {
      if (ctx?.optimisticId) {
        qc.setQueryData<Msg[]>(["messages", projectId], (prev) =>
          prev ? prev.filter((m) => m.id !== ctx.optimisticId) : prev,
        );
      }
      // Recognise server-side gate errors and refresh billing so the unlock
      // card renders instead of showing raw error codes.
      if (e.message.includes("free_message_limit")) {
        toast.error("Free preview limit reached — unlock this case to keep drafting.");
        qc.invalidateQueries({ queryKey: ["project_billing", projectId] });
      } else if (e.message.includes("budget_exhausted")) {
        toast.error("Case token budget exhausted.");
        qc.invalidateQueries({ queryKey: ["project_billing", projectId] });
      } else {
        toast.error(e.message);
      }
    },
    onSettled: () => {
      if (driverStatus === "idle") {
        (window as unknown as { __agentBusy?: boolean }).__agentBusy = false;
      }
    },
  });

  const stopStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLiveText("");
    (window as unknown as { __agentBusy?: boolean }).__agentBusy = false;
    qc.invalidateQueries({ queryKey: ["messages", projectId] });
  }, [projectId, qc]);



  // ---------- Intake + auto-kickoff for brand-new cases ----------
  const saveIntake = useServerFn(saveProjectIntake);
  const intakeCompleted = !!(project?.profile_data as { intake_completed_at?: string } | null)
    ?.intake_completed_at;
  const isBrandNew = !!messages && messages.length === 0;
  const needsIntake = isBrandNew && !!project && !intakeCompleted;

  const runKickoff = useCallback(() => {
    if (!project) return;
    if (kickoffDispatched.has(projectId)) return;
    if (send.isPending || budgetExhausted) return;
    kickoffDispatched.add(projectId);
    const profile = (project.profile_data ?? {}) as {
      nationality?: string;
      links?: string[];
      intake_notes?: string;
    };
    const links = Array.isArray(profile.links) ? profile.links.filter(Boolean) : [];
    const prompt = [
      `A brand-new ${project.visa_type} case named "${project.name}" has just been opened. Here is what the user gave us at intake:`,
      ``,
      `- Beneficiary: ${project.beneficiary_name ?? "(unknown)"}`,
      `- Field of work: ${project.field ?? "(unknown)"}`,
      `- Nationality: ${profile.nationality || "(not provided)"}`,
      `- Public links: ${links.length ? links.join(", ") : "(none provided)"}`,
      profile.intake_notes ? `- Notes: ${profile.intake_notes}` : ``,
      ``,
      `Please kick off this case proactively. Do this now, without asking follow-up questions first:`,
      `1. For each provided link, call capture_url_as_exhibit so the source becomes an exhibit (title it like "LinkedIn — {name}", "Google Scholar — {name}", etc.).`,
      `2. Run web_search on the beneficiary's name + field to surface press, awards, notable talks, patents, citations, and anything that hints at strong evidence categories.`,
      `3. Call set_profile_data to merge any new facts you learned (employer, notable achievements, hypothesis, etc.).`,
      `4. Call write_strategy ONCE to seed the strategy doc in the canonical shape. Structure it exactly as: a one-paragraph case theory (before any heading), then '## Plan' (2–5 bullets on which ${project.visa_type} criteria/prongs you're leaning on and why), '## Criteria' (one line per criterion or Dhanasar prong — status met/partial/missing + evidence or gap), '## Recommenders' (target signer profiles: name or TBD, affiliation, why they fit, letter status), '## To do' (GitHub checkboxes for what the user must still send), and '## Notes' (leave empty or short). After kickoff, use patch_strategy for routine updates — never write_strategy again.`,
      `5. Finally, reply in chat with a ~150-word summary of the strategy and the top 3 concrete next actions for the user (e.g. "upload your CV", "confirm criteria X/Y/Z", "send me the {award} press mention"). Do NOT draft any petition section yet.`,
      ``,
      `Keep the chat reply tight and skimmable. The Strategy pane is the source of truth; the chat reply is the summary.`,
    ].filter(Boolean).join("\n");
    send.mutate({ text: prompt }, {
      onError: () => {
        // Allow the user to retry by refreshing / re-triggering intake completion.
        kickoffDispatched.delete(projectId);
      },
    });

  }, [project, projectId, send, budgetExhausted]);

  // Forward manual-compile errors to the agent so it can diagnose + fix.
  // ChatPane is mounted twice (mobile + desktop variants both live in the DOM),
  // so we dedupe by event nonce at module scope to avoid double-sending.
  useEffect(() => {
    const onCompileError = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string; errors?: string[]; log?: string; nonce?: string }>).detail;
      if (!detail || detail.projectId !== projectId) return;
      if (detail.nonce && seenCompileErrorNonces.has(detail.nonce)) return;
      if (detail.nonce) {
        seenCompileErrorNonces.add(detail.nonce);
        // keep the set bounded
        if (seenCompileErrorNonces.size > 50) {
          const first = seenCompileErrorNonces.values().next().value;
          if (first) seenCompileErrorNonces.delete(first);
        }
      }
      if (send.isPending || budgetExhausted) return;
      const errs = (detail.errors ?? []).slice(0, 20);
      const logTail = (detail.log ?? "").split("\n").slice(-80).join("\n");
      const prompt = [
        `The manual "Build PDF" just failed on this petition. Please diagnose the LaTeX error and fix it by editing the relevant section(s). Then tell me in one sentence what you changed.`,
        ``,
        `Top errors:`,
        ...(errs.length ? errs.map((l) => `- ${l}`) : ["- (no parsed errors — see log)"]),
        ``,
        `Log tail:`,
        "```",
        logTail,
        "```",
      ].join("\n");
      send.mutate({ text: prompt });
      toast.info("Sent to your assistant to fix");
    };
    window.addEventListener("visaworker:compile-error", onCompileError);
    return () => window.removeEventListener("visaworker:compile-error", onCompileError);
  }, [projectId, send, budgetExhausted]);


  // Auto-run kickoff as soon as intake is complete AND there are no messages.
  useEffect(() => {
    if (!isBrandNew || !intakeCompleted || !project) return;
    if (kickoffDispatched.has(projectId)) return;
    runKickoff();
  }, [isBrandNew, intakeCompleted, project, projectId, runKickoff]);

  const submitIntake = useMutation({
    mutationFn: async (input: {
      beneficiary_name: string;
      field: string;
      nationality: string;
      links: string[];
      notes: string;
    }) => {
      await saveIntake({ data: { projectId, ...input } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      // The effect above will trigger runKickoff once project refetches.
    },
    onError: (e: Error) => toast.error(e.message),
  });
  // ---------- end intake ----------

  // Track scroll position → toggle "jump to latest" pill.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < 80;
    setAtBottom(near);
    atBottomRef.current = near;
    if (near) setUnread(0);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    if (behavior === "auto") {
      // Bypass CSS `scroll-smooth` so instant jumps don't animate.
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
    setUnread(0);
  }, []);
  scrollToBottomRef.current = scrollToBottom;


  // Auto-scroll only when the user was already at the bottom; otherwise bump unread badge.
  const lastCountRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const scrollProjectRef = useRef(projectId);
  useLayoutEffect(() => {
    if (scrollProjectRef.current !== projectId) {
      scrollProjectRef.current = projectId;
      initialScrollDoneRef.current = false;
      lastCountRef.current = 0;
      setUnread(0);
      setAtBottom(true);
      atBottomRef.current = true;
    }

    const count = messages?.length ?? 0;
    if (count === 0) return;

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      lastCountRef.current = count;
      scrollToBottom("auto");
      setAtBottom(true);
      atBottomRef.current = true;
      return;
    }

    const grew = count > lastCountRef.current;
    lastCountRef.current = count;
    if (!grew) return;
    if (atBottom) scrollToBottom("smooth");
    else setUnread((n) => n + 1);
  }, [projectId, messages?.length, atBottom, scrollToBottom]);

  const busyLabel = useMemo(() => {
    if (driverStatus === "compiling") return "Building your PDF…";
    if (driverStatus === "resuming") return "Sharing the result with your assistant";
    if (send.isPending) return "Your assistant is working";
    return null;
  }, [driverStatus, send.isPending]);

  async function uploadPending(): Promise<string> {
    if (!pending.length) return "";
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const previews: string[] = [];
    for (const p of pending) {
      const form = new FormData();
      form.append("file", p.file);
      form.append("project_id", projectId);
      form.append("target", "upload");
      const res = await fetch("/api/attachments/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed to ingest ${p.file.name}`);
      const preview: string = j.preview ?? "";
      previews.push(
        `[Attached upload_id=${j.upload.id} title="${j.upload.title}" mime=${j.upload.mime_type} — first ${preview.length} chars]\n${preview}`,
      );
    }
    return previews.join("\n\n---\n\n");
  }

  async function submit() {
    const text = (composerRef.current?.getValue() ?? "").trim();
    const hasImages = pendingImages.length > 0;
    if (
      (!text && pending.length === 0 && !hasImages) ||
      send.isPending ||
      attaching ||
      blocked
    )
      return;
    try {
      setAttaching(pending.length > 0);
      const attachmentBlock = await uploadPending();
      setPending([]);
      qc.invalidateQueries({ queryKey: ["uploads", projectId] });
      const combined = [text, attachmentBlock].filter(Boolean).join("\n\n");
      const imagesToSend = pendingImages;
      setPendingImages([]);
      composerRef.current?.setValue("");
      setComposerEmpty(true);
      demoQuota.increment();
      send.mutate({
        text: combined || (hasImages ? "(screenshot attached)" : "(attached files)"),
        images: imagesToSend,
      });
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAttaching(false);
    }
  }


  async function addImageBlobs(blobs: File[]) {
    for (const blob of blobs) {
      try {
        const prepared = await prepareImageAttachment(blob);
        setPendingImages((cur) => [...cur, prepared]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to attach image");
      }
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    // Split out image files first — they get sent inline to the vision model,
    // not through the text extractor.
    const images = extractImageBlobs(files);
    if (images.length) void addImageBlobs(images);

    const accepted = [".pdf", ".docx", ".txt", ".md", ".markdown"];
    const next: PendingAttachment[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (isSupportedImageFile(f)) continue; // handled above
      const lower = f.name.toLowerCase();
      const okExt = accepted.some((ext) => lower.endsWith(ext));
      const okMime =
        f.type === "application/pdf" ||
        f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        f.type === "text/plain" ||
        f.type === "text/markdown";
      if (okExt || okMime) {
        next.push({ id: crypto.randomUUID(), file: f });
      } else {
        rejected.push(f.name);
      }
    }
    if (next.length) setPending((cur) => [...cur, ...next]);
    if (rejected.length) {
      toast.error(
        `Unsupported: ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}. Use PDF, DOCX, TXT, MD, or an image.`,
      );
    }
  }

  // Clipboard paste — screenshots from macOS/Windows show up as image/png Files.
  useEffect(() => {
    if (blocked) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs = extractImageBlobs(items);
      if (imgs.length) {
        e.preventDefault();
        void addImageBlobs(imgs);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  // Full-pane drag-and-drop. Counter handles child dragenter/leave noise.
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const onPaneDragEnter = (e: React.DragEvent) => {
    if (blocked || !dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const onPaneDragOver = (e: React.DragEvent) => {
    if (blocked || !dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onPaneDragLeave = (_e: React.DragEvent) => {
    if (blocked) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onPaneDrop = (e: React.DragEvent) => {
    if (blocked) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };


  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={onPaneDragEnter}
      onDragOver={onPaneDragOver}
      onDragLeave={onPaneDragLeave}
      onDrop={onPaneDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-crimson/70 bg-paper/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <Paperclip className="h-8 w-8 text-crimson" />
            <p className="font-serif text-lg text-ink">Drop to attach</p>
            <p className="text-xs text-muted-foreground">Images, PDF, DOCX, TXT, or MD</p>
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-auto"
      >
        <div className={centered ? "mx-auto min-h-full w-full max-w-3xl space-y-2 p-4" : "min-h-full space-y-2 p-4"}>
          {!messages || !project ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : messages.length === 0 && needsIntake ? (
            <div className="flex h-full items-start justify-center">
              <IntakeCard
                visaType={project.visa_type}
                projectName={project.name}
                submitting={submitIntake.isPending}
                defaults={{
                  beneficiary_name: project.beneficiary_name ?? "",
                  field: project.field ?? "",
                  nationality:
                    ((project.profile_data ?? {}) as { nationality?: string }).nationality ?? "",
                }}
                onSubmit={(values) => submitIntake.mutate(values)}
              />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <PlanningState visaType={project.visa_type} beneficiary={project.beneficiary_name} />
            </div>
          ) : (
            (() => {
              // Index tool results by tool_use_id so we can fold them into the
              // preceding assistant message as a Lethra-style collapsible step list.
              const resultsById = new Map<string, { content: unknown; is_error?: boolean }>();
              for (const m of messages) {
                if (m.role !== "tool") continue;
                const blocks = Array.isArray(m.content) ? (m.content as any[]) : [];
                for (const b of blocks) {
                  if (b?.tool_use_id) {
                    resultsById.set(b.tool_use_id, { content: b.content, is_error: !!b.is_error });
                  }
                }
              }
              // Merge consecutive assistant messages that only contain tool
              // calls (no user-facing text) into the previous assistant bubble,
              // so a narration followed by several tool-only rounds renders as
              // one text box + one step list instead of N step boxes.
              const rendered: typeof messages = [];
              for (const m of messages) {
                if (m.role === "tool") { rendered.push(m); continue; }
                const prev = rendered[rendered.length - 1];
                const blocks = Array.isArray(m.content) ? (m.content as any[]) : [];
                const hasText = blocks.some((b: any) => b?.type === "text" && String(b?.text ?? "").trim());
                if (
                  m.role === "assistant" &&
                  prev &&
                  prev.role === "assistant" &&
                  !hasText &&
                  Array.isArray(prev.content)
                ) {
                  prev.content = [...(prev.content as any[]), ...blocks] as any;
                } else {
                  rendered.push({ ...m });
                }
              }
              const lastAssistantIdx = (() => {
                for (let i = rendered.length - 1; i >= 0; i--) {
                  if (rendered[i].role === "assistant") return i;
                }
                return -1;
              })();
              return rendered.map((m, i) => {
                if (m.role === "tool") return null; // folded into the assistant step list
                const isLastAssistant = i === lastAssistantIdx;
                return (
                  <MessageView
                    key={m.id}
                    msg={m}
                    resultsById={resultsById}
                    isBusy={isLastAssistant && (send.isPending || driverStatus !== "idle")}
                    isLatestAssistant={isLastAssistant}
                    projectId={projectId}
                    onNotify={(text) => send.mutate({ text })}
                    onPickNextStep={(text) => send.mutate({ text })}
                  />
                );
              });
            })()
          )}


          {liveText && (
            <div className="group space-y-2">
              <div className="relative rounded-md border border-border/60 bg-parchment/40 px-4 py-3">
                <ChatMarkdown>{liveText}</ChatMarkdown>
                <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-navy align-middle" />
              </div>
            </div>
          )}

          {busyLabel && <TypingIndicator label={busyLabel} />}
          <div ref={bottomRef} />
        </div>
      </div>


      {/* Floating "jump to latest" pill. Sits above the composer; when the
          budget/demo banner is showing the composer is taller, so lift the
          pill so it doesn't cover the banner. */}
      {!atBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/95 px-2.5 py-1 text-[11px] shadow-md backdrop-blur transition hover:border-navy hover:shadow-lg ${
            budgetExhausted || demoQuota.exhausted ? "bottom-[14rem]" : "bottom-[6.25rem]"
          }`}
          aria-label="Scroll to latest"
        >
          <ArrowDown className="h-3 w-3" />
          {unread > 0 ? `${unread} new` : "Latest"}
        </button>
      )}


      <div className={centered ? "mx-auto w-full max-w-3xl p-2 pt-1 md:pb-0" : "p-2 pt-1 md:pb-0"}>
        <div className="relative overflow-hidden rounded-md border border-border bg-card p-3 transition focus-within:border-navy/50">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-parchment/30 to-transparent" />
          {budgetExhausted && <BudgetExhaustedCard projectId={projectId} />}
        {!budgetExhausted && demoQuota.exhausted && <DemoQuotaExhaustedCard />}
        {(pending.length > 0 || pendingImages.length > 0) && (
          <div className="mb-2 flex flex-wrap items-start gap-1.5">
            {pendingImages.map((img) => (
              <div
                key={img.id}
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-background"
                title={`Screenshot · ${Math.round(img.sizeBytes / 1024)} KB`}
              >
                <img
                  src={img.dataUrl}
                  alt="Pasted screenshot"
                  className="h-full w-full object-cover"
                />
                <button
                  aria-label="Remove screenshot"
                  onClick={() =>
                    setPendingImages((cur) => cur.filter((x) => x.id !== img.id))
                  }
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/70 text-paper opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pending.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px]"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{p.file.name}</span>
                <button
                  aria-label="Remove attachment"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setPending((cur) => cur.filter((x) => x.id !== p.id))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Attach files"
            title="Attach image, PDF, DOCX, TXT, or MD"
            onClick={() => attachInputRef.current?.click()}
            disabled={send.isPending || attaching || blocked}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-navy hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <input
            ref={attachInputRef}
            type="file"
            accept={`${ATTACH_ACCEPT},image/png,image/jpeg,image/webp,image/gif`}
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <AutoTextarea
            ref={composerRef}
            onEmptyChange={setComposerEmpty}
            onSubmit={submit}
            disabled={attaching || blocked}
          />


          {(() => {
            const agentBusy = send.isPending || driverStatus !== "idle";
            const canStop = send.isPending && driverStatus === "idle";
            if (canStop) {
              return (
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopStream}
                  className="h-9 shrink-0 min-w-[7.5rem] gap-1.5"
                  aria-label="Stop generating"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </Button>
              );
            }
            const label = budgetExhausted
              ? "Budget exhausted"
              : demoQuota.exhausted
                ? "Demo limit reached"
                : attaching
                  ? "Uploading…"
                  : driverStatus === "compiling"
                    ? "Compiling…"
                    : driverStatus === "resuming"
                      ? "Resuming…"
                      : "Send";
            return (
              <Button
                onClick={submit}
                disabled={(composerEmpty && pending.length === 0 && pendingImages.length === 0) || agentBusy || attaching || blocked}
                className="h-9 shrink-0 min-w-[7.5rem]"
                aria-busy={agentBusy}
              >
                {agentBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {label}
              </Button>
            );
          })()}

        </div>
        </div>
        {demoQuota.isDemo && !demoQuota.exhausted && demoQuota.count > 0 ? (
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Demo · {demoQuota.count}/{demoQuota.limit} messages used this window
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DemoQuotaExhaustedCard() {
  return (
    <div className="mb-3 rounded-lg border border-crimson/40 bg-crimson/5 p-4">
      <p className="font-serif text-base text-crimson">
        You've hit the demo message limit
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The shared demo is capped at <strong>3 messages per 15-minute window</strong> so
        everyone gets a turn. PDF preview, exhibits, and letters still work — or open your own
        case to keep chatting with your assistant.
      </p>
      <div className="mt-3">
        <Button asChild size="sm" className="h-8 gap-1 rounded-none bg-navy text-paper hover:bg-navy-deep">
          <Link to="/auth">
            Open your own case
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

type ComposerHandle = {
  getValue: () => string;
  setValue: (v: string) => void;
  focus: () => void;
};

const AutoTextarea = forwardRef<
  ComposerHandle,
  {
    onSubmit: () => void;
    onEmptyChange?: (empty: boolean) => void;
    disabled?: boolean;
  }
>(function AutoTextarea({ onSubmit, onEmptyChange, disabled }, ref) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const emptyRef = useRef(true);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    if (el.value.length === 0) {
      el.style.height = "36px";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 160)}px`;
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => taRef.current?.value ?? "",
    setValue: (v: string) => {
      const el = taRef.current;
      if (!el) return;
      el.value = v;
      const nowEmpty = v.length === 0;
      if (nowEmpty !== emptyRef.current) {
        emptyRef.current = nowEmpty;
        onEmptyChange?.(nowEmpty);
      }
      resize();
    },
    focus: () => taRef.current?.focus(),
  }), [onEmptyChange, resize]);

  return (
    <textarea
      ref={taRef}
      defaultValue=""
      placeholder="Ask your assistant…"
      rows={1}
      disabled={disabled}
      style={{ height: 36 }}
      className="block h-9 min-h-9 max-h-[160px] flex-1 resize-none bg-transparent px-1 py-[7px] text-sm leading-[22px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      onInput={(e) => {
        const nowEmpty = (e.target as HTMLTextAreaElement).value.length === 0;
        if (nowEmpty !== emptyRef.current) {
          emptyRef.current = nowEmpty;
          onEmptyChange?.(nowEmpty);
        }
        resize();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
  );
});

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-0.5">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </span>
      <span>{label}</span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-navy"
      style={{ animationDelay: delay }}
    />
  );
}

function IntakeCard({
  visaType,
  projectName,
  defaults,
  submitting,
  onSubmit,
}: {
  visaType: string;
  projectName: string;
  defaults: { beneficiary_name: string; field: string; nationality: string };
  submitting: boolean;
  onSubmit: (v: {
    beneficiary_name: string;
    field: string;
    nationality: string;
    links: string[];
    notes: string;
  }) => void;
}) {
  const [name, setName] = useState(defaults.beneficiary_name);
  const [field, setField] = useState(defaults.field);
  const [nationality, setNationality] = useState(defaults.nationality);
  const [linksText, setLinksText] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit = name.trim().length > 0 && field.trim().length > 0 && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const links = linksText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
      .slice(0, 20);
    onSubmit({
      beneficiary_name: name.trim(),
      field: field.trim(),
      nationality: nationality.trim(),
      links,
      notes: notes.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-lg overflow-hidden rounded-lg border border-border border-t-2 border-t-crimson bg-parchment shadow-plate"
    >
      <div className="p-6 pb-2">
        <div className="space-y-1">
          <span className="eyebrow text-crimson">Intake</span>
          <h2 className="font-serif text-2xl leading-tight text-navy">
            Let's plan your {visaType} case
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Give me a minute of context and I'll research the beneficiary, propose a strategy, and set up your workspace — before you upload a single file.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink/70">Beneficiary full name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Q. Researcher"
            maxLength={200}
            required
            className="block w-full rounded-md border border-input bg-paper px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-navy focus-visible:ring-1 focus-visible:ring-navy/30"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink/70">Field of work</span>
          <input
            type="text"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="Computational neuroscience"
            maxLength={200}
            required
            className="block w-full rounded-md border border-input bg-paper px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-navy focus-visible:ring-1 focus-visible:ring-navy/30"
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink/70">Nationality (optional)</span>
          <input
            type="text"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="Brazilian"
            maxLength={120}
            className="block w-full rounded-md border border-input bg-paper px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-navy focus-visible:ring-1 focus-visible:ring-navy/30"
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink/70">Public links (optional)</span>
          <textarea
            value={linksText}
            onChange={(e) => setLinksText(e.target.value)}
            placeholder={"LinkedIn, Google Scholar, personal site, GitHub, company page — one per line or comma-separated"}
            rows={3}
            className="block w-full resize-none rounded-md border border-input bg-paper px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-navy focus-visible:ring-1 focus-visible:ring-navy/30"
          />
          <span className="block text-[10px] leading-relaxed text-muted-foreground">
            The more the better — I'll capture each as an exhibit and use them for research.
          </span>
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink/70">Anything I should know? (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Prior H-1B, currently at OpenAI, target filing by March, etc."
            rows={2}
            maxLength={2000}
            className="block w-full resize-none rounded-md border border-input bg-paper px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-navy focus-visible:ring-1 focus-visible:ring-navy/30"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-paper/60 px-6 py-4">
        <span className="truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Case: {projectName}
        </span>
        <Button type="submit" disabled={!canSubmit} className="h-9 shrink-0 gap-1.5 bg-navy text-paper hover:bg-navy-deep">
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
            </>
          ) : (
            <>Start planning</>
          )}
        </Button>
      </div>
    </form>
  );
}

function PlanningState({ visaType, beneficiary }: { visaType: string; beneficiary: string | null }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-navy/40 bg-navy/10">
        <Loader2 className="h-5 w-5 animate-spin text-navy" />
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-lg">Researching {beneficiary || "your beneficiary"}…</h2>
        <p className="text-sm text-muted-foreground">
          Pulling public sources, mapping strengths to {visaType} criteria, and drafting a strategy in the Strategy tab. This takes about a minute.
        </p>
      </div>
    </div>
  );
}

function MessageView({
  msg,
  resultsById,
  isBusy,
  isLatestAssistant = false,
  projectId,
  onNotify,
  onPickNextStep,
}: {
  msg: Msg;
  resultsById: Map<string, { content: unknown; is_error?: boolean }>;
  isBusy: boolean;
  isLatestAssistant?: boolean;
  projectId: string;
  onNotify: (text: string) => void;
  onPickNextStep?: (text: string) => void;
}) {
  const content = msg.content as unknown;

  if (msg.role === "user") {
    const blocks = Array.isArray(content) ? (content as any[]) : null;
    const text = typeof content === "string"
      ? content
      : blocks
        ? blocks.map((b: any) => (b?.type === "text" ? b.text : "")).join("\n").trim()
        : "";
    // Hide synthetic system-injected user messages (auto-compile plumbing).
    if (text.startsWith("[system]")) return null;
    const images = blocks
      ? blocks.filter((b: any) => b?.type === "image" && b?.source)
      : [];
    return (
      <div className="group flex justify-end">
        <div className="flex max-w-[80%] flex-col items-end gap-2">
          {images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {images.map((b: any, i: number) => {
                const src =
                  b.source?.type === "base64"
                    ? `data:${b.source.media_type};base64,${b.source.data}`
                    : b.source?.url;
                if (!src) return null;
                return (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block overflow-hidden rounded-md border border-border bg-background"
                  >
                    <img
                      src={src}
                      alt="Attached screenshot"
                      className="max-h-64 max-w-[240px] object-contain"
                    />
                  </a>
                );
              })}
            </div>
          )}
          {text && (
            <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
              {text}
            </div>
          )}
        </div>
      </div>
    );
  }


  // assistant — group blocks: aggregate tool_use into a single StepList,
  // merge consecutive text blocks, keep thinking/web results inline.
  const blocks = Array.isArray(content) ? (content as any[]) : [];
  const fullText = blocks
    .filter((b: any) => b?.type === "text")
    .map((b: any) => String(b.text ?? ""))
    .join("\n\n");

  type Step = {
    id: string;
    name: string;
    input: unknown;
    result?: { content: unknown; is_error?: boolean };
    status: "running" | "ok" | "error";
  };
  type Group =
    | { kind: "text"; key: string; text: string }
    | { kind: "steps"; key: string; steps: Step[] }
    | { kind: "doc_request"; key: string; toolUseId: string; title?: string; items: DocRequestItem[] }
    | { kind: "next_steps"; key: string; toolUseId: string; suggestions: NextStepSuggestion[] }
    | { kind: "other"; key: string; block: any };

  const groups: Group[] = [];
  blocks.forEach((b: any, i: number) => {
    if (b?.type === "text") {
      const last = groups[groups.length - 1];
      const text = String(b.text ?? "");
      if (last && last.kind === "text") {
        last.text += (last.text.endsWith("\n") ? "" : "\n\n") + text;
      } else {
        groups.push({ kind: "text", key: `t-${i}`, text });
      }
    } else if (b?.type === "tool_use" && b?.name === "request_documents") {
      const input = (b.input ?? {}) as { title?: string; items?: DocRequestItem[] };
      const items = Array.isArray(input.items) ? input.items : [];
      groups.push({
        kind: "doc_request",
        key: `dr-${i}`,
        toolUseId: String(b.id ?? `dr-${i}`),
        title: input.title,
        items,
      });
    } else if (b?.type === "tool_use" && b?.name === "suggest_next_steps") {
      const input = (b.input ?? {}) as { suggestions?: NextStepSuggestion[] };
      const suggestions = Array.isArray(input.suggestions)
        ? input.suggestions
            .map((s) => ({ label: String(s?.label ?? "").trim(), prompt: String(s?.prompt ?? "").trim() }))
            .filter((s) => s.label && s.prompt)
        : [];
      groups.push({
        kind: "next_steps",
        key: `ns-${i}`,
        toolUseId: String(b.id ?? `ns-${i}`),
        suggestions,
      });
    } else if (b?.type === "tool_use" || b?.type === "server_tool_use") {
      const result = b.id ? resultsById.get(b.id) : undefined;
      const step: Step = {
        id: b.id ?? `tu-${i}`,
        name: String(b.name ?? "tool"),
        input: b.input,
        result,
        status: result ? (result.is_error ? "error" : "ok") : isBusy ? "running" : "ok",
      };
      const last = groups[groups.length - 1];
      if (last && last.kind === "steps") {
        last.steps.push(step);
      } else {
        groups.push({ kind: "steps", key: `s-${i}`, steps: [step] });
      }
    } else {
      groups.push({ kind: "other", key: `o-${i}`, block: b });
    }
  });

  return (
    <div className="group space-y-2">
      {groups.map((g) => {
        if (g.kind === "text") {
          return (
            <div
              key={g.key}
              className="relative rounded-md border border-border/60 bg-parchment/40 px-4 py-3"
            >
              <ChatMarkdown>{g.text}</ChatMarkdown>
              {fullText && (
                <div className="pointer-events-none absolute right-2 top-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                  <CopyButton text={fullText} />
                </div>
              )}
            </div>
          );
        }
        if (g.kind === "steps") {
          return <StepList key={g.key} steps={g.steps} />;
        }
        if (g.kind === "doc_request") {
          return (
            <DocRequestWidget
              key={g.key}
              projectId={projectId}
              toolUseId={g.toolUseId}
              title={g.title}
              items={g.items}
              onNotify={onNotify}
            />
          );
        }
        if (g.kind === "next_steps") {
          return (
            <NextStepsWidget
              key={g.key}
              projectId={projectId}
              toolUseId={g.toolUseId}
              suggestions={g.suggestions}
              isLatestAssistant={isLatestAssistant}
              onPick={(text) => onPickNextStep?.(text)}
            />
          );
        }
        const b = g.block;
        if (b?.type === "thinking") {
          return <ThinkingBlock key={g.key} text={String(b.thinking ?? "")} />;
        }
        if (b?.type === "redacted_thinking") {
          return (
            <div key={g.key} className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-[10px] text-muted-foreground">
              <span className="text-navy">✦</span> Reasoning (redacted)
            </div>
          );
        }
        if (b?.type === "web_search_tool_result") {
          const results = Array.isArray(b?.content) ? b.content : [];
          return (
            <div key={g.key} className="rounded border border-border bg-background p-2 text-xs">
              <p className="mb-1 font-mono text-muted-foreground">web_search · {results.length} results</p>
              <ul className="space-y-0.5">
                {results.slice(0, 5).map((r: any, k: number) => (
                  <li key={k}>
                    <a href={r?.url} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                      {r?.title || r?.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function StepList({
  steps,
}: {
  steps: Array<{
    id: string;
    name: string;
    input: unknown;
    result?: { content: unknown; is_error?: boolean };
    status: "running" | "ok" | "error";
  }>;
}) {
  const running = steps.some((s) => s.status === "running");
  const [open, setOpen] = useState(running);
  // Auto-collapse once every step has resolved.
  useEffect(() => {
    if (!running) setOpen(false);
  }, [running]);
  const lastRunning = steps.find((s) => s.status === "running");
  const summary = lastRunning
    ? prettyToolName(lastRunning.name)
    : `${steps.length} step${steps.length === 1 ? "" : "s"}`;
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="flex-1 truncate text-left">{summary}</span>
        {running && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {open && (
        <ul className="space-y-1 px-3 pb-2">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StepRow({
  step,
}: {
  step: {
    id: string;
    name: string;
    input: unknown;
    result?: { content: unknown; is_error?: boolean };
    status: "running" | "ok" | "error";
  };
}) {
  const [open, setOpen] = useState(false);
  const detail = summarizeInput(step.input);
  const resultText = step.result
    ? typeof step.result.content === "string"
      ? step.result.content
      : JSON.stringify(step.result.content)
    : "";
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="-mx-1 flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-muted/60"
      >
        <StepIcon status={step.status} />
        <span className="font-mono text-foreground/80">{prettyToolName(step.name)}</span>
        {detail && (
          <span className="truncate text-muted-foreground">— {detail}</span>
        )}
        {resultText && (
          <span className="ml-auto truncate pl-2 text-muted-foreground/70">
            {truncate(resultText, 60)}
          </span>
        )}
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 space-y-2 rounded border border-border/60 bg-background/70 p-2 text-[11px]">
          <div>
            <p className="mb-1 font-mono uppercase tracking-wide text-muted-foreground">Input</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-foreground/80">
              {JSON.stringify(step.input ?? {}, null, 2)}
            </pre>
          </div>
          {step.result && (
            <div>
              <p className="mb-1 font-mono uppercase tracking-wide text-muted-foreground">
                {step.result.is_error ? "Error" : "Result"}
              </p>
              <pre className={`max-h-64 overflow-auto whitespace-pre-wrap font-mono ${step.result.is_error ? "text-destructive" : "text-foreground/80"}`}>
                {resultText}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StepIcon({ status }: { status: "running" | "ok" | "error" }) {
  if (status === "running") return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />;
  if (status === "error") return <X className="h-3 w-3 shrink-0 text-destructive" />;
  return <Check className="h-3 w-3 shrink-0 text-foreground/60" />;
}

function prettyToolName(name: string) {
  return name.replace(/_/g, " ");
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  // Prefer commonly-informative fields for one-line detail.
  for (const k of ["exhibit_id", "section_key", "path", "title", "query", "url", "name", "id"]) {
    const v = obj[k];
    if (typeof v === "string" && v) return truncate(`${k}=${v}`, 80);
  }
  const first = Object.entries(obj)[0];
  if (!first) return "";
  const [k, v] = first;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return truncate(`${k}=${s}`, 80);
}


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Copy failed");
        }
      }}
      className="rounded border border-border bg-background/95 p-1 text-muted-foreground shadow-sm hover:text-foreground"
      aria-label="Copy message"
      title="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/60 p-2 text-xs">
      <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground">
        <span className="text-navy">✦</span> Reasoning {open ? "▾" : "▸"}
      </button>
      {open && <div className="mt-2 whitespace-pre-wrap font-serif text-sm leading-relaxed">{text}</div>}
    </div>
  );
}


function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
