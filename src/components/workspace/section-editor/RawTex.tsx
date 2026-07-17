// Escape hatch nodes: preserve any LaTeX the bridge doesn't understand so
// round-tripping through the editor never loses source. Rendered as compact
// chips so the raw source doesn't visually dominate the writing surface.
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { Code2 } from "lucide-react";

function InlineChip({ node }: NodeViewProps) {
  const source = String(node.attrs?.source ?? "");
  const [open, setOpen] = useState(false);
  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <span
        contentEditable={false}
        onClick={() => setOpen((v) => !v)}
        title={source}
        className="mx-0.5 inline-flex cursor-pointer items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1 py-0 font-mono text-[0.75em] text-muted-foreground hover:bg-muted"
      >
        <Code2 className="h-2.5 w-2.5" />
        {open ? source : "TeX"}
      </span>
    </NodeViewWrapper>
  );
}

function BlockChip({ node }: NodeViewProps) {
  const source = String(node.attrs?.source ?? "");
  const [open, setOpen] = useState(false);
  const preview = source.split("\n")[0].slice(0, 60);
  return (
    <NodeViewWrapper className="my-2">
      <div
        contentEditable={false}
        className="rounded border border-dashed border-border/60 bg-muted/30 px-2 py-1.5"
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Code2 className="h-3 w-3" />
          <span className="font-mono">{open ? "LaTeX block" : preview}</span>
          <span className="ml-auto text-[10px]">{open ? "hide" : "show"}</span>
        </button>
        {open && (
          <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
{source}
          </pre>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const RawTexInline = Node.create({
  name: "rawTex",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { source: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "code[data-raw-tex]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "code",
      mergeAttributes(HTMLAttributes, { "data-raw-tex": "" }),
      String(node.attrs.source ?? ""),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineChip);
  },
});

export const RawTexBlock = Node.create({
  name: "rawTexBlock",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return { source: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "pre[data-raw-tex-block]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, { "data-raw-tex-block": "" }),
      String(node.attrs.source ?? ""),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlockChip);
  },
});

