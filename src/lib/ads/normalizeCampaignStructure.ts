// =============================================================================
// normalizeCampaignStructure (Gestor de Tráfego IA)
//
// Adapter puro que normaliza `action_data` (novo OU legacy) na estrutura
// canônica Campanha → Conjunto(s) de anúncios → Anúncio(s).
//
// Regras:
//  - Função pura, NUNCA muta o payload original.
//  - Aceita o novo formato `action_data.campaign_structure` quando existir.
//  - Faz fallback tolerante para o formato legacy:
//      * data.adsets[], data.ads[], data.preview.*, data.campaign_*, etc.
//  - Campos ausentes ficam como `null` (a UI exibe "—" ou "Não informado").
//  - Não disparar IA, não logar, não tocar em rede.
// =============================================================================

export interface CampaignNode {
  name: string | null;
  objective: string | null;
  platform: string | null;
  buying_type: string | null;
  budget_type: string | null;          // daily | lifetime | adset_level
  daily_budget_cents: number | null;
  planned_status: string | null;       // PAUSED | ACTIVE
  rationale: string | null;
  /** Resumo herdado dos anúncios (NUNCA configuração principal da Campanha).
   *  Preenchido pelo adapter quando o payload legado guardou link/CTA no topo. */
  inherited_destination_url: string | null;
  inherited_cta: string | null;
  /** Contrato v1.1 (Onda H.2.1) — orçamento na campanha (CBO) ou nos conjuntos (ABO). */
  budget_mode?: "CBO" | "ABO" | null;
  /** Contrato v1.1 — tag estratégica interna (não é A/B test nativo da Meta). */
  internal_strategy_tag?: string | null;
  /** Contrato v1.1 — subtipo da venda (manual_sales ou advantage_plus_shopping). */
  sales_subtype?: string | null;
  /** Contrato v1.1 — exige catálogo Meta? */
  requires_catalog?: boolean | null;
}

export interface AdSetNode {
  id?: string | null;                  // só presente quando vem como ação filha
  name: string | null;
  funnel_stage: string | null;
  audience_type: string | null;
  targeting_summary: string | null;
  inclusions: string[];
  exclusions: string[];
  customer_exclusion_applied: boolean | null;
  customer_exclusion_label: string | null;
  location: string | null;
  age_range: string | null;
  gender: string | null;
  placements: string[];
  optimization_goal: string | null;
  conversion_event: string | null;
  schedule: { start: string | null; end: string | null } | null;
  daily_budget_cents: number | null;
  /** Contrato v1.1 — em CBO, valor informativo de distribuição estimada. */
  budget_distribution_estimate?: number | null;
  rationale: string | null;
}

export interface AdNode {
  name: string | null;
  ad_set_ref: string | null;
  product_name: string | null;
  offer_note: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  // ---- Pertencem ao CRIATIVO (Onda C.2) ----
  cta: string | null;
  destination_url: string | null;
  tracking_params: string | null;
  creative_prompt: string | null;
  creative_format: string | null;
  alternative_formats: string[];
  reference_image_url: string | null;
  creative_final_url: string | null;
  creative_status: "pending_strategy_approval" | "generating" | "ready" | "unknown";
  rationale: string | null;
  // ---- H.2.3 — metadados de origem/fase (só para a UI exibir mensagens) ----
  cta_source?: "ad_override" | "objective_default" | null;
  destination_source?: "ad_override" | "landing" | "product_offer" | "domain_derived" | null;
  destination_pending_reason?:
    | "product_offer_url_missing"
    | "store_public_domain_not_verified"
    | "landing_invalid_or_internal"
    | "no_product_or_offer_linked"
    | null;
  format_phase?: "h2_structural" | "h4_future" | "account_config" | null;
  // H.2.5 — origem do formato resolvido.
  format_source?:
    | "strategy_explicit_format"
    | "account_default_format"
    | "meta_sales_manual_contract_default"
    | "catalog_required"
    | "testing_h4_variable"
    | "missing_catalog_config"
    | "unsupported_format"
    | null;
  format_source_label_pt?: string | null;
  format_label?: string | null;

}

export interface IdentityNode {
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_actor_id: string | null;
  instagram_actor_name: string | null;
  pixel_id: string | null;
  pixel_name: string | null;
  conversion_event_default: string | null;
  attribution_window: string | null;
  utm_base: string | Record<string, string> | null;
  cta_default: string | null;
  conversions_api_active: boolean;
  source: string;
}

