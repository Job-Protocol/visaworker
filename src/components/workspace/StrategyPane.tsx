// Strategy pane — a single markdown doc per project that the agent auto-maintains.
// The user edits inline via TipTap; changes autosave. While the agent is busy,
// we refetch and pull in agent-driven edits, but never clobber what the user is typing.
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { toast } from "sonner";

export function StrategyPane({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const { data } = useQuery({
    queryKey: ["strategy", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("strategy_md")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return (data?.strategy_md ?? "") as string;
    },
    // Poll while the agent is working so agent edits appear live, but hold off
    // while the user has unsaved local changes.
    refetchInterval: () => {
      if (dirtyRef.current) return false;
      return (typeof window !== "undefined" &&
        (window as unknown as { __agentBusy?: boolean }).__agentBusy)
        ? 1500
        : false;
    },
  });

  const save = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ strategy_md: content })
        .eq("id", projectId);
      if (error) throw error;
      return content;
    },
    onSuccess: (content) => {
      lastSavedRef.current = content;
      dirtyRef.current = false;
      qc.invalidateQueries({ queryKey: ["strategy", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder:
          "Your assistant will fill this in as you work — a running plan, outstanding to-dos, evidence gaps, and open questions. You can edit here too.",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, breaks: true, transformPastedText: true }),
    ],
    editorProps: {
      attributes: {
        class: "strategy-editor focus:outline-none min-h-full",
      },
    },
    onUpdate: ({ editor }) => {
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
        if (md === lastSavedRef.current) {
          dirtyRef.current = false;
          return;
        }
        save.mutate(md);
      }, 800);
    },
  });

  // Sync incoming server content into the editor without clobbering user edits.
  useEffect(() => {
    if (!editor) return;
    const incoming = data ?? "";
    if (dirtyRef.current) return;
    if (incoming === lastSavedRef.current) return;
    lastSavedRef.current = incoming;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [data, editor]);

  // Flush pending save on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor && dirtyRef.current) {
        const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
        if (md !== lastSavedRef.current) {
          void supabase
            .from("projects")
            .update({ strategy_md: md })
            .eq("id", projectId);
        }
      }
    };
  }, [editor, projectId]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          A running plan your assistant maintains as you work. Edit inline — changes autosave.
        </p>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {save.isPending ? "Saving…" : dirtyRef.current ? "Unsaved" : "Saved"}
        </span>
      </div>
      <div className="flex-1 overflow-auto rounded-md border border-border/60 bg-background/40 px-8 py-6">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
