/**
 * Media Shadow Event — Motor de Créditos v2 (Fase 3C)
 *
 * Insere `service_usage_events` com `status='shadow'` para etapas de mídia
 * (creative-process, media-generate-video). NÃO toca wallet, NÃO toca
 * credit_ledger, NÃO chama provider duas vezes.
 *
 * Padrão herdado do creative-image-generate (Fase 3B):
 *  - cost_owner='platform' + tenant_id real
 *  - status='shadow'
 *  - metadata.motor_version='v2', mode='shadow'
 *  - idempotency_key determinística
 *  - gate via tenant_credit_motor_config.shadow_service_keys
 *
 * VERSÃO: 0.1.0
 */
import { resolveMediaServiceKey, UNPRICED_MEDIA_MODELS, type ResolveOpts } from "./media-service-key-resolver.ts";
import { estimateCredits } from "./charge.ts";

export const MEDIA_SHADOW_VERSION = "0.1.0" as const;

export interface RecordMediaShadowArgs {
  tenantId: string;
  originFunction: "creative-process" | "media-generate-video";
  jobId: string;
  /** Identificador do step ou variation (compõe idempotency). */
  stepKey: string;
  modelId: string;
  resolveOpts?: ResolveOpts;
  /** Custo USD real apurado pela Fal Usage API (snapshot, não vai p/ ledger). */
  providerCostUsd?: number | null;
  /** request_id da Fal, externo. */
  externalRequestId?: string | null;
  /** Output principal (vídeo/imagem) — auditoria. */
  outputUrl?: string | null;
}

export async function recordMediaShadowEvent(
  supabase: any,
  args: RecordMediaShadowArgs,
): Promise<{ recorded: boolean; reason?: string; service_key?: string }> {
  try {
    if (!args.tenantId) return { recorded: false, reason: "no_tenant_id" };

    // 1) Gate por tenant
    const { data: cfg } = await supabase
      .from("tenant_credit_motor_config")
      .select("shadow_service_keys")
      .eq("tenant_id", args.tenantId)
      .maybeSingle();
    const shadowKeys: string[] = cfg?.shadow_service_keys || [];
    if (!shadowKeys.length) {
      console.log(`[media-shadow] skip tenant_not_enabled ${args.tenantId}`);
      return { recorded: false, reason: "tenant_not_enabled" };
    }

    // 2) Resolver canônico
    const resolved = resolveMediaServiceKey(args.modelId, args.resolveOpts || {});
    if (!resolved) {
      const isKnown = UNPRICED_MEDIA_MODELS.has(args.modelId.toLowerCase());
      console.warn(JSON.stringify({
        evt: "media-shadow.skip_pricing_unresolved",
        tenant_id: args.tenantId,
        model_id: args.modelId,
        reason: isKnown ? "unpriced_known_model" : "unknown_model",
        origin: args.originFunction,
        job_id: args.jobId,
      }));
      return { recorded: false, reason: isKnown ? "unpriced_known_model" : "unknown_model" };
    }

    if (!shadowKeys.includes(resolved.service_key)) {
      console.log(`[media-shadow] skip service_key_not_in_tenant_shadow ${resolved.service_key}`);
      return { recorded: false, reason: "service_key_not_in_tenant_shadow", service_key: resolved.service_key };
    }

    // 3) Estimativa v2 (sem debitar)
    let v2CreditsEstimated: number | null = null;
    let estimateError: string | null = null;
    try {
      const est = await estimateCredits({
        tenantId: args.tenantId,
        serviceKey: resolved.service_key,
        units: resolved.units_json as any,
        publicSafe: false,
      });
      v2CreditsEstimated = (est.data as any)?.credits ?? (est.data as any)?.total_credits ?? null;
      if (!est.success) estimateError = est.error_message || est.error_code || "estimate_failed";
    } catch (e: any) {
      estimateError = e?.message || "estimate_threw";
    }

    // 4) Idempotência determinística
    const idempotencyKey = `${args.originFunction}-shadow-v2:${args.tenantId}:${args.jobId}:${args.stepKey}:${resolved.service_key}`;

    // 5) Insert
    const { error: insErr } = await supabase
      .from("service_usage_events")
      .insert({
        tenant_id: args.tenantId,
        service_key: resolved.service_key,
        category: resolved.category,
        provider: resolved.provider,
        units_json: resolved.units_json,
        status: "shadow",
        cost_owner: "platform",
        origin_function: args.originFunction,
        metadata: {
          motor_version: "v2",
          mode: "shadow",
          media_shadow_version: MEDIA_SHADOW_VERSION,
          shadow_for_tenant_id: args.tenantId,
          model_id: args.modelId,
          job_id: args.jobId,
          step_key: args.stepKey,
          external_request_id: args.externalRequestId || null,
          output_url: args.outputUrl || null,
          provider_cost_usd_snapshot: args.providerCostUsd ?? null,
          provider_cost_source: args.providerCostUsd != null ? "fal_usage_api" : "service_pricing_estimate",
          v1_credits: null,
          v2_credits_estimated: v2CreditsEstimated,
          idempotency_key: idempotencyKey,
          shadow_error: estimateError,
          is_internal_shadow: true,
          no_billing: true,
          no_wallet_mutation: true,
          no_ledger_mutation: true,
        },
      });

    if (insErr) {
      // Conflict de idempotência é OK (retry)
      const msg = insErr.message || "";
      if (msg.includes("duplicate key") || msg.includes("unique") || msg.includes("idempotency")) {
        console.log(`[media-shadow] idempotent skip ${idempotencyKey}`);
        return { recorded: false, reason: "idempotent_replay", service_key: resolved.service_key };
      }
      console.warn(`[media-shadow] insert_failed ${msg}`);
      return { recorded: false, reason: "insert_failed", service_key: resolved.service_key };
    }

    console.log(JSON.stringify({
      evt: "media-shadow.recorded",
      tenant_id: args.tenantId,
      service_key: resolved.service_key,
      v2_credits_estimated: v2CreditsEstimated,
      provider_cost_usd: args.providerCostUsd ?? null,
      origin: args.originFunction,
      job_id: args.jobId,
    }));
    return { recorded: true, service_key: resolved.service_key };
  } catch (e: any) {
    console.warn(`[media-shadow] error_ignored ${e?.message || e}`);
    return { recorded: false, reason: "exception" };
  }
}