export interface PendingFieldUi {
  level: "identity" | "campaign" | "adset" | "ad";
  index?: number;
  field: string;
  label_pt: string;
}

export interface MetaStepChecklistItem {
  step: "identity" | "campaign" | "adset" | "ad";
  label_pt: string;
  total: number;
  filled: number;
  missing_count: number;
}

export interface CampaignStructure {
  /** Versão do contrato canônico desta proposta (1=legacy, 2=canonical v2, 2.1=ownership-by-level). */
  schema_version: 1 | 2;
  campaign: CampaignNode;
  ad_sets: AdSetNode[];
  ads: AdNode[];
  is_structured_campaign: boolean;
  source: "canonical" | "legacy_adapter";
  /** H.2.1 — identidade da conta (página, IG, pixel, evento, UTM, CTA padrão). */
  identity?: IdentityNode | null;
  /** H.2.1 — pendências por contrato de objetivo Meta. */
  pending_fields?: PendingFieldUi[];
  /** H.2.1 — passo a passo Meta com status de preenchimento. */
  meta_step_checklist?: MetaStepChecklistItem[];
  /** H.2.1 — rótulo PT-BR do objetivo (ex.: "Vendas"). */
  objective_contract_label_pt?: string | null;
  /** Contrato v1.1 (Onda H.2.1) — versão explícita do contrato salvo. */
  contract_version?: "campaign_proposal_v1" | "campaign_proposal_v1_1" | null;
  /** Contrato v1.1 — ok | pending_dependency | blocked. */
  contract_validation_status?: "ok" | "pending_dependency" | "blocked" | null;
  /** Contrato v1.1 — mensagem amigável quando blocked. */
  unsupported_reason?: string | null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function pick<T = unknown>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== "") return v as T;
  }
  return null;
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.name || x?.label || "")).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function buildAgeRange(t: any): string | null {
  if (!t) return null;
  if (typeof t.age_range === "string") return t.age_range;
  if (typeof t.age_min === "number") {
    const max = typeof t.age_max === "number" ? t.age_max : 65;
    return `${t.age_min}-${max}`;
  }
  return null;
}

function buildGender(t: any): string | null {
  if (!t) return null;
  if (typeof t.gender === "string") return t.gender;
  if (Array.isArray(t.genders) && t.genders.length > 0) {
    return t.genders
      .map((g: number) => (g === 1 ? "Masculino" : g === 2 ? "Feminino" : "Todos"))
      .join(", ");
  }
  return null;
}

function buildLocation(t: any): string | null {
  if (!t) return null;
  if (typeof t.location === "string") return t.location;
  const geo = t.geo_locations;
  if (!geo) return null;
  const parts: string[] = [];
  if (Array.isArray(geo.cities)) parts.push(...geo.cities.map((c: any) => c.name || c.key).filter(Boolean));
  if (Array.isArray(geo.regions)) parts.push(...geo.regions.map((c: any) => c.name || c.key).filter(Boolean));
  if (Array.isArray(geo.countries)) parts.push(...geo.countries);
  return parts.length > 0 ? parts.join(", ") : null;
}

// -----------------------------------------------------------------------------
// Construtores a partir do canônico
// -----------------------------------------------------------------------------

