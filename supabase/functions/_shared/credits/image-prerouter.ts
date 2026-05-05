/**
 * Image Pre-Router — Motor de Créditos v2 (Fase A1, shadow sidecar)
 *
 * OBJETIVO:
 *   Calcular, ANTES da chamada ao provider, qual provider/model/service_key
 *   o sistema escolheria, sem alterar o comportamento real da geração.
 *
 * ESCOPO:
 *   - Apenas observabilidade.
 *   - Não chama provider externo.
 *   - Não chama RPC de reserva/captura.
 *   - Não toca wallet/credit_ledger/service_pricing.
 *   - Não decide, não bloqueia, não substitui resilientGenerate.
 *
 * GATE (avaliado pelo caller):
 *   tenant_credit_motor_config.metadata->>'pre_router_enabled' = 'true'
 *
 * VERSÃO: 0.1.0-shadow-sidecar
 */

import { resolveImageServiceKey } from "./image-resolver.ts";

export const PRE_ROUTER_VERSION = "0.1.0-shadow-sidecar" as const;

export type PredictedProvider = "fal" | "gemini" | "openai" | "lovable";
export type PredictedMode = "live" | "shadow" | "free" | "shadow_observation";
export type BlockReason =
  | "no_pricing"
  | "pricing_not_approved_for_live"
  | "tenant_not_in_live_keys"
  | "legacy_provider_out_of_live"
  | "provider_unavailable";

export interface PreRouteImageArgs {
  tenant_id: string;
  feature: "creative_product_image";
  job_id: string;
  variation_index: number;
  outputSize: string; // ex: "1024x1024"
  quality: "low" | "medium" | "high";
  has_reference_image: boolean;
  available_keys: { fal: boolean; gemini: boolean; openai: boolean; lovable: boolean };
}

export interface FallbackChainStep {
  step: number;
  provider: PredictedProvider;
  model: string;
  service_key: string | null;
  mode: PredictedMode;
  reason_to_use:
    | "primary"
    | "no_fal_key"
    | "no_reference_image"
    | "fal_failed_runtime"
    | "gemini_failed_runtime"
    | "openai_failed_runtime"
    | "lovable_last_resort";
}

export interface PreRouteDecision {
  pre_router_version: typeof PRE_ROUTER_VERSION;
  decided_at: string;
  predicted_provider: PredictedProvider;
  predicted_model: string;
  predicted_service_key: string | null;
  predicted_pricing_id: string | null;
  predicted_estimated_credits: number | null;
  fallback_chain: FallbackChainStep[];
  would_block_in_live: boolean;
  block_reason: BlockReason | null;
  mode_predicted: PredictedMode;
}

/**
 * Espelha a cascata atual de visual-engine.ts → resilientGenerate:
 *   Step 1: Fal GPT Image 1 (se falKey + refImage)
 *   Step 2: Gemini Nativa
 *   Step 3: OpenAI Nativa
 *   Step 4: Lovable Gateway
 *
 * NUNCA lança. Toda exceção interna é capturada e retorna decisão segura.
 */
