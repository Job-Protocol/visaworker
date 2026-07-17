// Server-only helper to resolve which AI provider a given project uses.
// Never import from client-reachable code.
import { decryptApiKey } from "./ai-key-crypto.server";

export type ResolvedAiConfig =
  | { mode: "managed"; apiKey: string }
  | { mode: "byok"; provider: "anthropic"; apiKey: string; last4: string };

export async function resolveAiConfigForProject(projectId: string): Promise<ResolvedAiConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("ai_mode, byok_provider, byok_key_ciphertext, byok_key_last4")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;

  if (data?.ai_mode === "byok") {
    if (!data.byok_key_ciphertext) {
      throw new Error("byok_key_missing");
    }
    const apiKey = decryptApiKey(data.byok_key_ciphertext);
    return {
      mode: "byok",
      provider: (data.byok_provider as "anthropic") ?? "anthropic",
      apiKey,
      last4: data.byok_key_last4 ?? "",
    };
  }

  const { resolveManagedAnthropicKey } = await import("@/ee/server");
  return { mode: "managed", apiKey: resolveManagedAnthropicKey() };
}