function fromCanonical(cs: any): CampaignStructure {
  const legacyTopCta = pickStr(cs?.campaign?.cta);
  const legacyTopUrl = pickStr(cs?.campaign?.destination_url, cs?.campaign?.destination);

  const campaign: CampaignNode = {
    name: pickStr(cs?.campaign?.name),
    objective: pickStr(cs?.campaign?.objective),
    platform: pickStr(cs?.campaign?.platform),
    buying_type: pickStr(cs?.campaign?.buying_type),
    budget_type: pickStr(cs?.campaign?.budget_type),
    daily_budget_cents: pickNum(cs?.campaign?.daily_budget_cents, cs?.campaign?.daily_budget),
    planned_status: pickStr(cs?.campaign?.planned_status),
    rationale: pickStr(cs?.campaign?.rationale),
    inherited_destination_url: legacyTopUrl,
    inherited_cta: legacyTopCta,
  };

  const ad_sets: AdSetNode[] = Array.isArray(cs?.ad_sets)
    ? cs.ad_sets.map((a: any) => ({
        id: pickStr(a?.id),
        name: pickStr(a?.name),
        funnel_stage: pickStr(a?.funnel_stage),
        audience_type: pickStr(a?.audience_type),
        targeting_summary: pickStr(a?.targeting_summary),
        inclusions: asStringArray(a?.inclusions),
        exclusions: asStringArray(a?.exclusions),
        customer_exclusion_applied:
          typeof a?.customer_exclusion === "boolean"
            ? a.customer_exclusion
            : typeof a?.customer_exclusion?.applied === "boolean"
              ? a.customer_exclusion.applied
              : typeof a?.audience_exclusions?.customers === "boolean"
                ? a.audience_exclusions.customers
              : null,
        customer_exclusion_label:
          pickStr(a?.customer_exclusion?.label)
          || (a?.audience_exclusions?.customers ? "Exclui clientes/compradores" : null)
          || ((a?.audience_exclusions?.pending_dependency === "customer_audience_not_detected" || a?.audience_exclusions?.pending_dependency === "customer_audience_missing")
            ? "Pendência: público de clientes não detectado"
            : null),
        location: pickStr(a?.location),
        age_range: pickStr(a?.age_range),
        gender: pickStr(a?.gender),
        placements: asStringArray(a?.placements),
        optimization_goal: pickStr(a?.optimization_goal),
        conversion_event: pickStr(a?.conversion_event),
        schedule: a?.schedule
          ? { start: pickStr(a.schedule.start, a.schedule.start_time), end: pickStr(a.schedule.end, a.schedule.end_time) }
          : null,
        daily_budget_cents: pickNum(a?.daily_budget_cents, a?.budget?.daily_cents, a?.budget),
        rationale: pickStr(a?.rationale),
      }))
    : [];

  const ads: AdNode[] = Array.isArray(cs?.ads)
    ? cs.ads.map((ad: any) => ({
        name: pickStr(ad?.name),
        ad_set_ref: pickStr(ad?.ad_set_ref),
        product_name: pickStr(ad?.product, ad?.product_name),
        offer_note: pickStr(ad?.offer, ad?.offer_note),
        primary_text: pickStr(ad?.primary_text),
        headline: pickStr(ad?.headline),
        description: pickStr(ad?.description),
        // Criativo: link/CTA/tracking são lidos do ad e, se ausentes,
        // herdam o que veio no topo do payload (legado), nunca o contrário.
        cta: pickStr(ad?.cta) || legacyTopCta,
        destination_url: pickStr(ad?.destination_url) || legacyTopUrl,
        tracking_params: pickStr(ad?.tracking_params, ad?.utm_params, ad?.url_tags),
        creative_prompt: pickStr(ad?.creative_prompt),
        creative_format: pickStr(ad?.creative_format),
        alternative_formats: asStringArray(ad?.alternative_formats),
        reference_image_url: pickStr(ad?.reference_image, ad?.reference_image_url),
        creative_final_url: pickStr(ad?.creative_final_url, ad?.creative_url),
        creative_status: (pickStr(ad?.creative_status) as AdNode["creative_status"]) || "unknown",
        rationale: pickStr(ad?.rationale),
      }))
    : [];

  const sv: 1 | 2 = (cs?.schema_version === 2 ? 2 : 1) as 1 | 2;
  return { schema_version: sv, campaign, ad_sets, ads, is_structured_campaign: true, source: "canonical" };
}

// -----------------------------------------------------------------------------
// Construtor a partir do legacy
// -----------------------------------------------------------------------------

