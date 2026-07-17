// Web-capture: scrape a URL with Firecrawl (full-page screenshot + markdown)
// and store it as a numbered exhibit in the current project.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { captureUrlToExhibit } from "./webcapture.server";

export const captureUrlAsExhibit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        projectId: z.string().uuid(),
        url: z.string().url(),
        title: z.string().min(1).max(200).optional(),
        stealth: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Confirm the user actually has access to this project (RLS check).
    const { data: p, error: pErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!p) throw new Error("Project not found");

    return captureUrlToExhibit(supabase, data.projectId, data.url, data.title, {
      stealth: data.stealth,
    });
  });
