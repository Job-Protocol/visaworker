// Round-trip a curated subset of LaTeX to ProseMirror JSON and back.
// Anything unrecognized is preserved verbatim in `rawTex` inline/block nodes so
// nothing is ever lost when a user opens the editor and saves.
//
// Supported subset (matches what the agent emits — see SYSTEM_PROMPT):
//   \subsection / \subsubsection   → heading level 2 / 3
//   \textbf / \textit / \emph       → bold / italic marks
//   \begin{itemize} / \begin{enumerate} + \item → bulletList / orderedList
//   \begin{quote}                   → blockquote
//   \exhibit / \exhibitref / \exhibitp → exhibitMention node
//   escaped chars \$ \% \& \# \_ \S{} \euro{} → literal chars
//   ~                               → normal space
//   everything else                 → rawTex (inline or block)

export type PMText = { type: "text"; text: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> };
export type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[] | PMText[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};
export type PMDoc = { type: "doc"; content: PMNode[] };

// ---------- helpers ----------

function balancedBraces(src: string, i: number): number {
  // src[i] must be '{'. Returns index of matching '}'.
  if (src[i] !== "{") return -1;
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === "\\") { k++; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return k; }
  }
  return -1;
}

function findEnv(src: string, start: number, env: string): number {
  // Returns index of matching \end{env} for a \begin{env} whose \begin started at `start`.
  const open = `\\begin{${env}}`;
  const close = `\\end{${env}}`;
  let i = start + open.length;
  let depth = 1;
  while (i < src.length) {
    const nextOpen = src.indexOf(open, i);
    const nextClose = src.indexOf(close, i);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + open.length; }
    else { depth--; if (depth === 0) return nextClose; i = nextClose + close.length; }
  }
  return -1;
}

// ---------- TEX → PM ----------

const KNOWN_ENVS = new Set(["itemize", "enumerate", "quote"]);

function isBlockStart(src: string, i: number): boolean {
  return (
    src.startsWith("\\subsection{", i) ||
    src.startsWith("\\subsubsection{", i) ||
    /^\\begin\{[^}]+\}/.test(src.slice(i, i + 40))
  );
}

function parseParagraphEnd(src: string, i: number): number {
  // End at blank line OR at a line-starting block command.
  let k = i;
  while (k < src.length) {
    // Look for a newline followed (optionally) by whitespace + newline → blank line.
    if (src[k] === "\n") {
      let p = k + 1;
      while (p < src.length && (src[p] === " " || src[p] === "\t")) p++;
      if (p >= src.length || src[p] === "\n") return k;
      if (isBlockStart(src, p)) return k;
    }
    k++;
  }
  return k;
}

export function texToProseMirror(tex: string): PMDoc {
  const src = (tex ?? "").replace(/\r\n?/g, "\n");
  const blocks: PMNode[] = [];
  let i = 0;

  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;

    // Heading?
    let m: RegExpExecArray | null;
    m = /^\\subsection\*?\{/.exec(src.slice(i));
    if (m) {
      const braceOpen = i + m[0].length - 1;
      const end = balancedBraces(src, braceOpen);
      if (end !== -1) {
        const title = src.slice(braceOpen + 1, end);
        blocks.push({ type: "heading", attrs: { level: 2 }, content: parseInline(title) });
        i = end + 1;
        continue;
      }
    }
    m = /^\\subsubsection\*?\{/.exec(src.slice(i));
    if (m) {
      const braceOpen = i + m[0].length - 1;
      const end = balancedBraces(src, braceOpen);
      if (end !== -1) {
        const title = src.slice(braceOpen + 1, end);
        blocks.push({ type: "heading", attrs: { level: 3 }, content: parseInline(title) });
        i = end + 1;
        continue;
      }
    }

    // Environment?
    m = /^\\begin\{([^}]+)\}(\[[^\]]*\])?/.exec(src.slice(i));
    if (m) {
      const env = m[1];
      const endIdx = findEnv(src, i, env);
      if (endIdx === -1) {
        // Unclosed — dump remainder as rawBlock.
        blocks.push({ type: "rawTexBlock", attrs: { source: src.slice(i) } });
        break;
      }
      const bodyStart = i + m[0].length;
      const body = src.slice(bodyStart, endIdx);
      const closeLen = `\\end{${env}}`.length;
      const consumed = endIdx + closeLen;
      if (env === "itemize" || env === "enumerate") {
        blocks.push(parseList(env, body));
        i = consumed;
        continue;
      }
      if (env === "quote") {
        blocks.push({ type: "blockquote", content: parseBlocks(body) });
        i = consumed;
        continue;
      }
      // Unknown env → preserve verbatim.
      blocks.push({ type: "rawTexBlock", attrs: { source: src.slice(i, consumed) } });
      i = consumed;
      continue;
    }

    // Paragraph.
    const pEnd = parseParagraphEnd(src, i);
    const text = src.slice(i, pEnd).trim();
    if (text) blocks.push({ type: "paragraph", content: parseInline(text) });
    i = pEnd;
  }

  if (blocks.length === 0) blocks.push({ type: "paragraph" });
  return { type: "doc", content: blocks };
}