function fromLegacy(data: any, opts: { actionType?: string | null; flowVersion?: string | null }): CampaignStructure {
  const preview = data?.preview || {};

  const isCampaignLike =
    opts.actionType === "create_campaign" ||
    opts.flowVersion === "two_step_v1" ||
    !!data?.campaign_name ||
    !!preview?.campaign_name ||
    Array.isArray(data?.adsets) ||
    Array.isArray(data?.ads);

  const legacyTopUrl = pickStr(data?.destination_url, preview?.destination_url, data?.website_url);
  const legacyTopCta = pickStr(data?.cta_type, preview?.cta_type, preview?.cta);
  const legacyTopTracking = pickStr(data?.tracking_params, data?.utm_params, preview?.tracking_params);

  const campaign: CampaignNode = {
    name: pickStr(data?.campaign_name, preview?.campaign_name),
    objective: pickStr(data?.objective, preview?.objective, data?.campaign_type),
    platform: pickStr(data?.platform, data?.channel),
    buying_type: pickStr(data?.buying_type),
    budget_type: pickStr(data?.budget_type) || (data?.daily_budget_cents ? "daily" : data?.lifetime_budget_cents ? "lifetime" : null),
    daily_budget_cents: pickNum(data?.daily_budget_cents, preview?.daily_budget_cents),
    planned_status: pickStr(data?.initial_status, data?.status) || "PAUSED",
    rationale: pickStr(data?.reasoning, preview?.copy_text),
    inherited_destination_url: legacyTopUrl,
    inherited_cta: legacyTopCta,
  };

  // ad_sets: pode vir como data.adsets[] (com targeting próprio) ou inferir 1 conjunto
  // a partir dos campos planos do preview.
  let ad_sets: AdSetNode[] = [];
  if (Array.isArray(data?.adsets) && data.adsets.length > 0) {
    ad_sets = data.adsets.map((a: any, i: number) => {
      const p = a?.preview || {};
      const t = a?.targeting || p?.targeting || {};
      return {
        id: pickStr(a?.id),
        name: pickStr(a?.adset_name, a?.name, p?.adset_name) || `Conjunto ${i + 1}`,
        funnel_stage: pickStr(a?.funnel_stage, p?.funnel_stage, data?.funnel_stage, preview?.funnel_stage),
        audience_type: pickStr(a?.audience_type, p?.audience_type),
        targeting_summary: pickStr(p?.targeting_summary, a?.targeting_summary, a?.audience_description),
        inclusions: asStringArray(t?.interests || a?.inclusions),
        exclusions: asStringArray(t?.excluded_custom_audiences || a?.exclusions || a?.excluded_audience_ids),
        customer_exclusion_applied: typeof a?.audience_exclusions?.customers === "boolean" ? a.audience_exclusions.customers : null,
        customer_exclusion_label:
          a?.audience_exclusions?.customers
            ? "Exclui clientes/compradores"
            : (a?.audience_exclusions?.pending_dependency === "customer_audience_not_detected" || a?.audience_exclusions?.pending_dependency === "customer_audience_missing")
              ? "Pendência: público de clientes não detectado"
              : null,
        // Contrato canônico v2: aceita location/age_min/age_max/gender estruturados por conjunto
        location: pickStr(a?.location) || buildLocation(t),
        age_range:
          pickStr(p?.age_range, a?.age_range) ||
          (typeof a?.age_min === "number" || typeof a?.age_max === "number"
            ? `${a?.age_min ?? 18}-${a?.age_max ?? 65}`
            : null) ||
          buildAgeRange(t),
        gender: pickStr(p?.gender, a?.gender) || buildGender(t),
        placements: asStringArray(a?.placements || p?.placements),
        optimization_goal: pickStr(a?.optimization_goal),
        conversion_event: pickStr(a?.conversion_event),
        schedule: a?.schedule
          ? { start: pickStr(a.schedule.start_time, a.schedule.start), end: pickStr(a.schedule.end_time, a.schedule.end) }
          : null,
        daily_budget_cents:
          pickNum(a?.daily_budget_cents) ??
          (typeof a?.budget_brl === "number" ? Math.round(a.budget_brl * 100) : null),
        rationale: pickStr(a?.reasoning),
      } as AdSetNode;
    });
  } else if (isCampaignLike) {
    // 1 conjunto inferido do payload plano
    const t = data?.targeting || preview?.targeting || {};
    ad_sets = [
      {
        id: null,
        name: pickStr(data?.adset_name, preview?.adset_name) || "Conjunto 1",
        funnel_stage: pickStr(data?.funnel_stage, preview?.funnel_stage),
        audience_type: pickStr(data?.audience_type, preview?.audience_type),
        targeting_summary: pickStr(preview?.targeting_summary, data?.targeting_summary),
        inclusions: asStringArray(t?.interests),
        exclusions: asStringArray(t?.excluded_custom_audiences || data?.excluded_audience_ids),
        customer_exclusion_applied: typeof data?.audience_exclusions?.customers === "boolean" ? data.audience_exclusions.customers : null,
        customer_exclusion_label:
          data?.audience_exclusions?.customers
            ? "Exclui clientes/compradores"
            : (data?.audience_exclusions?.pending_dependency === "customer_audience_not_detected" || data?.audience_exclusions?.pending_dependency === "customer_audience_missing")
              ? "Pendência: público de clientes não detectado"
              : null,
        location: buildLocation(t),
        age_range: pickStr(preview?.age_range, data?.age_range) || buildAgeRange(t),
        gender: pickStr(preview?.gender, data?.gender) || buildGender(t),
        placements: asStringArray(data?.placements || preview?.placements),
        optimization_goal: pickStr(data?.optimization_goal),
        conversion_event: pickStr(data?.conversion_event),
        schedule: null,
        daily_budget_cents: null,
        rationale: null,
      },
    ];
  }

  // ads: data.ads[] explícito OU 1 anúncio inferido de preview/creative_brief
  let ads: AdNode[] = [];
  const brief = data?.creative_brief || {};
  const inferredAd = (): AdNode | null => {
    const anything =
      preview?.headline ||
      preview?.copy_text ||
      preview?.creative_url ||
      brief?.prompt ||
      data?.creative_prompt ||
      data?.headline;
    if (!anything && !isCampaignLike) return null;
    const isTwoStepStrategy = opts.flowVersion === "two_step_v1";
    return {
      name: pickStr(data?.ad_name) || "Anúncio 1",
      ad_set_ref: null,
      product_name: pickStr(preview?.product_name, data?.product_name),
      offer_note: pickStr(data?.offer_note),
      primary_text: pickStr(preview?.copy_text, data?.copy_text, preview?.primary_text, data?.primary_text),
      headline: pickStr(preview?.headline, data?.headline),
      description: pickStr(preview?.description, data?.description),
      // Criativo herda link/CTA legados que vinham no topo do payload
      cta: pickStr(preview?.cta, preview?.cta_type, data?.cta_type) || legacyTopCta,
      destination_url: pickStr(data?.destination_url, preview?.destination_url, data?.website_url) || legacyTopUrl,
      tracking_params: legacyTopTracking,
      creative_prompt: pickStr(brief?.prompt, data?.creative_prompt),
      creative_format: pickStr(brief?.format, data?.creative_format_suggested, data?.creative_format),
      alternative_formats: asStringArray(brief?.alternative_formats),
      reference_image_url: pickStr(preview?.creative_url, data?.asset_url, brief?.reference_image_url),
      creative_final_url: isTwoStepStrategy ? null : pickStr(preview?.creative_url, data?.asset_url),
      creative_status: isTwoStepStrategy
        ? "pending_strategy_approval"
        : preview?.creative_url || data?.asset_url
          ? "ready"
          : "unknown",
      rationale: pickStr(data?.reasoning),
    };
  };

  if (Array.isArray(data?.ads) && data.ads.length > 0) {
    ads = data.ads.map((ad: any, i: number) => ({
      name: pickStr(ad?.name) || `Anúncio ${i + 1}`,
      ad_set_ref: pickStr(ad?.adset_id, ad?.ad_set_ref),
      product_name: pickStr(ad?.product_name),
      offer_note: pickStr(ad?.offer_note),
      primary_text: pickStr(ad?.body, ad?.primary_text, ad?.copy_text),
      headline: pickStr(ad?.headline),
      description: pickStr(ad?.description),
      cta: pickStr(ad?.cta_type, ad?.cta),
      destination_url: pickStr(ad?.url, ad?.destination_url),
      creative_prompt: pickStr(ad?.creative_prompt),
      creative_format: pickStr(ad?.creative_format),
      alternative_formats: asStringArray(ad?.alternative_formats),
      reference_image_url: pickStr(ad?.reference_image_url),
      creative_final_url: pickStr(ad?.creative_url, ad?.asset_url),
      creative_status: (pickStr(ad?.creative_status) as AdNode["creative_status"]) || (ad?.creative_url ? "ready" : "unknown"),
      rationale: pickStr(ad?.reasoning),
    }));
  } else {
    const a = inferredAd();
    if (a) ads = [a];
  }

  return {
    schema_version: 1,
    campaign,
    ad_sets,
    ads,
    is_structured_campaign: isCampaignLike,
    source: "legacy_adapter",
  };
}

