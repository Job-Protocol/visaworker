// Server-only: autonomously reviews an exhibit PDF and — when confident — trims
// it down to only the pages that are relevant to the current petition.
//
// Called from every ingest path (user upload, agent web capture, agent
// attach-from-upload). The caller is responsible for producing the initial
// exhibit row and its `original_storage_path`; this module runs the AI review
// pass and writes back the trimmed derivative + status.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractPagesText, trimPdf } from "./pdf-trim.server";

type SB = SupabaseClient<Database>;

const MODEL = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-4-5";
const PAGE_CAP = 60;
const MAX_PAGES_TO_REVIEW = 300; // hard cap on prompt size for very long PDFs

export type Relevance = "high" | "medium" | "low" | "irrelevant";
export type ReviewStatus =
  | "auto_applied"
  | "needs_attention"
  | "user_confirmed"
  | "capped"
  | "pending"
  | "rejected"
  | "skipped";

export type AIRecommendation = {
  keep: number[];
  drop: number[];
  reasons: Record<string, string>;
  summary: string;
  confidence: number;
  relevance: Relevance;
  model: string;
  created_at: string;
};

export type ReviewOutcome = {
  status: ReviewStatus;
  kept_pages: number[];
  original_page_count: number;
  recommendation: AIRecommendation | null;
  note?: string;
};

type ProjectContext = {
  visa_type: string | null;
  beneficiary_name: string | null;
  field: string | null;
  strategy_md: string | null;
};

async function loadProjectContext(supabase: SB, projectId: string): Promise<ProjectContext> {
  const { data } = await supabase
    .from("projects")
    .select("visa_type, beneficiary_name, field, strategy_md")
    .eq("id", projectId)
    .maybeSingle();
  return (data ?? {
    visa_type: null,
    beneficiary_name: null,
    field: null,
    strategy_md: null,
  }) as ProjectContext;
}

