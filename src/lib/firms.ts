// Firm directory shown on /find-a-lawyer. Rows live in the public `firms`
// table; both neutral market entries and VisaWorker partner firms are stored
// there. RLS allows anyone to read active rows.
import { supabase } from "@/integrations/supabase/client";

export type FirmKind = "boutique" | "big" | "platform" | "new-wave";
export type Transparency = "published" | "partial" | "estimate" | "quote";

export interface Firm {
  id: string;
  slug: string;
  name: string;
  kind: FirmKind;
  website_url: string | null;
  logo_url: string | null;
  visa_types: string[];
  price_label: string;
  price_low_usd: number | null;
  price_high_usd: number | null;
  transparency: Transparency;
  hq: string | null;
  offices: string | null;
  founded_year: number | null;
  success_rate_label: string | null;
  notes: string | null;
  is_partner: boolean;
  partner_discount_label: string | null;
  partner_min_discount_pct: number | null;
  partner_blurb: string | null;
  is_active: boolean;
  sort_order: number;
}

const COLUMNS =
  "id,slug,name,kind,website_url,logo_url,visa_types,price_label,price_low_usd,price_high_usd,transparency,hq,offices,founded_year,success_rate_label,notes,is_partner,partner_discount_label,partner_min_discount_pct,partner_blurb,is_active,sort_order";

type UntypedFrom = { from: (table: string) => any };

/** All active firms — safe to call anywhere; public SELECT policy applies. */
export async function fetchFirms(): Promise<Firm[]> {
  const { data, error } = await (supabase as unknown as UntypedFrom)
    .from("firms")
    .select(COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Firm[];
}

/** One active firm by slug, or null if not found. */
export async function fetchFirmBySlug(slug: string): Promise<Firm | null> {
  const { data, error } = await (supabase as unknown as UntypedFrom)
    .from("firms")
    .select(COLUMNS)
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Firm | null;
}

/** Just the slugs of active firms — for the sitemap. */
export async function fetchActiveFirmSlugs(): Promise<string[]> {
  const { data, error } = await (supabase as unknown as UntypedFrom)
    .from("firms")
    .select("slug")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
}

