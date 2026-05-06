/**
 * Fallback Shadow — Motor de Créditos v2 (Fase A2.1)
 *
 * OBJETIVO:
 *   Registrar evento separado em `service_usage_events` quando o vencedor real
 *   da geração de IA Imagem NÃO está coberto pela A2 (Fal.AI medium_1024 com
 *   pricing). Cobre vencedores Gemini/OpenAI/Lovable e qualquer Fal sem pricing.
 *
 * ESCOPO ESTRITO (READ-ONLY do ponto de vista financeiro):
 *   - Apenas observabilidade.
 *   - Zero mutação em wallet, credit_ledger, RPCs de cobrança.
 *   - Zero pricing numérico (cost_usd_snap, sell_usd_snap, credits).
 *   - status='shadow' (NÃO cria status novo).
 *   - cost_owner='platform' + tenant_id real (permitido por chk_sue_owner_tenant).
 *   - service_key placeholder textual `fallback.<provider>.<model_slug>.unpriced`.
 *   - NÃO confere cobrança em live. Em live, pipeline futuro deve BLOQUEAR
 *     fallback sem pricing (live_behavior='block_without_pricing').
 *
 * GATE:
 *   tenant_credit_motor_config.metadata.fallback_shadow_enabled = true
 *   tenant_credit_motor_config.metadata.fallback_shadow_version = '0.1.0'
 *
 * VERSÃO: 0.1.0
 */

export const FALLBACK_SHADOW_VERSION = "0.1.0" as const;

export type FallbackProvider = "gemini" | "openai" | "lovable" | "fal" | "unknown";

export interface FallbackShadowGateMeta {
  fallback_shadow_enabled?: unknown;
  fallback_shadow_version?: unknown;
}

/**
 * Avalia gate A2.1 a partir do metadata do tenant.
 * Só retorna true se as DUAS chaves estiverem corretas.
 */
export function isFallbackShadowEnabled(
  metadata: FallbackShadowGateMeta | Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return m.fallback_shadow_enabled === true && m.fallback_shadow_version === FALLBACK_SHADOW_VERSION;
}

/**
 * Normaliza provider bruto para o conjunto canônico do fallback.
 * Função pura.
 */
export function normalizeProviderForFallback(raw: string | null | undefined): FallbackProvider {
  const v = (raw || "").toLowerCase().trim();
  if (!v) return "unknown";
  if (v.includes("lovable")) return "lovable";
  if (v.includes("gemini") || v.includes("google") || v.includes("nano-banana")) return "gemini";
  if (v.includes("openai") || v.includes("gpt-image") || v.includes("dall")) return "openai";
  if (v === "fal" || v.startsWith("fal")) return "fal";
  return "unknown";
}

/**
 * Slugifica model_id para um token seguro em service_key.
 * Mantém [a-z0-9.-], colapsa o resto em "-".
 */
