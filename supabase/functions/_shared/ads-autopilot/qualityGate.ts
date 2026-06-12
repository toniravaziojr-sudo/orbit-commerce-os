// =====================================================================
// Ads Autopilot — Quality Gate determinístico para sugestões create_campaign.
//
// Função pura: recebe args da tool, produto resolvido e catálogo do tenant,
// devolve veredito normalizado (pass | block) com lista de reason_codes.
//
// NÃO consulta banco, NÃO chama Meta, NÃO chama LLM, NÃO altera nada.
// O Strategist é responsável por persistir o resultado como `skipped`
// quando o gate bloquear.
//
// Reason codes (estáveis — usados em documentação, telemetria e memória):
//   - invalid_unknown_product_name
//   - invalid_product_catalog_mismatch
//   - invalid_product_copy_mismatch
//   - invalid_offer_mismatch
//   - invalid_missing_creative
//   - invalid_missing_destination
//   - invalid_creative_product_mismatch
//   - invalid_cold_campaign_budget_too_aggressive
//   - invalid_creative_not_in_tenant
//   - invalid_creative_product_link_mismatch
//   - invalid_generate_creative_unknown_product
//   - invalid_generate_creative_offer_mismatch
//   - cold_audience_requires_customer_exclusion   (Frente 1 — Fase A)
// =====================================================================

export const QUALITY_GATE_VERSION = "1.4.0";

// CTAs aceitos pela Meta para campanhas de vendas/conversão.
// Mantemos uma lista permissiva — basta haver algum CTA não vazio para
// passar; campos vazios/whitespace disparam invalid_missing_cta.
const SALES_OBJECTIVE_PATTERNS = [
  "sale",
  "sales",
  "conversion",
  "conversions",
  "outcome_sales",
  "purchase",
  "catalog",
  "outcome_traffic",
  "traffic",
  "lead",
  "leads",
  "outcome_leads",
];

function requiresCta(args: { objective?: string | null; funnel_stage?: string | null }): boolean {
  const obj = String(args.objective || "").toLowerCase();
  if (!obj) return false;
  return SALES_OBJECTIVE_PATTERNS.some((p) => obj.includes(p));
}

function extractCta(args: Record<string, unknown>): string {
  const raw = (args.cta ?? args.cta_type ?? (args as any)?.creative?.cta ?? "") as unknown;
  return String(raw || "").trim();
}

export interface QualityGateProduct {
  id: string;
  name: string;
  price?: number | null;
}

export interface QualityGateArgs {
  campaign_name?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  headline?: string | null;
  headlines?: string[] | null;
  primary_text?: string | null;
  primary_texts?: string[] | null;
  copy_text?: string | null;
  destination_url?: string | null;
  funnel_stage?: string | null;
  objective?: string | null;
  daily_budget_cents?: number | null;
  creative_url?: string | null;
  creative_asset_id?: string | null;
  ad_format?: string | null;
  [k: string]: unknown;
}

export interface QualityGateTenantCreative {
  id: string;
  product_id?: string | null;
  tenant_id?: string | null;
}

export interface QualityGateInput {
  args: QualityGateArgs;
  matchedProduct: QualityGateProduct | null;
  catalog: QualityGateProduct[];
  /**
   * Inventário de criativos do tenant. Quando fornecido, o gate valida
   * que `creative_asset_id` existe, pertence ao tenant e está vinculado
   * ao mesmo produto da campanha.
   */
  tenantCreatives?: QualityGateTenantCreative[];
  /**
   * Resultado da resolução do público de Clientes/Compradores do sistema
   * para a conta de anúncios (Frente 1). Quando informado e a campanha
   * for classificada como Pública Fria, o gate exige exclusão aplicada.
   */
  customerAudience?: {
    found: boolean;
    meta_audience_id: string | null;
    audience_name?: string | null;
  } | null;
  /**
   * Onda G.5 — Intenção da campanha. Quando `creative_test` E houver
   * `exclusion_override_reason` na args, o gate libera a exclusão de
   * clientes em público frio (com auditoria nos `details`). Para qualquer
   * outra intenção a regra fria continua valendo.
   */
  campaign_intent?: "acquisition" | "retention" | "creative_test" | "offer_test" | "scale" | "reactivation" | null;
}

export interface QualityGateResult {
  ok: boolean;
  reason_codes: string[];
  details: Record<string, unknown>;
  version: string;
}

