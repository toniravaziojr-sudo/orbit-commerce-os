// =====================================================================
// Tenant Memory Reader — Subfase D (Leitura Observacional)
//
// Helper PURO usado pelo Ads Autopilot para carregar memórias do tenant
// em modo observacional. Esta camada NÃO influencia a IA: não altera
// veredito, sugestões, prompts, Policy Engine, Governance Layer,
// Action Derivation nem execução. Apenas retorna candidatas e produz
// um resumo estruturado para ser anexado/loggado como observação.
//
// Restrições do contrato (anti-regressão):
//   - sem chamadas a Meta;
//   - sem cron novo;
//   - sem LLM;
//   - sem fetch externo;
//   - sem efeito colateral (a leitura real é feita pelo caller passando
//     um `fetcher` injetado, mantendo este módulo testável sem Supabase);
//   - tenant_id é obrigatório — sem ele a leitura retorna vazio.
// =====================================================================

export type TenantMemoryStatus = "provisional" | "active" | "archived";

export interface TenantMemoryRow {
  id: string;
  tenant_id: string;
  sales_platform: string;
  ads_platform: string;
  memory_type: string;
  scope: string;
  key: string;
  value: Record<string, unknown> | null;
  confidence: number;
  evidence_count: number;
  status: TenantMemoryStatus;
}

export interface MemoryReadContext {
  tenant_id?: string | null;
  sales_platform?: string | null;
  ads_platform?: string | null;
  objective?: string | null;
  action_type?: string | null;
  campaign_id?: string | null;
  product_id?: string | null;
  memory_type?: string | null;
  scope?: string | null;
  key?: string | null;
  /** Confiança mínima opcional (0..1). Default: 0 (não filtra). */
  min_confidence?: number;
}

export interface MemoryObservation {
  mode: "observational_only";
  memory_candidates_count: number;
  memory_ids_considered: string[];
  statuses_considered: TenantMemoryStatus[];
  applied_to_decision: false;
  reason: string;
}

/** Status aceitos na leitura observacional. `archived` nunca é considerado. */
export const OBSERVATIONAL_STATUSES: TenantMemoryStatus[] = ["provisional", "active"];

/**
 * Indica se a chamada tem o mínimo necessário para uma consulta útil.
 * Sem tenant_id ou ads_platform, evitamos consulta pesada.
 */
export function canQueryTenantMemory(ctx: MemoryReadContext): boolean {
  return Boolean(ctx.tenant_id && ctx.ads_platform);
}

/**
 * Filtra em memória as linhas aplicáveis ao contexto, aplicando as
 * restrições por sales_platform/objective/action_type/scope/etc.
 * Tenant é filtrado server-side antes de chegar aqui — esta função
 * NUNCA pode "vazar" memória de outro tenant: por segurança, validamos
 * tenant_id de cada linha contra o do contexto.
 */
export function filterApplicableMemories(
  rows: TenantMemoryRow[],
  ctx: MemoryReadContext,
): TenantMemoryRow[] {
  if (!ctx.tenant_id) return [];
  const minConf = ctx.min_confidence ?? 0;
  return rows.filter((row) => {
    if (row.tenant_id !== ctx.tenant_id) return false;
    if (!OBSERVATIONAL_STATUSES.includes(row.status)) return false;
    if (ctx.ads_platform && row.ads_platform !== ctx.ads_platform) return false;
    if (ctx.sales_platform && row.sales_platform !== ctx.sales_platform) return false;
    if (ctx.memory_type && row.memory_type !== ctx.memory_type) return false;
    if (ctx.scope && row.scope !== ctx.scope) return false;
    if (ctx.key && row.key !== ctx.key) return false;
    if (row.confidence < minConf) return false;

    // Filtros opcionais que podem aparecer no value (objective/action_type/campaign_id/product_id).
    // São best-effort: se o value não tiver o campo, NÃO descartamos a linha — só descartamos
    // quando o campo existe e diverge explicitamente.
    const v = row.value || {};
    if (ctx.objective && typeof (v as any).objective === "string" && (v as any).objective !== ctx.objective) return false;
    if (ctx.action_type && typeof (v as any).action_type === "string" && (v as any).action_type !== ctx.action_type) return false;
    if (ctx.campaign_id && typeof (v as any).campaign_id === "string" && (v as any).campaign_id !== ctx.campaign_id) return false;
    if (ctx.product_id && typeof (v as any).product_id === "string" && (v as any).product_id !== ctx.product_id) return false;

    return true;
  });
}

/** Constrói o resumo observacional anexável em logs/contexto. */
export function buildMemoryObservation(
  rows: TenantMemoryRow[],
  reason?: string,
): MemoryObservation {
  const statuses = Array.from(new Set(rows.map((r) => r.status))) as TenantMemoryStatus[];
  return {
    mode: "observational_only",
    memory_candidates_count: rows.length,
    memory_ids_considered: rows.map((r) => r.id),
    statuses_considered: statuses,
    applied_to_decision: false,
    reason: reason ?? (rows.length === 0
      ? "tenant_memory_empty_or_not_applicable"
      : "tenant_memory_not_active_for_influence"),
  };
}

/**
 * Leitura observacional completa: recebe um fetcher injetado (geralmente
 * um wrapper de `supabase.from('ads_autopilot_tenant_memory')...`),
 * aplica filtros server-side mínimos via `ctx`, depois aplica
 * `filterApplicableMemories` e devolve `{ rows, observation }`.
 *
 * Garantias:
 *   - sem tenant_id/ads_platform → não chama fetcher;
 *   - fetcher pode lançar; nesse caso devolvemos rows vazias e
 *     observação com reason explicando a falha (não propaga erro
 *     porque memória é puramente observacional nesta subfase).
 */
export async function readTenantMemoryObservational(
  ctx: MemoryReadContext,
  fetcher: (ctx: MemoryReadContext) => Promise<TenantMemoryRow[]>,
): Promise<{ rows: TenantMemoryRow[]; observation: MemoryObservation }> {
  if (!canQueryTenantMemory(ctx)) {
    return { rows: [], observation: buildMemoryObservation([], "missing_tenant_or_ads_platform") };
  }
  let raw: TenantMemoryRow[] = [];
  try {
    raw = await fetcher(ctx);
  } catch {
    return { rows: [], observation: buildMemoryObservation([], "tenant_memory_fetch_failed_observational_only") };
  }
  const rows = filterApplicableMemories(raw || [], ctx);
  return { rows, observation: buildMemoryObservation(rows) };
}