function parseBlocks(tex: string): PMNode[] {
  return texToProseMirror(tex).content;
}

function parseList(env: "itemize" | "enumerate", body: string): PMNode {
  // Split on top-level \item (ignore \item inside nested envs).
  const items: string[] = [];
  let depth = 0;
  let start = -1;
  let i = 0;
  while (i < body.length) {
    if (body.startsWith("\\begin{", i)) {
      depth++;
      const close = body.indexOf("}", i);
      i = close === -1 ? body.length : close + 1;
      continue;
    }
    if (body.startsWith("\\end{", i)) {
      depth--;
      const close = body.indexOf("}", i);
      i = close === -1 ? body.length : close + 1;
      continue;
    }
    if (depth === 0 && body.startsWith("\\item", i)) {
      if (start !== -1) items.push(body.slice(start, i));
      // Skip \item and optional [label]
      i += 5;
      if (body[i] === "[") { const c = body.indexOf("]", i); i = c === -1 ? body.length : c + 1; }
      start = i;
      continue;
    }
    i++;
  }
  if (start !== -1) items.push(body.slice(start));
  const listItems: PMNode[] = items.map((raw) => {
    const inner = raw.trim();
    // If the item contains block-level structure, parse as blocks; else single paragraph.
    const hasBlock = /\\begin\{|\\subsection|\n\s*\n/.test(inner);
    const content = hasBlock ? parseBlocks(inner) : [{ type: "paragraph", content: parseInline(inner) }];
    return { type: "listItem", content } as PMNode;
  });
  return { type: env === "itemize" ? "bulletList" : "orderedList", content: listItems };
}

// ---------- inline parser ----------

type InlineNode = PMText | PMNode;

function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = "";
  const flush = (marks?: Array<{ type: string }>) => {
    if (!buf) return;
    const node: PMText = { type: "text", text: buf };
    if (marks && marks.length) node.marks = marks;
    out.push(node);
    buf = "";
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    // Escape sequences.
    if (c === "\\") {
      // \\S{} → §
      if (src.startsWith("\\S{}", i)) { buf += "§"; i += 4; continue; }
      if (src.startsWith("\\euro{}", i)) { buf += "€"; i += 7; continue; }
      // Escaped single chars.
      const esc = src[i + 1];
      if (esc && "$%&#_{}".includes(esc)) { buf += esc; i += 2; continue; }
      // -- and ---
      // (Handled below as plain text; LaTeX renders them but they're already the source form.)

      // Command name.
      const cmdMatch = /^\\([a-zA-Z@]+)\*?/.exec(src.slice(i));
      if (cmdMatch) {
        const name = cmdMatch[1];
        const after = i + cmdMatch[0].length;

        // Marks with one arg.
        if ((name === "textbf" || name === "textit" || name === "emph") && src[after] === "{") {
          const end = balancedBraces(src, after);
          if (end !== -1) {
            flush();
            const inner = parseInline(src.slice(after + 1, end));
            const markType = name === "textbf" ? "bold" : "italic";
            for (const n of inner) {
              if ((n as PMText).type === "text") {
                const t = n as PMText;
                t.marks = [...(t.marks ?? []), { type: markType }];
                out.push(t);
              } else {
                out.push(n);
              }
            }
            i = end + 1;
            continue;
          }
        }

        // \href{url}{text} → link mark
        if (name === "href" && src[after] === "{") {
          const urlEnd = balancedBraces(src, after);
          if (urlEnd !== -1 && src[urlEnd + 1] === "{") {
            const textStart = urlEnd + 1;
            const textEnd = balancedBraces(src, textStart);
            if (textEnd !== -1) {
              const url = src.slice(after + 1, urlEnd);
              const inner = parseInline(src.slice(textStart + 1, textEnd));
              flush();
              for (const n of inner) {
                if ((n as PMText).type === "text") {
                  const t = n as PMText;
                  t.marks = [...(t.marks ?? []), { type: "link", attrs: { href: url } }];
                  out.push(t);
                } else {
                  out.push(n);
                }
              }
              i = textEnd + 1;
              continue;
            }
          }
        }

        // Exhibit citations.
        if ((name === "exhibit" || name === "exhibitref" || name === "exhibitp") && src[after] === "{") {
          const end = balancedBraces(src, after);
          if (end !== -1) {
            const label = src.slice(after + 1, end).trim();
            // Drop a preceding "~" (nbsp) — we'll re-add on serialize.
            if (buf.endsWith("~")) buf = buf.slice(0, -1);
            flush();
            out.push({ type: "exhibitMention", attrs: { label, kind: name } });
            i = end + 1;
            continue;
          }
        }

        // Unknown command — preserve verbatim as a rawTex inline node so it round-trips.
        // Capture command + one optional {...} argument if present.
        let raw = cmdMatch[0];
        let j = after;
        if (src[j] === "{") {
          const end = balancedBraces(src, j);
          if (end !== -1) { raw += src.slice(j, end + 1); j = end + 1; }
        }
        flush();
        out.push({ type: "rawTex", attrs: { source: raw } });
        i = j;
        continue;
      }

      // Backslash followed by a non-letter (e.g. `\ `, `\,`, `\;`, `\!`).
      // Preserve verbatim as a rawTex inline so it round-trips exactly.
      const nextCh = src[i + 1] ?? "";
      flush();
      out.push({ type: "rawTex", attrs: { source: "\\" + nextCh } });
      i += nextCh ? 2 : 1;
      continue;
    }

    // Non-breaking space → normal space (we re-insert `~` before exhibit macros on save).
    if (c === "~") { buf += " "; i++; continue; }

    buf += c;
    i++;
  }

  flush();
  return out;
}

