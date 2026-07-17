// Agent turn loop. Handles Anthropic Messages API with tool_use loop and
// the request_compile "pause" branch.
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, SYSTEM_PROMPT, runTool, MUTATING_TOOL_NAMES, type SB } from "./agent-tools.server";

const MAX_AUTO_COMPILES = 5;

// Count how many auto-compile requests have been enqueued for this project
// since the most recent user message. Used to cap the auto self-heal loop.
async function autoCompileAttemptsSinceLastUser(supabase: SB, projectId: string): Promise<number> {
  const { data: lastUser } = await supabase
    .from("messages")
    .select("created_at")
    .eq("project_id", projectId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = lastUser?.created_at ?? new Date(0).toISOString();
  const { count } = await supabase
    .from("compile_requests")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("created_at", since)
    .like("reason", "auto:%");
  return count ?? 0;
}

// Enqueue an auto-compile with no tool_use_id. resumeFromCompile handles the
// null tool_use_id branch by appending a synthetic user message.
async function enqueueAutoCompile(
  supabase: SB,
  projectId: string,
  reason: string,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("compile_requests")
    .insert({
      project_id: projectId,
      status: "queued",
      reason: `auto: ${reason}`,
      request_compile_tool_use_id: null,
      pending_tool_results: [] as any,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const MAX_TOKENS = 8000;
const MAX_TURN_STEPS = 40;

type Msg = { role: "user" | "assistant" | "tool"; content: unknown };

async function client(projectId: string): Promise<{ anthropic: Anthropic; mode: "managed" | "byok" }> {
  const { resolveAiConfigForProject } = await import("./ai-config.server");
  const cfg = await resolveAiConfigForProject(projectId);
  return { anthropic: new Anthropic({ apiKey: cfg.apiKey }), mode: cfg.mode };
}

async function loadThread(supabase: SB, projectId: string): Promise<Msg[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Msg[];
}

// Convert stored thread rows into Anthropic messages format.
// tool rows are folded into a user message with tool_result blocks (contiguous
// tool rows collapse into one user turn).
function toAnthropicMessages(thread: Msg[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of thread) {
    if (m.role === "user") {
      const content = typeof m.content === "string"
        ? [{ type: "text" as const, text: m.content }]
        : (m.content as any);
      out.push({ role: "user", content });
    } else if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content as any });
    } else if (m.role === "tool") {
      const blocks = m.content as any[];
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        last.content = [...(last.content as any[]), ...blocks];
      } else {
        out.push({ role: "user", content: blocks });
      }
    }
  }
  return out;
}

async function appendMessage(supabase: SB, projectId: string, row: Msg) {
  const { error } = await supabase.from("messages").insert({
    project_id: projectId,
    role: row.role,
    content: row.content as any,
  });
  if (error) throw error;
}

export type TurnOutcome =
  | { kind: "final" }
  | { kind: "paused_for_compile"; compile_request_id: string }
  | { kind: "error"; error: string };

async function checkBudget(
  supabase: SB,
  projectId: string,
): Promise<{ exhausted: boolean; reason?: "tokens" | "free_messages" | "unpaid" } | null> {
  const { data } = await supabase
    .from("project_billing")
    .select("status, token_budget, tokens_used, free_messages_used")
    .eq("project_id", projectId)
    .maybeSingle();
  // No billing row → treat as unpaid; block usage.
  if (!data) return { exhausted: true, reason: "unpaid" };
  // Refunded / chargeback / cancelled → block immediately regardless of budget.
  if (data.status === "refunded" || data.status === "chargeback" || data.status === "cancelled") {
    return { exhausted: true, reason: "unpaid" };
  }
  if (data.status === "bypass") return { exhausted: false };
  if (data.status === "free") {
    // Import lazily to keep this module free of client-shared imports at top.
    const { FREE_MESSAGE_LIMIT } = await import("@/ee");
    const usedMsgs = Number(data.free_messages_used ?? 0);
    if (usedMsgs >= FREE_MESSAGE_LIMIT) return { exhausted: true, reason: "free_messages" };
    const used = Number(data.tokens_used ?? 0);
    const budget = Number(data.token_budget ?? 0);
    if (used >= budget) return { exhausted: true, reason: "tokens" };
    return { exhausted: false };
  }
  // Only "paid" projects (or bypass/free above) can consume tokens.
  if (data.status !== "paid") return { exhausted: true, reason: "unpaid" };
  const used = Number(data.tokens_used ?? 0);
  const budget = Number(data.token_budget ?? 0);
  return { exhausted: used >= budget, reason: used >= budget ? "tokens" : undefined };
}

