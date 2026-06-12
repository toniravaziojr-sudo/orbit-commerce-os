// =============================================================================
// UTM — modelo interno fixo de produção (Onda F) — versão Edge Function.
// Mantém paridade com src/lib/ads/utm.ts.
// =============================================================================

export const STANDARD_UTM_SOURCE = "meta";
export const STANDARD_UTM_MEDIUM = "paid_social";

export interface UtmInput {
  campaignSlug?: string | null;
  adSlug?: string | null;
  audienceSlug?: string | null;
}

export interface UtmResult {
  url: string;
  warnings: string[];
  applied: Record<string, string>;
}

export function slugifyForUtm(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function applyUtm(rawUrl: string, input: UtmInput): UtmResult {
  const warnings: string[] = [];
  const applied: Record<string, string> = {};
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { url: rawUrl, warnings: ["invalid_url"], applied };
  }

  const desired: Record<string, string> = {
    utm_source: STANDARD_UTM_SOURCE,
    utm_medium: STANDARD_UTM_MEDIUM,
    utm_campaign: slugifyForUtm(input.campaignSlug) || "campanha",
    utm_content: slugifyForUtm(input.adSlug) || "anuncio",
    utm_term: slugifyForUtm(input.audienceSlug) || "publico",
  };

  for (const [key, val] of Object.entries(desired)) {
    if (!val) continue;
    const existing = url.searchParams.get(key);
    if (existing && existing.trim() !== "") {
      if (existing !== val) warnings.push(`utm_conflict:${key}:kept_existing`);
      continue;
    }
    url.searchParams.set(key, val);
    applied[key] = val;
  }

  return { url: url.toString(), warnings, applied };
}

export const REQUIRED_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

export function hasRequiredUtm(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return REQUIRED_UTM_KEYS.every((k) => {
      const v = u.searchParams.get(k);
      return !!(v && v.trim());
    });
  } catch {
    return false;
  }
}