// -----------------------------------------------------------------------------
// Entrada pública
// -----------------------------------------------------------------------------

export interface NormalizeOptions {
  /** action_type da ação (create_campaign, create_adset, pause_campaign, …) */
  actionType?: string | null;
  /** flow_version do payload (ex.: two_step_v1) */
  flowVersion?: string | null;
}

// -----------------------------------------------------------------------------
// Construtor para dialeto Onda H.2 — campaign_proposal_v1
// O builder em supabase/functions/_shared/ads-autopilot/campaignProposals.ts
// grava { campaign:{}, adsets:[], planned_creatives:[], raw_planned_action }.
// Aqui mapeamos para o contrato canônico esperado pela UI, enriquecendo cada
// conjunto com os campos granulares (idade, gênero, local, orçamento, etc.)
// que ficam preservados em raw_planned_action.adsets[i].
// -----------------------------------------------------------------------------
function fromCampaignProposalV1(data: any): CampaignStructure {
  const c = data?.campaign || {};
  const raw = data?.raw_planned_action || {};
  const rawAdsets: any[] = Array.isArray(raw?.adsets) ? raw.adsets : [];

  const cents = (brl: unknown): number | null => {
    const n = pickNum(brl);
    return n === null ? null : Math.round(n * 100);
  };

  const campaign: CampaignNode = {
    name: pickStr(c?.name, raw?.campaign_name, raw?.name),
    objective: pickStr(c?.objective, raw?.objective),
    platform: pickStr(c?.platform, data?.platform, data?.channel, raw?.platform),
    buying_type: pickStr(c?.buying_type, raw?.buying_type),
    budget_type: pickStr(c?.budget_type, raw?.budget_type) || (c?.daily_budget_cents || raw?.daily_budget_brl ? "daily" : null),
    daily_budget_cents: pickNum(c?.daily_budget_cents) ?? cents(raw?.daily_budget_brl) ?? cents(raw?.budget_brl),
    planned_status: pickStr(c?.initial_status_planned, c?.planned_status) || "PAUSED",
    rationale: pickStr(c?.rationale, raw?.rationale),
    inherited_destination_url: null,
    inherited_cta: null,
    budget_mode: (c?.budget_mode === "CBO" || c?.budget_mode === "ABO") ? c.budget_mode : null,
    internal_strategy_tag: pickStr(c?.internal_strategy_tag),
    sales_subtype: pickStr(c?.sales_subtype),
    requires_catalog: typeof c?.requires_catalog === "boolean" ? c.requires_catalog : null,
  };

  const h2Adsets: any[] = Array.isArray(data?.adsets) ? data.adsets : [];
  const merged = h2Adsets.length > 0 ? h2Adsets : rawAdsets.map((_, i) => ({ index: i }));

  const ad_sets: AdSetNode[] = merged.map((h2: any, i: number) => {
    const r = rawAdsets[i] || {};
    const excludedAudArr =
      h2?.targeting?.excluded_custom_audiences
      || r?.targeting?.excluded_custom_audiences
      || [];
    return {
      id: null,
      name: humanizeAdsetDisplayName(pickStr(h2?.name, r?.adset_name, r?.name), i),
      funnel_stage: pickStr(r?.funnel_stage, c?.funnel_stage, raw?.funnel_stage),

      audience_type: pickStr(r?.audience_type, h2?.audience),
      targeting_summary: pickStr(r?.audience_description, h2?.audience),
      inclusions: asStringArray(r?.targeting?.interests || h2?.targeting?.interests),
      exclusions: asStringArray(excludedAudArr),
      customer_exclusion_applied:
        typeof h2?.audience_exclusions?.customers === "boolean"
          ? h2.audience_exclusions.customers
          : typeof r?.audience_exclusions?.customers === "boolean"
            ? r.audience_exclusions.customers
            : null,
      customer_exclusion_label:
        (h2?.audience_exclusions?.customers || r?.audience_exclusions?.customers)
          ? "Exclui clientes/compradores"
          : null,
      location: pickStr(r?.location) || buildLocation(r?.targeting),
      age_range:
        (typeof r?.age_min === "number" || typeof r?.age_max === "number")
          ? `${r?.age_min ?? 18}-${r?.age_max ?? 65}`
          : buildAgeRange(r?.targeting),
      gender: pickStr(r?.gender) || buildGender(r?.targeting),
      placements: asStringArray(h2?.placements || r?.placements),
      optimization_goal: pickStr(r?.optimization_goal),
      conversion_event: pickStr(r?.conversion_event, h2?.optimization_event),
      schedule: null,
      daily_budget_cents: pickNum(h2?.daily_budget_cents) ?? cents(r?.budget_brl),
      budget_distribution_estimate: pickNum(h2?.budget_distribution_estimate),
      rationale: pickStr(h2?.audience_exclusions?.reason),
    } as AdSetNode;
  });

  const planned: any[] = Array.isArray(data?.planned_creatives) ? data.planned_creatives : [];
  const adsPatched: any[] = Array.isArray(data?.ads) ? data.ads : [];
  const adsLen = Math.max(planned.length, adsPatched.length);
  const ads: AdNode[] = Array.from({ length: adsLen }, (_, i) => {
    const p: any = planned[i] || {};
    // a = patch persistido pela UI/edge (uploads PC/Drive, geração IA, edição manual de copy).
    // Tem precedência sobre planned_creatives, porque representa a versão mais recente
    // escolhida pelo lojista no fluxo de aprovação.
    const a: any = adsPatched[i] || {};
    const adsetIdx = typeof p?.adset_index === "number" ? p.adset_index : null;
    const linkedFromAdsets = adsetIdx !== null && ad_sets[adsetIdx]
      ? ad_sets[adsetIdx].name
      : null;
    const rawLinked = pickStr(a?.ad_set_ref, p?.linked_adset_name, p?.adset_name, p?.ad_set_ref, linkedFromAdsets);
    const humanizedLinked = rawLinked
      ? humanizeAdsetDisplayName(rawLinked, adsetIdx ?? i)
      : (adsetIdx !== null ? `Conjunto ${adsetIdx + 1}` : null);

    const finalUrl = pickStr(
      a?.creative_final_url, a?.creative_url, a?.asset_url,
      p?.creative_final_url, p?.image_url, p?.creative_url, p?.asset_url,
    );
    const status: AdNode["creative_status"] = (pickStr(a?.creative_status, p?.creative_status) as AdNode["creative_status"])
      || (finalUrl ? "ready" : "pending_strategy_approval");

    return {
      name: humanizeAdDisplayName(pickStr(a?.name, p?.name), i),
      ad_set_ref: humanizedLinked,
      product_name: pickStr(a?.product_name, p?.product_name, c?.product, raw?.product_name),
      offer_note: pickStr(a?.offer_note, p?.promise),
      primary_text: pickStr(a?.primary_text, a?.copy_text, a?.body, p?.copy, p?.primary_text),
      headline: pickStr(a?.headline, p?.headline),
      description: pickStr(a?.description, p?.description),
      cta: pickStr(a?.cta, a?.cta_type, p?.cta, p?.planned_cta),
      destination_url: pickStr(a?.destination_url, a?.url, p?.final_url_with_utm, p?.destination_url),
      tracking_params: typeof p?.utm_template === "string" ? p.utm_template
        : (p?.utm_template && typeof p.utm_template === "object")
          ? Object.entries(p.utm_template).map(([k, v]) => `${k}=${v}`).join("&")
          : null,
      creative_prompt: pickStr(a?.creative_prompt, p?.visual_prompt),
      creative_format: pickStr(a?.creative_format, p?.creative_format, p?.format),
      alternative_formats: [],
      reference_image_url: pickStr(a?.reference_image_url, p?.reference),
      creative_final_url: finalUrl,
      creative_status: status,
      rationale: pickStr(a?.rationale, p?.angle),
      cta_source: (p?.cta_source as any) || null,
      destination_source: (p?.destination_source as any) || null,
      destination_pending_reason: (p?.destination_pending_reason as any) || null,
      format_phase: (p?.format_resolution_phase as any) || (p?.resolution_phase?.format as any) || null,
      format_source: (p?.format_source as any) || null,
      format_source_label_pt: pickStr(p?.format_source_label_pt),
      format_label: pickStr(p?.format_label),
    } as AdNode;
  });

  const cv = typeof data?.contract_version === "string" ? data.contract_version : (data?.schema_version === "campaign_proposal_v1_1" ? "campaign_proposal_v1_1" : "campaign_proposal_v1");
  const cvs = data?.contract_validation_status === "ok" || data?.contract_validation_status === "pending_dependency" || data?.contract_validation_status === "blocked"
    ? data.contract_validation_status
    : null;

  return {
    schema_version: 2,
    campaign,
    ad_sets,
    ads,
    is_structured_campaign: true,
    source: "canonical",
    identity: (data?.identity as any) || null,
    pending_fields: Array.isArray(data?.pending_fields) ? data.pending_fields : [],
    meta_step_checklist: Array.isArray(data?.meta_step_checklist) ? data.meta_step_checklist : [],
    objective_contract_label_pt: typeof data?.objective_contract_label_pt === "string" ? data.objective_contract_label_pt : null,
    contract_version: cv as any,
    contract_validation_status: cvs as any,
    unsupported_reason: typeof data?.unsupported_reason === "string" ? data.unsupported_reason : null,
  };
}

