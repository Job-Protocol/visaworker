import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relTimeShort, isRecentAgentEdit } from "@/lib/section-utils";

export type SectionRow = {
  id: string;
  project_id: string;
  section_key: string;
  title: string | null;
  order_index: number;
  tex_body: string;
  updated_at: string;
  updated_by_source: string | null;
  // derived, computed by parent
  wordCount: number;
};

export function SectionListItem({
  section,
  selected,
  editing,
  now,
  onSelect,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onDelete,
}: {
  section: SectionRow;
  selected: boolean;
  editing: boolean;
  now: number;
  onSelect: () => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onCommitRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(section.title ?? section.section_key);
  const pulsing = isRecentAgentEdit(section.updated_at, section.updated_by_source, now);

  return (
    <li
      className={cn(
        "group relative rounded",
        selected ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <div className="flex items-start gap-1 px-1.5 py-1.5">
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          {editing ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitRename(draftTitle.trim() || section.section_key);
                if (e.key === "Escape") onCancelRename();
              }}
              onBlur={() => onCommitRename(draftTitle.trim() || section.section_key)}
              className="w-full rounded border border-border/60 bg-background px-1 py-0.5 font-serif text-sm outline-none focus:border-crimson"
            />
          ) : (
            <span
              className={cn(
                "block truncate font-serif text-sm",
                selected ? "text-accent-foreground font-medium" : "text-foreground",
              )}
            >
              {section.title || section.section_key}
            </span>
          )}
          {!editing && (
            <div
              className={cn(
                "mt-0.5 flex items-center gap-1.5 text-[10px]",
                selected ? "text-accent-foreground/75" : "text-muted-foreground/80",
              )}
            >
              <span>{section.wordCount.toLocaleString()} words</span>
              <span aria-hidden>·</span>
              <span>{relTimeShort(section.updated_at, now)}</span>
              {pulsing && (
                <span className="ml-1 inline-flex items-center gap-1 text-crimson">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-crimson" />
                  assistant editing
                </span>
              )}
            </div>
          )}
        </button>

        {!editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Section actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={onStartRename}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
