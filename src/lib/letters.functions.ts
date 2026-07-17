// Letter server functions. Owner-scoped via requireSupabaseAuth.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function mintToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertOwns(
  supabase: any,
  letterId: string,
): Promise<{ projectId: string }> {
  const { data, error } = await supabase
    .from("letters")
    .select("id, project_id")
    .eq("id", letterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Letter not found");
  return { projectId: data.project_id };
}

export const listLetters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("letters")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { letters: rows ?? [] };
  });

export const getLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { letterId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: letter, error } = await context.supabase
      .from("letters")
      .select("*")
      .eq("id", data.letterId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!letter) throw new Error("Letter not found");
    const { data: events } = await context.supabase
      .from("letter_events")
      .select("*")
      .eq("letter_id", data.letterId)
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: token } = await context.supabase
      .from("letter_tokens")
      .select("token, expires_at, revoked_at, created_at")
      .eq("letter_id", data.letterId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { letter, events: events ?? [], activeToken: token ?? null };
  });

export const createLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      projectId: string;
      recommender_name?: string;
      recommender_email?: string;
      recommender_title?: string;
      recommender_org?: string;
      relationship?: string;
      notes?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("letters")
      .insert({
        project_id: data.projectId,
        recommender_name: data.recommender_name ?? "",
        recommender_email: data.recommender_email ?? "",
        recommender_title: data.recommender_title ?? "",
        recommender_org: data.recommender_org ?? "",
        relationship: data.relationship ?? "",
        notes: data.notes ?? "",
        subject: "",
        body_md: "",
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { letter: row };
  });

export const updateLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      letterId: string;
      patch: Partial<{
        recommender_name: string;
        recommender_email: string;
        recommender_title: string;
        recommender_org: string;
        relationship: string;
        notes: string;
        subject: string;
        body_md: string;
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOwns(context.supabase, data.letterId);
    const { data: cur } = await context.supabase
      .from("letters")
      .select("status")
      .eq("id", data.letterId)
      .maybeSingle();
    const nextStatus =
      cur?.status === "signed" || cur?.status === "superseded"
        ? cur.status
        : "draft";
    const { error } = await context.supabase
      .from("letters")
      .update({ ...data.patch, status: nextStatus })
      .eq("id", data.letterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { letterId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwns(context.supabase, data.letterId);
    const { error } = await context.supabase
      .from("letters")
      .delete()
      .eq("id", data.letterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendLetterForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { letterId: string; origin?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwns(context.supabase, data.letterId);
    // Revoke any previous tokens
    await context.supabase
      .from("letter_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("letter_id", data.letterId)
      .is("revoked_at", null);
    const token = mintToken();
    const { error: tErr } = await context.supabase
      .from("letter_tokens")
      .insert({ letter_id: data.letterId, token });
    if (tErr) throw new Error(tErr.message);
    const { error: uErr } = await context.supabase
      .from("letters")
      .update({ status: "awaiting_review" })
      .eq("id", data.letterId);
    if (uErr) throw new Error(uErr.message);
    await context.supabase
      .from("letter_events")
      .insert({ letter_id: data.letterId, type: "sent", actor: "user" });
    const origin = data.origin ?? "";
    return { token, url: `${origin}/letter/${token}` };
  });

export const revokeLetterLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { letterId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwns(context.supabase, data.letterId);
    await context.supabase
      .from("letter_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("letter_id", data.letterId)
      .is("revoked_at", null);
    await context.supabase
      .from("letters")
      .update({ status: "draft" })
      .eq("id", data.letterId);
    await context.supabase
      .from("letter_events")
      .insert({ letter_id: data.letterId, type: "revoked", actor: "user" });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Public sign flow (no auth). Token in the request body is the sole capability.
// Calls the SECURITY DEFINER RPC (validates the token, flips letter to signed,
// creates the exhibit shell), renders the letter PDF, and uploads it to the
// exhibits storage bucket at the path the RPC allocated.
// ---------------------------------------------------------------------------

type SignArgs = {
  token: string;
  name: string;
  sig_data_url: string | null;
  ua: string | null;
};

export const signLetterWithPdf = createServerFn({ method: "POST" })
  .inputValidator((input: SignArgs) => {
    if (!input || typeof input !== "object") throw new Error("invalid_input");
    if (typeof input.token !== "string" || !/^[a-f0-9]{16,}$/i.test(input.token)) {
      throw new Error("invalid_token");
    }
    if (typeof input.name !== "string" || !input.name.trim()) throw new Error("name_required");
    if (input.name.length > 200) throw new Error("name_too_long");
    if (input.sig_data_url != null && typeof input.sig_data_url !== "string") {
      throw new Error("invalid_signature");
    }
    return {
      token: input.token,
      name: input.name.trim(),
      sig_data_url: input.sig_data_url ?? null,
      ua: (input.ua ?? "").slice(0, 200),
    };
  })
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { renderLetterPdf } = await import("@/lib/letter-pdf.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: rpcData, error: rpcErr } = await anon.rpc("letter_public_sign_pdf", {
      _token: data.token,
      _name: data.name,
      _sig_data_url: data.sig_data_url,
      _ip_hash: null,
      _ua: data.ua,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (!rpcData) throw new Error("invalid_token");

    const payload = rpcData as {
      ok: boolean;
      exhibit_id: string;
      exhibit_label: string;
      storage_path: string;
      letter: Parameters<typeof renderLetterPdf>[0];
      project: Parameters<typeof renderLetterPdf>[1];
    };

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await renderLetterPdf(payload.letter, payload.project);
    } catch (e) {
      await supabaseAdmin.from("exhibits").delete().eq("id", payload.exhibit_id);
      throw e;
    }

    const { error: upErr } = await supabaseAdmin.storage
      .from("exhibits")
      .upload(payload.storage_path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      await supabaseAdmin.from("exhibits").delete().eq("id", payload.exhibit_id);
      throw new Error(`upload_failed: ${upErr.message}`);
    }

    await supabaseAdmin
      .from("exhibits")
      .update({ size_bytes: pdfBytes.length })
      .eq("id", payload.exhibit_id);

    const signedAt = payload.letter.signed_at ?? new Date().toISOString();
    const cacheText = [
      payload.letter.subject ? `# ${payload.letter.subject}` : null,
      [payload.letter.recommender_name, payload.letter.recommender_title, payload.letter.recommender_org]
        .filter(Boolean)
        .join(" · "),
      "",
      (payload.letter.body_md ?? "").trim(),
      "",
      "---",
      `**Electronically signed by:** ${data.name}`,
      `**Date:** ${signedAt} UTC`,
      "**Method:** typed signature via visaworker.ai review link",
    ]
      .filter((l) => l !== null)
      .join("\n");

    await supabaseAdmin
      .from("exhibit_cache")
      .upsert({
        exhibit_id: payload.exhibit_id,
        extracted_text: cacheText.slice(0, 500_000),
        updated_at: signedAt,
      });

    return { ok: true as const, exhibit_label: payload.exhibit_label };
  });
