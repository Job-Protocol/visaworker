// Exhibit ordering, label compaction, and AI-review overrides.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reorderExhibits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        projectId: z.string().uuid(),
        exhibitIds: z.array(z.string().uuid()).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("exhibits")
      .select("id")
      .eq("project_id", data.projectId);
    if (error) throw error;
    const known = new Set((rows ?? []).map((r) => (r as { id: string }).id));
    for (const id of data.exhibitIds) {
      if (!known.has(id)) throw new Error(`Exhibit ${id} not in project`);
    }
    if (data.exhibitIds.length !== known.size) {
      throw new Error("exhibitIds must include every exhibit in the project exactly once");
    }
    for (let i = 0; i < data.exhibitIds.length; i++) {
      const { error: uErr } = await supabase
        .from("exhibits")
        .update({ order_index: (i + 1) * 10 })
        .eq("id", data.exhibitIds[i]);
      if (uErr) throw uErr;
    }
    return { ok: true, count: data.exhibitIds.length };
  });

export const compactLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ projectId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { compactExhibitLabels } = await import("./exhibit-labels.server");
    return compactExhibitLabels(context.supabase, data.projectId);
  });

/**
 * Apply a user-chosen page selection to an existing exhibit. Generates a
 * trimmed derivative PDF, points `storage_path` at it, and records the new
 * selection. Passing `pages: null` clears the trim and reverts to the original.
 */
export const applyExhibitSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        exhibitId: z.string().uuid(),
        pages: z.array(z.number().int().min(1)).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ex, error } = await supabase
      .from("exhibits")
      .select(
        "id, project_id, label, mime_type, storage_path, original_storage_path, original_page_count",
      )
      .eq("id", data.exhibitId)
      .maybeSingle();
    if (error) throw error;
    if (!ex) throw new Error("Exhibit not found");
    if (ex.mime_type !== "application/pdf") throw new Error("Only PDF exhibits can be trimmed");
    const originalPath = ex.original_storage_path ?? ex.storage_path;
    if (!originalPath) throw new Error("Exhibit has no source file");

    if (data.pages === null) {
      // Revert: point back at the original, drop any derivative.
      await supabase
        .from("exhibits")
        .update({
          storage_path: originalPath,
          included_pages: null,
          trimmed_at: null,
          page_count: ex.original_page_count,
          review_status: "user_confirmed",
        })
        .eq("id", ex.id);
      return { ok: true, reverted: true };
    }

    const { data: file, error: dErr } = await supabase.storage
      .from("exhibits")
      .download(originalPath);
    if (dErr) throw dErr;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { trimPdf } = await import("./pdf-trim.server");
    const trimmed = await trimPdf(bytes, data.pages);
    const derivativePath = `${ex.project_id}/${ex.label}.trimmed.pdf`;
    const { error: upErr } = await supabase.storage
      .from("exhibits")
      .upload(derivativePath, trimmed, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw upErr;

    await supabase
      .from("exhibits")
      .update({
        storage_path: derivativePath,
        original_storage_path: originalPath,
        included_pages: data.pages,
        trimmed_at: new Date().toISOString(),
        page_count: data.pages.length,
        review_status: "user_confirmed",
      })
      .eq("id", ex.id);
    return { ok: true, reverted: false, pages: data.pages.length };
  });

/**
 * Re-run the AI review on an existing exhibit. Useful after strategy edits.
 */
export const rerunExhibitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ exhibitId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ex, error } = await supabase
      .from("exhibits")
      .select(
        "id, project_id, title, mime_type, storage_path, original_storage_path",
      )
      .eq("id", data.exhibitId)
      .maybeSingle();
    if (error) throw error;
    if (!ex) throw new Error("Exhibit not found");
    if (ex.mime_type !== "application/pdf") {
      throw new Error("Review only runs on PDF exhibits");
    }
    const sourcePath = ex.original_storage_path ?? ex.storage_path;
    if (!sourcePath) throw new Error("Exhibit has no source file");
    const { data: file, error: dErr } = await supabase.storage
      .from("exhibits")
      .download(sourcePath);
    if (dErr) throw dErr;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { reviewAndApply } = await import("./exhibit-review.server");
    const outcome = await reviewAndApply({
      supabase,
      projectId: ex.project_id,
      exhibitId: ex.id,
      bytes,
      storagePath: sourcePath,
      mimeType: ex.mime_type,
      exhibitTitle: ex.title ?? "",
      source: "rerun",
    });
    return {
      ok: true,
      status: outcome.status,
      kept: outcome.kept_pages.length,
      total: outcome.original_page_count,
      summary: outcome.recommendation?.summary,
    };
  });
