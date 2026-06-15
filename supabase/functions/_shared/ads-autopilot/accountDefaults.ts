// =============================================================================
// Onda H.2.1 — Resolvedor de Padrões da Conta de Anúncios
//
// Lê configurações já cadastradas no tenant para que cada proposta de campanha
// "nasça preenchida" com identidade (página, IG, pixel, evento, UTM, CTA etc.)
// em vez de depender do LLM. Função executada SERVER-SIDE (edge function), sem
// chamadas externas. Falha silenciosa → retorna defaults vazios.
// =============================================================================

// SupabaseClient é tipado como any para evitar dependência de tipos do esm.sh em build TS local.
type SupabaseClient = any;

export interface AccountDefaults {
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_actor_id: string | null;
  instagram_actor_name: string | null;
  pixel_id: string | null;
  pixel_name: string | null;
  conversion_event_default: string | null;
  attribution_window: string | null;
  default_objective: string | null;
  default_buying_type: string | null;
  default_budget_type: string | null;
  default_daily_budget_cents: number | null;
  default_planned_status: string | null;
  default_country: string | null;
  default_age_min: number | null;
  default_age_max: number | null;
  default_gender: string | null;
  default_placements: string[] | null;
  default_cta: string | null;
  default_creative_format: string | null;
  default_utm_params: Record<string, string> | null;
  conversions_api_active: boolean;
  source: "ads_meta_production_config" | "tenant_meta_integrations" | "marketing_integrations" | "ads_autopilot_account_configs" | "merged" | "none";
  /** Distribuição de orçamento por funil (% inteiros somando 100). */
  funnel_splits?: { cold?: number; warm?: number; remarketing?: number; tests?: number; leads?: number } | null;
}

const EMPTY: AccountDefaults = {
  facebook_page_id: null, facebook_page_name: null,
  instagram_actor_id: null, instagram_actor_name: null,
  pixel_id: null, pixel_name: null,
  conversion_event_default: null, attribution_window: null,
  default_objective: null, default_buying_type: null, default_budget_type: null,
  default_daily_budget_cents: null, default_planned_status: null,
  default_country: null, default_age_min: null, default_age_max: null, default_gender: null,
  default_placements: null, default_cta: null, default_creative_format: null, default_utm_params: null,
  conversions_api_active: false, source: "none", funnel_splits: null,
};

export async function resolveAccountDefaults(
  supabase: SupabaseClient,
  params: { tenant_id: string; ad_account_id?: string | null },
): Promise<AccountDefaults> {
  const out: AccountDefaults = { ...EMPTY };
  let sources: string[] = [];

  try {
    // 1) ads_meta_production_config (config oficial da operação Meta)
    const cfgQ = supabase
      .from("ads_meta_production_config")
      .select("*")
      .eq("tenant_id", params.tenant_id);
    if (params.ad_account_id) cfgQ.eq("ad_account_id", params.ad_account_id);
    const { data: cfg } = await cfgQ.limit(1).maybeSingle();

    if (cfg) {
      sources.push("ads_meta_production_config");
      out.facebook_page_id = cfg.facebook_page_id || null;
      out.instagram_actor_id = cfg.instagram_actor_id || null;
      out.pixel_id = cfg.pixel_id || null;
      out.conversion_event_default = cfg.default_conversion_event || null;
      out.attribution_window = cfg.attribution_window || null;
      out.default_objective = cfg.default_objective || null;
      out.default_buying_type = cfg.default_buying_type || null;
      out.default_budget_type = cfg.default_budget_type || null;
      out.default_daily_budget_cents = cfg.default_daily_budget_cents ?? null;
      out.default_planned_status = cfg.default_planned_status || null;
      out.default_country = cfg.default_country || null;
      out.default_age_min = cfg.default_age_min ?? null;
      out.default_age_max = cfg.default_age_max ?? null;
      out.default_gender = cfg.default_gender || null;
      out.default_placements = Array.isArray(cfg.default_placements) ? cfg.default_placements : null;
      out.default_cta = cfg.default_cta || null;
      out.default_creative_format = cfg.default_creative_format || null;
      out.default_utm_params = (cfg.default_utm_params && typeof cfg.default_utm_params === "object")
        ? cfg.default_utm_params as Record<string, string>
        : null;
    }
  } catch (_) { /* tolerante */ }

  try {
    // 2) tenant_meta_integrations (assets reais conectados via OAuth)
    const { data: integrations } = await supabase
      .from("tenant_meta_integrations")
      .select("integration_id, status, selected_assets")
      .eq("tenant_id", params.tenant_id)
      .eq("status", "active");

    if (integrations?.length) {
      sources.push("tenant_meta_integrations");
      for (const row of integrations) {
        const sel: any = (row as any).selected_assets || {};
        const intId = (row as any).integration_id;
        if (intId === "anuncios") {
          if (!out.facebook_page_id) {
            const page = sel.page || (Array.isArray(sel.pages) ? sel.pages[0] : null);
            if (page) { out.facebook_page_id = page.id || null; out.facebook_page_name = page.name || null; }
          }
          if (!out.instagram_actor_id) {
            const ig = sel.instagram_actor || (Array.isArray(sel.instagram_accounts) ? sel.instagram_accounts[0] : null);
            if (ig) { out.instagram_actor_id = ig.id || null; out.instagram_actor_name = ig.name || ig.username || null; }
          }
        }
        if (intId === "pixel_facebook" || intId === "conversions_api") {
          if (!out.pixel_id) {
            const px = sel.pixel || (Array.isArray(sel.pixels) ? sel.pixels[0] : null);
            if (px) { out.pixel_id = px.id || null; out.pixel_name = px.name || null; }
          }
          if (intId === "conversions_api") out.conversions_api_active = true;
        }
      }
    }
  } catch (_) { /* tolerante */ }

  try {
    // 3) marketing_integrations — Pixel oficial cadastrado no marketing do tenant
    const { data: mk } = await supabase
      .from("marketing_integrations")
      .select("meta_pixel_id")
      .eq("tenant_id", params.tenant_id)
      .maybeSingle();
    if (mk?.meta_pixel_id && !out.pixel_id) {
      sources.push("marketing_integrations");
      out.pixel_id = String(mk.meta_pixel_id);
    }
  } catch (_) { /* tolerante */ }

  try {
    // 4) ads_autopilot_account_configs — Orçamento estratégico + funnel splits do canal Meta
    const acctQ = supabase
      .from("ads_autopilot_account_configs")
      .select("budget_mode, budget_cents, funnel_splits, target_roi")
      .eq("tenant_id", params.tenant_id)
      .eq("channel", "meta");
    if (params.ad_account_id) acctQ.eq("ad_account_id", params.ad_account_id);
    const { data: acct } = await acctQ.limit(1).maybeSingle();
    if (acct) {
      sources.push("ads_autopilot_account_configs");
      if (out.default_daily_budget_cents == null && acct.budget_cents && acct.budget_mode === "daily") {
        out.default_daily_budget_cents = Number(acct.budget_cents);
      }
      if (acct.funnel_splits && typeof acct.funnel_splits === "object") {
        out.funnel_splits = acct.funnel_splits as AccountDefaults["funnel_splits"];
      }
    }
  } catch (_) { /* tolerante */ }

  out.source = sources.length > 1 ? "merged" : sources.length === 1 ? (sources[0] as any) : "none";
  return out;
}

