// POST /api/attachments/ingest — multipart form: file, project_id, target ("exhibit" | "upload"),
// optional title, tags (comma-separated).
// Uploads to storage, extracts text server-side, inserts row + cache. Returns row summary.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/attachments/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
          if (!token) return json({ error: "Missing bearer token" }, 401);

          const form = await request.formData();
          const file = form.get("file");
          const projectId = String(form.get("project_id") ?? "");
          const target = String(form.get("target") ?? "upload") as "exhibit" | "upload";
          const providedTitle = form.get("title") ? String(form.get("title")) : null;
          const tagsRaw = form.get("tags") ? String(form.get("tags")) : "";
          const tags = tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
          const replaceExhibitId = form.get("replace_exhibit_id")
            ? String(form.get("replace_exhibit_id"))
            : null;
          const requestId = form.get("request_id") ? String(form.get("request_id")) : null;
          const slotKey = form.get("slot_key") ? String(form.get("slot_key")) : null;

          if (!(file instanceof File)) return json({ error: "file required" }, 400);
          if (!projectId) return json({ error: "project_id required" }, 400);
          if (target !== "exhibit" && target !== "upload")
            return json({ error: "target must be 'exhibit' or 'upload'" }, 400);
          if (replaceExhibitId && target !== "exhibit")
            return json({ error: "replace_exhibit_id only valid with target=exhibit" }, 400);

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            },
          );

          const { data: userRes, error: uErr } = await supabase.auth.getUser();
          if (uErr || !userRes.user) return json({ error: "Unauthorized" }, 401);

          const { data: p } = await supabase
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .maybeSingle();
          if (!p) return json({ error: "Project not found" }, 404);

          const { detectMime, isSupportedMime, extractAttachmentText } = await import(
            "@/lib/attachments-extract.server"
          );
          const mime = detectMime(file.name, file.type);
          if (!isSupportedMime(mime))
            return json({ error: `Unsupported file type: ${mime}` }, 415);

          const bytes = new Uint8Array(await file.arrayBuffer());
          const title = providedTitle ?? file.name.replace(/\.[^.]+$/, "");

          // Some extractors (pdfjs, pdf-lib) transfer/detach the underlying
          // ArrayBuffer. Give the extractor its own copy so `bytes` remains
          // valid for the subsequent storage upload.
          const extracted = await extractAttachmentText(bytes.slice(), mime);

          if (target === "exhibit" && replaceExhibitId) {
            const { data: existingEx, error: exErr } = await supabase
              .from("exhibits")
              .select("id, label, order_index, title, storage_path, tags")
              .eq("id", replaceExhibitId)
              .eq("project_id", projectId)
              .maybeSingle();
            if (exErr) throw exErr;
            if (!existingEx) return json({ error: "Exhibit not found" }, 404);

            const ext = extForMime(mime);
            const newPath = `${projectId}/${existingEx.label}${ext}`;
            const { error: upErr } = await supabase.storage
              .from("exhibits")
              .upload(newPath, bytes, { contentType: mime, upsert: true });
            if (upErr) throw upErr;
            if (existingEx.storage_path && existingEx.storage_path !== newPath) {
              await supabase.storage.from("exhibits").remove([existingEx.storage_path]);
            }

            const patch: {
              storage_path: string;
              original_storage_path: string;
              original_page_count: number | null;
              size_bytes: number;
              page_count: number | null;
              mime_type: string;
              original_filename: string;
              title?: string;
              tags?: string[];
            } = {
              storage_path: newPath,
              original_storage_path: newPath,
              original_page_count: extracted.page_count,
              size_bytes: file.size,
              page_count: extracted.page_count,
              mime_type: mime,
              original_filename: file.name,
            };
            if (providedTitle) patch.title = providedTitle;
            if (tags.length) patch.tags = tags;

            const { data: row, error: updErr } = await supabase
              .from("exhibits")
              .update(patch)
              .eq("id", existingEx.id)
              .select("id, label, title, mime_type, page_count")
              .single();
            if (updErr) throw updErr;

            await supabase.from("exhibit_cache").upsert({
              exhibit_id: row.id,
              extracted_text: extracted.text ?? "",
              updated_at: new Date().toISOString(),
            });

            return json({
              ok: true,
              kind: "exhibit",
              replaced: true,
              previous_title: existingEx.title,
              exhibit: row,
              warnings: extracted.warnings,
            });
          }

          if (target === "exhibit") {
            const { allocateNewExhibitSlot } = await import("@/lib/exhibit-labels.server");
            const slot = await allocateNewExhibitSlot(supabase, projectId);
            const label = slot.label;
            const nextIdx = slot.order_index;
            const ext = extForMime(mime);
            const path = `${projectId}/${label}${ext}`;
            const { error: upErr } = await supabase.storage
              .from("exhibits")
              .upload(path, bytes, { contentType: mime, upsert: true });
            if (upErr) throw upErr;

            const { data: row, error: insErr } = await supabase
              .from("exhibits")
              .insert({
                project_id: projectId,
                label,
                title,
                order_index: nextIdx,
                storage_path: path,
                original_storage_path: path,
                original_page_count: extracted.page_count,
                size_bytes: file.size,
                page_count: extracted.page_count,
                mime_type: mime,
                original_filename: file.name,
                tags: tags.length ? tags : undefined,
              })
              .select("id, label, title, mime_type, page_count")
              .single();
            if (insErr) throw insErr;

            if (extracted.text) {
              await supabase.from("exhibit_cache").upsert({
                exhibit_id: row.id,
                extracted_text: extracted.text,
                updated_at: new Date().toISOString(),
              });
            }

            // Autonomously review + (when confident) trim the PDF to just the
            // relevant pages. Non-PDF exhibits skip this pass.
            let review:
              | {
                  status: string;
                  kept_pages: number[];
                  original_page_count: number;
                  summary?: string;
                  relevance?: string;
                  note?: string;
                }
              | null = null;
            if (mime === "application/pdf") {
              try {
                const { reviewAndApply } = await import("@/lib/exhibit-review.server");
                const outcome = await reviewAndApply({
                  supabase,
                  projectId,
                  exhibitId: row.id,
                  bytes,
                  storagePath: path,
                  mimeType: mime,
                  exhibitTitle: title,
                  source: `upload:${file.name}`,
                });
                review = {
                  status: outcome.status,
                  kept_pages: outcome.kept_pages,
                  original_page_count: outcome.original_page_count,
                  summary: outcome.recommendation?.summary,
                  relevance: outcome.recommendation?.relevance,
                  note: outcome.note,
                };
              } catch (e) {
                console.error("exhibit-review failed", e);
              }
            }

            return json({
              ok: true,
              kind: "exhibit",
              exhibit: row,
              review,
              warnings: extracted.warnings,
            });
          }



          // target === 'upload'
          const path = `${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
          const { error: upErr } = await supabase.storage
            .from("uploads")
            .upload(path, bytes, { contentType: mime, upsert: false });
          if (upErr) throw upErr;

          const { data: row, error: insErr } = await supabase
            .from("uploads")
            .insert({
              project_id: projectId,
              title,
              kind: kindForMime(mime),
              storage_path: path,
              mime_type: mime,
              size_bytes: file.size,
              extracted_text: extracted.text || null,
              request_id: requestId,
              slot_key: slotKey,
            } as any)
            .select("id, title, kind, mime_type, size_bytes")
            .single();
          if (insErr) throw insErr;

          return json({
            ok: true,
            kind: "upload",
            upload: row,
            preview: extracted.text.slice(0, 1200),
            warnings: extracted.warnings,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("attachments.ingest error", e);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});

function extForMime(m: string): string {
  if (m === "application/pdf") return ".pdf";
  if (m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return ".docx";
  if (m === "text/markdown") return ".md";
  if (m === "text/plain") return ".txt";
  return "";
}

function kindForMime(m: string): string {
  if (m === "application/pdf") return "pdf";
  if (m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (m === "text/markdown") return "markdown";
  if (m === "text/plain") return "text";
  return "other";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
