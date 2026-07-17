// Shared exhibit label + order allocation. Server-only.
// Labels are STABLE opaque IDs (never reused, never renumbered on delete/reorder).
// Display numbers are derived from order_index at render time (LaTeX + UI).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

/** Highest numeric suffix ever used in a `exNN` label for this project. */
async function maxLabelSuffix(supabase: SB, projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("exhibits")
    .select("label")
    .eq("project_id", projectId);
  if (error) throw error;
  let max = 0;
  for (const row of data ?? []) {
    const m = /^ex(\d+)$/i.exec((row as { label: string }).label ?? "");
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

/** Next append position (order_index). Independent from label suffix. */
async function maxOrderIndex(supabase: SB, projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("exhibits")
    .select("order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.order_index as number | undefined) ?? 0;
}

/**
 * Allocate a fresh, monotonically-increasing label + append position.
 * Deleting an exhibit never causes its label to be reused.
 */
export async function allocateNewExhibitSlot(
  supabase: SB,
  projectId: string,
): Promise<{ label: string; order_index: number }> {
  const [suffix, order] = await Promise.all([
    maxLabelSuffix(supabase, projectId),
    maxOrderIndex(supabase, projectId),
  ]);
  const next = suffix + 1;
  return {
    label: `ex${String(next).padStart(2, "0")}`,
    order_index: order + 1,
  };
}

/**
 * Compact all labels in the project to ex01..exN matching current order_index.
 * Also rewrites `\exhibit{oldLabel}` and `\exhibitp{oldLabel}` in every section
 * body, and renames the storage objects in the `exhibits` bucket. Idempotent.
 *
 * Two-phase renames avoid the UNIQUE(project_id, label) constraint when labels
 * are swapped (e.g. ex01 <-> ex02).
 */
export async function compactExhibitLabels(
  supabase: SB,
  projectId: string,
): Promise<{
  renamed: number;
  mapping: Array<{ old_label: string; new_label: string }>;
}> {
  const { data: rows, error } = await supabase
    .from("exhibits")
    .select("id, label, order_index, storage_path, mime_type")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  const exhibits = (rows ?? []) as Array<{
    id: string;
    label: string;
    order_index: number;
    storage_path: string | null;
    mime_type: string | null;
  }>;

  // Compute target mapping.
  const mapping = exhibits.map((ex, i) => ({
    id: ex.id,
    old_label: ex.label,
    new_label: `ex${String(i + 1).padStart(2, "0")}`,
    storage_path: ex.storage_path,
    mime_type: ex.mime_type,
  }));

  const changed = mapping.filter((m) => m.old_label !== m.new_label);
  if (changed.length === 0) {
    return { renamed: 0, mapping: [] };
  }

  // Phase 1: set every changed row to a unique tmp label to clear the UNIQUE constraint.
  for (const m of changed) {
    const tmp = `__tmp_${m.id.replace(/-/g, "").slice(0, 12)}`;
    const { error: uErr } = await supabase
      .from("exhibits")
      .update({ label: tmp })
      .eq("id", m.id);
    if (uErr) throw uErr;
  }

  // Rename storage objects (best-effort — LaTeX includes reference exhibits/<label>.<ext>).
  for (const m of changed) {
    if (!m.storage_path) continue;
    const extMatch = /(\.[a-zA-Z0-9]+)$/.exec(m.storage_path);
    const ext = extMatch?.[1] ?? "";
    const tmpPath = `${projectId}/__tmp_${m.id.replace(/-/g, "").slice(0, 12)}${ext}`;
    const { error: mvErr } = await supabase.storage
      .from("exhibits")
      .move(m.storage_path, tmpPath);
    if (mvErr) throw mvErr;
    // Track for phase 2
    m.storage_path = tmpPath;
  }

  // Phase 2: assign final labels + final storage paths.
  for (const m of changed) {
    let finalPath = m.storage_path;
    if (m.storage_path) {
      const extMatch = /(\.[a-zA-Z0-9]+)$/.exec(m.storage_path);
      const ext = extMatch?.[1] ?? "";
      finalPath = `${projectId}/${m.new_label}${ext}`;
      const { error: mvErr } = await supabase.storage
        .from("exhibits")
        .move(m.storage_path, finalPath);
      if (mvErr) throw mvErr;
    }
    const { error: uErr } = await supabase
      .from("exhibits")
      .update({ label: m.new_label, storage_path: finalPath })
      .eq("id", m.id);
    if (uErr) throw uErr;
  }

  // Rewrite section citations.
  const { data: sections, error: sErr } = await supabase
    .from("sections")
    .select("id, tex_body")
    .eq("project_id", projectId);
  if (sErr) throw sErr;

  // Build a rename map keyed by old label. Two-phase-safe: only rewrite when new
  // label differs, and process in a single pass with token markers to avoid the
  // classic A→B, B→C cascade problem.
  const renameMap = new Map(changed.map((m) => [m.old_label, m.new_label]));
  for (const s of sections ?? []) {
    const body = (s as { tex_body: string | null }).tex_body ?? "";
    if (!body) continue;
    let touched = false;
    // Match \exhibit{...} and \exhibitp{...} (also \exhibittitle{...}).
    const rewritten = body.replace(
      /\\(exhibit|exhibitp|exhibittitle)\{([^}]+)\}/g,
      (full, macro: string, label: string) => {
        const trimmed = label.trim();
        const next = renameMap.get(trimmed);
        if (!next || next === trimmed) return full;
        touched = true;
        return `\\${macro}{${next}}`;
      },
    );
    if (touched) {
      const { error: upErr } = await supabase
        .from("sections")
        .update({ tex_body: rewritten, updated_at: new Date().toISOString() })
        .eq("id", (s as { id: string }).id);
      if (upErr) throw upErr;
    }
  }

  return {
    renamed: changed.length,
    mapping: changed.map((m) => ({ old_label: m.old_label, new_label: m.new_label })),
  };
}
