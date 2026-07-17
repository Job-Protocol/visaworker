// Rich Tiptap editor for a single section. Loads tex_body → ProseMirror,
// autosaves back to LaTeX via the set_section_body RPC (versioning trigger fires).
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { toast } from "sonner";
import { Bold, Italic, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { texToProseMirror, proseMirrorToTex } from "@/lib/section-tex-bridge";
import { ExhibitMention } from "./section-editor/ExhibitMention";
import { RawTexBlock, RawTexInline } from "./section-editor/RawTex";
import { SectionToolbar } from "./section-editor/Toolbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relTimeShort } from "@/lib/section-utils";

type SaveState = "saved" | "saving" | "dirty";
type Mode = "write" | "latex";

export function SectionEditor({
  sectionId,
  projectId,
  initialTex,
  title,
  onExternalUpdate,
}: {
  sectionId: string;
  projectId: string;
  initialTex: string;
  title: string;
  onExternalUpdate?: () => void;
}) {
  const qc = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mode, setMode] = useState<Mode>("write");
  const [titleDraft, setTitleDraft] = useState(title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const dirtyRef = useRef(false);
  const lastSavedTexRef = useRef(initialTex);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTex, setCurrentTex] = useState(initialTex);

  // Reset local title state when the parent hands us a new section.
  useEffect(() => {
    setTitleDraft(title);
    setEditingTitle(false);
  }, [title, sectionId]);

  // Live-relative "saved 12s ago" label.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Expose current project id to the exhibit-mention chip view (which is a
  // Tiptap node view without access to editor props).
  useEffect(() => {
    (window as unknown as { __currentProjectId?: string }).__currentProjectId = projectId;
  }, [projectId]);

  const save = useMutation({
    mutationFn: async (tex: string) => {
      const { error } = await supabase.rpc("set_section_body", {
        _section_id: sectionId,
        _tex_body: tex,
        _source: "manual_edit",
        _role: "owner",
      });
      if (error) throw error;
      return tex;
    },
    onMutate: () => setSaveState("saving"),
    onSuccess: (tex) => {
      lastSavedTexRef.current = tex;
      dirtyRef.current = false;
      setSaveState("saved");
      setLastSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
    },
    onError: (e: Error) => {
      setSaveState("dirty");
      toast.error(e.message);
    },
  });

  const saveTitle = useMutation({
    mutationFn: async (nextTitle: string) => {
      const { error } = await supabase
        .from("sections")
        .update({ title: nextTitle })
        .eq("id", sectionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          codeBlock: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder: "Draft this section, or ask your assistant to fill it in…",
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { class: "text-crimson underline underline-offset-2" },
        }),
        ExhibitMention,
        RawTexInline,
        RawTexBlock,
      ],
      content: texToProseMirror(initialTex) as unknown as object,
      editorProps: {
        attributes: {
          class: "section-editor focus:outline-none min-h-full",
        },
      },
      onCreate: ({ editor }) => {
        setWordCount(countWords(editor.getText()));
      },
      onUpdate: ({ editor }) => {
        dirtyRef.current = true;
        setSaveState("dirty");
        setWordCount(countWords(editor.getText()));
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          const json = editor.getJSON();
          const tex = proseMirrorToTex(json as never);
          setCurrentTex(tex);
          if (tex === lastSavedTexRef.current) {
            dirtyRef.current = false;
            setSaveState("saved");
            return;
          }
          save.mutate(tex);
        }, 800);
      },
    },
    [sectionId],
  );

  // If the parent hands us a new initialTex (e.g. an agent edit landed while
  // we weren't dirty), reset the editor. Never clobber unsaved user edits.
  useEffect(() => {
    if (!editor) return;
    if (dirtyRef.current) return;
    if (initialTex === lastSavedTexRef.current) return;
    lastSavedTexRef.current = initialTex;
    setCurrentTex(initialTex);
    editor.commands.setContent(texToProseMirror(initialTex) as unknown as object, { emitUpdate: false });
    setWordCount(countWords(editor.getText()));
    onExternalUpdate?.();
  }, [editor, initialTex, onExternalUpdate]);

  // Flush on unmount / section switch.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor && dirtyRef.current) {
        const json = editor.getJSON();
        const tex = proseMirrorToTex(json as never);
        if (tex !== lastSavedTexRef.current) {
          void supabase.rpc("set_section_body", {
            _section_id: sectionId,
            _tex_body: tex,
            _source: "manual_edit",
            _role: "owner",
          });
        }
      }
    };
  }, [editor, sectionId]);

  const savedLabel = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "dirty") return "Unsaved changes";
    if (lastSavedAt) return `Saved ${relTimeShort(new Date(lastSavedAt).toISOString(), now)}`;
    return "Saved";
  }, [saveState, lastSavedAt, now]);

  const commitTitle = () => {
    const t = titleDraft.trim();
    setEditingTitle(false);
    if (!t || t === title) {
      setTitleDraft(title);
      return;
    }
    saveTitle.mutate(t);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header: inline-editable title + metadata + mode toggle */}
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleDraft(title);
                }
              }}
              onBlur={commitTitle}
              className="w-full rounded border border-border/60 bg-background px-1.5 py-0.5 font-serif text-lg text-foreground outline-none focus:border-crimson"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="block w-full truncate text-left font-serif text-lg text-foreground hover:text-crimson"
              title="Click to rename"
            >
              {title}
            </button>

          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{wordCount.toLocaleString()} words</span>
            <span aria-hidden>·</span>
            <span className={saveState === "dirty" ? "text-amber-600" : ""}>{savedLabel}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center rounded-md border border-border/60 bg-muted/40 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              mode === "write"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setMode("latex")}
            title="View the LaTeX source"
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              mode === "latex"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Code
          </button>
        </div>

      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-parchment/40">
        {mode === "write" ? (
          <>
            <SectionToolbar editor={editor} projectId={projectId} />
            {editor && (
              <BubbleMenu
                editor={editor}
                shouldShow={({ editor: ed, from, to }) => from !== to && ed.isEditable}
                className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md"
              >
                <BubbleBtn
                  active={editor.isActive("bold")}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  label="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </BubbleBtn>
                <BubbleBtn
                  active={editor.isActive("italic")}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  label="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </BubbleBtn>
                <BubbleBtn
                  active={editor.isActive("link")}
                  onClick={() => {
                    const prev = (editor.getAttributes("link") as { href?: string }).href ?? "";
                    const href = window.prompt("Link URL", prev);
                    if (href === null) return;
                    if (href === "") {
                      editor.chain().focus().extendMarkRange("link").unsetLink().run();
                    } else {
                      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
                    }
                  }}
                  label="Link"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </BubbleBtn>
              </BubbleMenu>
            )}
            <div className="flex-1 overflow-auto px-8 py-6">
              <EditorContent editor={editor} className="h-full" />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span>Source · read only</span>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(currentTex);
                  toast.success("Copied source");
                }}
                className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
              >
                Copy
              </button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground/80">
{currentTex}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function BubbleBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded",
        active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
