import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionEditor } from "./SectionEditor";
import { SectionListItem, type SectionRow } from "./sections/SectionListItem";
import { wordCountFromTex } from "@/lib/section-utils";

type DbRow = Omit<SectionRow, "wordCount">;

export function SectionsPane({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement | null>(null);

  const { data: rawSections } = useQuery<DbRow[]>({
    queryKey: ["sections", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, project_id, section_key, title, order_index, tex_body, updated_at, updated_by_source")
        .eq("project_id", projectId)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as DbRow[];
    },
  });

  // Realtime — replaces the old 3s poll.
  useEffect(() => {
    const channel = supabase
      .channel(`sections:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sections", filter: `project_id=eq.${projectId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["sections", projectId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);

  // Tick the clock so "2m ago" and the agent-edit pulse update.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const sections: SectionRow[] = useMemo(
    () => (rawSections ?? []).map((s) => ({ ...s, wordCount: wordCountFromTex(s.tex_body) })),
    [rawSections],
  );

  const visibleSections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      (s.title ?? "").toLowerCase().includes(q) ||
      s.section_key.toLowerCase().includes(q) ||
      (s.tex_body ?? "").toLowerCase().includes(q),
    );
  }, [sections, filter]);


  // Auto-select first section on first load.
  useEffect(() => {
    if (!selected && sections.length > 0) setSelected(sections[0].id);
  }, [selected, sections]);

  // Keyboard: j/k navigate the visible list, ⌘K / ⌘F / "/" focuses search.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "f")) {
        // Only hijack when the Sections pane is mounted and no other input is focused.
        if (isTypingTarget(document.activeElement) && document.activeElement !== searchRef.current) return;
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      const list = visibleSections;
      if (list.length === 0) return;
      e.preventDefault();
      const idx = list.findIndex((s) => s.id === selected);
      const next = e.key === "j"
        ? Math.min(list.length - 1, idx < 0 ? 0 : idx + 1)
        : Math.max(0, idx < 0 ? 0 : idx - 1);
      setSelected(list[next].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections, selected]);

  const active = sections.find((s) => s.id === selected) ?? null;

  // --- mutations ---

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("sections").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      if (selected === id) setSelected(null);
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createNew = useMutation({
    mutationFn: async () => {
      const maxOrder = sections.reduce((m, s) => Math.max(m, s.order_index), 0);
      const { data, error } = await supabase
        .from("sections")
        .insert({
          project_id: projectId,
          section_key: `section_${Date.now().toString(36)}`,
          title: "Untitled section",
          order_index: maxOrder + 1,
          tex_body: "",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setSelected(id);
      setRenamingId(id);
      qc.invalidateQueries({ queryKey: ["sections", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmDelete = (id: string, title: string) => {
    const label = title || "this section";
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    remove.mutate(id);
  };

  const deleteRef = useRef(confirmDelete);
  deleteRef.current = confirmDelete;

  if (!rawSections) return <p className="p-2 text-sm text-muted-foreground">Loading…</p>;

  if (sections.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p>
          No sections yet. Ask your assistant to draft one, use{" "}
          <span className="font-medium text-foreground">Load starter outline</span> in the header, or start blank:
        </p>
        <Button size="sm" className="mt-3" onClick={() => createNew.mutate()} disabled={createNew.isPending}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New section
        </Button>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-3 sm:grid-cols-[260px_1fr]">
      <div className="flex min-h-0 flex-col border-r border-border/60 pr-2">
        <div className="mb-2 space-y-1.5 px-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
            <input
              ref={searchRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilter("");
                  (e.currentTarget as HTMLInputElement).blur();
                }
                if (e.key === "Enter" && visibleSections[0]) {
                  setSelected(visibleSections[0].id);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder="Search document…"
              className="h-7 w-full rounded-md border border-border/60 bg-background pl-7 pr-6 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-crimson"
            />
            {filter && (
              <button
                onClick={() => setFilter("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground/70">
            <span>
              {filter
                ? `${visibleSections.length} of ${sections.length}`
                : `${sections.length} section${sections.length === 1 ? "" : "s"}`}
            </span>
            <span className="hidden sm:inline">j/k · /</span>
          </div>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto">
          {visibleSections.map((s) => (
            <SectionListItem
              key={s.id}
              section={s}
              selected={selected === s.id}
              editing={renamingId === s.id}
              now={now}
              onSelect={() => setSelected(s.id)}
              onStartRename={() => setRenamingId(s.id)}
              onCancelRename={() => setRenamingId(null)}
              onCommitRename={(title) => {
                setRenamingId(null);
                if (title !== (s.title ?? "")) rename.mutate({ id: s.id, title });
              }}
              onDelete={() => deleteRef.current(s.id, s.title || s.section_key)}
            />
          ))}
          {visibleSections.length === 0 && (
            <li className="px-2 py-4 text-center text-[11px] text-muted-foreground">
              No sections match "{filter}"
            </li>
          )}
        </ul>
        <div className="mt-2 border-t border-border/60 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start gap-1 text-xs text-muted-foreground"
            onClick={() => createNew.mutate()}
            disabled={createNew.isPending}
          >
            <Plus className="h-3.5 w-3.5" /> New section
          </Button>
        </div>
      </div>

      <div className="min-h-0 overflow-hidden">
        {active ? (
          <SectionEditor
            key={active.id}
            sectionId={active.id}
            projectId={projectId}
            initialTex={active.tex_body ?? ""}
            title={active.title || active.section_key}
          />
        ) : (
          <p className="p-2 text-sm text-muted-foreground">Select a section to edit it.</p>
        )}
      </div>
    </div>
  );
}