function buildPrompt(
  ctx: ProjectContext,
  exhibitTitle: string,
  source: string,
  agentIntent: string | undefined,
  pages: { page: number; text: string }[],
): string {
  const strategy = (ctx.strategy_md ?? "").slice(0, 3000);
  const pagesBlock = pages
    .map((p) => `--- PAGE ${p.page} ---\n${p.text || "(no extractable text)"}`)
    .join("\n\n");
  return [
    `# Petition context`,
    `Visa type: ${ctx.visa_type ?? "unspecified"}`,
    `Beneficiary: ${ctx.beneficiary_name ?? "unspecified"}`,
    `Field: ${ctx.field ?? "unspecified"}`,
    `Strategy notes (truncated):\n${strategy || "(none yet)"}`,
    "",
    `# Exhibit being reviewed`,
    `Title: ${exhibitTitle}`,
    `Source: ${source}`,
    agentIntent ? `Agent's stated purpose for adding this: ${agentIntent}` : "",
    `Total pages: ${pages.length}`,
    "",
    `# Per-page extracted text`,
    pagesBlock,
    "",
    `# Your task`,
    `Decide which pages are DIRECTLY RELEVANT as evidence in the petition record and which are boilerplate (paywalls, cookie banners, nav, ads, unrelated ToS, empty pages, duplicative filler).`,
    `Respond with ONLY a JSON object matching this schema, no prose, no code fences:`,
    `{"summary": string (<=280 chars, one-line what this exhibit shows),`,
    ` "relevance": "high" | "medium" | "low" | "irrelevant",`,
    ` "confidence": number 0-1,`,
    ` "keep": number[] (1-indexed pages worth including),`,
    ` "drop": number[] (1-indexed pages to exclude),`,
    ` "reasons": { "<page>": "short reason why dropped" } (only for dropped pages)}`,
    `Rules:`,
    `- Prefer keeping fewer pages. If the useful content is on 3 pages, keep 3.`,
    `- "irrelevant" means the WHOLE document is off-topic (e.g. a paywall page, unrelated article). Only use with confidence >= 0.75.`,
    `- If you're unsure, use "low" and keep more pages rather than dropping useful evidence.`,
    `- keep + drop together must equal the full 1..${pages.length} range with no duplicates.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function tryParseJson(raw: string): unknown | null {
  const t = raw.trim();
  // Strip common code fences if the model added them despite instructions.
  const stripped = t.startsWith("```")
    ? t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
    : t;
  // Grab the first {...} balanced block.
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerceRecommendation(
  raw: unknown,
  totalPages: number,
): Omit<AIRecommendation, "model" | "created_at"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const relevance = (["high", "medium", "low", "irrelevant"] as Relevance[]).includes(
    r.relevance as Relevance,
  )
    ? (r.relevance as Relevance)
    : "medium";
  const confidence = Math.max(
    0,
    Math.min(1, typeof r.confidence === "number" ? r.confidence : 0.5),
  );
  const summary = typeof r.summary === "string" ? r.summary.slice(0, 400) : "";
  const keepArr = Array.isArray(r.keep) ? r.keep : [];
  const dropArr = Array.isArray(r.drop) ? r.drop : [];
  const reasonsIn =
    r.reasons && typeof r.reasons === "object" ? (r.reasons as Record<string, unknown>) : {};
  const seen = new Set<number>();
  const keep: number[] = [];
  for (const n of keepArr) {
    const p = Number(n);
    if (Number.isInteger(p) && p >= 1 && p <= totalPages && !seen.has(p)) {
      seen.add(p);
      keep.push(p);
    }
  }
  const drop: number[] = [];
  const dropSeen = new Set<number>();
  for (const n of dropArr) {
    const p = Number(n);
    if (Number.isInteger(p) && p >= 1 && p <= totalPages && !seen.has(p) && !dropSeen.has(p)) {
      dropSeen.add(p);
      drop.push(p);
    }
  }
  // Any un-classified pages default to keep, so we never silently lose content.
  for (let p = 1; p <= totalPages; p++) {
    if (!seen.has(p) && !dropSeen.has(p)) {
      seen.add(p);
      keep.push(p);
    }
  }
  keep.sort((a, b) => a - b);
  drop.sort((a, b) => a - b);
  const reasons: Record<string, string> = {};
  for (const [k, v] of Object.entries(reasonsIn)) {
    if (typeof v === "string") reasons[String(k)] = v.slice(0, 240);
  }
  return { keep, drop, reasons, summary, confidence, relevance };
}

async function callReviewer(prompt: string): Promise<unknown | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const client = new Anthropic({ apiKey: key });
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system:
      "You are an evidence-review assistant for U.S. immigration petitions. You inspect uploaded documents and decide which pages contain actual evidence versus boilerplate/noise. You output strict JSON only.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = resp.content
    .map((b) => (b.type === "text" ? (b as { text: string }).text : ""))
    .join("\n");
  return tryParseJson(text);
}

/**
 * Autonomously review a freshly-ingested PDF exhibit and, when the AI is
 * confident, write a trimmed derivative back to storage. Never destructive:
 * the untouched original stays at `original_storage_path`.
 *
 * Returns the final `review_status` and the kept pages. Non-fatal — any
 * failure downgrades to `pending` so the exhibit is still usable manually.
 */