// Bump the free-tier assistant message counter (no-op for paid/bypass cases).
async function bumpFreeMessage(projectId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("increment_free_message", { _project_id: projectId });
  } catch (e) {
    console.warn("increment_free_message failed", e);
  }
}

export async function runTurn(
  supabase: SB,
  projectId: string,
  userText: string,
  images?: { media_type: string; data: string }[],
): Promise<TurnOutcome> {
  // If images are attached, store the user message as a content-block array so
  // it can be forwarded to Anthropic's vision API. Otherwise keep the simple
  // string shape for backward compatibility.
  const content: unknown = images && images.length
    ? [
        ...(userText ? [{ type: "text", text: userText }] : []),
        ...images.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.media_type, data: img.data },
        })),
      ]
    : userText;
  await appendMessage(supabase, projectId, { role: "user", content });
  await bumpFreeMessage(projectId);
  return continueTurn(supabase, projectId);
}


export async function continueTurn(supabase: SB, projectId: string): Promise<TurnOutcome> {
  let clientRes;
  try {
    clientRes = await client(projectId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "byok_key_missing") return { kind: "error", error: "byok_key_missing" };
    return { kind: "error", error: msg };
  }
  const { anthropic, mode: aiMode } = clientRes;
  let mutated = false;


  for (let step = 0; step < MAX_TURN_STEPS; step++) {
    // Pre-turn budget guard
    const budget = await checkBudget(supabase, projectId);
    if (budget && budget.exhausted) {
      return { kind: "error", error: budget.reason === "free_messages" ? "free_message_limit" : "budget_exhausted" };
    }

    const thread = await loadThread(supabase, projectId);
    const messages = toAnthropicMessages(thread);

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [
          ...(TOOLS as unknown as Anthropic.Tool[]),
          { type: "web_search_20250305" as any, name: "web_search", max_uses: 5 } as unknown as Anthropic.Tool,
        ],
        messages,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { kind: "error", error: msg };
    }

    if (aiMode !== "byok") {
      try {
        const u: any = (response as any).usage ?? {};
        const inTok = Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
        const outTok = Number(u.output_tokens ?? 0);
        if (inTok > 0 || outTok > 0) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.rpc("consume_case_tokens", { _project_id: projectId, _in: inTok, _out: outTok });
        }
      } catch (e) {
        console.warn("token metering failed", e);
      }
    }

    await appendMessage(supabase, projectId, { role: "assistant", content: response.content });

    const toolUses = (response.content as any[]).filter(
      (b) => b?.type === "tool_use",
    ) as Array<{ type: "tool_use"; id: string; name: string; input: any }>;

    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      // Auto-compile if content was mutated this turn and we haven't exceeded the cap.
      if (mutated) {
        const attempts = await autoCompileAttemptsSinceLastUser(supabase, projectId);
        if (attempts < MAX_AUTO_COMPILES) {
          const r = await enqueueAutoCompile(supabase, projectId, `end-of-turn (attempt ${attempts + 1})`);
          if ("error" in r) return { kind: "error", error: r.error };
          return { kind: "paused_for_compile", compile_request_id: r.id };
        }
      }
      return { kind: "final" };
    }

    // Handle model-emitted request_compile: pause and wait for browser driver.
    // (Prompt says not to call it, but tolerate it.)
    const compileCall = toolUses.find((t) => t.name === "request_compile");
    if (compileCall) {
      const others = toolUses.filter((t) => t.id !== compileCall.id);
      const otherResults = await Promise.all(
        others.map(async (t) => {
          if (MUTATING_TOOL_NAMES.has(t.name)) mutated = true;
          const r = await runTool(supabase, projectId, t.name, t.input ?? {}, t.id);
          return {
            type: "tool_result" as const,
            tool_use_id: t.id,
            content: r.content,
            ...(r.is_error ? { is_error: true } : {}),
          };
        }),
      );
      const { data: req, error: cErr } = await supabase
        .from("compile_requests")
        .insert({
          project_id: projectId,
          status: "queued",
          reason: compileCall.input?.reason ?? "",
          request_compile_tool_use_id: compileCall.id,
          pending_tool_results: otherResults as any,
        })
        .select()
        .single();
      if (cErr) return { kind: "error", error: cErr.message };
      return { kind: "paused_for_compile", compile_request_id: req.id };
    }

    const toolBlocks = await Promise.all(
      toolUses.map(async (t) => {
        if (MUTATING_TOOL_NAMES.has(t.name)) mutated = true;
        const r = await runTool(supabase, projectId, t.name, t.input ?? {}, t.id);
        return {
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: r.content,
          ...(r.is_error ? { is_error: true } : {}),
        };
      }),
    );
    await appendMessage(supabase, projectId, { role: "tool", content: toolBlocks });
  }

  return { kind: "error", error: "Turn exceeded max steps" };
}

