// Signed letters — lives inside the Exhibits pane.
// Petitioner adds a signer (recommender or expert), agent (or user) drafts, user copies the review
// link and delivers it themselves; signer signs or comments via a public page.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listLetters,
  getLetter,
  createLetter,
  updateLetter,
  deleteLetter,
  sendLetterForReview,
  revokeLetterLink,
} from "@/lib/letters.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { track } from "@/ee";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Send,
  Trash2,
  XCircle,
  CheckCircle2,
  MessageSquareWarning,
  Clock,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

type Letter = {
  id: string;
  project_id: string;
  recommender_name: string;
  recommender_email: string;
  recommender_title: string;
  recommender_org: string;
  relationship: string;
  notes: string;
  subject: string;
  body_md: string;
  status:
    | "draft"
    | "awaiting_review"
    | "changes_requested"
    | "signed"
    | "superseded";
  signed_at: string | null;
  signed_name: string | null;
  exhibit_id: string | null;
  updated_at: string;
};

function statusLabel(s: Letter["status"]) {
  switch (s) {
    case "draft":
      return { label: "Draft", tone: "muted", Icon: Clock };
    case "awaiting_review":
      return { label: "Awaiting review", tone: "brass", Icon: Send };
    case "changes_requested":
      return { label: "Changes requested", tone: "crimson", Icon: MessageSquareWarning };
    case "signed":
      return { label: "Signed", tone: "green", Icon: CheckCircle2 };
    case "superseded":
      return { label: "Superseded", tone: "muted", Icon: XCircle };
  }
}