export function normalizeCampaignStructure(
  actionData: Record<string, any> | null | undefined,
  opts: NormalizeOptions = {},
): CampaignStructure {
  const data = actionData || {};
  const flowVersion = opts.flowVersion ?? (data as any)?.flow_version ?? null;
  const actionType = opts.actionType ?? null;

  // 1) Dialeto Onda H.2 — campaign_proposal_v1 e v1.1 (mesmo formato base, v1.1 adiciona campos do contrato)
  const sv = (data as any)?.schema_version;
  if (data && typeof data === "object" && (sv === "campaign_proposal_v1" || sv === "campaign_proposal_v1_1")) {
    return fromCampaignProposalV1(data);
  }

  // 2) Já gravado no formato canônico
  if (data && typeof data === "object" && (data as any).campaign_structure) {
    const out = fromCanonical((data as any).campaign_structure);
    // Reaproveita o flag de classificação se a IA já marcou
    return out;
  }

  // 3) Fallback legacy
  return fromLegacy(data, { actionType, flowVersion });
}

export function formatBudgetBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// =============================================================================
// Helpers de apresentação H.2 (Onda H.2 — auditoria visual)
// Funções puras. Não alteram payload salvo. Apenas convertem valores técnicos
// internos em rótulos amigáveis ou classificam pendências por fase do fluxo.
// =============================================================================

