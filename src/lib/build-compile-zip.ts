// Prepares the list of "resources" we hand to the compile server
// (latex.ytotech.com / latex-on-http). Tex files are sent inline as strings;
// exhibits stay in the private `exhibits` bucket and we hand the compile
// server a short-lived signed URL so it can fetch them directly. This avoids
// bundling megabytes of PDFs into a single upload — which was hitting nginx's
// 413 (Request Entity Too Large) on the public latex compile endpoint.
import { supabase } from "@/integrations/supabase/client";

type Exhibit = {
  label: string;
  storage_path: string | null;
  mime_type: string | null;
};

export type CompileResource =
  | { path: string; content: string; main?: boolean }
  | { path: string; url: string; main?: boolean };

export async function buildCompileResources(
  files: Record<string, string>,
  mainFile: string,
  exhibits: Exhibit[],
): Promise<{ resources: CompileResource[] }> {
  const resources: CompileResource[] = [];

  for (const [path, content] of Object.entries(files)) {
    resources.push(path === mainFile ? { path, content, main: true } : { path, content });
  }

  await Promise.all(
    exhibits.map(async (ex) => {
      const mime = ex.mime_type ?? "application/pdf";
      let ext: string | null = null;
      if (mime === "application/pdf") ext = "pdf";
      else if (mime === "image/png") ext = "png";
      else if (mime === "image/jpeg") ext = "jpg";
      if (!ext) return; // text-only exhibits render inline
      if (!ex.storage_path) throw new Error(`Exhibit ${ex.label} has no uploaded file yet`);
      const { data: signed, error } = await supabase.storage
        .from("exhibits")
        .createSignedUrl(ex.storage_path, 60 * 10);
      if (error || !signed?.signedUrl) {
        throw new Error(`Could not sign URL for exhibit ${ex.label}: ${error?.message ?? "unknown"}`);
      }
      const cleanLabel = ex.label.replace(/[^a-zA-Z0-9_-]/g, "");
      resources.push({ path: `exhibits/${cleanLabel}.${ext}`, url: signed.signedUrl });
    }),
  );

  return { resources };
}