export function slugifyModelForFallback(model: string | null | undefined): string {
  const v = (model || "unknown-model").toLowerCase().trim();
  return v
    .replace(/[^a-z0-9.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    || "unknown-model";
}

/**
 * Gera o service_key placeholder de fallback.
 * Sempre `fallback.<provider>.<model_slug>.unpriced`.
 * Função pura.
 */
export function resolveFallbackServiceKey(
  provider: string | null | undefined,
  model: string | null | undefined,
): string {
  const p = normalizeProviderForFallback(provider);
  const m = slugifyModelForFallback(model);
  return `fallback.${p}.${m}.unpriced`;
}

export interface BuildFallbackShadowMetadataInput {
  creative_job_id: string;
  variation_index: number;
  predicted_provider?: string | null;
  predicted_model?: string | null;
  predicted_service_key?: string | null;
  actual_provider: string | null | undefined;
  actual_model: string | null | undefined;
  winner_provider?: string | null;
  winner_model?: string | null;
  fallback_reason?: string | null;
  providers_requested?: Array<string> | null;
  enable_fallback?: boolean | null;
}

export interface FallbackShadowMetadata {
  motor_version: "v2";
  mode: "shadow";
  is_fallback_event: true;
  fallback_shadow_version: typeof FALLBACK_SHADOW_VERSION;
  pricing_status: "missing";
  unpriced: true;
  no_billing: true;
  no_wallet_mutation: true;
  no_ledger_mutation: true;
  absorbed_by_platform: true;
  is_internal_shadow: true;
  creative_job_id: string;
  variation_index: number;
  predicted_provider: string | null;
  predicted_model: string | null;
  predicted_service_key: string | null;
  actual_provider: string | null;
  actual_model: string | null;
  actual_service_key: null;
  winner_provider: string | null;
  winner_model: string | null;
  fallback_reason: string | null;
  providers_requested: Array<string>;
  enable_fallback: boolean;
  pricing_missing_reason: "no_service_pricing_row_for_model";
  live_behavior: "block_without_pricing";
  admin_visibility: true;
}

/**
 * Monta a metadata do evento fallback shadow.
 * Função pura. Nunca lança.
 * NÃO inclui cost_usd_snap, sell_usd_snap, credits, shadow_reserve/capture/release.
 */
export function buildFallbackShadowMetadata(
  input: BuildFallbackShadowMetadataInput,
): FallbackShadowMetadata {
  return {
    motor_version: "v2",
    mode: "shadow",
    is_fallback_event: true,
    fallback_shadow_version: FALLBACK_SHADOW_VERSION,
    pricing_status: "missing",
    unpriced: true,
    no_billing: true,
    no_wallet_mutation: true,
    no_ledger_mutation: true,
    absorbed_by_platform: true,
    is_internal_shadow: true,
    creative_job_id: input.creative_job_id,
    variation_index: input.variation_index,
    predicted_provider: input.predicted_provider ?? null,
    predicted_model: input.predicted_model ?? null,
    predicted_service_key: input.predicted_service_key ?? null,
    actual_provider: input.actual_provider ?? null,
    actual_model: input.actual_model ?? null,
    actual_service_key: null,
    winner_provider: input.winner_provider ?? input.actual_provider ?? null,
    winner_model: input.winner_model ?? input.actual_model ?? null,
    fallback_reason: input.fallback_reason ?? null,
    providers_requested: Array.isArray(input.providers_requested) ? input.providers_requested : [],
    enable_fallback: input.enable_fallback === true,
    pricing_missing_reason: "no_service_pricing_row_for_model",
    live_behavior: "block_without_pricing",
    admin_visibility: true,
  };
}

export interface RecordFallbackShadowArgs extends BuildFallbackShadowMetadataInput {
  tenantId: string;
}

/**
 * Persiste o evento fallback shadow em service_usage_events.
 * NÃO é função pura: faz INSERT.
 * NUNCA quebra a geração — try/catch externo no caller é obrigatório,
 * mas esta função também tolera falha silenciosa (loga warn).
 */
export async function recordFallbackShadowEvent(
  supabase: any,
  args: RecordFallbackShadowArgs,
): Promise<{ recorded: boolean; service_key: string; error?: string }> {
  const provider = normalizeProviderForFallback(args.actual_provider);
  const service_key = resolveFallbackServiceKey(args.actual_provider, args.actual_model);
  const metadata = buildFallbackShadowMetadata(args);

  try {
    const { error } = await supabase.from("service_usage_events").insert({
      tenant_id: args.tenantId,
      cost_owner: "platform",
      service_key,
      category: "ai_image",
      provider,
      units_json: { images: 1 },
      status: "shadow",
      origin_function: "creative-image-generate",
      metadata,
    });
    if (error) {
      console.warn(JSON.stringify({
        evt: "creative-image.fallback-shadow.insert_failed",
        tenant_id: args.tenantId,
        creative_job_id: args.creative_job_id,
        variation_index: args.variation_index,
        service_key,
        error: error.message,
      }));
      return { recorded: false, service_key, error: error.message };
    }
    console.log(JSON.stringify({
      evt: "creative-image.fallback-shadow.recorded",
      tenant_id: args.tenantId,
      creative_job_id: args.creative_job_id,
      variation_index: args.variation_index,
      provider,
      service_key,
      fallback_shadow_version: FALLBACK_SHADOW_VERSION,
    }));
    return { recorded: true, service_key };
  } catch (e: any) {
    console.warn(JSON.stringify({
      evt: "creative-image.fallback-shadow.error",
      tenant_id: args.tenantId,
      creative_job_id: args.creative_job_id,
      variation_index: args.variation_index,
      service_key,
      error: e?.message || String(e),
    }));
    return { recorded: false, service_key, error: e?.message || String(e) };
  }
}