/**
 * Sanitiza prefixos técnicos do nome de conjunto/anúncio mantendo o contexto
 * de negócio. Ex.: "[AI] TEST - Kit Banho - Criativo A" → "Kit Banho — Teste de criativo A".
 * Nunca persiste — só usado na UI. Se o nome ficar vazio, devolve fallback.
 */
export function humanizeAdsetDisplayName(raw: string | null | undefined, index: number): string {
  const fallback = `Conjunto ${index + 1}`;
  if (!raw || typeof raw !== "string") return fallback;
  let s = raw.trim();
  s = s.replace(/^\s*\[AI\]\s*/i, "");
  s = s.replace(/^\s*\[?TESTE?\]?\s*[-–—:]\s*/i, "Teste de criativo — ");
  s = s.replace(/\bTEST\b\s*[-–—:]\s*/gi, "Teste de criativo — ");
  s = s.replace(/\s*[-–—]\s*Criativo\s+([A-Za-z0-9]+)/gi, " — Variação $1");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s.length > 0 ? s : fallback;
}

export function humanizeAdDisplayName(raw: string | null | undefined, index: number): string {
  const fallback = `Anúncio planejado ${index + 1}`;
  if (!raw || typeof raw !== "string") return fallback;
  const s = raw.trim().replace(/^\s*\[AI\]\s*/i, "").replace(/\s{2,}/g, " ").trim();
  return s.length > 0 ? s : fallback;
}