export async function reviewAndApply(args: {
  supabase: SB;
  projectId: string;
  exhibitId: string;
  bytes: Uint8Array;
  storagePath: string;
  mimeType: string;
  exhibitTitle: string;
  source: string; // "upload" | "web:<url>" | "upload:<filename>"
  agentIntent?: string;
}): Promise<ReviewOutcome> {
  const {
    supabase,
    projectId,
    exhibitId,
    bytes,
    storagePath,
    mimeType,
    exhibitTitle,
    source,
    agentIntent,
  } = args;

  if (mimeType !== "application/pdf") {
    return { status: "skipped", kept_pages: [], original_page_count: 0, recommendation: null };
  }

  let extract: Awaited<ReturnType<typeof extractPagesText>>;
  try {
    extract = await extractPagesText(bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("exhibits")
      .update({ review_status: "pending" })
      .eq("id", exhibitId);
    return {
      status: "pending",
      kept_pages: [],
      original_page_count: 0,
      recommendation: null,
      note: `extraction failed: ${msg}`,
    };
  }

  const total = extract.total;
  // Persist the true page count + baseline `original_*` fields regardless of
  // whether the AI pass succeeds — the UI needs those to render "X / Y".
  await supabase
    .from("exhibits")
    .update({
      original_storage_path: storagePath,
      original_page_count: total,
      page_count: total,
    })
    .eq("id", exhibitId);

  // Tiny PDFs (<= cap) don't need trimming for compile reasons, but we still
  // run the review to catch fully-irrelevant captures (paywalls, cookie walls).
  // We only skip the review for pathologically huge PDFs where the prompt
  // would blow the context window; those default to `pending` for user review.
  if (total > MAX_PAGES_TO_REVIEW) {
    await supabase
      .from("exhibits")
      .update({ review_status: "pending" })
      .eq("id", exhibitId);
    return {
      status: "pending",
      kept_pages: [],
      original_page_count: total,
      recommendation: null,
      note: `PDF has ${total} pages; too long for automatic review — please trim manually.`,
    };
  }

  const ctx = await loadProjectContext(supabase, projectId);
  const prompt = buildPrompt(ctx, exhibitTitle, source, agentIntent, extract.pages);

  let raw: unknown | null = null;
  try {
    raw = await callReviewer(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("exhibits")
      .update({ review_status: "pending" })
      .eq("id", exhibitId);
    return {
      status: "pending",
      kept_pages: [],
      original_page_count: total,
      recommendation: null,
      note: `AI review failed: ${msg}`,
    };
  }

  const parsed = coerceRecommendation(raw, total);
  if (!parsed) {
    await supabase
      .from("exhibits")
      .update({ review_status: "pending" })
      .eq("id", exhibitId);
    return {
      status: "pending",
      kept_pages: [],
      original_page_count: total,
      recommendation: null,
      note: "AI review produced no usable output",
    };
  }

  const recommendation: AIRecommendation = {
    ...parsed,
    model: MODEL,
    created_at: new Date().toISOString(),
  };

  // Decide autonomously.
  let status: ReviewStatus;
  let kept: number[] = parsed.keep.slice();

  if (parsed.relevance === "irrelevant" && parsed.confidence >= 0.75) {
    // Reject: preserve the row + AI reasoning, but flag it and don't spend
    // storage on a trimmed derivative. The user can promote it back later.
    status = "rejected";
    kept = [];
  } else {
    // Enforce the compile cap: if the AI wants more than PAGE_CAP pages, take
    // the first PAGE_CAP in original order and flag `capped` so the user knows
    // to look.
    if (kept.length > PAGE_CAP) {
      kept = kept.slice(0, PAGE_CAP);
      status = "capped";
    } else if (parsed.relevance === "low" || parsed.confidence < 0.6) {
      status = "needs_attention";
    } else {
      status = "auto_applied";
    }
  }

  // Build + upload the derivative (only if we actually reduced the page set).
  const patch: {
    review_status: ReviewStatus;
    ai_recommendation: AIRecommendation;
    included_pages: number[] | null;
    trimmed_at: string | null;
    page_count: number;
    storage_path?: string;
  } = {
    review_status: status,
    ai_recommendation: recommendation,
    included_pages: null,
    trimmed_at: null,
    page_count: total,
  };

  if (status !== "rejected" && kept.length > 0 && kept.length < total) {
    try {
      const trimmed = await trimPdf(bytes, kept);
      const label = storagePath.split("/").pop()?.replace(/\.pdf$/i, "") ?? "exhibit";
      const derivativePath = `${projectId}/${label}.trimmed.pdf`;
      const { error: upErr } = await supabase.storage
        .from("exhibits")
        .upload(derivativePath, trimmed, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      patch.storage_path = derivativePath;
      patch.included_pages = kept;
      patch.trimmed_at = new Date().toISOString();
      patch.page_count = kept.length;
    } catch (e) {
      // Trim upload failed — keep the original in `storage_path`, downgrade
      // to needs_attention so the user can retry.
      const msg = e instanceof Error ? e.message : String(e);
      patch.review_status = "needs_attention";
      recommendation.summary = `${recommendation.summary}\n[trim upload failed: ${msg}]`;
    }
  } else if (status === "rejected") {
    // Keep the storage path pointing at the original so the user can still
    // inspect it — they may want to "add anyway".
  }

  await supabase.from("exhibits").update(patch).eq("id", exhibitId);

  return {
    status: patch.review_status,
    kept_pages: patch.included_pages ?? (status === "rejected" ? [] : Array.from({ length: total }, (_, i) => i + 1)),
    original_page_count: total,
    recommendation,
  };
}
