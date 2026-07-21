// Partner firms shown wherever `fetchActivePartners` is called. Backed by the
// unified `public.firms` table (rows where `is_partner = true`). Kept as a
// thin adapter so older callers keep working.
import { fetchFirms, type Firm } from "@/lib/firms";

export interface PartnerFirm {
  id: string;
  name: string;
  blurb: string;
  visa_types: string[];
  discount_label: string;
  min_discount_pct: number | null;
  website_url: string | null;
  location: string | null;
  is_active: boolean;
  sort_order: number;
}

function toPartner(f: Firm): PartnerFirm {
  return {
    id: f.id,
    name: f.name,
    blurb: f.partner_blurb ?? f.notes ?? "",
    visa_types: f.visa_types,
    discount_label: f.partner_discount_label ?? "",
    min_discount_pct: f.partner_min_discount_pct,
    website_url: f.website_url,
    location: f.hq,
    is_active: f.is_active,
    sort_order: f.sort_order,
  };
}

/** Active VisaWorker partner firms, ordered for display. */
export async function fetchActivePartners(): Promise<PartnerFirm[]> {
  const firms = await fetchFirms();
  return firms.filter((f) => f.is_partner).map(toPartner);
}