export type ResumePayload = {
  request_id: string;
  ok: boolean;
  log: string;
  pdf_path: string | null;
  error_lines: string[] | null;
};

export async function resumeFromCompile(
  supabase: SB,
  projectId: string,
  payload: ResumePayload,
): Promise<TurnOutcome> {
  const { data: req, error } = await supabase
    .from("compile_requests")
    .select("*")
    .eq("id", payload.request_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !req) return { kind: "error", error: "compile request not found" };

  const summary = payload.ok
    ? `COMPILE OK. PDF generated at ${payload.pdf_path}. Log tail:\n${(payload.log ?? "").slice(-2000)}`
    : `COMPILE FAILED. Errors:\n${(payload.error_lines ?? []).join("\n")}\n\nLog tail:\n${(payload.log ?? "").slice(-2000)}`;

  if (!req.request_compile_tool_use_id) {
    // Auto-compile branch. On success we stay silent — the assistant has
    // already replied to the user and burning another turn just to say
    // "compiled fine" is noise. Only re-engage the model on failure.
    if (payload.ok) {
      return { kind: "final" };
    }
    const attempts = await autoCompileAttemptsSinceLastUser(supabase, projectId);
    const capped = attempts >= MAX_AUTO_COMPILES;
    const userText = capped
      ? `[system] Auto-compile has failed ${attempts} times in a row. Stop trying to fix it. Explain to the user in plain English which section is affected and what appears to be wrong, and ask them how to proceed. Do not call any editing tools.\n\n${summary}`
      : `[system] Auto-compile failed. Inspect with get_last_compile / get_rendered_latex if needed, then make ONE surgical fix to the offending section. Do not reply to the user with prose yet — the system will recompile automatically after your edit.\n\n${summary}`;
    await appendMessage(supabase, projectId, { role: "user", content: userText });
    return continueTurn(supabase, projectId);
  }

  const compileToolResult = {
    type: "tool_result" as const,
    tool_use_id: req.request_compile_tool_use_id,
    content: summary,
    ...(payload.ok ? {} : { is_error: true }),
  };

  const pending = (req.pending_tool_results as any[]) ?? [];
  await appendMessage(supabase, projectId, {
    role: "tool",
    content: [...pending, compileToolResult],
  });

  return continueTurn(supabase, projectId);
}

// -----------------------------------------------------------------------------
// Streaming variants — SSE-friendly. Emits text deltas as they arrive so the
// browser can render assistant tokens live. Same tool-use loop and compile
// pause branch as the non-streaming path.

export type StreamEvent =
  | { type: "user_saved" }
  | { type: "step_start"; step: number }
  | { type: "text"; delta: string }
  | { type: "assistant_saved" }
  | { type: "tool_saved" }
  | { type: "paused_compile"; compile_request_id: string }
  | { type: "final" }
  | { type: "cancelled" }
  | { type: "error"; error: string };

export type Emit = (e: StreamEvent) => void;

export async function runTurnStream(
  supabase: SB,
  projectId: string,
  userText: string,
  images: { media_type: string; data: string }[] | undefined,
  signal: AbortSignal,
  emit: Emit,
): Promise<void> {
  const content: unknown = images && images.length
    ? [
        ...(userText ? [{ type: "text", text: userText }] : []),
        ...images.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.media_type, data: img.data },
        })),
      ]
    : userText;
  await appendMessage(supabase, projectId, { role: "user", content });
  await bumpFreeMessage(projectId);
  emit({ type: "user_saved" });
  await continueTurnStream(supabase, projectId, signal, emit);
}

