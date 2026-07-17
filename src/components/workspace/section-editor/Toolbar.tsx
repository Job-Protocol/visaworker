import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  Paperclip,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExhibits } from "@/lib/use-exhibits";
import { cn } from "@/lib/utils";

export function SectionToolbar({
  editor,
  projectId,
}: {
  editor: Editor | null;
  projectId: string;
}) {
  const { data: exhibits } = useExhibits(projectId);
  if (!editor) return null;

  const btn = (active: boolean) =>
    cn(
      "h-7 w-7 rounded p-0",
      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
    );

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-card/60 px-2 py-1">
      <Button size="sm" variant="ghost" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading 2">
        <Heading2 className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Heading 3">
        <Heading3 className="h-3.5 w-3.5" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bulleted list">
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Blockquote">
        <Quote className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={btn(editor.isActive("link"))}
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
        aria-label="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
            <Paperclip className="h-3.5 w-3.5" /> Cite exhibit
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-auto">
          {(!exhibits || exhibits.length === 0) && (
            <DropdownMenuItem disabled>No exhibits yet</DropdownMenuItem>
          )}
          {exhibits?.map((ex) => (
            <DropdownMenuItem
              key={ex.id}
              onSelect={() => {
                editor
                  .chain()
                  .focus()
                  .insertContent([
                    { type: "text", text: " " },
                    { type: "exhibitMention", attrs: { label: ex.label, kind: "exhibitp" } },
                  ])
                  .run();
              }}
            >
              <span className="mr-2 shrink-0 rounded border border-crimson/30 bg-crimson/5 px-1.5 text-[0.75rem] font-medium text-crimson">
                Ex. {ex.order_index}
              </span>
              <span className="truncate text-xs">{ex.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().undo().run()} aria-label="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().redo().run()} aria-label="Redo">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
