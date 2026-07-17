import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IntakeSchema = z.object({
  projectId: z.string().uuid(),
  beneficiary_name: z.string().trim().min(1).max(200),
  field: z.string().trim().min(1).max(200),
  nationality: z.string().trim().max(120).optional().default(""),
  links: z.array(z.string().trim().url().max(500)).max(20).optional().default([]),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const saveProjectIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IntakeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check + read current profile_data so we can merge.
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, owner_id, profile_data")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project || project.owner_id !== userId) {
      throw new Response("Not found", { status: 404 });
    }

    const currentProfile = (project.profile_data ?? {}) as Record<string, unknown>;
    const mergedProfile = {
      ...currentProfile,
      nationality: data.nationality || (currentProfile.nationality as string | undefined) || "",
      links: data.links,
      intake_notes: data.notes || (currentProfile.intake_notes as string | undefined) || "",
      intake_completed_at: new Date().toISOString(),
    };

    const { error: uErr } = await supabase
      .from("projects")
      .update({
        beneficiary_name: data.beneficiary_name,
        field: data.field,
        profile_data: mergedProfile,
      })
      .eq("id", data.projectId);
    if (uErr) throw uErr;

    return { ok: true as const };
  });
