import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEMO_PROJECT_ID } from "@/lib/demo-config";

const DeleteSchema = z.object({ project_id: z.string().uuid() });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.project_id === DEMO_PROJECT_ID) {
      throw new Error("The demo case cannot be deleted.");
    }

    // Verify ownership (RLS also enforces).
    const { data: project, error: projErr } = await context.supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (projErr) throw new Error(projErr.message);
    if (!project || project.owner_id !== context.userId) {
      throw new Error("Case not found");
    }

    const { error } = await context.supabase
      .from("projects")
      .delete()
      .eq("id", data.project_id);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
