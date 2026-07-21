// Public server fn: accept a firm URL from a visitor, scrape the site,
// extract structured data with Claude, and insert an active row into
// public.firms. Uses supabaseAdmin because inserts bypass anon RLS.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const InputSchema = z.object({ url: z.string().url().max(500) });

const KIND_ALLOWED = new Set(["boutique", "big", "platform"]);
const TRANS_ALLOWED = new Set(["published", "partial", "estimate", "quote"]);
const VISA_ALLOWED = new Set([
  "O-1",
  "O-1A",
  "EB-1A",
  "EB-1",
  "EB-2",
  "NIW",
  "H-1B",
  "L-1",
  "EB-5",
  "TN",
]);

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "firm"}-${Math.random().toString(36).slice(2, 7)}`;
}

// Shared: fetch URL + extract structured firm data via Claude. Does not touch DB.
async function extractFirmData(url: string) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("URL must be http or https");
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; VisaWorkerBot/1.0; +https://visaworker.ai)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
  } catch (e) {
    throw new Error(
      `Couldn't reach that URL (${e instanceof Error ? e.message : "network error"})`,
    );
  }
  if (!res.ok) throw new Error(`That site returned HTTP ${res.status}`);
  const html = await res.text();
  const text = htmlToText(html).slice(0, 18000);
  if (text.length < 200) throw new Error("That page had almost no readable text.");

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Firm extraction is not configured on this server.");
  const client = new Anthropic({ apiKey: key });
  const model = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-4-5";

  const prompt = `You are cataloguing a US immigration law firm for a public directory.
Read the website content below and return STRICT JSON matching this shape:

{
  "is_immigration_firm": boolean,
  "name": string,
  "kind": "boutique" | "big" | "platform",
  "visa_types": string[],
  "price_label": string,
  "price_low_usd": number|null,
  "price_high_usd": number|null,
  "transparency": "published" | "partial" | "estimate" | "quote",
  "hq": string|null,
  "offices": string|null,
  "founded_year": number|null,
  "notes": string|null
}

Website: ${parsed.toString()}

Content:
${text}

Return ONLY the JSON object. No markdown fences, no commentary.`;

  const resp = await client.messages.create({
    model,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = resp.content
    .map((b) => (b.type === "text" ? (b as { text: string }).text : ""))
    .join("");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Couldn't read firm details from that site.");
  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    throw new Error("Couldn't parse firm details from that site.");
  }

  const name = String(extracted.name || "").trim();
  const kindRaw = String(extracted.kind || "boutique");
  const kind = KIND_ALLOWED.has(kindRaw) ? kindRaw : "boutique";
  const transRaw = String(extracted.transparency || "quote");
  const transparency = TRANS_ALLOWED.has(transRaw) ? transRaw : "quote";
  const visa_types = Array.isArray(extracted.visa_types)
    ? (extracted.visa_types as unknown[])
        .map((v) => String(v))
        .filter((v) => VISA_ALLOWED.has(v))
    : [];
  const toIntOrNull = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    return null;
  };

  return {
    is_immigration_firm: extracted.is_immigration_firm !== false,
    name: name.slice(0, 120),
    kind,
    website_url: parsed.toString().slice(0, 500),
    visa_types,
    price_label: String(extracted.price_label || "").slice(0, 120),
    price_low_usd: toIntOrNull(extracted.price_low_usd),
    price_high_usd: toIntOrNull(extracted.price_high_usd),
    transparency,
    hq: extracted.hq ? String(extracted.hq).slice(0, 120) : null,
    offices: extracted.offices ? String(extracted.offices).slice(0, 240) : null,
    founded_year: toIntOrNull(extracted.founded_year),
    notes: extracted.notes ? String(extracted.notes).slice(0, 240) : null,
    suggested_slug: slugify(name || "firm"),
  };
}

// Admin-only: extract firm data from URL without inserting. Used to prefill the admin form.
export const extractFirmFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const extracted = await extractFirmData(data.url);
    return { ok: true as const, ...extracted };
  });

