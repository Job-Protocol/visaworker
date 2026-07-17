// Server-only helpers for per-page PDF text extraction and page-range trimming.
// Uses `unpdf` (already installed) for extraction so we get per-page text without
// merging, and `pdf-lib` (already installed) for building the trimmed derivative.
// Both are pure-JS and Worker-safe.

import { extractText, getDocumentProxy } from "unpdf";
import { PDFDocument } from "pdf-lib";

export type PageText = { page: number; text: string };

/**
 * Extract text from every page of a PDF. Returns one entry per page, 1-indexed.
 * Long pages are truncated to `maxCharsPerPage` so the downstream AI prompt
 * stays within a sensible budget.
 */
export async function extractPagesText(
  bytes: Uint8Array,
  maxCharsPerPage = 1500,
): Promise<{ pages: PageText[]; total: number }> {
  const proxy = await getDocumentProxy(bytes);
  const out = await extractText(proxy, { mergePages: false });
  const arr = Array.isArray(out.text) ? out.text : [String(out.text ?? "")];
  const total = (out as { totalPages?: number }).totalPages ?? arr.length;
  const pages: PageText[] = arr.map((raw, i) => {
    const clean = String(raw ?? "").replace(/\s+/g, " ").trim();
    const trimmed = clean.length > maxCharsPerPage ? clean.slice(0, maxCharsPerPage) + "…" : clean;
    return { page: i + 1, text: trimmed };
  });
  return { pages, total };
}

/**
 * Build a new PDF containing only the requested pages, in the given order.
 * Page numbers are 1-indexed. Duplicate / out-of-range entries are dropped.
 */
export async function trimPdf(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const seen = new Set<number>();
  const wanted: number[] = [];
  for (const p of pages) {
    if (!Number.isInteger(p) || p < 1 || p > total) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    wanted.push(p);
  }
  if (wanted.length === 0) throw new Error("No valid pages to include");

  const dst = await PDFDocument.create();
  const copied = await dst.copyPages(
    src,
    wanted.map((p) => p - 1),
  );
  for (const page of copied) dst.addPage(page);
  return dst.save();
}