export function LettersSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const listFn = useServerFn(listLetters);
  const { data } = useQuery({
    queryKey: ["letters", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    refetchInterval: () => {
      const busy =
        typeof window !== "undefined" &&
        (window as unknown as { __agentBusy?: boolean }).__agentBusy;
      return busy ? 2000 : 15000;
    },
  });

  const createFn = useServerFn(createLetter);
  const create = useMutation({
    mutationFn: (input: {
      recommender_name: string;
      recommender_email: string;
      recommender_title: string;
      recommender_org: string;
      relationship: string;
    }) => createFn({ data: { projectId, ...input } }),
    onSuccess: ({ letter }) => {
      qc.invalidateQueries({ queryKey: ["letters", projectId] });
      setAdding(false);
      setExpandedId(letter.id);
      toast.success("Signer added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const letters = (data?.letters ?? []) as Letter[];

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-serif text-sm">Letters</span>
          <Badge variant="secondary" className="text-[10px]">
            {letters.length}
          </Badge>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Draft → Sign → Exhibit
        </span>
      </button>
      {open && (
        <div className="border-t border-border p-3">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              <Plus className="mr-1 h-3 w-3" /> Add signer
            </Button>
          </div>
          {adding && (
            <AddRecommenderForm
              onCancel={() => setAdding(false)}
              onSubmit={(v) => create.mutate(v)}
              submitting={create.isPending}
            />
          )}
          {letters.length === 0 && !adding ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No letters yet. Add a signer to start — your assistant can draft the letter from
              your strategy and exhibits.
            </p>
          ) : (
            <ul className="space-y-2">
              {letters.map((l) => (
                <LetterRow
                  key={l.id}
                  letter={l}
                  expanded={expandedId === l.id}
                  onToggle={() => setExpandedId((cur) => (cur === l.id ? null : l.id))}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function AddRecommenderForm({
  onCancel,
  onSubmit,
  submitting,
}: {
  onCancel: () => void;
  onSubmit: (v: {
    recommender_name: string;
    recommender_email: string;
    recommender_title: string;
    recommender_org: string;
    relationship: string;
  }) => void;
  submitting: boolean;
}) {
  const [f, setF] = useState({
    recommender_name: "",
    recommender_email: "",
    recommender_title: "",
    recommender_org: "",
    relationship: "",
  });
  const canSubmit = f.recommender_name.trim() && f.recommender_email.trim();
  return (
    <div className="mb-3 rounded border border-border bg-background p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Full name</Label>
          <Input
            value={f.recommender_name}
            onChange={(e) => setF({ ...f, recommender_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={f.recommender_email}
            onChange={(e) => setF({ ...f, recommender_email: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={f.recommender_title}
            onChange={(e) => setF({ ...f, recommender_title: e.target.value })}
            placeholder="Professor of CS"
          />
        </div>
        <div>
          <Label className="text-xs">Organization</Label>
          <Input
            value={f.recommender_org}
            onChange={(e) => setF({ ...f, recommender_org: e.target.value })}
            placeholder="Stanford University"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Relationship to beneficiary</Label>
          <Input
            value={f.relationship}
            onChange={(e) => setF({ ...f, relationship: e.target.value })}
            placeholder="PhD advisor · 6 years"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!canSubmit || submitting}
          onClick={() => onSubmit(f)}
        >
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LetterRow({
  letter,
  expanded,
  onToggle,
}: {
  letter: Letter;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { label, tone, Icon } = statusLabel(letter.status);
  const toneClass =
    tone === "green"
      ? "border-emerald-500/50 text-emerald-500"
      : tone === "brass"
        ? "border-navy/60 text-navy"
        : tone === "crimson"
          ? "border-crimson/60 text-crimson"
          : "border-border text-muted-foreground";
  return (
    <li className="rounded border border-border bg-background">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="truncate font-serif text-sm">
            {letter.recommender_name || "Unnamed recommender"}
          </span>
          {letter.recommender_title && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · {letter.recommender_title}
            </span>
          )}
        </div>
        <Badge variant="outline" className={`shrink-0 gap-1 ${toneClass}`}>
          <Icon className="h-3 w-3" />
          {label}
        </Badge>
      </button>
      {expanded && <LetterEditor letter={letter} />}
    </li>
  );
}

function LetterEditor({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const readOnly = letter.status === "signed" || letter.status === "superseded";
  const getFn = useServerFn(getLetter);
  const { data: detail } = useQuery({
    queryKey: ["letter", letter.id],
    queryFn: () => getFn({ data: { letterId: letter.id } }),
    refetchInterval: () => {
      const busy =
        typeof window !== "undefined" &&
        (window as unknown as { __agentBusy?: boolean }).__agentBusy;
      return busy ? 2000 : 10000;
    },
  });

  const updateFn = useServerFn(updateLetter);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedBodyRef = useRef<string>(letter.body_md);
  const lastSavedSubjectRef = useRef<string>(letter.subject);
  const [subject, setSubject] = useState(letter.subject);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder:
          "Write the letter here, or ask your assistant to draft it from your strategy and exhibits.",
      }),
      Markdown.configure({ html: false, breaks: true, transformPastedText: true }),
    ],
    editorProps: {
      attributes: { class: "strategy-editor focus:outline-none min-h-[220px]" },
    },
    onUpdate: ({ editor }) => {
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const md = (editor.storage as any).markdown.getMarkdown() as string;
        if (md === lastSavedBodyRef.current && subject === lastSavedSubjectRef.current) {
          dirtyRef.current = false;
          return;
        }
        updateFn({
          data: {
            letterId: letter.id,
            patch: { body_md: md, subject },
          },
        })
          .then(() => {
            lastSavedBodyRef.current = md;
            lastSavedSubjectRef.current = subject;
            dirtyRef.current = false;
            qc.invalidateQueries({ queryKey: ["letters", letter.project_id] });
          })
          .catch((e: Error) => toast.error(e.message));
      }, 800);
    },
  });

  // Sync incoming server content without clobbering local edits.
  useEffect(() => {
    if (!editor) return;
    const incoming = detail?.letter?.body_md ?? "";
    if (dirtyRef.current) return;
    if (incoming === lastSavedBodyRef.current) return;
    lastSavedBodyRef.current = incoming;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [detail, editor]);

  useEffect(() => {
    if (dirtyRef.current) return;
    const incomingSubject = detail?.letter?.subject ?? "";
    if (incomingSubject !== subject) {
      setSubject(incomingSubject);
      lastSavedSubjectRef.current = incomingSubject;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.letter?.subject]);

  const sendFn = useServerFn(sendLetterForReview);
  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          letterId: letter.id,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
      }),
    onSuccess: async ({ url }) => {
      qc.invalidateQueries({ queryKey: ["letters", letter.project_id] });
      qc.invalidateQueries({ queryKey: ["letter", letter.id] });
      track("letter_shared", { project_id: letter.project_id, letter_id: letter.id });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Review link copied to clipboard");
      } catch {
        toast.success("Review link ready — copy from the field below");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeFn = useServerFn(revokeLetterLink);
  const revoke = useMutation({
    mutationFn: () => revokeFn({ data: { letterId: letter.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["letters", letter.project_id] });
      qc.invalidateQueries({ queryKey: ["letter", letter.id] });
      toast.success("Link revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteLetter);
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { letterId: letter.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["letters", letter.project_id] });
      toast.success("Letter deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeToken = detail?.activeToken ?? null;
  const reviewUrl = activeToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/letter/${activeToken.token}`
    : "";

  const latestComment = (detail?.events ?? []).find(
    (e: any) => e.type === "commented",
  );

  return (
    <div className="space-y-3 border-t border-border p-3">
      {/* Recommender profile summary */}
      <div className="rounded border border-border/60 bg-background/60 p-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">
          {letter.recommender_name} · {letter.recommender_email || "no email"}
        </div>
        {(letter.recommender_title || letter.recommender_org) && (
          <div>
            {letter.recommender_title}
            {letter.recommender_title && letter.recommender_org ? " · " : ""}
            {letter.recommender_org}
          </div>
        )}
        {letter.relationship && <div>Relationship: {letter.relationship}</div>}
      </div>

      {/* Signed status callout */}
      {letter.status === "signed" && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs">
          <div className="font-medium text-emerald-500">
            Signed by {letter.signed_name}
            {letter.signed_at ? ` on ${new Date(letter.signed_at).toLocaleString()}` : ""}
          </div>
          {letter.exhibit_id && (
            <div className="text-muted-foreground">
              Stored as an exhibit — visible in the list below.
            </div>
          )}
        </div>
      )}

      {/* Comment callout */}
      {letter.status === "changes_requested" && latestComment && (
        <div className="rounded border border-crimson/40 bg-crimson/5 p-3 text-xs">
          <div className="mb-1 font-medium text-crimson">
            Signer requested changes
          </div>
          <p className="whitespace-pre-wrap text-foreground">
            {(latestComment.payload as any)?.comment ?? ""}
          </p>
          <p className="mt-1 text-muted-foreground">
            Revise the draft below, then send a fresh review link.
          </p>
        </div>
      )}

      {/* Subject + body editor */}
      <div>
        <Label className="text-xs">Subject</Label>
        <Input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            dirtyRef.current = true;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
              updateFn({
                data: {
                  letterId: letter.id,
                  patch: { subject: e.target.value },
                },
              }).then(() => {
                lastSavedSubjectRef.current = e.target.value;
                dirtyRef.current = false;
              });
            }, 800);
          }}
          disabled={readOnly}
          placeholder="Re: Petition in support of Dr. Chen for O-1A classification"
        />
      </div>
      <div className="rounded border border-border bg-background/40 px-3 py-2">
        <EditorContent editor={editor} />
      </div>

      {/* Review link + actions */}
      {activeToken && letter.status === "awaiting_review" && (
        <div className="rounded border border-navy/40 bg-navy/5 p-3">
          <Label className="text-xs text-navy">Review link — copy and email this yourself</Label>
          <div className="mt-1 flex gap-2">
            <Input value={reviewUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(reviewUrl);
                toast.success("Copied");
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Anyone with this link can review and sign. Revoke it once you re-send.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(letter.status === "draft" || letter.status === "changes_requested") && (
            <Button
              size="sm"
              onClick={() => send.mutate()}
              disabled={send.isPending || !letter.body_md.trim() || !letter.recommender_email.trim()}
            >
              <Send className="mr-1 h-3 w-3" />
              {letter.status === "changes_requested" ? "Send revised link" : "Send for review"}
            </Button>
          )}
          {letter.status === "awaiting_review" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(reviewUrl);
                  toast.success("Copied");
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
              >
                <XCircle className="mr-1 h-3 w-3" /> Revoke link
              </Button>
            </>
          )}
        </div>
        {letter.status !== "signed" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              if (confirm("Delete this letter?")) del.mutate();
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}
