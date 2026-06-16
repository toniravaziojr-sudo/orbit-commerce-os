// =============================================================================
// readinessLoader — Onda H.4.1
// Hidrata o CreativeReadinessInput a partir do banco. Único ponto que faz
// merge global+override de marca. NUNCA decide prontidão (isso é do gate puro).
// =============================================================================

import {
  type BrandInput,
  type CreativeReadinessInput,
  type CreativePlannedFormat,
  type MetaIntegrationInput,
  type PlannedCreativeInput,
  type PricingInput,
  type PricingEntry,
  type ProductInput,
  type ProposalInput,
} from "./creativeReadinessGate.ts";

// Mapeamento canônico de formato planejado → service_key da tabela de preços.
// Decisão da plataforma (não da IA). Hoje só suportamos imagem única em produção.
const FORMAT_TO_SERVICE_KEY: Record<
  Exclude<CreativePlannedFormat, "test_pending">,
  string | null
> = {
  image_single: "fal.gpt-image-1.5.per_image.medium_1024",
  carousel: null,
  video: null,
};

const COST_TABLE_VERSION = "v1.2026-06";

function normalizeFormat(raw: unknown): CreativePlannedFormat {
  const s = String(raw || "").toLowerCase();
  if (s === "single_image" || s === "image_single" || s === "image") return "image_single";
  if (s === "carousel") return "carousel";
  if (s === "video" || s === "single_video") return "video";
  return "test_pending";
}

function asArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function mergeBrand(global: any, override: any): BrandInput {
  const pick = <K extends string>(field: K): any => {
    const o = override?.[field];
    if (o === undefined || o === null) return global?.[field] ?? null;
    if (typeof o === "string" && o.trim() === "") return global?.[field] ?? null;
    if (Array.isArray(o) && o.length === 0) return global?.[field] ?? [];
    return o;
  };
  return {
    brand_summary: pick("brand_summary"),
    tone_of_voice: pick("tone_of_voice"),
    visual_style_guidelines: pick("visual_style_guidelines"),
    logo_url: pick("logo_url"),
    palette_defined: false, // calculado fora a partir de store_settings
    packshot_url: pick("packshot_url"),
    banned_claims: asArray(pick("banned_claims")),
    do_not_do: asArray(pick("do_not_do")),
    allowed_claims: asArray(pick("allowed_claims")),
    approved_main_promise: pick("approved_main_promise"),
    compliance_notes: pick("compliance_notes"),
    no_additional_restrictions_confirmed: Boolean(
      override?.no_additional_restrictions_confirmed ??
        global?.no_additional_restrictions_confirmed ??
        false,
    ),
  };
}

export interface LoaderResult {
  input: CreativeReadinessInput;
  /** Resolvido para uso posterior (geração) sem reler banco. */
  resolved: {
    action_data: any;
    product_image_url: string | null;
    product_description: string | null;
    product_name: string | null;
    product_id: string | null;
  };
  /** Falhas duras de carga (sem proposta, sem tenant, etc.). Quando setado, o caller deve abortar. */
  fatal: string | null;
}

