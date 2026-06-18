// =============================================================================
// meta-publish-mappers.ts
// Tradutores idempotentes Proposta → Meta. Sem rede, sem IA.
// Contrato: o publicador deve transcrever 100% do que está na proposta,
// sem perda. Estes helpers são a única fonte de tradução.
// =============================================================================

// -------- Gênero --------------------------------------------------------------
// Meta: genders = [1] (masculino), [2] (feminino), ou ausente (todos).
export function mapGender(input: any): number[] | undefined {
  if (Array.isArray(input)) {
    const norm = input.map((g) => Number(g)).filter((n) => n === 1 || n === 2);
    return norm.length ? norm : undefined;
  }
  if (typeof input !== "string") return undefined;
  const s = input.trim().toLowerCase();
  if (!s) return undefined;
  if (["m", "masc", "masculino", "homem", "homens", "male"].includes(s)) return [1];
  if (["f", "fem", "feminino", "mulher", "mulheres", "female"].includes(s)) return [2];
  if (["todos", "ambos", "all", "any", "todos os gêneros", "todos os generos"].includes(s)) return undefined;
  return undefined;
}

// -------- Localizações --------------------------------------------------------
export function mapGeoLocations(adset: any): any {
  if (adset?.geo_locations && typeof adset.geo_locations === "object") return adset.geo_locations;
  if (adset?.targeting?.geo_locations) return adset.targeting.geo_locations;
  const loc = (adset?.location ?? "BR").toString().trim().toUpperCase().slice(0, 2);
  return { countries: [loc || "BR"] };
}

// -------- Posicionamentos -----------------------------------------------------
// Suporta:
//   - "advantage_plus" (string ou item do array)  → posicionamentos automáticos
//   - ["facebook_feed", "instagram_reels", ...]    → mapeia para publisher_platforms + *_positions
//   - publisher_platforms direto                   → repassa
const FB_POSITIONS = new Set(["feed", "right_hand_column", "marketplace", "video_feeds", "story", "search", "instream_video", "facebook_reels", "facebook_reels_overlay", "groups_feed"]);
const IG_POSITIONS = new Set(["stream", "story", "explore", "explore_home", "reels", "profile_feed", "ig_search", "shop"]);

const PLACEMENT_ALIAS: Record<string, { platform: "facebook" | "instagram" | "messenger" | "audience_network"; position: string }> = {
  facebook_feed: { platform: "facebook", position: "feed" },
  facebook_stories: { platform: "facebook", position: "story" },
  facebook_reels: { platform: "facebook", position: "facebook_reels" },
  facebook_marketplace: { platform: "facebook", position: "marketplace" },
  facebook_video_feeds: { platform: "facebook", position: "video_feeds" },
  facebook_search: { platform: "facebook", position: "search" },
  facebook_instream_video: { platform: "facebook", position: "instream_video" },
  instagram_feed: { platform: "instagram", position: "stream" },
  instagram_stories: { platform: "instagram", position: "story" },
  instagram_reels: { platform: "instagram", position: "reels" },
  instagram_explore: { platform: "instagram", position: "explore" },
  instagram_explore_home: { platform: "instagram", position: "explore_home" },
  instagram_shop: { platform: "instagram", position: "shop" },
  messenger_inbox: { platform: "messenger", position: "messenger_home" },
  messenger_stories: { platform: "messenger", position: "story" },
  audience_network: { platform: "audience_network", position: "classic" },
};

export function applyPlacements(targeting: any, adset: any): void {
  const list = Array.isArray(adset?.placements) ? adset.placements : [];
  const advantageRequested = list.some((p: any) => String(p).toLowerCase() === "advantage_plus")
    || adset?.use_advantage_placements === true
    || adset?.advantage_plus_placements === true;

  if (advantageRequested) {
    // Advantage+ Placements: basta NÃO enviar publisher_platforms/positions.
    // ATENÇÃO: NÃO setar targeting_automation.advantage_audience=1 — isso é
    // Advantage+ AUDIENCE (automação de público), coisa diferente, e força
    // a Meta a rejeitar age_min > 25 (erro 1870188 em 2026-06-18).
    // Advantage+ Audience só deve ser ativado se a proposta pedir explicitamente
    // via adset.use_advantage_audience === true.
    if (adset?.use_advantage_audience === true) {
      targeting.targeting_automation = { ...(targeting.targeting_automation || {}), advantage_audience: 1 };
    }
    return;
  }

  // Placements manuais explícitos
  if (Array.isArray(adset?.publisher_platforms) && adset.publisher_platforms.length > 0) {
    targeting.publisher_platforms = adset.publisher_platforms;
    if (Array.isArray(adset.facebook_positions)) targeting.facebook_positions = adset.facebook_positions;
    if (Array.isArray(adset.instagram_positions)) targeting.instagram_positions = adset.instagram_positions;
    if (Array.isArray(adset.messenger_positions)) targeting.messenger_positions = adset.messenger_positions;
    if (Array.isArray(adset.audience_network_positions)) targeting.audience_network_positions = adset.audience_network_positions;
    if (Array.isArray(adset.device_platforms)) targeting.device_platforms = adset.device_platforms;
    return;
  }

  if (list.length === 0) return;

  const platforms = new Set<string>();
  const fb: string[] = [];
  const ig: string[] = [];
  const msgr: string[] = [];
  const an: string[] = [];
  for (const raw of list) {
    const key = String(raw).toLowerCase();
    const m = PLACEMENT_ALIAS[key];
    if (!m) continue;
    platforms.add(m.platform);
    if (m.platform === "facebook") fb.push(m.position);
    else if (m.platform === "instagram") ig.push(m.position);
    else if (m.platform === "messenger") msgr.push(m.position);
    else if (m.platform === "audience_network") an.push(m.position);
  }
  if (platforms.size > 0) {
    targeting.publisher_platforms = Array.from(platforms);
    if (fb.length) targeting.facebook_positions = Array.from(new Set(fb));
    if (ig.length) targeting.instagram_positions = Array.from(new Set(ig));
    if (msgr.length) targeting.messenger_positions = Array.from(new Set(msgr));
    if (an.length) targeting.audience_network_positions = Array.from(new Set(an));
  }
}