/**
 * Classifica uma pendência salva no payload nas três categorias da H.2:
 *  - "h2_structure"     → bloqueio legítimo da fase atual (estrutura/segmentação).
 *  - "account_config"   → falta uma configuração padrão da conta (evento, CTA, UTM…).
 *  - "h4_future"        → pertence à fase de geração de criativos; NÃO bloqueia H.2.
 */
export type H2PendingCategory = "h2_structure" | "account_config" | "h4_future";

const H4_FIELD_HINTS = [
  "primary_text", "headline", "description", "copy", "body",
  "asset", "image", "video", "creative_id", "creative_url",
  "ad_id", "campaign_id_meta", "adset_id_meta", "creative_final_url",
];

const ACCOUNT_CONFIG_FIELD_HINTS = [
  "conversion_event", "attribution_window", "cta_default", "utm_base",
  "default_cta", "default_format", "default_creative_format", "pixel_id",
  "facebook_page_id", "facebook_page_name", "instagram_actor_id",
  "default_objective", "default_daily_budget",
];

export function classifyPendingFieldH2(p: { level?: string; field?: string; label_pt?: string; phase?: string }): H2PendingCategory {
  // H.2.2: payload novo já traz `phase` explícito.
  if (p?.phase === "h2_structural") return "h2_structure";
  if (p?.phase === "h4_future") return "h4_future";
  if (p?.phase === "account_config") return "account_config";
  // Fallback heurístico para payloads antigos.
  const field = String(p?.field || "").toLowerCase();
  const level = String(p?.level || "").toLowerCase();
  if (level === "ad" && H4_FIELD_HINTS.some((h) => field.includes(h))) return "h4_future";
  if (level === "identity" || ACCOUNT_CONFIG_FIELD_HINTS.some((h) => field.includes(h))) return "account_config";
  return "h2_structure";
}

