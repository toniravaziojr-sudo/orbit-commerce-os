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
// =====================================================================

export const QUALITY_GATE_VERSION = "1.0.0";

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

export interface QualityGateInput {
  args: QualityGateArgs;
  matchedProduct: QualityGateProduct | null;
  catalog: QualityGateProduct[];
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
    const uniq = tokens(p.name).filter((t) => !exceptToks.has(t));
    if (uniq.length === 0) continue;
    const hits = uniq.filter((t) => haystack.includes(t)).length;
    if (hits >= Math.min(2, uniq.length)) return p;
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

  // 6) Destino/landing obrigatório.
  if (requiresDestination(args) && !args.destination_url) {
    reason_codes.push("invalid_missing_destination");
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

  return {
    ok: reason_codes.length === 0,
    reason_codes,
    details,
    version: QUALITY_GATE_VERSION,
  };
}
