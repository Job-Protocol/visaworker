// Server-only text extraction for uploaded attachments.
// Supports PDF (unpdf), DOCX (mammoth), TXT/MD (utf-8 decode).
import { extractText as extractPdfText } from "unpdf";

export type ExtractResult = {
  text: string;
  page_count: number | null;
  warnings: string[];
};

const MAX_CACHED_CHARS = 500_000;

export function detectMime(filename: string, provided?: string | null): string {
  if (provided && provided !== "application/octet-stream") return provided;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return provided ?? "application/octet-stream";
}

export function isSupportedMime(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  );
}

export async function extractAttachmentText(
  bytes: Uint8Array,
  mime: string,
): Promise<ExtractResult> {
  const warnings: string[] = [];
  let text = "";
  let pageCount: number | null = null;

  try {
    if (mime === "application/pdf") {
      const out = await extractPdfText(bytes, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n\n") : (out.text as string);
      pageCount = (out as any).totalPages ?? null;
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // mammoth expects a Node Buffer or { buffer } with an ArrayBuffer.
      const mammoth = await import("mammoth");
      const ab = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const result = await mammoth.extractRawText({ arrayBuffer: ab } as any);
      text = result.value ?? "";
      if (result.messages?.length) {
        for (const m of result.messages) warnings.push(`docx: ${m.message}`);
      }
      // Rough page estimate: ~450 words per page.
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      pageCount = Math.max(1, Math.ceil(words / 450));
    } else if (mime === "text/plain" || mime === "text/markdown") {
      text = new TextDecoder("utf-8").decode(bytes);
      pageCount = Math.max(1, Math.ceil(text.length / 3000));
    } else {
      warnings.push(`Unsupported mime type: ${mime}`);
    }
  } catch (e) {
    warnings.push(`Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (text.length > MAX_CACHED_CHARS) {
    text = text.slice(0, MAX_CACHED_CHARS) + `\n\n[truncated at ${MAX_CACHED_CHARS} chars]`;
    warnings.push("Text truncated for cache.");
  }
  return { text, page_count: pageCount, warnings };
}
