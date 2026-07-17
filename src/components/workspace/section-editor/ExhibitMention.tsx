// Tiptap node: an exhibit citation rendered as a pill chip.
// Round-trips to \exhibit / \exhibitref / \exhibitp via section-tex-bridge.
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useExhibits } from "@/lib/use-exhibits";

type ExhibitMentionAttrs = {
  label: string;
  kind: "exhibit" | "exhibitref" | "exhibitp";
};

function ChipView({ node }: NodeViewProps) {
  const attrs = node.attrs as ExhibitMentionAttrs;
  const projectId = (typeof window !== "undefined"
    ? (window as unknown as { __currentProjectId?: string }).__currentProjectId
    : "") || "";
  const { data: exhibits } = useExhibits(projectId);
  const match = exhibits?.find((e) => e.label === attrs.label);
  const num = match ? String((match.order_index ?? 0)) : "?";
  const display =
    attrs.kind === "exhibitp"
      ? `Ex. ${num}, p. …`
      : attrs.kind === "exhibit"
      ? `Ex. ${num}`
      : `Ex. ${num}`;
  const title = match?.title ?? attrs.label;
  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <span
        className="mx-0.5 inline-flex items-center gap-1 rounded border border-crimson/30 bg-crimson/5 px-1.5 py-0 text-[0.85em] font-medium text-crimson"
        title={title}
        contentEditable={false}
        data-exhibit-label={attrs.label}
      >
        {display}
      </span>
    </NodeViewWrapper>
  );
}

export const ExhibitMention = Node.create({
  name: "exhibitMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      label: { default: "" },
      kind: { default: "exhibitp" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-exhibit-label]",
        getAttrs: (el) => ({
          label: (el as HTMLElement).getAttribute("data-exhibit-label") ?? "",
          kind: ((el as HTMLElement).getAttribute("data-exhibit-kind") ?? "exhibitp") as ExhibitMentionAttrs["kind"],
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-exhibit-label": node.attrs.label,
        "data-exhibit-kind": node.attrs.kind,
      }),
      `Ex. ${node.attrs.label}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChipView);
  },
});