export async function loadCreativeReadiness(
  supabase: any,
  tenantId: string,
  actionId: string,
): Promise<LoaderResult> {
  // ---- proposta -----------------------------------------------------------
  const { data: action } = await supabase
    .from("ads_autopilot_actions")
    .select("id, tenant_id, channel, action_data, status")
    .eq("id", actionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!action) {
    return {
      input: emptyInput(actionId),
      resolved: { action_data: null, product_image_url: null, product_description: null, product_name: null, product_id: null },
      fatal: "Proposta não encontrada.",
    };
  }

  const ad = action.action_data || {};
  const campaign = ad.campaign || {};
  const adsets = Array.isArray(ad.adsets) ? ad.adsets : [];
  const planned: any[] = Array.isArray(ad.planned_creatives) ? ad.planned_creatives : [];

  // ---- produto ------------------------------------------------------------
  let productId: string | null =
    ad.product_id || campaign.product_id || null;
  let productRow: any = null;
  if (productId) {
    const { data } = await supabase
      .from("products")
      .select("id, name, description, short_description, regulatory_category, commercial_restrictions, no_additional_restrictions_confirmed, ai_product_type, ai_main_function")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    productRow = data;
  }
  if (!productRow && campaign.product) {
    const { data } = await supabase
      .from("products")
      .select("id, name, description, short_description, regulatory_category, commercial_restrictions, no_additional_restrictions_confirmed, ai_product_type, ai_main_function")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${String(campaign.product).trim()}%`)
      .limit(1)
      .maybeSingle();
    productRow = data;
    productId = data?.id ?? null;
  }

  // imagem principal
  let primaryImageUrl: string | null = null;
  if (productId) {
    const { data: imgs } = await supabase
      .from("product_images")
      .select("url, is_primary, sort_order")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1);
    primaryImageUrl = imgs?.[0]?.url ?? null;
  }

  // benefícios (diferenciais)
  let benefits: string[] = [];
  if (productId) {
    const { data: payload } = await supabase
      .from("ai_product_commercial_payload")
      .select("differentials")
      .eq("product_id", productId)
      .maybeSingle();
    benefits = asArray(payload?.differentials);
  }

  // ---- marca: global + override ------------------------------------------
  const { data: brandGlobal } = await supabase
    .from("tenant_brand_context")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: accountCfg } = await supabase
    .from("ads_autopilot_account_configs")
    .select("chat_overrides")
    .eq("tenant_id", tenantId)
    .eq("channel", action.channel || "meta")
    .maybeSingle();
  const brandOverride = accountCfg?.chat_overrides?.brand_overrides ?? null;

  const brand = mergeBrand(brandGlobal, brandOverride);

  // logo + paleta vêm de store_settings
  const { data: store } = await supabase
    .from("store_settings")
    .select("logo_url, primary_color, secondary_color, accent_color")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!brand.logo_url) brand.logo_url = store?.logo_url ?? null;
  brand.palette_defined = Boolean(store?.primary_color && store?.secondary_color);

  // ---- Meta production -----------------------------------------------------
  // Fonte primária: ativos selecionados nas integrações Meta (OAuth ativa).
  // Evento de conversão e janela de atribuição são DERIVADOS do objetivo da
  // campanha + padrão Meta — não há campo manual obrigatório. A tabela de
  // configuração de produção é só override avançado opcional.
  const { data: metaIntegRows } = await supabase
    .from("tenant_meta_integrations")
    .select("integration_id, status, selected_assets")
    .eq("tenant_id", tenantId);

  const integByKind: Record<string, any> = {};
  for (const row of metaIntegRows || []) {
    integByKind[(row as any).integration_id] = row;
  }
  const anuncios = integByKind["anuncios"];
  const pixelInteg = integByKind["pixel_facebook"];
  const capiInteg = integByKind["conversions_api"];

  const anyMetaActive = (metaIntegRows || []).some(
    (r: any) => r?.status === "active" || r?.status === "connected",
  );

  const adAccountFromInteg = Array.isArray(anuncios?.selected_assets?.ad_accounts)
    && anuncios.selected_assets.ad_accounts.length > 0;
  const pageFromInteg =
    (Array.isArray(anuncios?.selected_assets?.pages) && anuncios.selected_assets.pages.length > 0) ||
    !!anuncios?.selected_assets?.page;
  const pixelFromInteg =
    !!pixelInteg?.selected_assets?.pixel?.id ||
    (Array.isArray(pixelInteg?.selected_assets?.pixels) && pixelInteg.selected_assets.pixels.length > 0) ||
    !!capiInteg?.selected_assets?.pixel?.id ||
    (Array.isArray(capiInteg?.selected_assets?.pixels) && capiInteg.selected_assets.pixels.length > 0);

  const meta: MetaIntegrationInput = {
    oauth_active: anyMetaActive,
    ad_account_valid: adAccountFromInteg,
    facebook_page_linked: pageFromInteg,
    pixel_configured: pixelFromInteg,
    // Derivados automaticamente — sempre verdadeiros quando o objetivo for válido.
    conversion_event_set: true,
    attribution_window_set: true,
  };

  // ---- UTM fallback: proposta → conta → global -----------------------------
  const { data: globalCfg } = await supabase
    .from("ads_autopilot_configs")
    .select("safety_rules")
    .eq("tenant_id", tenantId)
    .eq("channel", "global")
    .maybeSingle();
  const utmFromGlobal =
    (globalCfg?.safety_rules as any)?.default_utm_template ||
    "utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}";

  // ---- planned_creatives normalizadas -------------------------------------
  const plannedCreatives: PlannedCreativeInput[] = planned.map((pc, i) => ({
    index: typeof pc.index === "number" ? pc.index : i,
    origin: ad.kind === "campaign_test_proposal" ? "test" : "creation",
    format: normalizeFormat(pc.format ?? pc.creative_format),
    cta: pc.cta ?? pc.planned_cta ?? null,
  }));

  // ---- proposta normalizada -----------------------------------------------
  const firstAdset = adsets[0] || {};
  const proposal: ProposalInput = {
    id: action.id,
    proposal_kind: ad.kind === "campaign_test_proposal" ? "test" : "creation",
    campaign_objective: campaign.objective ?? campaign.platform_objective ?? null,
    destination_url: planned[0]?.destination_url ?? null,
    utm_template: planned[0]?.utm_template ?? campaign.utm_base ?? utmFromGlobal ?? null,
    budget_amount_cents: campaign.daily_budget_cents ?? null,
    audience_defined: adsets.some((a: any) => a.audience || a.targeting),
    placements_defined: adsets.some((a: any) => Array.isArray(a.placements) && a.placements.length > 0),
    catalog_required: Boolean(campaign.requires_catalog),
    catalog_linked: Boolean(campaign.catalog_id),
    planned_creatives: plannedCreatives,
  };

  // ---- produto normalizado ------------------------------------------------
  const product: ProductInput = {
    id: productId || "unknown",
    name: productRow?.name ?? null,
    description: productRow?.description ?? productRow?.short_description ?? null,
    benefits,
    is_physical: true,
    primary_image_url: primaryImageUrl,
    ai_product_type: productRow?.ai_product_type ?? null,
    ai_main_function: productRow?.ai_main_function ?? null,
    regulatory_category: (productRow?.regulatory_category as any) ?? null,
    commercial_restrictions: productRow?.commercial_restrictions ?? null,
    no_additional_restrictions_confirmed: Boolean(productRow?.no_additional_restrictions_confirmed),
  };

  // ---- pricing -------------------------------------------------------------
  const serviceKeys = Object.values(FORMAT_TO_SERVICE_KEY).filter(Boolean) as string[];
  const pricingTable: Record<string, PricingEntry> = {};
  if (serviceKeys.length > 0) {
    const { data: rows } = await supabase
      .from("service_pricing")
      .select("service_key, cost_usd, markup_pct, is_active, effective_until")
      .in("service_key", serviceKeys);
    const now = Date.now();
    for (const r of rows || []) {
      if (r.is_active === false) continue;
      if (r.effective_until && new Date(r.effective_until).getTime() < now) continue;
      const cost = Number(r.cost_usd) || 0;
      const markup = Number(r.markup_pct) || 0;
      const sellUsd = cost * (1 + markup / 100);
      const credits = Math.max(1, Math.ceil(sellUsd / 0.01));
      pricingTable[r.service_key] = { service_key: r.service_key, credits_per_unit: credits };
    }
  }

  const pricing: PricingInput = {
    format_to_service_key: FORMAT_TO_SERVICE_KEY,
    table: pricingTable,
    cost_table_version: COST_TABLE_VERSION,
  };

  return {
    input: { proposal, meta, brand, product, pricing },
    resolved: {
      action_data: ad,
      product_image_url: primaryImageUrl,
      product_description: productRow?.description ?? productRow?.short_description ?? null,
      product_name: productRow?.name ?? null,
      product_id: productId,
    },
    fatal: null,
  };
}

function emptyInput(actionId: string): CreativeReadinessInput {
  return {
    proposal: {
      id: actionId,
      proposal_kind: "creation",
      campaign_objective: null,
      destination_url: null,
      utm_template: null,
      budget_amount_cents: null,
      audience_defined: false,
      placements_defined: false,
      catalog_required: false,
      catalog_linked: false,
      planned_creatives: [],
    },
    meta: {
      oauth_active: false, ad_account_valid: false, facebook_page_linked: false,
      pixel_configured: false, conversion_event_set: false, attribution_window_set: false,
    },
    brand: {
      brand_summary: null, tone_of_voice: null, visual_style_guidelines: null,
      logo_url: null, palette_defined: false, packshot_url: null,
      banned_claims: [], do_not_do: [], allowed_claims: [],
      approved_main_promise: null, compliance_notes: null,
      no_additional_restrictions_confirmed: false,
    },
    product: {
      id: "unknown", name: null, description: null, benefits: [],
      is_physical: true, primary_image_url: null,
      ai_product_type: null, ai_main_function: null,
      regulatory_category: null,
      commercial_restrictions: null, no_additional_restrictions_confirmed: false,
    },
    pricing: { format_to_service_key: FORMAT_TO_SERVICE_KEY, table: {}, cost_table_version: COST_TABLE_VERSION },
  };
}
