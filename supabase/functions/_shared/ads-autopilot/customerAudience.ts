// =====================================================================
// Ads Autopilot — Customer Audience Resolver (Frente 1 / Fase A)
//
// Resolve, de forma determinística, qual é o público de Clientes/Compradores
// já criado/sincronizado pelo sistema para uma conta de anúncios da Meta.
//
// Regra canônica:
//   audience_sync_mappings (platform='meta', status='active', ad_account_id)
//   ⨯ email_marketing_lists (is_system=true, name='Clientes')
//   → platform_audience_id
//
// Não chama Meta. Não cria/sincroniza nada. Apenas LÊ dados já existentes.
// Se o vínculo não existir, retorna null e o chamador decide o que fazer
// (Quality Gate bloqueia, Executor recusa publicação).
// =====================================================================

export interface CustomerAudienceResolution {
  found: boolean;
  meta_audience_id: string | null;
  audience_name: string | null;
  list_id: string | null;
  ad_account_id: string;
  source: "audience_sync_mapping" | null;
  source_table: "audience_sync_mappings" | null;
  last_synced_at: string | null;
  pending_dependency: "customer_audience_not_detected" | null;
  reason_if_missing: string | null;
  reason_code?: "missing_customer_audience";
}

const SYSTEM_CUSTOMERS_LIST_NAME = "Clientes";

/**
 * Detecta o público de Clientes/Compradores sincronizado pelo sistema
 * para a conta de anúncios. Retorna `found=false` se nada estiver vinculado.
 *
 * @param supabase Cliente Supabase (service_role recomendado para edge function)
 * @param tenantId UUID do tenant
 * @param adAccountId ID da conta de anúncios Meta (ex: "act_123...")
 */
export async function resolveCustomerAudienceForMetaAccount(
  supabase: any,
  tenantId: string,
  adAccountId: string,
): Promise<CustomerAudienceResolution> {
  if (!tenantId || !adAccountId) {
    return {
      found: false,
      meta_audience_id: null,
      audience_name: null,
      list_id: null,
      ad_account_id: adAccountId,
      source: null,
      source_table: null,
      last_synced_at: null,
      pending_dependency: "customer_audience_not_detected",
      reason_if_missing: "tenant_or_ad_account_missing",
      reason_code: "missing_customer_audience",
    };
  }

  // 1) Pega a lista de sistema "Clientes" do tenant
  const { data: list } = await supabase
    .from("email_marketing_lists")
    .select("id, name, is_system")
    .eq("tenant_id", tenantId)
    .eq("is_system", true)
    .eq("name", SYSTEM_CUSTOMERS_LIST_NAME)
    .maybeSingle();

  if (!list?.id) {
    return {
      found: false,
      meta_audience_id: null,
      audience_name: null,
      list_id: null,
      ad_account_id: adAccountId,
      source: null,
      source_table: null,
      last_synced_at: null,
      pending_dependency: "customer_audience_not_detected",
      reason_if_missing: "system_customers_list_missing",
      reason_code: "missing_customer_audience",
    };
  }

  // 2) Procura o mapeamento ativo para Meta naquela conta
  const { data: mapping } = await supabase
    .from("audience_sync_mappings")
    .select("platform_audience_id, audience_name, status, last_synced_at")
    .eq("tenant_id", tenantId)
    .eq("list_id", list.id)
    .eq("platform", "meta")
    .eq("ad_account_id", adAccountId)
    .eq("status", "active")
    .maybeSingle();

  if (!mapping?.platform_audience_id) {
    return {
      found: false,
      meta_audience_id: null,
      audience_name: null,
      list_id: list.id,
      ad_account_id: adAccountId,
      source: null,
      source_table: null,
      last_synced_at: null,
      pending_dependency: "customer_audience_not_detected",
      reason_if_missing: "active_audience_mapping_missing",
      reason_code: "missing_customer_audience",
    };
  }

  return {
    found: true,
    meta_audience_id: String(mapping.platform_audience_id),
    audience_name: mapping.audience_name || SYSTEM_CUSTOMERS_LIST_NAME,
    list_id: list.id,
    ad_account_id: adAccountId,
    source: "audience_sync_mapping",
    source_table: "audience_sync_mappings",
    last_synced_at: mapping.last_synced_at || null,
    pending_dependency: null,
    reason_if_missing: null,
  };
}

/**
 * Constrói o bloco de metadata padronizado que descreve a aplicação
 * da regra "público frio sempre exclui Clientes". Persistir em
 * `action_data.customer_audience_exclusion` e também propagar no preview.
 */
export function buildCustomerExclusionMetadata(
  resolution: CustomerAudienceResolution,
  applied: boolean,
): Record<string, unknown> {
  return {
    customer_audience_exclusion_enabled: applied && resolution.found,
    customer_audience_id: resolution.meta_audience_id,
    customer_audience_name: resolution.audience_name,
    customer_audience_list_id: resolution.list_id,
    customer_audience_missing: !resolution.found,
    exclusion_reason: applied
      ? "cold_audience_must_exclude_existing_customers"
      : null,
    resolved_at: new Date().toISOString(),
    source: resolution.source,
  };
}

const COLD_FUNNEL_STAGES = new Set([
  "tof",
  "cold",
  "frio",
  "prospecting",
  "prospect",
  "prospeccao",
]);

export function isColdFunnelStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return COLD_FUNNEL_STAGES.has(String(stage).toLowerCase().trim());
}