// ---------- PM → TEX ----------

function escText(s: string): string {
  // Text nodes never contain literal `\` (the inline parser routes every
  // backslash into a rawTex node), so we only escape the plain special chars.
  return s
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/\^/g, "\\^{}")
    .replace(/§/g, "\\S{}")
    .replace(/€/g, "\\euro{}");
}

function serializeInline(nodes: (PMText | PMNode)[] | undefined): string {
  if (!nodes) return "";
  let out = "";
  for (const n of nodes) {
    if ((n as PMText).type === "text") {
      const t = n as PMText;
      let s = escText(t.text ?? "");
      const marks = t.marks ?? [];
      if (marks.some((m) => m.type === "bold")) s = `\\textbf{${s}}`;
      if (marks.some((m) => m.type === "italic")) s = `\\textit{${s}}`;
      const link = marks.find((m) => m.type === "link");
      if (link) {
        const href = String((link.attrs as { href?: string } | undefined)?.href ?? "");
        if (href) s = `\\href{${href}}{${s}}`;
      }
      out += s;
      continue;
    }
    const node = n as PMNode;
    if (node.type === "exhibitMention") {
      const label = String(node.attrs?.label ?? "");
      const kind = String(node.attrs?.kind ?? "exhibitp");
      // Re-insert nbsp before the macro if preceded by a space.
      if (out.endsWith(" ")) out = out.slice(0, -1) + "~";
      out += `\\${kind}{${label}}`;
      continue;
    }
    if (node.type === "rawTex") {
      out += String(node.attrs?.source ?? "");
      continue;
    }
    if (node.type === "hardBreak") { out += "\\\\\n"; continue; }
    // Unknown inline → best-effort recurse.
    out += serializeInline((node.content ?? []) as (PMText | PMNode)[]);
  }
  return out;
}

export function proseMirrorToTex(doc: PMDoc | PMNode): string {
  const root = (doc as PMDoc).type === "doc" ? (doc as PMDoc).content : ((doc as PMNode).content as PMNode[] ?? []);
  const parts: string[] = [];
  for (const b of root) parts.push(serializeBlock(b));
  return parts.filter(Boolean).join("\n\n").trim() + "\n";
}

function serializeBlock(node: PMNode): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline((node.content ?? []) as (PMText | PMNode)[]);
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const cmd = level >= 3 ? "\\subsubsection" : "\\subsection";
      return `${cmd}{${serializeInline((node.content ?? []) as (PMText | PMNode)[])}}`;
    }
    case "bulletList":
      return serializeList("itemize", (node.content ?? []) as PMNode[]);
    case "orderedList":
      return serializeList("enumerate", (node.content ?? []) as PMNode[]);
    case "blockquote":
      return `\\begin{quote}\n${((node.content ?? []) as PMNode[]).map(serializeBlock).filter(Boolean).join("\n\n")}\n\\end{quote}`;
    case "rawTexBlock":
      return String(node.attrs?.source ?? "");
    case "horizontalRule":
      return "\\hrulefill";
    default:
      // Unknown block — best-effort: recurse into children as paragraphs.
      return ((node.content ?? []) as PMNode[]).map(serializeBlock).join("\n\n");
  }
}

function serializeList(env: "itemize" | "enumerate", items: PMNode[]): string {
  const opts = env === "itemize" ? "[leftmargin=*, itemsep=2pt]" : "[leftmargin=*, itemsep=4pt]";
  const lines: string[] = [];
  lines.push(`\\begin{${env}}${opts}`);
  for (const li of items) {
    const body = ((li.content ?? []) as PMNode[]).map(serializeBlock).filter(Boolean).join("\n\n");
    lines.push(`\\item ${body}`);
  }
  lines.push(`\\end{${env}}`);
  return lines.join("\n");
}
