// =====================================================================
// Ads Autopilot — Resolução determinística de produto e criativo ready.
//
// Funções puras (sem I/O) usadas pelo Strategist no fluxo
// implement_campaigns ANTES do Quality Gate. Objetivo:
//
//  1. Resolver o produto da proposta com fallback robusto
//     (product_id → nome exato → nome normalizado). Evita falso-positivo
//     `invalid_missing_creative` quando o modelo passou product_id correto
//     mas product_name com variação de espaço/acento/caixa.
//
//  2. Selecionar um criativo `ready` do tenant vinculado ao MESMO
//     product_id resolvido, com proteção Kit vs isolado: se o produto
//     vinculado é Kit, só aceita criativo de Kit; se é isolado, só aceita
//     criativo do isolado.
//
// NÃO consulta banco, NÃO chama Meta, NÃO chama LLM. Recebe inventários
// já carregados e devolve decisões puras + logs estruturados.
// =====================================================================

export interface ResolverProduct {
  id: string;
  name: string;
  price?: number | null;
}

export interface ResolverCreativeAsset {
  id: string;
  product_id?: string | null;
  asset_url?: string | null;
  status?: string | null;
  tenant_id?: string | null;
}

export interface ResolveProductInput {
  args: { product_id?: string | null; product_name?: string | null };
  catalog: ResolverProduct[];
}

export interface ResolveCreativeInput {
  product: ResolverProduct | null;
  tenantCreatives: ResolverCreativeAsset[];
}

export interface ResolveCreativeResult {
  asset: ResolverCreativeAsset | null;
  candidates: ResolverCreativeAsset[];
  skipped_reason: string | null;
}

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isKit(name: string): boolean {
  return /\bkit\b/i.test(name);
}

/**
 * Resolve produto a partir dos args.
 * Prioridade: product_id → nome exato (trim) → nome normalizado
 * (lower + sem acentos + sem pontuação). Nunca usa "includes" amplo
 * para evitar confundir "Shampoo" com "Kit Banho ... Shampoo".
 */
export function resolveProduct(input: ResolveProductInput): ResolverProduct | null {
  const { args, catalog } = input;
  if (!catalog || catalog.length === 0) return null;

  if (args.product_id) {
    const byId = catalog.find((p) => p.id === args.product_id);
    if (byId) return byId;
  }

  const declared = (args.product_name || "").trim();
  if (declared) {
    const exact = catalog.find((p) => p.name.trim() === declared);
    if (exact) return exact;
    const declaredNorm = norm(declared);
    if (declaredNorm) {
      const normalized = catalog.find((p) => norm(p.name) === declaredNorm);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Seleciona um criativo `ready` para o produto resolvido.
 *  - Aceita apenas criativos com asset_url e status="ready" do MESMO product_id.
 *  - Proteção Kit vs isolado: nome do produto vinculado ao criativo (quando
 *    disponível via product_id) precisa pertencer ao mesmo lado (Kit ou
 *    isolado) que o produto da proposta. Como o filtro é por product_id,
 *    este invariante já está garantido — Kit não recebe criativo de
 *    isolado e vice-versa porque o product_id é distinto.
 *  - Retorna o mais recente disponível; se não houver, devolve skipped_reason.
 */
export function selectReadyCreative(
  input: ResolveCreativeInput,
): ResolveCreativeResult {
  const { product, tenantCreatives } = input;
  if (!product) {
    return { asset: null, candidates: [], skipped_reason: "no_resolved_product" };
  }
  const candidates = (tenantCreatives || []).filter(
    (c) =>
      c &&
      c.product_id === product.id &&
      (c.status ?? "ready") === "ready" &&
      typeof c.asset_url === "string" &&
      c.asset_url.length > 0,
  );
  if (candidates.length === 0) {
    return { asset: null, candidates: [], skipped_reason: "no_ready_creative_for_product" };
  }
  return { asset: candidates[0], candidates, skipped_reason: null };
}

export function describeResolverDecision(opts: {
  product: ResolverProduct | null;
  args: { product_id?: string | null; product_name?: string | null };
  result: ResolveCreativeResult;
}): Record<string, unknown> {
  return {
    declared_product_id: opts.args.product_id ?? null,
    declared_product_name: opts.args.product_name ?? null,
    resolved_product_id: opts.product?.id ?? null,
    resolved_product_name: opts.product?.name ?? null,
    resolved_is_kit: opts.product ? isKit(opts.product.name) : null,
    ready_creative_count: opts.result.candidates.length,
    selected_creative_id: opts.result.asset?.id ?? null,
    skipped_reason: opts.result.skipped_reason,
  };
}