export async function continueTurnStream(
  supabase: SB,
  projectId: string,
  signal: AbortSignal,
  emit: Emit,
): Promise<void> {
  let clientRes;
  try {
    clientRes = await client(projectId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit({ type: "error", error: msg === "byok_key_missing" ? "byok_key_missing" : msg });
    return;
  }
  const { anthropic, mode: aiMode } = clientRes;
  let mutated = false;



  for (let step = 0; step < MAX_TURN_STEPS; step++) {
    if (signal.aborted) { emit({ type: "cancelled" }); return; }

    const budget = await checkBudget(supabase, projectId);
    if (budget && budget.exhausted) { emit({ type: "error", error: budget.reason === "free_messages" ? "free_message_limit" : "budget_exhausted" }); return; }

    const thread = await loadThread(supabase, projectId);
    const messages = toAnthropicMessages(thread);

    emit({ type: "step_start", step });

    let response: Anthropic.Message;
    try {
      const stream = anthropic.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools: [
            ...(TOOLS as unknown as Anthropic.Tool[]),
            { type: "web_search_20250305" as any, name: "web_search", max_uses: 5 } as unknown as Anthropic.Tool,
          ],
          messages,
        },
        { signal },
      );

      for await (const ev of stream) {
        if (signal.aborted) break;
        if (
          ev.type === "content_block_delta" &&
          (ev as any).delta?.type === "text_delta"
        ) {
          emit({ type: "text", delta: (ev as any).delta.text ?? "" });
        }
      }

      if (signal.aborted) { emit({ type: "cancelled" }); return; }
      response = await stream.finalMessage();
    } catch (e) {
      if (signal.aborted) { emit({ type: "cancelled" }); return; }
      const msg = e instanceof Error ? e.message : String(e);
      emit({ type: "error", error: msg });
      return;
    }

    // Meter tokens
    if (aiMode !== "byok") {
      try {
        const u: any = (response as any).usage ?? {};
        const inTok = Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
        const outTok = Number(u.output_tokens ?? 0);
        if (inTok > 0 || outTok > 0) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.rpc("consume_case_tokens", { _project_id: projectId, _in: inTok, _out: outTok });
        }
      } catch (e) {
        console.warn("token metering failed", e);
      }
    }

    await appendMessage(supabase, projectId, { role: "assistant", content: response.content });
    emit({ type: "assistant_saved" });

    const toolUses = (response.content as any[]).filter(
      (b) => b?.type === "tool_use",
    ) as Array<{ type: "tool_use"; id: string; name: string; input: any }>;

    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      if (mutated) {
        const attempts = await autoCompileAttemptsSinceLastUser(supabase, projectId);
        if (attempts < MAX_AUTO_COMPILES) {
          const r = await enqueueAutoCompile(supabase, projectId, `end-of-turn (attempt ${attempts + 1})`);
          if ("error" in r) { emit({ type: "error", error: r.error }); return; }
          emit({ type: "paused_compile", compile_request_id: r.id });
          return;
        }
      }
      emit({ type: "final" });
      return;
    }

    const compileCall = toolUses.find((t) => t.name === "request_compile");
    if (compileCall) {
      const others = toolUses.filter((t) => t.id !== compileCall.id);
      const otherResults = await Promise.all(
        others.map(async (t) => {
          if (MUTATING_TOOL_NAMES.has(t.name)) mutated = true;
          const r = await runTool(supabase, projectId, t.name, t.input ?? {}, t.id);
          return {
            type: "tool_result" as const,
            tool_use_id: t.id,
            content: r.content,
            ...(r.is_error ? { is_error: true } : {}),
          };
        }),
      );
      const { data: req, error: cErr } = await supabase
        .from("compile_requests")
        .insert({
          project_id: projectId,
          status: "queued",
          reason: compileCall.input?.reason ?? "",
          request_compile_tool_use_id: compileCall.id,
          pending_tool_results: otherResults as any,
        })
        .select()
        .single();
      if (cErr) { emit({ type: "error", error: cErr.message }); return; }
      emit({ type: "paused_compile", compile_request_id: req.id });
      return;
    }

    if (signal.aborted) { emit({ type: "cancelled" }); return; }

    const toolBlocks = await Promise.all(
      toolUses.map(async (t) => {
        if (MUTATING_TOOL_NAMES.has(t.name)) mutated = true;
        const r = await runTool(supabase, projectId, t.name, t.input ?? {}, t.id);
        return {
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: r.content,
          ...(r.is_error ? { is_error: true } : {}),
        };
      }),
    );
    await appendMessage(supabase, projectId, { role: "tool", content: toolBlocks });
    emit({ type: "tool_saved" });
  }

  emit({ type: "error", error: "Turn exceeded max steps" });
}
