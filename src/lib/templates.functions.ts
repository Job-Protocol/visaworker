import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTemplate, type VisaType } from "./petition-templates";

const VisaEnum = z.enum(["EB-1A", "O-1A", "NIW"]);

// Turn a template section into a LaTeX skeleton body. Prefer the pre-authored
// `body` (comments + macro scaffolding, invisible in the compiled PDF); fall
// back to a hidden comment so nothing italic ever ships to the final PDF.
function sectionBody(section: { prompt: string; body?: string }): string {
  if (section.body && section.body.trim().length > 0) return section.body;
  const commentSafe = section.prompt.replace(/\r?\n/g, " ");
  return `% TODO: ${commentSafe}\n`;
}

export const seedProjectSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      projectId: z.string().uuid(),
      overwrite: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirm project ownership + fetch visa type
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, owner_id, visa_type")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project || project.owner_id !== userId) {
      throw new Response("Not found", { status: 404 });
    }

    const { data: existing, error: exErr } = await supabase
      .from("sections")
      .select("id")
      .eq("project_id", data.projectId)
      .limit(1);
    if (exErr) throw exErr;

    if (existing && existing.length > 0) {
      if (!data.overwrite) {
        return { seeded: 0, skipped: true as const };
      }
      const { error: delErr } = await supabase
        .from("sections")
        .delete()
        .eq("project_id", data.projectId);
      if (delErr) throw delErr;
    }

    const tpl = getTemplate(project.visa_type ?? "EB-1A");
    const rows = tpl.sections.map((s, i) => ({
      project_id: data.projectId,
      order_index: i + 1,
      section_key: s.key,
      title: s.title,
      tex_body: sectionBody(s),
    }));

    const { error: insErr } = await supabase.from("sections").insert(rows);
    if (insErr) throw insErr;

    return { seeded: rows.length, skipped: false as const };
  });