// -------- Janela de atribuição -----------------------------------------------
// "7d_click_1d_view" → [{event_type:"CLICK_THROUGH", window_days:7},{event_type:"VIEW_THROUGH", window_days:1}]
export function mapAttributionSpec(window: any): Array<{ event_type: string; window_days: number }> | undefined {
  if (Array.isArray(window) && window.length && typeof window[0] === "object") return window;
  if (typeof window !== "string") return undefined;
  const s = window.trim().toLowerCase();
  if (!s) return undefined;
  const out: Array<{ event_type: string; window_days: number }> = [];
  // padrões: Xd_click, Xd_view, combinações
  const reClick = /(\d+)d[_-]?click/g;
  const reView = /(\d+)d[_-]?view/g;
  let m;
  while ((m = reClick.exec(s))) out.push({ event_type: "CLICK_THROUGH", window_days: Number(m[1]) });
  while ((m = reView.exec(s))) out.push({ event_type: "VIEW_THROUGH", window_days: Number(m[1]) });
  return out.length ? out : undefined;
}

// -------- Resolver de públicos (nome → ID) ------------------------------------
// Busca todos os custom audiences da conta (uma vez por publicação).
const CUSTOM_AUDIENCE_LIMIT = 500;

export type MetaAudience = { id: string; name: string; subtype?: string };

export async function fetchAccountAudiences(adAccountId: string, accessToken: string): Promise<MetaAudience[]> {
  const cleanId = String(adAccountId).replace("act_", "");
  const out: MetaAudience[] = [];
  let next: string | null = `https://graph.facebook.com/v21.0/act_${cleanId}/customaudiences?fields=id,name,subtype&limit=200&access_token=${encodeURIComponent(accessToken)}`;
  let safety = 0;
  while (next && safety++ < 10) {
    const res: Response = await fetch(next);
    const data: any = await res.json();
    if (data?.error) throw new Error(`Meta audiences: ${data.error.message}`);
    for (const a of (data?.data || [])) {
      out.push({ id: a.id, name: a.name, subtype: a.subtype });
      if (out.length >= CUSTOM_AUDIENCE_LIMIT) break;
    }
    next = data?.paging?.next || null;
    if (out.length >= CUSTOM_AUDIENCE_LIMIT) break;
  }
  return out;
}

function norm(s: string): string {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function findAudienceByName(catalog: MetaAudience[], name: string): MetaAudience | null {
  const target = norm(name);
  if (!target) return null;
  // exato
  let hit = catalog.find((a) => norm(a.name) === target);
  if (hit) return hit;
  // contém
  hit = catalog.find((a) => norm(a.name).includes(target) || target.includes(norm(a.name)));
  return hit || null;
}

// Extrai entradas (id ou nome) de inclusão de público a partir da proposta.
export function extractIncludedAudienceRefs(adset: any): Array<{ id?: string; name?: string }> {
  const out: Array<{ id?: string; name?: string }> = [];
  const push = (v: any) => {
    if (!v) return;
    if (typeof v === "string") {
      if (/^\d{6,}$/.test(v)) out.push({ id: v });
      else out.push({ name: v });
    } else if (typeof v === "object") {
      if (v.id) {
        const o: { id: string; name?: string } = { id: String(v.id) };
        if (v.name) o.name = String(v.name);
        out.push(o);
      } else if (v.name) out.push({ name: String(v.name) });
    }
  };
  const ti = adset?.targeting?.custom_audiences;
  if (Array.isArray(ti)) ti.forEach(push);
  if (Array.isArray(adset?.custom_audiences)) adset.custom_audiences.forEach(push);
  if (Array.isArray(adset?.required_audiences)) adset.required_audiences.forEach(push);
  if (Array.isArray(adset?.required_lookalikes)) adset.required_lookalikes.forEach(push);
  if (Array.isArray(adset?.included_audience_ids)) adset.included_audience_ids.forEach(push);
  return out;
}