const COLD_FUNNEL_STAGES = new Set(["tof", "cold", "prospecting"]);
const COLD_BUDGET_AGGRESSIVE_CENTS_DEFAULT = 20000; // R$ 200/dia
const MIN_TOKEN_LEN = 4;

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length >= MIN_TOKEN_LEN);
}

function copyMentionsProduct(
  copyBlob: string,
  product: QualityGateProduct | null,
): boolean {
  if (!product) return false;
  const haystack = norm(copyBlob);
  if (!haystack) return false;
  const productNorm = norm(product.name);
  if (!productNorm) return false;
  if (haystack.includes(productNorm)) return true;
  const ptoks = tokens(product.name);
  if (ptoks.length === 0) return false;
  const hits = ptoks.filter((t) => haystack.includes(t)).length;
  return hits >= Math.min(2, ptoks.length);
}

/**
 * Detecta outro produto do catálogo mencionado na copy usando APENAS tokens
 * exclusivos (não compartilhados com o produto vinculado). Evita falso
 * positivo entre "Shampoo Calvície Zero" e "Kit Banho Calvície Zero", que
 * compartilham "calvicie" e "zero".
 *
 * v1.1.1 — Threshold mínimo SEMPRE 2 hits para tokens isolados. A versão
 * anterior usava `Math.min(2, uniq.length)`, permitindo bloqueio por 1 único
 * token genérico quando o outro produto tinha apenas 1 token exclusivo. Isso
 * causou falso positivo no tenant Respeite o Homem: copy de "Shampoo
 * Calvície Zero" mencionando a palavra "banho" disparava match com "Kit
 * Banho Calvície Zero" (uniq=["banho"], hits=1 ≥ min(2,1)=1) e gerava
 * `invalid_offer_mismatch` indevido. Fallback adicional: se o NOME COMPLETO
 * normalizado do outro produto (≥8 chars) aparece como substring na copy,
 * mantém o bloqueio — preserva detecção de menção literal ao produto rival.
 */
function copyMentionsAnyCatalogProduct(
  copyBlob: string,
  catalog: QualityGateProduct[],
  except: QualityGateProduct | null,
): QualityGateProduct | null {
  const haystack = norm(copyBlob);
  if (!haystack) return null;
  const exceptToks = new Set(except ? tokens(except.name) : []);
  for (const p of catalog) {
    if (except && p.id === except.id) continue;
    // Fallback forte: nome completo aparece literalmente na copy.
    const otherNorm = norm(p.name);
    if (otherNorm.length >= 8 && haystack.includes(otherNorm)) return p;

    const uniq = tokens(p.name).filter((t) => !exceptToks.has(t));
    if (uniq.length < 2) continue; // produto sem 2 tokens exclusivos não dispara mistura
    const hits = uniq.filter((t) => haystack.includes(t)).length;
    if (hits >= 2) return p;
  }
  return null;
}

function isKit(p: QualityGateProduct | null): boolean {
  if (!p) return false;
  return /\bkit\b/i.test(p.name);
}

function buildCopyBlob(args: QualityGateArgs): string {
  return [
    args.campaign_name,
    args.headline,
    ...(args.headlines || []),
    args.primary_text,
    args.copy_text,
    ...(args.primary_texts || []),
  ]
    .filter(Boolean)
    .join(" \n ");
}

function isCold(args: QualityGateArgs): boolean {
  const f = String(args.funnel_stage || "").toLowerCase();
  return COLD_FUNNEL_STAGES.has(f);
}

function requiresCreative(args: QualityGateArgs): boolean {
  // create_campaign no Meta exige criativo (single image / carousel / video).
  // ad_format ausente é tratado como SINGLE_IMAGE pelo Strategist.
  return true;
}

function requiresDestination(args: QualityGateArgs): boolean {
  // Conversões/tráfego/vendas requerem destino. Engajamento/awareness não.
  const obj = String(args.objective || "").toLowerCase();
  if (!obj) return true;
  return /(conver|sale|traffic|lead|app|catalog|message)/i.test(obj) ||
    obj === "outcome_sales" || obj === "outcome_traffic";
}