export function preRouteImageGeneration(args: PreRouteImageArgs): PreRouteDecision {
  try {
    const decided_at = new Date().toISOString();
    const chain: FallbackChainStep[] = [];

    // ---------- STEP 1: Fal (primary se referência + key disponível) ----------
    const falEligible = args.has_reference_image && args.available_keys.fal;
    if (falEligible) {
      const resolved = resolveImageServiceKey({
        provider: "fal",
        actualProvider: "fal",
        model: "gpt-image-1.5",
        size: args.outputSize,
        quality: args.quality,
      });
      chain.push({
        step: 1,
        provider: "fal",
        model: "gpt-image-1.5",
        service_key: resolved.resolved ? resolved.service_key : null,
        mode: resolved.resolved ? "live" : "shadow_observation",
        reason_to_use: "primary",
      });
    } else {
      // Fal indisponível: registramos por que pulou
      chain.push({
        step: 1,
        provider: "fal",
        model: "gpt-image-1.5",
        service_key: null,
        mode: "shadow_observation",
        reason_to_use: args.has_reference_image ? "no_fal_key" : "no_reference_image",
      });
    }

    // ---------- STEP 2: Gemini Nativa ----------
    if (args.available_keys.gemini) {
      chain.push({
        step: 2,
        provider: "gemini",
        model: "gemini-2.5-flash-image",
        service_key: null, // sem pricing ativo nesta fase
        mode: "free",
        reason_to_use: "fal_failed_runtime",
      });
    }

    // ---------- STEP 3: OpenAI Nativa (legacy, fora do live) ----------
    if (args.available_keys.openai) {
      chain.push({
        step: 3,
        provider: "openai",
        model: "openai-legacy",
        service_key: null,
        mode: "free",
        reason_to_use: "gemini_failed_runtime",
      });
    }

    // ---------- STEP 4: Lovable Gateway (último recurso) ----------
    if (args.available_keys.lovable) {
      chain.push({
        step: chain.length + 1,
        provider: "lovable",
        model: "google/gemini-2.5-flash-image",
        service_key: null,
        mode: "free",
        reason_to_use: "lovable_last_resort",
      });
    }

    // ---------- Predição primária = primeiro elegível live, senão step 1 ----------
    const primary =
      chain.find((c) => c.mode === "live") ?? chain[0] ?? {
        step: 0,
        provider: "lovable" as PredictedProvider,
        model: "unknown",
        service_key: null,
        mode: "free" as PredictedMode,
        reason_to_use: "lovable_last_resort" as const,
      };

    // ---------- Bloqueio em live ----------
    let would_block_in_live = false;
    let block_reason: BlockReason | null = null;
    if (primary.mode === "live" && !primary.service_key) {
      would_block_in_live = true;
      block_reason = "no_pricing";
    } else if (primary.provider === "openai") {
      would_block_in_live = true;
      block_reason = "legacy_provider_out_of_live";
    } else if (primary.provider === "gemini" && !primary.service_key) {
      would_block_in_live = true;
      block_reason = "no_pricing";
    }

    return {
      pre_router_version: PRE_ROUTER_VERSION,
      decided_at,
      predicted_provider: primary.provider,
      predicted_model: primary.model,
      predicted_service_key: primary.service_key,
      predicted_pricing_id: null, // a Fase A1 não consulta service_pricing.id
      predicted_estimated_credits: null, // estimativa real fica no shadow event existente
      fallback_chain: chain,
      would_block_in_live,
      block_reason,
      mode_predicted: primary.mode,
    };
  } catch (err: any) {
    // Decisão segura "vazia" — caller registra como pre_router_error
    return {
      pre_router_version: PRE_ROUTER_VERSION,
      decided_at: new Date().toISOString(),
      predicted_provider: "lovable",
      predicted_model: "unknown",
      predicted_service_key: null,
      predicted_pricing_id: null,
      predicted_estimated_credits: null,
      fallback_chain: [],
      would_block_in_live: true,
      block_reason: "provider_unavailable",
      mode_predicted: "shadow_observation",
    };
  }
}

/**
 * Normaliza provider para comparação match.
 */
export function normalizeProviderForMatch(p: string | null | undefined): string {
  const v = (p || "").toLowerCase().trim();
  if (v === "fal-ai" || v.startsWith("fal")) return "fal";
  if (v.includes("gemini")) return "gemini";
  if (v === "openai") return "openai";
  if (v === "lovable") return "lovable";
  return v || "unknown";
}

/**
 * Calcula match dimensional entre decisão e resultado real.
 */
export function computePreRouteMatch(
  decision: PreRouteDecision,
  actual: { provider: string; model: string; service_key: string | null },
): {
  match: boolean;
  dimensions: { provider: boolean; model: boolean; service_key: boolean };
  mismatch_reason:
    | null
    | "fallback_used"
    | "fal_failed_runtime"
    | "pricing_not_ready"
    | "provider_unavailable"
    | "model_alias_mismatch"
    | "actual_pricing_missing"
    | "event_not_recorded"
    | "unknown";
} {
  const predProv = normalizeProviderForMatch(decision.predicted_provider);
  const actProv = normalizeProviderForMatch(actual.provider);

  const provMatch = predProv === actProv;
  const skMatch = (decision.predicted_service_key || null) === (actual.service_key || null);
  const modelMatch =
    !decision.predicted_model ||
    !actual.model ||
    actual.model.toLowerCase().includes(decision.predicted_model.toLowerCase()) ||
    decision.predicted_model.toLowerCase().includes(actual.model.toLowerCase());

  const match = provMatch && skMatch;
  let mismatch_reason: ReturnType<typeof computePreRouteMatch>["mismatch_reason"] = null;

  if (!match) {
    if (predProv === "fal" && actProv !== "fal") {
      mismatch_reason = "fal_failed_runtime";
    } else if (!actual.service_key && decision.predicted_service_key) {
      mismatch_reason = "actual_pricing_missing";
    } else if (predProv !== actProv) {
      mismatch_reason = "fallback_used";
    } else if (!skMatch) {
      mismatch_reason = "model_alias_mismatch";
    } else {
      mismatch_reason = "unknown";
    }
  }

  return {
    match,
    dimensions: { provider: provMatch, model: modelMatch, service_key: skMatch },
    mismatch_reason,
  };
}