export const suggestFirm = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const parsed = new URL(data.url);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("URL must be http or https");
    }
    const host = parsed.hostname.replace(/^www\./, "");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Dedupe by hostname substring.
    const { data: existing } = await supabaseAdmin
      .from("firms")
      .select("id, name, slug, website_url")
      .ilike("website_url", `%${host}%`)
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        ok: false as const,
        reason: "duplicate" as const,
        firm: existing[0],
      };
    }

    // Fetch site.
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; VisaWorkerBot/1.0; +https://visaworker.ai)",
          accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
    } catch (e) {
      throw new Error(
        `Couldn't reach that URL (${e instanceof Error ? e.message : "network error"})`,
      );
    }
    if (!res.ok) {
      throw new Error(`That site returned HTTP ${res.status}`);
    }
    const html = await res.text();
    const text = htmlToText(html).slice(0, 18000);
    if (text.length < 200) {
      throw new Error("That page had almost no readable text.");
    }

    // Extract with Claude.
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Firm extraction is not configured on this server.");
    const client = new Anthropic({ apiKey: key });
    const model = process.env.ANTHROPIC_REVIEW_MODEL || "claude-sonnet-4-5";

    const prompt = `You are cataloguing a US immigration law firm for a public directory.
Read the website content below and return STRICT JSON matching this shape:

{
  "is_immigration_firm": boolean,          // true only if this is clearly a US immigration law firm (not a general firm, not a directory, not an agency)
  "name": string,                          // official firm name
  "kind": "boutique" | "big" | "platform", // boutique = small immigration-focused, big = large/full-service, platform = tech-enabled service
  "visa_types": string[],                  // subset of: O-1, EB-1A, NIW, H-1B, L-1, EB-5, TN
  "price_label": string,                   // short label (e.g. "Flat $8,500 for O-1" or "Quote-only")
  "price_low_usd": number|null,            // legal-fee low bound if published, else null
  "price_high_usd": number|null,           // legal-fee high bound if published, else null
  "transparency": "published" | "partial" | "estimate" | "quote", // how openly they publish pricing
  "hq": string|null,                       // "City, ST"
  "offices": string|null,                  // comma-separated "City, ST" of other offices
  "founded_year": number|null,
  "notes": string|null                     // one neutral sentence, max 180 chars
}

If it's not clearly an immigration law firm, set is_immigration_firm=false and leave other fields best-effort.

Website: ${parsed.toString()}

Content:
${text}

Return ONLY the JSON object. No markdown fences, no commentary.`;

    const resp = await client.messages.create({
      model,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = resp.content
      .map((b) => (b.type === "text" ? (b as { text: string }).text : ""))
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Couldn't read firm details from that site.");
    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new Error("Couldn't parse firm details from that site.");
    }

    if (extracted.is_immigration_firm === false) {
      throw new Error(
        "That site didn't look like a US immigration law firm. If you think it should be listed, email hello@visaworker.ai.",
      );
    }

    const name = String(extracted.name || "").trim();
    if (!name) throw new Error("Couldn't identify the firm's name from that site.");

    const kindRaw = String(extracted.kind || "boutique");
    const kind = KIND_ALLOWED.has(kindRaw) ? kindRaw : "boutique";
    const transRaw = String(extracted.transparency || "quote");
    const transparency = TRANS_ALLOWED.has(transRaw) ? transRaw : "quote";
    const visa_types = Array.isArray(extracted.visa_types)
      ? (extracted.visa_types as unknown[])
          .map((v) => String(v))
          .filter((v) => VISA_ALLOWED.has(v))
      : [];

    const toIntOrNull = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
      return null;
    };

    const insertRow = {
      slug: slugify(name),
      name: name.slice(0, 120),
      kind,
      website_url: parsed.toString().slice(0, 500),
      visa_types,
      price_label: String(extracted.price_label || "Custom · quote-only").slice(0, 120),
      price_low_usd: toIntOrNull(extracted.price_low_usd),
      price_high_usd: toIntOrNull(extracted.price_high_usd),
      transparency,
      hq: extracted.hq ? String(extracted.hq).slice(0, 120) : null,
      offices: extracted.offices ? String(extracted.offices).slice(0, 240) : null,
      founded_year: toIntOrNull(extracted.founded_year),
      notes: extracted.notes
        ? String(extracted.notes).slice(0, 240)
        : "Community-suggested listing.",
      is_partner: false,
      is_active: true,
      sort_order: 500,
    };

    const { data: row, error } = await supabaseAdmin
      .from("firms")
      .insert(insertRow)
      .select("id, slug, name")
      .single();
    if (error) throw new Error(error.message);

    return { ok: true as const, firm: row };
  });