export function runCreateCampaignQualityGate(
  input: QualityGateInput,
): QualityGateResult {
  const reason_codes: string[] = [];
  const details: Record<string, unknown> = {};
  const { args, matchedProduct, catalog } = input;

  // 1) Produto precisa existir no catálogo.
  const declared = (args.product_name || "").trim();
  if (declared && !matchedProduct) {
    reason_codes.push("invalid_unknown_product_name");
    details.declared_product_name = declared;
  } else if (!declared && !matchedProduct) {
    reason_codes.push("invalid_product_catalog_mismatch");
    details.declared_product_name = null;
  }

  const copyBlob = buildCopyBlob(args);

  // 2) Produto vinculado vs copy/headline devem falar da mesma oferta.
  if (matchedProduct && copyBlob) {
    const mentionsLinked = copyMentionsProduct(copyBlob, matchedProduct);
    if (!mentionsLinked) {
      reason_codes.push("invalid_product_copy_mismatch");
      details.linked_product = matchedProduct.name;
    }

    // 3) Kit vs isolado: se outro produto do catálogo aparece na copy e o vinculado é diferente.
    const otherInCopy = copyMentionsAnyCatalogProduct(
      copyBlob,
      catalog,
      matchedProduct,
    );
    if (otherInCopy) {
      const kitMismatch = isKit(matchedProduct) !== isKit(otherInCopy);
      if (kitMismatch || !mentionsLinked) {
        if (!reason_codes.includes("invalid_offer_mismatch")) {
          reason_codes.push("invalid_offer_mismatch");
        }
        details.other_product_in_copy = otherInCopy.name;
        details.linked_is_kit = isKit(matchedProduct);
        details.copy_mentions_kit = isKit(otherInCopy);
      }
    }
  }

  // 4) Criativo coerente — se nome no copy não bate com produto E não existe criativo, marcar.
  const hasCreative = !!(args.creative_asset_id || args.creative_url);
  if (
    matchedProduct &&
    hasCreative &&
    reason_codes.includes("invalid_product_copy_mismatch")
  ) {
    reason_codes.push("invalid_creative_product_mismatch");
  }

  // 5) Criativo obrigatório.
  if (requiresCreative(args) && !hasCreative) {
    reason_codes.push("invalid_missing_creative");
  }

  // 5b) Se inventário de criativos do tenant foi fornecido e a sugestão
  // referencia creative_asset_id, validar pertencimento e vínculo de produto.
  if (args.creative_asset_id && Array.isArray(input.tenantCreatives)) {
    const found = input.tenantCreatives.find((c) => c.id === args.creative_asset_id);
    if (!found) {
      reason_codes.push("invalid_creative_not_in_tenant");
      details.creative_asset_id = args.creative_asset_id;
    } else if (
      matchedProduct &&
      found.product_id &&
      found.product_id !== matchedProduct.id
    ) {
      reason_codes.push("invalid_creative_product_link_mismatch");
      details.creative_asset_id = args.creative_asset_id;
      details.creative_product_id = found.product_id;
      details.linked_product_id = matchedProduct.id;
    }
  }

  // 6) Destino/landing obrigatório.
  if (requiresDestination(args) && !args.destination_url) {
    reason_codes.push("invalid_missing_destination");
  }

  // 6b) CTA obrigatório para campanhas de vendas/conversão/tráfego/lead.
  // Em v1.1.2 — campanha SALES sem CTA não pode ficar aprovável.
  // Aceita CTA em args.cta, args.cta_type ou args.creative.cta.
  if (requiresCta(args)) {
    const cta = extractCta(args as unknown as Record<string, unknown>);
    if (!cta) {
      reason_codes.push("invalid_missing_cta");
      details.objective = args.objective;
    }
  }

  // 7) Campanha fria TOF com orçamento agressivo + falhas estruturais.
  const budget = Number(args.daily_budget_cents || 0);
  if (
    isCold(args) &&
    budget >= COLD_BUDGET_AGGRESSIVE_CENTS_DEFAULT &&
    (
      reason_codes.includes("invalid_missing_creative") ||
      reason_codes.includes("invalid_missing_destination") ||
      reason_codes.includes("invalid_product_copy_mismatch") ||
      reason_codes.includes("invalid_offer_mismatch") ||
      reason_codes.includes("invalid_unknown_product_name")
    )
  ) {
    reason_codes.push("invalid_cold_campaign_budget_too_aggressive");
    details.cold_budget_cents = budget;
  }

  // 8) Frente 1 — Pública Fria deve excluir o público de Clientes/Compradores.
  //    Requer:
  //      a) `input.customerAudience` informado (chamador resolveu o público do sistema);
  //      b) se found=true, seu meta_audience_id presente em excluded_audience_ids;
  //      c) se found=false, bloqueia com pré-requisito ausente.
  //    Fail-safe: se chamador não informar customerAudience, não bloqueia
  //    (preserva compatibilidade com callers antigos), mas registra detalhe.
  if (isCold(args)) {
    const ca = input.customerAudience;
    // Onda G.5 — Override de teste criativo: intenção declarada + justificativa.
    const overrideReasonRaw = (args as any).exclusion_override_reason;
    const overrideReason = typeof overrideReasonRaw === "string" ? overrideReasonRaw.trim() : "";
    const isCreativeTestOverride =
      input.campaign_intent === "creative_test" && overrideReason.length >= 12;

    if (isCreativeTestOverride) {
      details.customer_audience_status = "exclusion_overridden_creative_test";
      details.exclusion_override_reason = overrideReason;
      if (ca && ca.found && ca.meta_audience_id) {
        details.customer_audience_id = ca.meta_audience_id;
        details.customer_audience_name = ca.audience_name || null;
      }
    } else if (ca === undefined || ca === null) {
      details.customer_audience_check = "skipped_no_resolver_input";
    } else if (!ca.found || !ca.meta_audience_id) {
      reason_codes.push("cold_audience_requires_customer_exclusion");
      details.customer_audience_status = "missing_in_account";
      details.customer_audience_hint =
        "Crie ou sincronize o público de Clientes antes de propor campanhas frias.";
    } else {
      const excluded = (args as any).excluded_audience_ids as Array<any> | undefined;
      const excludedIds = Array.isArray(excluded)
        ? excluded.map((e) => String(e?.id ?? e)).filter(Boolean)
        : [];
      const has = excludedIds.includes(String(ca.meta_audience_id));
      if (!has) {
        reason_codes.push("cold_audience_requires_customer_exclusion");
        details.customer_audience_status = "exclusion_not_applied";
        details.customer_audience_id = ca.meta_audience_id;
        details.customer_audience_name = ca.audience_name || null;
      } else {
        details.customer_audience_status = "exclusion_applied";
        details.customer_audience_id = ca.meta_audience_id;
        details.customer_audience_name = ca.audience_name || null;
      }
    }
  }

  return {
    ok: reason_codes.length === 0,
    reason_codes,
    details,
    version: QUALITY_GATE_VERSION,
  };
}

