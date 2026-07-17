// Server functions for BYO API key management. Users can attach their own
// Anthropic key to a project (free forever) or remove it (revert to managed).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Verify by making a tiny Anthropic call.
async function verifyAnthropicKey(apiKey: string): Promise<void> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Anthropic rejected that key. Double-check it and try again.");
  }
  if (!res.ok && res.status !== 400) {
    // 400 is fine — key auth worked, request was just minimal. Anything 5xx-ish means we couldn't verify.
    const body = await res.text().catch(() => "");
    throw new Error(`Could not verify key (Anthropic returned ${res.status}). ${body.slice(0, 200)}`);
  }
}

async function assertProjectOwner(supabase: any, userId: string, projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) throw new Error("Project not found");
  if (data.owner_id !== userId) throw new Error("Not authorized");
}

export const setByokKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { project_id: string; provider?: "anthropic"; api_key: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const provider = data.provider ?? "anthropic";
    const raw = (data.api_key ?? "").trim();
    if (!raw || raw.length < 20 || raw.length > 500) {
      throw new Error("That doesn't look like an Anthropic API key.");
    }
    if (!raw.startsWith("sk-ant-")) {
      throw new Error("Anthropic keys start with sk-ant-. Paste the value from console.anthropic.com.");
    }

    await assertProjectOwner(supabase, userId, data.project_id);
    await verifyAnthropicKey(raw);

    const { encryptApiKey } = await import("./ai-key-crypto.server");
    const ciphertext = encryptApiKey(raw);
    const last4 = raw.slice(-4);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const { error: upErr } = await supabaseAdmin
      .from("projects")
      .update({
        ai_mode: "byok",
        byok_provider: provider,
        byok_key_ciphertext: ciphertext,
        byok_key_last4: last4,
        byok_verified_at: nowIso,
      })
      .eq("id", data.project_id);
    if (upErr) throw new Error(upErr.message);

    // Unlock the workspace: mirror what unlockCaseCheckout does for a paid case.
    // Set status to "bypass" so all existing gating (compile, export, unlimited
    // messages) treats it as fully unlocked, and reset budget so the meter is
    // hidden. Free-preview message counters are ignored under bypass.
    await supabaseAdmin
      .from("project_billing")
      .update({
        status: "bypass",
        paid_at: nowIso,
      })
      .eq("project_id", data.project_id);

    return { ok: true as const, last4 };
  });

export const clearByokKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { project_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectOwner(supabase, userId, data.project_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look at whether the case was previously actually paid (has paid_at + non-bypass
    // history) — if not, revert to free preview.
    const { data: billing } = await supabaseAdmin
      .from("project_billing")
      .select("status, amount_cents")
      .eq("project_id", data.project_id)
      .maybeSingle();

    const wasEverPaid = Number(billing?.amount_cents ?? 0) > 0;

    await supabaseAdmin
      .from("projects")
      .update({
        ai_mode: "managed",
        byok_key_ciphertext: null,
        byok_key_last4: null,
        byok_verified_at: null,
      })
      .eq("id", data.project_id);

    // If they never actually paid Stripe, revert billing status to "free".
    // If they did (they upgraded from BYOK back to managed after paying), leave paid.
    if (!wasEverPaid) {
      await supabaseAdmin
        .from("project_billing")
        .update({ status: "free" })
        .eq("project_id", data.project_id);
    }

    return { ok: true as const };
  });

export const getAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { project_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: proj } = await context.supabase
      .from("projects")
      .select("ai_mode, byok_provider, byok_key_last4, byok_verified_at")
      .eq("id", data.project_id)
      .maybeSingle();
    return {
      ai_mode: (proj?.ai_mode as "managed" | "byok") ?? "managed",
      byok_provider: proj?.byok_provider ?? null,
      byok_key_last4: proj?.byok_key_last4 ?? null,
      byok_verified_at: proj?.byok_verified_at ?? null,
    };
  });