// =====================================================================
// Quality Gate para generate_creative — preflight ANTES de consumir
// crédito de geração. Garante que produto existe no catálogo e que copy
// adicional (se fornecida) não diverge do produto declarado.
// =====================================================================

export interface GenerateCreativeArgs {
  product_name?: string | null;
  product_id?: string | null;
  headline?: string | null;
  primary_text?: string | null;
  copy_text?: string | null;
  style_preference?: string | null;
  [k: string]: unknown;
}

export interface GenerateCreativeGateInput {
  args: GenerateCreativeArgs;
  matchedProduct: QualityGateProduct | null;
  catalog: QualityGateProduct[];
}

export function runGenerateCreativeQualityGate(
  input: GenerateCreativeGateInput,
): QualityGateResult {
  const reason_codes: string[] = [];
  const details: Record<string, unknown> = {};
  const { args, matchedProduct, catalog } = input;

  const declared = (args.product_name || "").trim();
  if (!matchedProduct) {
    reason_codes.push("invalid_generate_creative_unknown_product");
    details.declared_product_name = declared || null;
  }

  const copyBlob = [args.headline, args.primary_text, args.copy_text]
    .filter(Boolean)
    .join(" \n ");

  if (matchedProduct && copyBlob) {
    const other = copyMentionsAnyCatalogProduct(copyBlob, catalog, matchedProduct);
    const mentionsLinked = copyMentionsProduct(copyBlob, matchedProduct);
    if (other && (!mentionsLinked || isKit(matchedProduct) !== isKit(other))) {
      reason_codes.push("invalid_generate_creative_offer_mismatch");
      details.other_product_in_copy = other.name;
      details.linked_product = matchedProduct.name;
    }
  }

  return {
    ok: reason_codes.length === 0,
    reason_codes,
    details,
    version: QUALITY_GATE_VERSION,
  };
}
