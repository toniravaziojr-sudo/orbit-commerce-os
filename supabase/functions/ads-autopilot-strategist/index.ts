import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
import { getBrainContextForPrompt } from "../_shared/brain-context.ts";
import { attachObservationFromActionRecordAsync } from "../_shared/ads-policy.ts";
import { runCreateCampaignQualityGate, runGenerateCreativeQualityGate, QUALITY_GATE_VERSION } from "../_shared/ads-autopilot/qualityGate.ts";
import { resolveProduct, selectReadyCreative, describeResolverDecision } from "../_shared/ads-autopilot/creativeResolver.ts";
import { resolveCustomerAudienceForMetaAccount, buildCustomerExclusionMetadata, isColdFunnelStage } from "../_shared/ads-autopilot/customerAudience.ts";
import { applyUtm, slugifyForUtm } from "../_shared/ads/utm.ts";
// Onda G — Modelos determinísticos para qualidade estratégica do Plano Inicial.
import { computeFunnelBudgetState, formatFunnelBudgetStatePtBr, inferCampaignFunnel, type FunnelBudgetState } from "../_shared/ads-autopilot/funnelBudgetModel.ts";
import { identifyProductFromCampaign, type InferredProduct } from "../_shared/ads-autopilot/productIdentification.ts";
import { evaluateAudienceBudgetFit, type AudienceBudgetFitResult } from "../_shared/ads-autopilot/audienceBudgetFitLite.ts";
// Onda G (rev2) — Preflight Builder + Contrato fail-closed do Plano Estratégico.
import { buildStrategicPlanPreflightContext, type StrategicPlanPreflight } from "../_shared/ads-autopilot/strategicPlanPreflight.ts";
import { validateStrategicPlanContract, CONTRACT_VERSION as PLAN_CONTRACT_VERSION } from "../_shared/ads-autopilot/strategicPlanContract.ts";
import {
  scoreProposal,
  applyLimits,
  templateKey,
  PROPOSAL_LIMITER_VERSION,
  DEFAULT_MAX_PROPOSALS_PER_CYCLE,
  DEFAULT_MAX_PROPOSALS_PER_PRODUCT_PER_CYCLE,
  DEFAULT_COOLDOWN_MS,
  type ExistingPendingProposal,
} from "../_shared/ads-autopilot/proposalLimiter.ts";
import {
  evaluateStrategistCooldown,
  evaluatePendingQueueGate,
  shouldWeeklyYieldToMonthly,
  MAX_PENDING_APPROVAL_QUEUE,
  CADENCE_POLICY_VERSION,
  type StrategistTriggerKind,
} from "../_shared/ads-autopilot/cadencePolicy.ts";
import {
  TWO_STEP_FLOW_VERSION,
  buildCreativeBrief,
  type CreativeBrief,
} from "../_shared/ads-autopilot/twoStep.ts";

// ===== Frente 4 — Fluxo de duas etapas =====
// Sempre ativo para novas propostas. O Estrategista deixa de gerar criativo
// final no preflight: salva o brief e o usuário decide gerar na Etapa 2.
const TWO_STEP_ENABLED = true;

/**
 * Fase C.3.2 — Etapa 5 — Helper local NÃO-bloqueante.
 * Delega para o helper central ASSÍNCRONO que aplica gates, faz fallback de
 * contexto via DB (somente leitura) e chama `decide()` real antes do INSERT.
 * Engole qualquer erro silenciosamente: observação NUNCA bloqueia o fluxo principal.
 */
async function attachObservationIfEligible(
  actionRecord: Record<string, any>,
  acctConfig: { tenant_id?: string; is_ai_enabled?: boolean | null; kill_switch?: boolean | null; autonomy_mode?: unknown; last_budget_adjusted_at?: string | null } | null | undefined,
  supabase: any,
): Promise<void> {
  try {
    await attachObservationFromActionRecordAsync(actionRecord, acctConfig as any, supabase);
  } catch (_e) {
    // no-op
  }
}


import { chargeAfter } from "../_shared/credits/charge-after.ts";

// ===== VERSION =====
const VERSION = "v1.49.0"; // Phase 5: Migrate to centralized meta-connection helper (V4+fallback)
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============ TYPES ============

interface AccountConfig {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string;
  is_ai_enabled: boolean;
  budget_cents: number | null;
  budget_mode: string | null;
  target_roi: number | null;
  min_roi_cold: number | null;
  min_roi_warm: number | null;
  roas_scaling_threshold: number | null;
  user_instructions: string | null;
  strategy_mode: string | null;
  funnel_split_mode: string | null;
  funnel_splits: Record<string, number> | null;
  kill_switch: boolean | null;
  human_approval_mode: string | null;
  last_budget_adjusted_at: string | null;
}

type StrategistTrigger = "start" | "weekly" | "monthly" | "implement_approved_plan" | "implement_campaigns" | "revision";

// ============ HELPERS ============

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeDivide(a: number, b: number, fallback = 0): number {
  return b > 0 ? Math.round((a / b) * 100) / 100 : fallback;
}

function getNextSchedulingTime(): string {
  const now = new Date();
  const scheduleDate = new Date(now);
  const utcHour = now.getUTCHours();
  const brtHour = utcHour - 3 < 0 ? utcHour - 3 + 24 : utcHour - 3;

  if (brtHour >= 0 && brtHour < 4) {
    scheduleDate.setMinutes(scheduleDate.getMinutes() + 5);
  } else {
    if (brtHour >= 4) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }
    const randomMinute = 1 + Math.floor(Math.random() * 59);
    scheduleDate.setUTCHours(3, randomMinute, 0, 0);
  }
  return scheduleDate.toISOString();
}

// ============ STRATEGIST TOOLS ============

const STRATEGIST_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Cria nova campanha completa na plataforma de anúncios (Campanha + Conjunto + Anúncio). Será criada PAUSADA e AGENDADA para ativação em 00:01-04:00 BRT. TODOS os campos devem ser preenchidos como se estivesse configurando manualmente no Meta Ads Manager.",
      parameters: {
        type: "object",
        properties: {
          // --- NÍVEL CAMPANHA ---
          campaign_name: { type: "string", description: "Nome da campanha. Padrão: [AI] Objetivo | Produto | Público | Data" },
          objective: { type: "string", enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION"], description: "Objetivo da campanha Meta Ads" },
          special_ad_categories: { type: "array", items: { type: "string", enum: ["NONE", "CREDIT", "EMPLOYMENT", "HOUSING", "SOCIAL_ISSUES_ELECTIONS_POLITICS"] }, description: "Categorias especiais de anúncio. Use ['NONE'] se não aplicável." },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos (CBO — Campaign Budget Optimization)" },
          lifetime_budget_cents: { type: "number", description: "Orçamento vitalício em centavos (alternativa ao diário)" },
          bid_strategy: { type: "string", enum: ["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "MINIMUM_ROAS"], description: "Estratégia de lance. Padrão: LOWEST_COST_WITHOUT_CAP (menor custo automático)" },
          bid_amount_cents: { type: "number", description: "Limite de lance em centavos (apenas para BID_CAP ou COST_CAP)" },
          roas_avg_floor: { type: "number", description: "ROAS mínimo (apenas para MINIMUM_ROAS). Ex: 2.0 = 200%" },
          
          // --- NÍVEL CONJUNTO DE ANÚNCIOS ---
          adset_name: { type: "string", description: "Nome do conjunto de anúncios. Padrão: [AI] CJ - Público | Funil" },
          optimization_goal: { type: "string", enum: ["OFFSITE_CONVERSIONS", "LINK_CLICKS", "IMPRESSIONS", "REACH", "LANDING_PAGE_VIEWS", "VALUE", "LEAD_GENERATION", "QUALITY_LEAD", "ENGAGED_USERS"], description: "Objetivo de otimização do conjunto. OBRIGATÓRIO." },
          billing_event: { type: "string", enum: ["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY"], description: "Evento de cobrança. Padrão: IMPRESSIONS" },
          conversion_event: { type: "string", enum: ["PURCHASE", "ADD_TO_CART", "INITIATED_CHECKOUT", "LEAD", "COMPLETE_REGISTRATION", "VIEW_CONTENT", "SEARCH", "ADD_PAYMENT_INFO", "ADD_TO_WISHLIST", "CONTACT", "SUBSCRIBE", "START_TRIAL"], description: "Evento de conversão do Pixel. OBRIGATÓRIO para campanhas de vendas/leads." },
          
          // --- TARGETING / PÚBLICO ---
          targeting_description: { type: "string", description: "Descrição textual do público-alvo para referência humana" },
          funnel_stage: { type: "string", enum: ["cold", "warm", "hot"], description: "Etapa do funil" },
          age_min: { type: "number", description: "Idade mínima. Padrão: 18" },
          age_max: { type: "number", description: "Idade máxima. Padrão: 65" },
          genders: { type: "array", items: { type: "number" }, description: "Gêneros: [0]=Todos, [1]=Masculino, [2]=Feminino" },
          geo_locations: { type: "object", description: "Localização geográfica. Ex: {countries: ['BR']} ou {regions: [{key: '3650'}], cities: [{key: '123456'}]}" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "Interesses para segmentação detalhada" },
          behaviors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "Comportamentos para segmentação" },
          custom_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos personalizados para incluir" },
          excluded_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos personalizados para excluir" },
          lookalike_spec: { type: "object", description: "Especificação de Lookalike. Ex: {ratio: 0.03, country: 'BR', source_audience_id: '123'}" },
          
          // --- POSICIONAMENTOS ---
          publisher_platforms: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "audience_network", "messenger"] }, description: "Plataformas. Omitir = Automático (Advantage+)" },
          position_types: { type: "array", items: { type: "string", enum: ["feed", "story", "reels", "right_hand_column", "instant_article", "marketplace", "video_feeds", "search", "instream_video", "reels_overlay", "explore", "profile_feed", "facebook_stories", "instagram_stories", "instagram_reels", "facebook_reels"] }, description: "Posições específicas. Omitir = Automático" },
          device_platforms: { type: "array", items: { type: "string", enum: ["mobile", "desktop"] }, description: "Dispositivos. Omitir = Todos" },
          
          // --- LINK & DESTINO ---
          destination_url: { type: "string", description: "URL de destino do anúncio. OBRIGATÓRIO. Use a URL real do produto ou landing page." },
          display_link: { type: "string", description: "Link exibido no anúncio (opcional, apenas visual)" },
          utm_params: { type: "object", description: "Parâmetros UTM. Ex: {source: 'meta', medium: 'paid', campaign: 'campanha-x'}" },
          
          // --- CRIATIVO / ANÚNCIO ---
          product_name: { type: "string", description: "Nome EXATO do produto do catálogo para esta campanha" },
          ad_name: { type: "string", description: "Nome do anúncio. Padrão: [AI] Ad - Produto | Variação" },
          ad_format: { type: "string", enum: ["SINGLE_IMAGE", "SINGLE_VIDEO", "CAROUSEL", "COLLECTION"], description: "Formato do anúncio" },
          primary_texts: { type: "array", items: { type: "string" }, description: "2-4 variações de Primary Text (copy principal). OBRIGATÓRIO ter no mínimo 2." },
          headlines: { type: "array", items: { type: "string" }, description: "2-4 variações de Headline. OBRIGATÓRIO ter no mínimo 2." },
          descriptions: { type: "array", items: { type: "string" }, description: "1-2 descrições curtas para o anúncio." },
          cta: { type: "string", enum: ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "BUY_NOW", "ORDER_NOW", "GET_OFFER", "SEND_WHATSAPP_MESSAGE", "CONTACT_US", "SUBSCRIBE", "DOWNLOAD", "WATCH_MORE", "BOOK_NOW", "APPLY_NOW"], description: "Call to Action" },

          // --- AGENDAMENTO ---
          start_time: { type: "string", description: "Data/hora de início (ISO 8601). Omitir = agendamento automático 00:01 BRT" },
          end_time: { type: "string", description: "Data/hora de término (ISO 8601). Omitir = sem data de término" },

          // --- META ---
          reasoning: { type: "string", description: "Justificativa com dados numéricos" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_name", "objective", "daily_budget_cents", "optimization_goal", "conversion_event", "targeting_description", "funnel_stage", "destination_url", "product_name", "primary_texts", "headlines", "reasoning", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_adset",
      description: "Cria novo conjunto de anúncios ADICIONAL dentro de uma campanha existente (para múltiplos públicos). Use quando a campanha já foi criada e você quer adicionar segmentações diferentes.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha pai (retornado no create_campaign)" },
          campaign_name: { type: "string", description: "Nome da campanha pai (fallback para busca)" },
          adset_name: { type: "string", description: "Nome do conjunto de anúncios" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos (ABO — Ad Set Budget)" },
          lifetime_budget_cents: { type: "number", description: "Orçamento vitalício em centavos" },
          
          // --- OTIMIZAÇÃO ---
          optimization_goal: { type: "string", enum: ["OFFSITE_CONVERSIONS", "LINK_CLICKS", "IMPRESSIONS", "REACH", "LANDING_PAGE_VIEWS", "VALUE", "LEAD_GENERATION", "QUALITY_LEAD", "ENGAGED_USERS"], description: "Objetivo de otimização" },
          billing_event: { type: "string", enum: ["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY"], description: "Evento de cobrança" },
          conversion_event: { type: "string", enum: ["PURCHASE", "ADD_TO_CART", "INITIATED_CHECKOUT", "LEAD", "COMPLETE_REGISTRATION", "VIEW_CONTENT", "SEARCH", "ADD_PAYMENT_INFO", "CONTACT", "SUBSCRIBE", "START_TRIAL"], description: "Evento de conversão do Pixel" },
          bid_amount_cents: { type: "number", description: "Limite de lance em centavos" },
          
          // --- TARGETING ---
          targeting_type: { type: "string", enum: ["cold_broad", "cold_interest", "warm_custom", "hot_remarketing", "lookalike"], description: "Tipo de segmentação" },
          targeting_description: { type: "string", description: "Descrição textual do público" },
          age_min: { type: "number" },
          age_max: { type: "number" },
          genders: { type: "array", items: { type: "number" } },
          geo_locations: { type: "object", description: "Localização. Ex: {countries: ['BR']}" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
          behaviors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
          custom_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos personalizados" },
          excluded_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos para excluir" },
          lookalike_spec: { type: "object", description: "Spec de Lookalike" },
          
          // --- POSICIONAMENTOS ---
          publisher_platforms: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "audience_network", "messenger"] } },
          position_types: { type: "array", items: { type: "string" } },
          device_platforms: { type: "array", items: { type: "string", enum: ["mobile", "desktop"] } },
          
          // --- DESTINO ---
          destination_url: { type: "string", description: "URL de destino dos anúncios deste conjunto" },
          
          // --- AGENDAMENTO ---
          start_time: { type: "string" },
          end_time: { type: "string" },
          
          // --- META ---
          reasoning: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "adset_name", "targeting_type", "reasoning", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_creative",
      description: "Gera criativos (imagens) para uma campanha via IA generativa. OBRIGATÓRIO: product_name deve ser IDÊNTICO ao nome no catálogo (case-sensitive, sem abreviações). Se o nome não bater exatamente, a geração FALHARÁ.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          campaign_objective: { type: "string" },
          target_audience: { type: "string" },
          style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting", "ugc_style"] },
          format: { type: "string", enum: ["1:1", "9:16", "16:9"] },
          variations: { type: "number", minimum: 1, maximum: 5 },
          funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"], description: "Etapa do funil para o criativo. OBRIGATÓRIO para garantir criativos diferentes por funil. TOF=aquisição, BOF=remarketing, test=testes" },
          reasoning: { type: "string" },
        },
        required: ["product_name", "campaign_objective", "target_audience", "style_preference", "funnel_stage", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lookalike_audience",
      description: "Cria público Lookalike a partir de uma Custom Audience existente.",
      parameters: {
        type: "object",
        properties: {
          lookalike_name: { type: "string" },
          source_audience_id: { type: "string" },
          source_audience_name: { type: "string" },
          ratio: { type: "number", description: "Tamanho do Lookalike (0.01 a 0.10 = 1% a 10%)" },
          country: { type: "string", description: "País ISO 2-letter" },
          reasoning: { type: "string" },
        },
        required: ["lookalike_name", "source_audience_id", "source_audience_name", "ratio", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_budget",
      description: "Ajusta orçamento de campanha existente. Será AGENDADO para 00:01 BRT.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          current_budget_cents: { type: "number" },
          new_budget_cents: { type: "number" },
          change_pct: { type: "number" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "new_budget_cents", "change_pct", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "strategic_plan",
      description: "Emite plano estratégico DETALHADO e COMPLETO. Cada ação DEVE ter todos os campos preenchidos com dados específicos — NUNCA genéricos.",
      parameters: {
        type: "object",
        properties: {
          diagnosis: { 
            type: "string", 
            description: "Diagnóstico DETALHADO: campanhas ativas (nome, ROAS 7d/30d, CPA, orçamento), campanhas pausadas relevantes, orçamento utilizado vs disponível, tracking health, e análise de oportunidades. Mínimo 300 palavras." 
          },
          planned_actions: { 
            type: "array", 
            items: { 
              type: "object",
              properties: {
                action_type: { type: "string", enum: ["create_campaign", "adjust_budget", "pause_campaign", "test", "scale", "duplicate", "optimize"], description: "Tipo da ação" },
                campaign_type: { type: "string", enum: ["TOF", "MOF", "BOF", "Remarketing", "Teste", "Catálogo", "Duplicação", "prospecting", "retargeting", "catalog_prospecting", "catalog_retargeting", "testing"], description: "Tipo de campanha. Para catálogo dinâmico use 'catalog_prospecting' ou 'catalog_retargeting'." },
                campaign_intent: { type: "string", enum: ["acquisition", "retention", "creative_test", "offer_test", "scale", "reactivation"], description: "Onda G.5 — Intenção da campanha. Em creative_test, clientes podem ser incluídos com justificativa (exclusion_override_reason)." },
                funnel: { type: "string", enum: ["cold", "remarketing", "tests", "leads", "unknown"], description: "Onda G.1 — Funil canônico ao qual essa ação pertence. Deve bater com funnel_budget_state." },
                budget_delta_brl: { type: "number", description: "Onda G.1 — Variação de orçamento desta ação em R$ (+ para criar/escalar, − para reduzir/pausar)." },
                references_release_from_action_index: { type: "number", description: "Onda G.1 — Índice (zero-based) de uma ação anterior nesta lista cuja redução/pausa libera o orçamento usado aqui. Use somente se a ação atual depende de verba liberada antes." },
                audience_exclusions: {
                  type: "object",
                  description: "Onda G.4 — Exclusões de público explícitas. Obrigatório em ações de público frio/prospecção.",
                  properties: {
                    customers: { type: "boolean", description: "Excluir clientes/compradores." },
                    reason: { type: "string", description: "Justificativa curta." },
                    customer_audience_detected: { type: "boolean", description: "true se o público de Clientes existe na conta Meta." },
                    pending_dependency: { type: "string", enum: ["customer_audience_missing"], description: "Marca pendência quando o público de Clientes não foi detectado." },
                  },
                },
                exclusion_override_reason: { type: "string", description: "Onda G.5 — Justificativa OBRIGATÓRIA quando creative_test inclui clientes no frio." },
                catalog_setup: {
                  type: "object",
                  description: "Onda G.3 — Obrigatório quando campaign_type começa com 'catalog_'. Use pending_dependency='catalog_not_connected' se não houver catálogo detectado.",
                  properties: {
                    product_catalog_id: { type: "string" },
                    product_catalog_name: { type: "string" },
                    product_set: { type: "string", description: "Descrição lógica do product set (ex.: 'Todos os produtos da categoria X')." },
                    audience_window: { type: "string", description: "Janela de público (ex.: '14d viewers', '30d ATC')." },
                    exclude_recent_buyers_days: { type: "number", description: "Dias para excluir compradores recentes." },
                    creative_mode: { type: "string", enum: ["dynamic", "static"], description: "Catálogo dinâmico = 'dynamic'." },
                    pending_dependency: { type: "string", enum: ["catalog_not_connected"] },
                  },
                },
                product_identification_confidence: { type: "string", enum: ["high", "medium", "low", "unknown"], description: "Onda G.2 — Confiança da identificação do produto da campanha existente. Copie do bloco determinístico." },
                diagnosis_limitation: { type: "string", description: "Onda G.2 — Limitação declarada quando a identificação for low/unknown." },
                audience_budget_fit: {
                  type: "object",
                  description: "Onda G.6 — Sinal histórico de compatibilidade entre público, orçamento e objetivo. Copie do bloco determinístico quando disponível.",
                  properties: {
                    fit: { type: "string", enum: ["under_funded", "adequate", "over_funded_small_audience", "saturation_risk", "insufficient_data"] },
                    recommended_action: { type: "string" },
                  },
                },
                product_name: { type: "string", description: "Nome EXATO do produto do catálogo" },
                daily_budget_brl: { type: "number", description: "Orçamento diário TOTAL da campanha em R$" },
                target_audience: { type: "string", description: "Resumo do público-alvo principal (ex: Homens 30-65, Brasil)" },
                funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"], description: "Etapa do funil" },
                objective: { type: "string", enum: ["sales", "leads", "traffic", "awareness", "engagement", "app_promotion"], description: "Objetivo CANÔNICO interno da campanha. Use sempre um destes 6 valores: sales, leads, traffic, awareness, engagement, app_promotion. NUNCA grave o enum oficial da plataforma (ex.: OUTCOME_SALES). O Platform Adapter traduz para o enum da plataforma na hora de publicar." },
                performance_goal: { type: "string", enum: ["Maximizar Conversões", "Maximizar Valor das Conversões"], description: "Meta de desempenho do conjunto (como aparece no Meta Ads). Padrão: Maximizar Conversões" },
                conversion_location: { type: "string", enum: ["Site", "Site e App", "App", "Site e Loja Física"], description: "Local da conversão do conjunto. Padrão: Site" },
                attribution_model: { type: "string", enum: ["Padrão", "Incremental"], description: "Modelo de atribuição. Padrão: Padrão" },
                creatives_count: { type: "number", description: "Quantidade TOTAL de variações de criativos (mín 2, conta todas as variações de todos os conjuntos)" },
                copy_variations: { type: "number", description: "Quantidade de variações de copy (mín 2)" },
                rationale: { type: "string", description: "Justificativa detalhada para esta ação específica, com dados de suporte" },
                expected_roas: { type: "number", description: "ROAS esperado baseado em dados históricos" },
                placements: { type: "string", description: "Posicionamentos (ex: Feed, Stories, Reels, Advantage+)" },
                adsets: {
                  type: "array",
                  description: "OBRIGATÓRIO: Lista dos conjuntos de anúncios desta campanha. TOF ≥2 conjuntos com públicos distintos; Testes 1 conjunto por anúncio (ABO); BOF ≥2 conjuntos segmentados. Cada conjunto DEVE vir COMPLETO (público, região, idade, gênero, evento de conversão, meta de otimização, posicionamentos, orçamento). Se algum campo obrigatório for desconhecido, use o valor literal 'requires_user_input' em vez de inventar.",
                  items: {
                    type: "object",
                    properties: {
                      adset_name: { type: "string", description: "Nome do conjunto (ex: CJ1 - Broad | TOF)" },
                      audience_type: { type: "string", enum: ["broad", "interest", "lookalike", "custom", "retargeting"], description: "Tipo de audiência deste conjunto" },
                      audience_description: { type: "string", description: "Descrição textual do público deste conjunto" },
                      // --- Targeting estruturado por conjunto (obrigatório no contrato canônico v2) ---
                      location: { type: "string", description: "Região/país do conjunto (ex.: 'BR', 'São Paulo, BR'). Default seguro: BR." },
                      age_min: { type: "number", description: "Idade mínima. Default: 18." },
                      age_max: { type: "number", description: "Idade máxima. Default: 65." },
                      gender: { type: "string", enum: ["Todos", "Masculino", "Feminino"], description: "Gênero alvo. Default: Todos." },
                      placements: { type: "array", items: { type: "string" }, description: "Posicionamentos suportados. Default seguro: ['advantage_plus']." },
                      // --- Otimização / conversão (obrigatórios) ---
                      optimization_goal: { type: "string", enum: ["OFFSITE_CONVERSIONS","LINK_CLICKS","IMPRESSIONS","REACH","LANDING_PAGE_VIEWS","VALUE","LEAD_GENERATION","QUALITY_LEAD","ENGAGED_USERS"], description: "Meta de otimização do conjunto. OBRIGATÓRIO." },
                      conversion_event: { type: "string", description: "Evento de conversão (ex.: PURCHASE). OBRIGATÓRIO para vendas/leads. Se o pixel/evento não estiver confirmado, use literal 'requires_user_input'." },
                      conversion_location: { type: "string", enum: ["Site","Site e App","App","Site e Loja Física","Site e ligações"], description: "Local da conversão. Default: Site." },
                      budget_brl: { type: "number", description: "Orçamento diário deste conjunto em R$ (ABO) — obrigatório em campanhas de teste; opcional em CBO" },
                      ads_count: { type: "number", description: "Número de anúncios neste conjunto" },
                    },
                    required: [
                      "adset_name", "audience_type", "audience_description", "ads_count",
                      "location", "age_min", "age_max", "gender", "placements",
                      "optimization_goal", "conversion_event", "conversion_location",
                    ],
                  },
                },
              },
              required: ["action_type", "campaign_type", "product_name", "daily_budget_brl", "target_audience", "funnel_stage", "rationale", "creatives_count", "adsets"],
            }, 
            description: "Lista de ações planejadas — OBRIGATÓRIO: cada campanha de create_campaign DEVE incluir o campo 'adsets' detalhando TODOS os conjuntos de anúncios com seus públicos. TOF ≥2 conjuntos, Teste = 1 conjunto por anúncio (ABO), BOF ≥2 conjuntos segmentados." 
          },
          budget_allocation: {
            type: "object",
            properties: {
              total_daily_brl: { type: "number", description: "Orçamento diário total em R$" },
              tof_pct: { type: "number", description: "% alocado para TOF (aquisição)" },
              bof_pct: { type: "number", description: "% alocado para BOF (remarketing)" },
              test_pct: { type: "number", description: "% alocado para testes" },
              tof_brl: { type: "number", description: "Valor em R$ para TOF" },
              bof_brl: { type: "number", description: "Valor em R$ para BOF" },
              test_brl: { type: "number", description: "Valor em R$ para testes" },
            },
            required: ["total_daily_brl", "tof_pct", "bof_pct", "test_pct", "tof_brl", "bof_brl", "test_brl"],
            description: "Alocação detalhada de orçamento por funil — DEVE somar 100% do budget disponível",
          },
          expected_results: { type: "string", description: "Projeção QUANTITATIVA de resultados: ROAS esperado por campanha, CPA alvo, conversões estimadas, receita projetada. Usar dados históricos como base." },
          risk_assessment: { type: "string", description: "Riscos específicos com probabilidade e mitigação para cada um" },
          timeline: { type: "string", description: "Cronograma detalhado: Dia 1 (o quê), Dia 2-3 (o quê), Semana 1 (review), etc." },
          funnel_budget_state: {
            type: "object",
            description: "Onda G.1 — Estado do orçamento por funil. Copie EXATAMENTE do bloco determinístico injetado no contexto. NÃO INVENTE valores.",
            properties: {
              total_daily_cents: { type: "number" },
              per_funnel: {
                type: "object",
                description: "Mapa funil → { planned_cents, occupied_cents, free_cents }",
              },
              splits_source: { type: "string", enum: ["user_config", "defaults"] },
            },
          },
        },
        required: ["diagnosis", "planned_actions", "budget_allocation", "expected_results", "risk_assessment", "timeline"],
        additionalProperties: false,
      },
    },
  },
];

// ============ LANDING PAGE TOOLS (shared across channels) ============

const LANDING_PAGE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_landing_pages",
      description: "Busca landing pages existentes na loja que podem ser usadas como destino de campanhas. Retorna URLs públicas prontas para uso em destination_url. Use ANTES de criar campanhas para verificar se já existe uma LP otimizada para o produto.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome do produto para buscar LPs relacionadas (opcional — sem filtro retorna todas)" },
          include_drafts: { type: "boolean", description: "Incluir LPs em rascunho (default: false, apenas publicadas)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_landing_page",
      description: "Solicita a geração de uma nova landing page otimizada para conversão usando IA. Use quando NÃO existir uma LP adequada para o produto e você identificar que uma LP dedicada melhoraria a taxa de conversão (vs enviar para a página padrão do produto). A LP será gerada em background e ficará disponível em poucos minutos.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome EXATO do produto do catálogo (case-sensitive)" },
          prompt: { type: "string", description: "Instruções criativas para a LP. Descreva o tom, estilo visual, público-alvo e ângulo de venda. Mínimo 50 caracteres para melhor resultado." },
          show_header: { type: "boolean", description: "Exibir header da loja na LP (default: true)" },
          show_footer: { type: "boolean", description: "Exibir footer da loja na LP (default: true)" },
          reasoning: { type: "string", description: "Justificativa estratégica: por que uma LP dedicada é melhor que a página padrão do produto para esta campanha" },
        },
        required: ["product_name", "prompt", "reasoning"],
        additionalProperties: false,
      },
    },
  },
];

// ============ GOOGLE STRATEGIST TOOLS ============

const GOOGLE_STRATEGIST_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_google_campaign",
      description: "Cria uma nova campanha no Google Ads. Suporta SEARCH (Pesquisa), PERFORMANCE_MAX (PMax), DISPLAY e SHOPPING. A campanha é criada PAUSADA.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da campanha. Padrão: [AI] Tipo | Produto | Objetivo" },
          channel_type: { type: "string", enum: ["SEARCH", "PERFORMANCE_MAX", "DISPLAY", "SHOPPING"], description: "Tipo de campanha" },
          budget_micros: { type: "number", description: "Orçamento diário em micros (R$ 1 = 1.000.000 micros). Ex: R$50 = 50000000" },
          bidding_strategy: { type: "string", enum: ["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_ROAS", "TARGET_CPA"], description: "Estratégia de lances" },
          target_roas: { type: "number", description: "ROAS alvo (ex: 2.5 = 250%). Obrigatório para TARGET_ROAS." },
          target_cpa_micros: { type: "number", description: "CPA alvo em micros. Obrigatório para TARGET_CPA." },
          start_date: { type: "string", description: "YYYY-MM-DD. Opcional (imediato se omitido)." },
          reasoning: { type: "string", description: "Justificativa da criação." }
        },
        required: ["name", "channel_type", "budget_micros", "bidding_strategy", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_ad_group",
      description: "Cria um Grupo de Anúncios (Ad Group) dentro de uma campanha existente. Necessário para SEARCH e DISPLAY.",
      parameters: {
        type: "object",
        properties: {
          campaign_name: { type: "string", description: "Nome da campanha pai (deve ter sido criada nesta sessão ou já existir)" },
          name: { type: "string", description: "Nome do grupo de anúncios" },
          cpc_bid_micros: { type: "number", description: "Lance máximo de CPC em micros (opcional se a campanha usar estratégia automática)" },
          type: { type: "string", enum: ["SEARCH_STANDARD", "DISPLAY_STANDARD"], description: "Tipo de grupo. Padrão: SEARCH_STANDARD" },
          reasoning: { type: "string" }
        },
        required: ["campaign_name", "name", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_keyword",
      description: "Adiciona uma palavra-chave (keyword) a um Grupo de Anúncios de Pesquisa.",
      parameters: {
        type: "object",
        properties: {
          campaign_name: { type: "string", description: "Nome da campanha pai" },
          ad_group_name: { type: "string", description: "Nome do grupo de anúncios pai" },
          text: { type: "string", description: "Texto da palavra-chave (ex: 'tenis de corrida')" },
          match_type: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"], description: "Tipo de correspondência" },
          reasoning: { type: "string" }
        },
        required: ["campaign_name", "ad_group_name", "text", "match_type", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_ad",
      description: "Cria um anúncio dentro de um Grupo de Anúncios. Para SEARCH cria RSA (Responsive Search Ad).",
      parameters: {
        type: "object",
        properties: {
          campaign_name: { type: "string", description: "Nome da campanha pai" },
          ad_group_name: { type: "string", description: "Nome do grupo de anúncios pai" },
          headlines: { type: "array", items: { type: "string" }, description: "Lista de 3 a 15 títulos (máx 30 chars cada)" },
          descriptions: { type: "array", items: { type: "string" }, description: "Lista de 2 a 4 descrições (máx 90 chars cada)" },
          final_url: { type: "string", description: "URL final de destino (deve começar com http/https)" },
          path1: { type: "string", description: "Caminho exibido 1 (opcional, máx 15 chars)" },
          path2: { type: "string", description: "Caminho exibido 2 (opcional, máx 15 chars)" },
          reasoning: { type: "string" }
        },
        required: ["campaign_name", "ad_group_name", "headlines", "descriptions", "final_url", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "strategic_plan",
      description: "Emite plano estratégico DETALHADO e COMPLETO para Google Ads. Cada ação DEVE ter todos os campos preenchidos com dados específicos.",
      parameters: {
        type: "object",
        properties: {
          diagnosis: { type: "string", description: "Diagnóstico DETALHADO da conta Google Ads." },
          planned_actions: { 
            type: "array", 
            items: { 
              type: "object",
              properties: {
                action_type: { type: "string", enum: ["create_campaign", "pause_campaign", "adjust_budget", "optimize"] },
                description: { type: "string" },
                rationale: { type: "string" }
              },
              required: ["action_type", "description", "rationale"]
            },
            description: "Lista de ações." 
          },
          expected_results: { type: "string", description: "Projeção de resultados." },
          risk_assessment: { type: "string" },
          timeline: { type: "string" }
        },
        required: ["diagnosis", "planned_actions", "expected_results"]
      }
    }
  }
];

// ============ TIKTOK STRATEGIST TOOLS ============

const TIKTOK_STRATEGIST_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_tiktok_campaign",
      description: "Cria campanha TikTok Ads completa (Campanha → Ad Group → Ads). Criada PAUSADA para aprovação. Suporta conversão (Website) e catálogo (Product Sales).",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome do produto (obrigatório)" },
          campaign_name: { type: "string", description: "Nome da campanha (opcional)" },
          objective_type: { type: "string", enum: ["WEB_CONVERSIONS", "PRODUCT_SALES", "TRAFFIC", "REACH"], description: "Objetivo (default: WEB_CONVERSIONS)" },
          budget_mode: { type: "string", enum: ["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"], description: "Modo de orçamento (default: BUDGET_MODE_DAY)" },
          budget_cents: { type: "number", description: "Orçamento diário em centavos (min R$ 20,00 = 2000)" },
          optimization_goal: { type: "string", enum: ["CONVERT", "CLICK", "REACH"], description: "Meta de otimização (default: CONVERT)" },
          bid_strategy: { type: "string", enum: ["LOWEST_COST", "BID_CAP", "COST_CAP"], description: "Estratégia de lance (default: LOWEST_COST)" },
          bid_cents: { type: "number", description: "Lance em centavos (para BID_CAP/COST_CAP)" },
          conversion_event: { type: "string", enum: ["COMPLETE_PAYMENT", "INITIATE_CHECKOUT", "ADD_TO_CART", "VIEW_CONTENT", "FORM_SUBMISSION"], description: "Evento de conversão (obrigatório para conversão)" },
          placements: { type: "array", items: { type: "string" }, description: "Posicionamentos (default: ['PLACEMENT_TIKTOK'])" },
          ad_account_id: { type: "string", description: "ID do advertiser TikTok" },
          funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"], description: "Estágio do funil" },
          targeting: {
            type: "object",
            description: "Segmentação",
            properties: {
              age_groups: { type: "array", items: { type: "string" } },
              genders: { type: "array", items: { type: "string" } },
              locations: { type: "array", items: { type: "string" } },
              interests: { type: "array", items: { type: "string" } },
              behaviors: { type: "array", items: { type: "object" } },
            }
          },
          ad_creative: {
            type: "object",
            description: "Criativo do anúncio (único ou múltiplo)",
            properties: {
              display_name: { type: "string", description: "Nome exibido no anúncio" },
              text: { type: "string", description: "Texto do anúncio (max 100 chars)" },
              call_to_action: { type: "string", description: "Botão CTA (ex: SHOP_NOW)" },
              ad_format: { type: "string", enum: ["SINGLE_VIDEO", "SINGLE_IMAGE", "CAROUSEL"], description: "Formato" },
              video_id: { type: "string", description: "ID do vídeo na biblioteca TikTok (opcional)" },
              identity_type: { type: "string", enum: ["CUSTOMIZED_USER", "AUTH_CODE"], description: "Tipo de identidade (default: CUSTOMIZED_USER)" },
              identity_id: { type: "string", description: "ID da identidade (Spark Ads)" }
            }
          }
        },
        required: ["product_name", "budget_cents", "objective_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_tiktok_status",
      description: "Pausa ou reativa campanha/adgroup/ad no TikTok.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["campaign", "adgroup", "ad"] },
          entity_id: { type: "string" },
          new_status: { type: "string", enum: ["ENABLE", "DISABLE"] },
          advertiser_id: { type: "string" }
        },
        required: ["entity_type", "entity_id", "new_status", "advertiser_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_tiktok_budget",
      description: "Atualiza orçamento de campanha ou adgroup no TikTok.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["campaign", "adgroup"] },
          entity_id: { type: "string" },
          budget_cents: { type: "number" },
          advertiser_id: { type: "string" }
        },
        required: ["entity_type", "entity_id", "budget_cents", "advertiser_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "strategic_plan",
      description: "Emite plano estratégico DETALHADO e COMPLETO para TikTok Ads.",
      parameters: {
        type: "object",
        properties: {
          diagnosis: { type: "string", description: "Diagnóstico DETALHADO da conta TikTok Ads." },
          planned_actions: { 
            type: "array", 
            items: { 
              type: "object",
              properties: {
                action_type: { type: "string", enum: ["create_campaign", "pause_campaign", "adjust_budget", "optimize"] },
                description: { type: "string" },
                rationale: { type: "string" }
              },
              required: ["action_type", "description", "rationale"]
            },
            description: "Lista de ações." 
          },
          expected_results: { type: "string", description: "Projeção de resultados." },
          risk_assessment: { type: "string" },
          timeline: { type: "string" }
        },
        required: ["diagnosis", "planned_actions", "expected_results"]
      }
    }
  }
];

const PLATFORM_LIMITS: Record<string, { max_change_pct: number; min_interval_hours: number }> = {
  meta: { max_change_pct: 20, min_interval_hours: 48 },
  google: { max_change_pct: 20, min_interval_hours: 168 },
  tiktok: { max_change_pct: 15, min_interval_hours: 48 },
};

function canAdjustBudget(config: AccountConfig): boolean {
  if (!config.last_budget_adjusted_at) return true;
  const limit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;
  const lastAdj = new Date(config.last_budget_adjusted_at).getTime();
  const hoursSince = (Date.now() - lastAdj) / (1000 * 60 * 60);
  return hoursSince >= limit.min_interval_hours;
}

// ============ DEEP HISTORICAL INSIGHTS (LOCAL DB — v1.38.0) ============
// Instead of re-fetching from Graph API (which caused timeouts on large accounts),
// we build deep historical from already-synced local tables + a SINGLE lightweight API call for all-time insights.

interface DeepInsight {
  level: string;
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  cpa: number;
  ctr: number;
  frequency?: number;
  cpm?: number;
  page_views?: number;
  add_to_cart?: number;
  initiate_checkout?: number;
  video_p25?: number;
  video_p50?: number;
  video_p95?: number;
  placements?: Record<string, { spend: number; conversions: number; roas: number }>;
  creative_data?: any;
  targeting?: any;
  campaign_id?: string;
  adset_id?: string;
}

async function buildDeepHistoricalFromLocalData(
  supabase: any,
  tenantId: string,
  adAccountId: string,
  channel: string = "meta"
): Promise<{ campaigns: DeepInsight[]; adsets: DeepInsight[]; ads: DeepInsight[] } | null> {
  if (channel === "google") {
    try {
      console.log(`[ads-autopilot-strategist][${VERSION}] Building Google deep historical from LOCAL DB for ${adAccountId}`);

      const [gCampaignsRes, gAdGroupsRes, gAdsRes, gKeywordsRes] = await Promise.all([
        supabase.from("google_ad_campaigns").select("google_campaign_id, name, status, campaign_type, bidding_strategy_type, budget_amount_micros, budget_type, target_cpa_micros, target_roas, optimization_score, ad_account_id")
          .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(500),
        supabase.from("google_ad_groups").select("google_ad_group_id, google_campaign_id, name, status, type, cpc_bid_micros, cpm_bid_micros, target_cpa_micros, target_roas")
          .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(1000),
        supabase.from("google_ad_ads").select("google_ad_id, google_ad_group_id, google_campaign_id, name, ad_type, status, headlines, descriptions, final_urls, performance_data")
          .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(1000),
        supabase.from("google_ad_keywords").select("google_keyword_id, google_ad_group_id, google_campaign_id, text, match_type, status, quality_score, cpc_bid_micros, performance_data")
          .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(1000),
      ]);

      const gCampaigns = gCampaignsRes.data || [];
      const gAdGroups = gAdGroupsRes.data || [];
      const gAds = gAdsRes.data || [];
      const gKeywords = gKeywordsRes.data || [];

      if (gCampaigns.length === 0) {
        console.warn(`[ads-autopilot-strategist][${VERSION}] No Google campaigns in local DB for ${adAccountId}`);
        return null;
      }

      const campaignInsights: DeepInsight[] = gCampaigns.map((c: any) => {
        const perf = c.performance_data || {};
        return {
          level: "campaign", id: c.google_campaign_id, name: c.name, status: c.status || "",
          spend: (perf.cost_micros || 0) / 1_000_000, impressions: perf.impressions || 0,
          clicks: perf.clicks || 0, conversions: perf.conversions || 0,
          roas: perf.conversions_value && perf.cost_micros ? Math.round((perf.conversions_value / (perf.cost_micros / 1_000_000)) * 100) / 100 : 0,
          cpa: perf.conversions > 0 ? Math.round(((perf.cost_micros || 0) / 1_000_000 / perf.conversions) * 100) / 100 : 0,
          ctr: perf.impressions > 0 ? Math.round((perf.clicks / perf.impressions) * 10000) / 100 : 0,
        };
      });

      const adsetInsights: DeepInsight[] = gAdGroups.map((ag: any) => ({
        level: "adset", id: ag.google_ad_group_id, name: ag.name, status: ag.status || "",
        spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, cpa: 0, ctr: 0,
        campaign_id: ag.google_campaign_id,
      }));

      const adInsights: DeepInsight[] = gAds.map((ad: any) => {
        const perf = ad.performance_data || {};
        return {
          level: "ad", id: ad.google_ad_id, name: ad.name || ad.ad_type, status: ad.status || "",
          spend: (perf.cost_micros || 0) / 1_000_000, impressions: perf.impressions || 0,
          clicks: perf.clicks || 0, conversions: perf.conversions || 0,
          roas: perf.conversions_value && perf.cost_micros ? Math.round((perf.conversions_value / (perf.cost_micros / 1_000_000)) * 100) / 100 : 0,
          cpa: perf.conversions > 0 ? Math.round(((perf.cost_micros || 0) / 1_000_000 / perf.conversions) * 100) / 100 : 0,
          ctr: perf.impressions > 0 ? Math.round((perf.clicks / perf.impressions) * 10000) / 100 : 0,
          creative_data: { headlines: ad.headlines, descriptions: ad.descriptions },
          campaign_id: ad.google_campaign_id, adset_id: ad.google_ad_group_id,
        };
      });

      console.log(`[ads-autopilot-strategist][${VERSION}] Google deep historical for ${adAccountId}: ${campaignInsights.length} campaigns, ${adsetInsights.length} ad groups, ${adInsights.length} ads`);

      return { campaigns: campaignInsights, adsets: adsetInsights, ads: adInsights, keywords: gKeywords } as any;
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] buildDeepHistoricalFromLocalData (Google) error:`, err.message);
      return null;
    }
  }

  if (channel === "tiktok") {
    try {
      console.log(`[ads-autopilot-strategist][${VERSION}] Building TikTok deep historical from LOCAL DB for ${adAccountId}`);

      // Fetch TikTok campaigns
      const { data: tCampaigns } = await supabase.from("tiktok_ad_campaigns")
        .select("tiktok_campaign_id, name, status, objective_type, budget_cents, budget_mode, advertiser_id")
        .eq("tenant_id", tenantId).eq("advertiser_id", adAccountId).limit(200);

      // Fetch aggregated insights (lifetime or long window)
      // Since we don't store adgroup/ad level hierarchy fully yet, we focus on campaign level insights
      const { data: tInsights } = await supabase.from("tiktok_ad_insights")
        .select("tiktok_campaign_id, spend_cents, impressions, clicks, conversions, conversion_value_cents, ctr, cpc_cents, cpm_cents, roas")
        .eq("tenant_id", tenantId).eq("advertiser_id", adAccountId).order("date_start", { ascending: false }).limit(1000);

      const tCampaignsList = tCampaigns || [];
      if (tCampaignsList.length === 0) {
        console.warn(`[ads-autopilot-strategist][${VERSION}] No TikTok campaigns in local DB for ${adAccountId}`);
        return null;
      }

      // Aggregate insights by campaign
      const campPerf: Record<string, any> = {};
      for (const ins of (tInsights || [])) {
        const cid = ins.tiktok_campaign_id;
        if (!campPerf[cid]) campPerf[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
        campPerf[cid].spend += (ins.spend_cents || 0);
        campPerf[cid].impressions += ins.impressions || 0;
        campPerf[cid].clicks += ins.clicks || 0;
        campPerf[cid].conversions += ins.conversions || 0;
        campPerf[cid].revenue += (ins.conversion_value_cents || 0);
      }

      const campaignInsights: DeepInsight[] = tCampaignsList.map((c: any) => {
        const p = campPerf[c.tiktok_campaign_id] || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
        const spendVal = p.spend / 100;
        const revVal = p.revenue / 100;
        return {
          level: "campaign", id: c.tiktok_campaign_id, name: c.name, status: c.status,
          spend: spendVal, impressions: p.impressions, clicks: p.clicks, conversions: p.conversions,
          roas: spendVal > 0 ? Math.round((revVal / spendVal) * 100) / 100 : 0,
          cpa: p.conversions > 0 ? Math.round((spendVal / p.conversions) * 100) / 100 : 0,
          ctr: p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 100 : 0,
        };
      });

      console.log(`[ads-autopilot-strategist][${VERSION}] TikTok deep historical for ${adAccountId}: ${campaignInsights.length} campaigns`);
      return { campaigns: campaignInsights, adsets: [], ads: [] }; // AdGroups/Ads not fully synced yet
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] buildDeepHistoricalFromLocalData (TikTok) error:`, err.message);
      return null;
    }
  }
  try {
    console.log(`[ads-autopilot-strategist][${VERSION}] Building deep historical from LOCAL DB for ${adAccountId} (${channel})`);

    // Fetch all entities from local cache (already synced)
    // Paginated fetch helper — PostgREST caps at 1000 rows per request (v1.42.0)
    async function fetchAllPaginated(table: string, selectCols: string, filters: Record<string, string>, orderCol?: string) {
      const PAGE_SIZE = 1000;
      const allRows: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = supabase.from(table).select(selectCols);
        for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
        if (orderCol) q = q.order(orderCol, { ascending: false });
        q = q.range(offset, offset + PAGE_SIZE - 1);
        const { data, error } = await q;
        if (error) { console.error(`[ads-autopilot-strategist][${VERSION}] Pagination error on ${table} offset ${offset}:`, error.message); break; }
        const rows = data || [];
        allRows.push(...rows);
        offset += PAGE_SIZE;
        hasMore = rows.length === PAGE_SIZE;
      }
      return allRows;
    }

    const [campaignsRes, adsetsRes, adsRes] = await Promise.all([
      supabase.from("meta_ad_campaigns")
        .select("meta_campaign_id, name, status, effective_status, objective, daily_budget_cents, ad_account_id")
        .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(500),
      supabase.from("meta_ad_adsets")
        .select("meta_adset_id, name, status, effective_status, meta_campaign_id, daily_budget_cents, optimization_goal, targeting, ad_account_id")
        .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(1000),
      supabase.from("meta_ad_ads")
        .select("meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, creative_id")
        .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).limit(1000),
    ]);

    // Fetch ALL insights with pagination — fixes PostgREST 1000-row cap (v1.42.0)
    const allInsights = await fetchAllPaginated(
      "meta_ad_insights",
      "meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, cpm_cents, frequency, actions, date_start",
      { tenant_id: tenantId },
      "date_start"
    );

    const campaigns = campaignsRes.data || [];
    const adsets = adsetsRes.data || [];
    const ads = adsRes.data || [];
    console.log(`[ads-autopilot-strategist][${VERSION}] Insights fetched: ${allInsights.length} rows (paginated)`);

    if (campaigns.length === 0) {
      console.warn(`[ads-autopilot-strategist][${VERSION}] No campaigns in local DB for ${adAccountId}`);
      return null;
    }

    // Build all-time performance per campaign from insights
    const perfAllTime: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; days: Set<string>; frequency_sum: number; frequency_count: number; cpm_sum: number; page_views: number; add_to_cart: number; initiate_checkout: number }> = {};
    for (const ins of allInsights) {
      const cid = ins.meta_campaign_id;
      if (!perfAllTime[cid]) perfAllTime[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: new Set(), frequency_sum: 0, frequency_count: 0, cpm_sum: 0, page_views: 0, add_to_cart: 0, initiate_checkout: 0 };
      const p = perfAllTime[cid];
      p.spend += ins.spend_cents || 0;
      p.impressions += ins.impressions || 0;
      p.clicks += ins.clicks || 0;
      p.conversions += ins.conversions || 0;
      p.revenue += (ins.roas || 0) * (ins.spend_cents || 0);
      p.days.add(ins.date_start);
      if (ins.frequency) { p.frequency_sum += ins.frequency; p.frequency_count++; }
      if (ins.cpm_cents) p.cpm_sum += ins.cpm_cents;
      if (ins.actions && Array.isArray(ins.actions)) {
        for (const a of ins.actions) {
          const t = a.action_type;
          if (t === "view_content" || t === "offsite_conversion.fb_pixel_view_content") p.page_views += parseInt(a.value || "0");
          else if (t === "add_to_cart" || t === "offsite_conversion.fb_pixel_add_to_cart") p.add_to_cart += parseInt(a.value || "0");
          else if (t === "initiate_checkout" || t === "offsite_conversion.fb_pixel_initiate_checkout") p.initiate_checkout += parseInt(a.value || "0");
        }
      }
    }

    // Filter campaigns that belong to this account
    const accountCampaignIds = new Set(campaigns.map((c: any) => c.meta_campaign_id));

    // Transform campaigns to DeepInsight
    const campaignInsights: DeepInsight[] = campaigns.map((c: any) => {
      const p = perfAllTime[c.meta_campaign_id] || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, frequency_sum: 0, frequency_count: 0, cpm_sum: 0, page_views: 0, add_to_cart: 0, initiate_checkout: 0 };
      const spend = p.spend / 100; // cents to BRL
      const roas = spend > 0 ? Math.round((p.revenue / p.spend) * 100) / 100 : 0;
      const cpa = p.conversions > 0 ? Math.round((spend / p.conversions) * 100) / 100 : 0;
      const ctr = p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 100 : 0;
      const cpm = p.impressions > 0 ? Math.round((spend / p.impressions) * 1000 * 100) / 100 : 0;
      const frequency = p.frequency_count > 0 ? Math.round((p.frequency_sum / p.frequency_count) * 100) / 100 : undefined;
      return {
        level: "campaign", id: c.meta_campaign_id, name: c.name, status: c.status || c.effective_status || "",
        spend, impressions: p.impressions, clicks: p.clicks, conversions: p.conversions, roas, cpa, ctr, cpm, frequency,
        page_views: p.page_views || undefined, add_to_cart: p.add_to_cart || undefined, initiate_checkout: p.initiate_checkout || undefined,
      };
    });

    // AdSets and Ads don't have per-entity insights in local DB (insights are per-campaign),
    // so we include them with basic metadata for the AI to reference
    const adsetInsights: DeepInsight[] = adsets.map((as: any) => ({
      level: "adset", id: as.meta_adset_id, name: as.name, status: as.status || as.effective_status || "",
      spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, cpa: 0, ctr: 0,
      targeting: as.targeting, campaign_id: as.meta_campaign_id,
    }));

    const adInsights: DeepInsight[] = ads.map((ad: any) => ({
      level: "ad", id: ad.meta_ad_id, name: ad.name, status: ad.status || ad.effective_status || "",
      spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0, cpa: 0, ctr: 0,
      creative_id: ad.creative_id, campaign_id: ad.meta_campaign_id, adset_id: ad.meta_adset_id,
    }));

    console.log(`[ads-autopilot-strategist][${VERSION}] Local deep historical for ${adAccountId}: ${campaignInsights.length} campaigns, ${adsetInsights.length} adsets, ${adInsights.length} ads (no API calls!)`);

    return { campaigns: campaignInsights, adsets: adsetInsights, ads: adInsights };
  } catch (err: any) {
    console.error(`[ads-autopilot-strategist][${VERSION}] buildDeepHistoricalFromLocalData error:`, err.message);
    return null;
  }
}

// ============ CONTEXT COLLECTOR ============

async function collectStrategistContext(supabase: any, tenantId: string, configs: AccountConfig[], trigger?: StrategistTrigger) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Parallel data collection — DEEP CONTEXT
  const [
    productsRes,
    ordersRes,
    campaignsRes,
    insights30dRes,
    insights7dRes,
    adsetsRes,
    adsRes,
    audiencesRes,
    recentCreativesRes,
    recentActionsRes,
    experimentsRes,
    marketingRes,
    storeRes,
    tenantRes,
    storePagesRes,
    landingPagesRes,
    globalConfigRes,
    categoriesRes,
    // Google Ads local cache
    googleCampaignsRes,
    googleAdGroupsRes,
    googleAdsRes,
    googleKeywordsRes,
    googleAssetsRes,
    // TikTok Ads local cache
    tiktokCampaignsRes,
    tiktokInsightsRes,
    // Onda D — Meta production configs
    metaProductionConfigsRes,
  ] = await Promise.all([
    supabase.from("products").select("id, name, slug, price, cost_price, status, stock_quantity, brand, short_description").eq("tenant_id", tenantId).eq("status", "active").order("name", { ascending: true }).limit(30),
    supabase.from("orders").select("id, total, status, payment_status, created_at").eq("tenant_id", tenantId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(500),
    supabase.from("meta_ad_campaigns").select("meta_campaign_id, name, status, effective_status, objective, daily_budget_cents, ad_account_id").eq("tenant_id", tenantId).limit(200),
    supabase.from("meta_ad_insights").select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, cpm_cents, frequency, actions, date_start").eq("tenant_id", tenantId).gte("date_start", thirtyDaysAgo).limit(1000),
    supabase.from("meta_ad_insights").select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, cpm_cents, frequency, actions, date_start").eq("tenant_id", tenantId).gte("date_start", sevenDaysAgo).limit(500),
    supabase.from("meta_ad_adsets").select("meta_adset_id, name, status, effective_status, meta_campaign_id, daily_budget_cents, lifetime_budget_cents, optimization_goal, billing_event, bid_amount_cents, targeting, ad_account_id").eq("tenant_id", tenantId).limit(500),
    supabase.from("meta_ad_ads").select("meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, creative_id, creative_data").eq("tenant_id", tenantId).limit(500),
    supabase.from("meta_ad_audiences").select("meta_audience_id, name, audience_type, subtype, ad_account_id, approximate_count").eq("tenant_id", tenantId).limit(100),
    supabase.from("ads_creative_assets").select("id, channel, format, status, product_id, created_at").eq("tenant_id", tenantId).gte("created_at", sevenDaysAgo).limit(50),
    supabase.from("ads_autopilot_actions").select("action_type, action_data, status, channel, created_at").eq("tenant_id", tenantId).gte("created_at", sevenDaysAgo).limit(200),
    supabase.from("ads_autopilot_experiments").select("*").eq("tenant_id", tenantId).in("status", ["active", "completed"]).limit(20),
    supabase.from("marketing_integrations").select("meta_pixel_id").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("store_settings").select("store_name, store_description, seo_title, seo_description").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("tenants").select("name, slug, settings").eq("id", tenantId).single(),
    supabase.from("store_pages").select("title, slug, type, status, is_published, seo_title").eq("tenant_id", tenantId).eq("is_published", true).limit(30),
    supabase.from("ai_landing_pages").select("name, slug, status, is_published, seo_title, product_ids").eq("tenant_id", tenantId).eq("status", "active").limit(20),
    supabase.from("ads_autopilot_configs").select("*").eq("tenant_id", tenantId).eq("channel", "global").maybeSingle(),
    supabase.from("categories").select("name, slug").eq("tenant_id", tenantId).limit(30),
    // Google Ads local cache queries
    supabase.from("google_ad_campaigns").select("google_campaign_id, name, status, campaign_type, bidding_strategy_type, budget_amount_micros, budget_type, target_cpa_micros, target_roas, optimization_score, ad_account_id, synced_at").eq("tenant_id", tenantId).limit(200),
    supabase.from("google_ad_groups").select("google_ad_group_id, google_campaign_id, name, status, type, cpc_bid_micros, cpm_bid_micros, target_cpa_micros, target_roas, ad_account_id").eq("tenant_id", tenantId).limit(500),
    supabase.from("google_ad_ads").select("google_ad_id, google_ad_group_id, google_campaign_id, name, ad_type, status, headlines, descriptions, final_urls, performance_data, ad_account_id").eq("tenant_id", tenantId).limit(500),
    supabase.from("google_ad_keywords").select("google_keyword_id, google_ad_group_id, google_campaign_id, text, match_type, status, quality_score, cpc_bid_micros, performance_data, ad_account_id").eq("tenant_id", tenantId).limit(500),
    supabase.from("google_ad_assets").select("google_asset_id, name, asset_type, status, text_content, image_url, youtube_video_id, ad_account_id").eq("tenant_id", tenantId).limit(200),
    supabase.from("tiktok_ad_campaigns").select("tiktok_campaign_id, name, status, objective_type, budget_cents, budget_mode, advertiser_id, synced_at").eq("tenant_id", tenantId).limit(200),
    supabase.from("tiktok_ad_insights").select("tiktok_campaign_id, spend_cents, impressions, clicks, conversions, conversion_value_cents, roas, ctr, cpc_cents, cpm_cents, date_start").eq("tenant_id", tenantId).gte("date_start", sevenDaysAgo).limit(500),
    // Onda D — Configuração de Criação Meta (fonte de verdade dos defaults por conta)
    supabase.from("ads_meta_production_config").select("*").eq("tenant_id", tenantId).limit(50),
  ]);

  const products = productsRes.data || [];
  const orders = ordersRes.data || [];
  const campaigns = campaignsRes.data || [];
  const insights30d = insights30dRes.data || [];
  const insights7d = insights7dRes.data || [];
  const adsets = adsetsRes.data || [];
  const ads = adsRes.data || [];
  const audiences = audiencesRes.data || [];
  const recentCreatives = recentCreativesRes.data || [];
  const recentActions = recentActionsRes.data || [];
  const experiments = experimentsRes.data || [];
  const metaPixelId = marketingRes.data?.meta_pixel_id || null;
  const storeSettings = storeRes.data || null;
  const tenant = tenantRes.data || null;
  const storePages = storePagesRes.data || [];
  const landingPages = landingPagesRes.data || [];
  const globalConfig = globalConfigRes.data || null;
  const categories = categoriesRes.data || [];
  const googleCampaigns = googleCampaignsRes.data || [];
  const googleAdGroups = googleAdGroupsRes.data || [];
  const googleAds = googleAdsRes.data || [];
  const googleKeywords = googleKeywordsRes.data || [];
  const googleAssets = googleAssetsRes.data || [];
  const tiktokCampaigns = tiktokCampaignsRes?.data || [];
  const tiktokInsights = tiktokInsightsRes?.data || [];
  // Onda D — indexa configs Meta por ad_account_id
  const metaProductionConfigsByAccount: Record<string, any> = {};
  ((metaProductionConfigsRes as any)?.data || []).forEach((row: any) => {
    if (row?.ad_account_id) metaProductionConfigsByAccount[row.ad_account_id] = row;
  });



  // Resolve store URL from tenant_domains (source of truth)
  const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
  const storeUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenant?.slug ? `https://${tenant.slug}.comandocentral.com.br` : null);
  const checkoutUrl = storeUrl ? `${storeUrl}/checkout` : null;

  // Fetch product images for top products
  const productIds = products.map((p: any) => p.id);
  const { data: productImages } = productIds.length > 0
    ? await supabase.from("product_images").select("product_id, image_url, sort_order").in("product_id", productIds).order("sort_order", { ascending: true })
    : { data: [] };
  const imagesByProduct: Record<string, string[]> = {};
  (productImages || []).forEach((img: any) => {
    if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
    imagesByProduct[img.product_id].push(img.image_url);
  });

  // Build page links for the AI
  const pageLinks = storePages.map((p: any) => ({
    title: p.title,
    url: storeUrl ? `${storeUrl}/p/${p.slug}` : `/p/${p.slug}`,
    type: p.type,
  }));
  const lpLinks = landingPages.map((lp: any) => ({
    name: lp.name,
    url: storeUrl ? `${storeUrl}/ai-lp/${lp.slug}` : `/ai-lp/${lp.slug}`,
    slug: lp.slug,
    products: lp.product_ids,
    seo_title: lp.seo_title,
  }));

  // Compute per-campaign performance (v1.35.0: added frequency, CPM, funnel actions)
  const buildPerf = (insights: any[]) => {
    const perf: Record<string, any> = {};
    for (const ins of insights) {
      const cid = ins.meta_campaign_id;
      if (!perf[cid]) perf[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: new Set(), frequency_sum: 0, frequency_count: 0, cpm_sum: 0, page_views: 0, add_to_cart: 0, initiate_checkout: 0 };
      perf[cid].spend += ins.spend_cents || 0;
      perf[cid].impressions += ins.impressions || 0;
      perf[cid].clicks += ins.clicks || 0;
      perf[cid].conversions += ins.conversions || 0;
      perf[cid].revenue += (ins.roas || 0) * (ins.spend_cents || 0);
      perf[cid].days.add(ins.date_start);
      if (ins.frequency) { perf[cid].frequency_sum += ins.frequency; perf[cid].frequency_count++; }
      if (ins.cpm_cents) perf[cid].cpm_sum += ins.cpm_cents;
      // Parse funnel actions from JSON actions field
      if (ins.actions && Array.isArray(ins.actions)) {
        for (const a of ins.actions) {
          const t = a.action_type;
          if (t === "view_content" || t === "offsite_conversion.fb_pixel_view_content") perf[cid].page_views += parseInt(a.value || "0");
          else if (t === "add_to_cart" || t === "offsite_conversion.fb_pixel_add_to_cart") perf[cid].add_to_cart += parseInt(a.value || "0");
          else if (t === "initiate_checkout" || t === "offsite_conversion.fb_pixel_initiate_checkout") perf[cid].initiate_checkout += parseInt(a.value || "0");
        }
      }
    }
    for (const cid of Object.keys(perf)) {
      const p = perf[cid];
      perf[cid] = {
        ...p, days: p.days.size,
        roas: safeDivide(p.revenue, p.spend),
        cpa_cents: safeDivide(p.spend, p.conversions),
        ctr_pct: safeDivide(p.clicks * 100, p.impressions),
        frequency: p.frequency_count > 0 ? Math.round((p.frequency_sum / p.frequency_count) * 100) / 100 : null,
        cpm: p.impressions > 0 ? Math.round((p.spend / p.impressions) * 1000) / 100 : null,
      };
    }
    return perf;
  };

  const perf30d = buildPerf(insights30d);
  const perf7d = buildPerf(insights7d);

  // Campaign → account mapping
  const campaignAccountMap: Record<string, string> = {};
  for (const c of campaigns) {
    if (c.ad_account_id) campaignAccountMap[c.meta_campaign_id] = c.ad_account_id;
  }

  // Order stats
  const paidOrders = orders.filter((o: any) => o.payment_status === "paid" || o.status === "delivered");
  const orderStats = {
    total_30d: orders.length,
    paid_30d: paidOrders.length,
    revenue_cents_30d: paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
    avg_ticket_cents: paidOrders.length > 0 ? Math.round(paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / paidOrders.length) : 0,
  };

  // Creative cadence check — use all non-variant products (variant filtering via regex)
  const variantRegex = /\s*\(\d+x\)|\s*\(FLEX\)|\s*\(Dia\)|\s*\(Noite\)/i;
  const mainProducts = products.filter((p: any) => !variantRegex.test(p.name));
  const topProducts = mainProducts.slice(0, 8);
  const creativeCadence = topProducts.map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    creatives_this_week: recentCreatives.filter((c: any) => c.product_id === p.id).length,
    needs_more: recentCreatives.filter((c: any) => c.product_id === p.id).length < 3,
  }));

  // === DEEP HISTORICAL INSIGHTS (only for "start" trigger) ===
  // v1.40.0: Skip LIFETIME sync if local DB already has sufficient data (>100 rows)
  let deepHistorical: Record<string, any> | null = null;
  if (trigger === "start") {
    const accountIds = configs.map(c => c.ad_account_id);
    
    // Check if local DB already has sufficient insight data
    const { count: localInsightCount } = await supabase
      .from("meta_ad_insights")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    
    const hasEnoughLocalData = (localInsightCount || 0) > 100;
    
    if (hasEnoughLocalData) {
      console.log(`[ads-autopilot-strategist][${VERSION}] Local DB has ${localInsightCount} insights — skipping LIFETIME sync (fast path)`);
    } else {
      console.log(`[ads-autopilot-strategist][${VERSION}] Local DB has only ${localInsightCount || 0} insights — syncing LIFETIME from Meta...`);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const syncHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey,
      };
      
      for (const acctId of accountIds) {
        try {
          console.log(`[ads-autopilot-strategist][${VERSION}] Syncing lifetime insights for ${acctId}...`);
          const syncRes = await fetch(`${supabaseUrl}/functions/v1/meta-ads-insights`, {
            method: "POST",
            headers: syncHeaders,
            body: JSON.stringify({ 
              tenant_id: tenantId, 
              action: "sync", 
              date_preset: "maximum",
              ad_account_id: acctId 
            }),
          });
          const syncData = await syncRes.json();
          console.log(`[ads-autopilot-strategist][${VERSION}] Lifetime sync for ${acctId}: ${syncData.success ? `${syncData.data?.synced || 0} synced` : syncData.error}`);
        } catch (syncErr: any) {
          console.warn(`[ads-autopilot-strategist][${VERSION}] Lifetime sync failed for ${acctId} (non-blocking): ${syncErr.message}`);
        }
      }
    }
    
    // Build deep historical from LOCAL DB
    console.log(`[ads-autopilot-strategist][${VERSION}] Building deep historical from LOCAL DB for start trigger...`);
    deepHistorical = {};
    for (const acctId of accountIds) {
      const acctChannel = configs.find(c => c.ad_account_id === acctId)?.channel || "meta";
      const result = await buildDeepHistoricalFromLocalData(supabase, tenantId, acctId, acctChannel);
      if (result) {
        deepHistorical[acctId] = result;
        console.log(`[ads-autopilot-strategist][${VERSION}] Deep historical for ${acctId}: ${result.campaigns.length} campaigns, ${result.adsets.length} adsets, ${result.ads.length} ads`);
      }
    }
  }

  // ============ ETAPA 7.mem — Subfase D: LEITURA OBSERVACIONAL DA TENANT MEMORY ============
  // Carrega uma única vez por ciclo as memórias provisional/active do tenant para os canais
  // ads_platform presentes em `configs`. Esta leitura é estritamente observacional:
  // não altera veredito, sugestões, prompts, Policy Engine, Governance Layer, Action
  // Derivation, status ou execução. Apenas anexa um resumo em `tenant_memory_observation`
  // e loga estruturadamente. Falha silenciosa: memória é puramente observacional nesta subfase.
  const tenantMemoryObservation: Record<string, any> = {
    mode: "observational_only",
    applied_to_decision: false,
    reason: "tenant_memory_not_active_for_influence",
    by_ads_platform: {} as Record<string, { candidates: number; ids: string[]; statuses: string[] }>,
    total_candidates: 0,
  };
  try {
    const adsPlatforms = Array.from(new Set((configs || []).map((c) => c.channel).filter(Boolean)));
    if (tenantId && adsPlatforms.length > 0) {
      const { data: memRows, error: memErr } = await supabase
        .from("ads_autopilot_tenant_memory")
        .select("id, tenant_id, sales_platform, ads_platform, memory_type, scope, key, value, confidence, evidence_count, status")
        .eq("tenant_id", tenantId)
        .in("ads_platform", adsPlatforms)
        .in("status", ["provisional", "active"])
        .limit(500);
      if (memErr) {
        tenantMemoryObservation.reason = "tenant_memory_fetch_failed_observational_only";
      } else {
        const rows = (memRows || []).filter((r: any) => r.tenant_id === tenantId);
        tenantMemoryObservation.total_candidates = rows.length;
        for (const r of rows) {
          const p = String(r.ads_platform || "unknown");
          if (!tenantMemoryObservation.by_ads_platform[p]) {
            tenantMemoryObservation.by_ads_platform[p] = { candidates: 0, ids: [], statuses: [] };
          }
          const slot = tenantMemoryObservation.by_ads_platform[p];
          slot.candidates += 1;
          slot.ids.push(r.id);
          if (!slot.statuses.includes(r.status)) slot.statuses.push(r.status);
        }
        if (rows.length === 0) tenantMemoryObservation.reason = "tenant_memory_empty_or_not_applicable";
      }
    } else {
      tenantMemoryObservation.reason = "missing_tenant_or_ads_platform";
    }
  } catch (err: any) {
    tenantMemoryObservation.reason = "tenant_memory_fetch_failed_observational_only";
    tenantMemoryObservation.error = err?.message || String(err);
  }
  console.log(`[ads-autopilot-strategist][${VERSION}][tenant-memory-observation]`, JSON.stringify({
    tenant_id: tenantId,
    ...tenantMemoryObservation,
  }));

  // Onda F — Aprendizados ATIVOS da IA do Gestor de Tráfego (somente status='active' entram no prompt).
  let activeLearnings: Array<{ id: string; title: string; description: string | null; category: string; confidence: number; evidence_count: number }> = [];
  try {
    const { data: lrn } = await supabase
      .from("ads_ai_learnings")
      .select("id, title, description, category, confidence, evidence_count, last_used_at")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("confidence", { ascending: false })
      .order("evidence_count", { ascending: false })
      .limit(50);
    activeLearnings = (lrn || []) as any;
    // Marca uso (não bloqueia se falhar)
    if (activeLearnings.length > 0) {
      const ids = activeLearnings.map((l) => l.id);
      supabase.from("ads_ai_learnings").update({ last_used_at: new Date().toISOString() }).in("id", ids).then(() => {}, () => {});
    }
  } catch (e) {
    console.warn(`[ads-autopilot-strategist][${VERSION}] learnings fetch failed:`, e?.message);
  }

  // ============ Onda G — Pré-computações por conta de anúncios (Meta) ============
  // Disponibilidade do público de Clientes e disponibilidade de catálogo Meta.
  // Tudo lido localmente; sem chamada à Meta.
  const adAccountIds = Array.from(new Set(campaigns.map((c: any) => c.ad_account_id).filter(Boolean)));
  const customerAudienceByAccount: Record<string, { found: boolean; meta_audience_id: string | null; audience_name: string | null }> = {};
  for (const acctId of adAccountIds) {
    try {
      const res = await resolveCustomerAudienceForMetaAccount(supabase, tenantId, acctId);
      customerAudienceByAccount[acctId] = {
        found: !!res?.found,
        meta_audience_id: res?.meta_audience_id || null,
        audience_name: res?.audience_name || null,
      };
    } catch (_) {
      customerAudienceByAccount[acctId] = { found: false, meta_audience_id: null, audience_name: null };
    }
  }
  const catalogAvailabilityByAccount: Record<string, { available: boolean; catalog_id: string | null; catalog_name: string | null }> = {};
  try {
    const { data: metaInts } = await supabase
      .from("tenant_meta_integrations")
      .select("integration_key, status, selected_assets")
      .eq("tenant_id", tenantId)
      .in("integration_key", ["catalogos", "catalogo_meta"])
      .eq("status", "active");
    const catalogsRow = (metaInts || []).find((r: any) => r.integration_key === "catalogos") || (metaInts || [])[0];
    const selected = catalogsRow?.selected_assets || {};
    const cats: any[] = selected?.catalogs || (selected?.catalog ? [selected.catalog] : []);
    for (const acctId of adAccountIds) {
      // Catálogo é por tenant, não por conta de anúncios; reusa para todas.
      const first = cats[0];
      catalogAvailabilityByAccount[acctId] = {
        available: !!first,
        catalog_id: first?.id || null,
        catalog_name: first?.name || null,
      };
    }
  } catch (_) { /* fail-open */ }

  return {
    products,
    categories,
    orderStats,
    campaigns,
    perf30d,
    perf7d,
    adsets,
    ads,
    audiences,
    campaignAccountMap,
    recentActions,
    experiments,
    creativeCadence,
    recentCreatives,
    metaPixelId,
    storeSettings,
    tenant,
    storeUrl,
    checkoutUrl,
    pageLinks,
    lpLinks,
    globalConfig,
    imagesByProduct,
    deepHistorical,
    // Google Ads data
    googleCampaigns,
    googleAdGroups,
    googleAds,
    googleKeywords,
    googleAssets,
    tiktokCampaigns,
    tiktokInsights,
    // Onda D — Configuração de Criação Meta indexada por conta
    metaProductionConfigsByAccount,
    // Etapa 7.mem — Subfase D: observação carregada uma vez por ciclo, NÃO influencia a IA.
    tenant_memory_observation: tenantMemoryObservation,
    // Onda F — Aprendizados ATIVOS (entram no prompt).
    activeLearnings,
    // Onda G — disponibilidade por conta (cliente exclusão fria + catálogo Meta).
    customerAudienceByAccount,
    catalogAvailabilityByAccount,
  };
}

// ============ BUILD STRATEGIST PROMPT ============

// Onda D — Bloco "Configuração de Criação Meta" injetado no prompt do Strategist.
// Não inventa Pixel/Página/Instagram/evento. Quando o dado não está configurado,
// marca como `requires_user_input` e o gate de etapa lida com a pendência.
function buildMetaProductionConfigBlock(cfg: any | null | undefined): string {
  if (!cfg) {
    return [
      "## CONFIGURAÇÃO DE CRIAÇÃO META (PRODUÇÃO)",
      "Nenhuma configuração persistida encontrada para esta conta de anúncios.",
      "Use defaults conservadores: país BR, idioma pt_BR, idade 18-65, gênero todos,",
      "posicionamentos automáticos (Advantage+), modo de compra Leilão, status inicial PAUSED,",
      "CTA SHOP_NOW, formato 1x1. Para Pixel/Página/Instagram/Evento de conversão,",
      "use o valor literal 'requires_user_input' (NÃO INVENTAR).",
    ].join("\n");
  }
  const v = (x: any, fallback = "requires_user_input") => (x == null || x === "" ? fallback : x);
  const placements = Array.isArray(cfg.default_placements) ? cfg.default_placements.join(", ") : "advantage_plus";
  const budgetReais = cfg.default_daily_budget_cents != null
    ? (Number(cfg.default_daily_budget_cents) / 100).toFixed(2)
    : null;
  return [
    "## CONFIGURAÇÃO DE CRIAÇÃO META (PRODUÇÃO) — FONTE DE VERDADE DA CONTA",
    "Use estes defaults ao montar Campaign / AdSet / Ad. Para qualquer dado obrigatório",
    "não configurado, use literalmente 'requires_user_input' (NÃO INVENTAR Pixel, Página,",
    "Instagram Actor ou Evento de conversão).",
    "",
    "### Identidade",
    `- Página do Facebook: ${v(cfg.facebook_page_id)}`,
    `- Instagram Actor: ${v(cfg.instagram_actor_id, "n/d")}`,
    "",
    "### Mensuração",
    `- Pixel ID: ${v(cfg.pixel_id)}`,
    `- Evento de conversão padrão: ${v(cfg.default_conversion_event)}`,
    `- Janela de atribuição: ${v(cfg.attribution_window, "padrão da plataforma")}`,
    "",
    "### Campanha (defaults)",
    `- Objetivo canônico: ${cfg.default_objective || "sales"}`,
    `- Modo de compra: ${cfg.default_buying_type || "AUCTION"}`,
    `- Tipo de orçamento: ${cfg.default_budget_type || "daily"}`,
    `- Orçamento diário padrão: ${budgetReais ? `R$ ${budgetReais}` : "usar orçamento da proposta"}`,
    `- Status inicial: ${cfg.default_planned_status || "PAUSED"}`,
    "",
    "### Conjunto (defaults)",
    `- País: ${cfg.default_country || "BR"} | Idioma: ${cfg.default_language || "pt_BR"}`,
    `- Idade: ${cfg.default_age_min ?? 18}-${cfg.default_age_max ?? 65}`,
    `- Gênero: ${cfg.default_gender || "all"}`,
    `- Posicionamentos: ${placements}`,
    `- Tipo de público padrão: ${cfg.default_audience_type || "broad"}`,
    `- Etapa de funil padrão: ${cfg.default_funnel_stage || "tof"}`,
    `- Excluir clientes/compradores do público frio: ${cfg.exclude_customers ? "sim" : "não"}`,
    "",
    "### Anúncio / Criativo (defaults)",
    `- CTA padrão: ${cfg.default_cta || "SHOP_NOW"}`,
    `- Formato padrão: ${cfg.default_creative_format || "1x1"}`,
    `- Estratégia de imagem de referência: ${cfg.reference_image_strategy || "product_main_image"}`,
    "",
    "REGRAS OBRIGATÓRIAS:",
    "- NÃO coloque link/CTA no nível Campanha — pertencem ao Ad/Criativo.",
    "- Não deixe nenhum conjunto sem público/região/idade/gênero/posicionamento/otimização.",
    "- Use objetivo no enum canônico (sales, leads, traffic, awareness, engagement, app_promotion).",
    "- O adapter Meta traduz para o enum oficial — não grave OUTCOME_SALES diretamente.",
  ].join("\n");
}

function buildStrategistPrompt(trigger: StrategistTrigger, config: AccountConfig, context: any) {
  // === GOOGLE ADS BRANCH ===
  if (config.channel === "google") {
    return buildGoogleStrategistPrompt(trigger, config, context);
  }

  // === TIKTOK ADS BRANCH ===
  if (config.channel === "tiktok") {
    return buildTikTokStrategistPrompt(trigger, config, context);
  }

  // === META ADS (default) ===
  // Filter campaigns for this account
  const accountCampaignIds = Object.entries(context.campaignAccountMap || {})
    .filter(([_, acctId]) => acctId === config.ad_account_id)
    .map(([campId]) => campId);

  const accountCampaigns = context.campaigns.filter((c: any) =>
    accountCampaignIds.includes(c.meta_campaign_id) || c.ad_account_id === config.ad_account_id
  );

  const activeCampaigns = accountCampaigns.filter((c: any) => c.status === "ACTIVE");
  const pausedCampaigns = accountCampaigns.filter((c: any) => c.status === "PAUSED");

  const accountAdsets = context.adsets.filter((as: any) => as.ad_account_id === config.ad_account_id);
  const accountAudiences = context.audiences.filter((a: any) => a.ad_account_id === config.ad_account_id);

  const minRoiCold = config.min_roi_cold || 0.8;
  const minRoiWarm = config.min_roi_warm || 1.5;
  const targetRoi = config.target_roi;
  const roasThreshold = config.roas_scaling_threshold;
  const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;
  const budgetAdjustable = canAdjustBudget(config);

  // Build campaign data with perf (v1.35.0: added frequency, CPM, funnel actions)
  const campaignData = accountCampaigns.map((c: any) => {
    const p30 = context.perf30d[c.meta_campaign_id] || {};
    const p7 = context.perf7d[c.meta_campaign_id] || {};
    return {
      id: c.meta_campaign_id, name: c.name, status: c.status,
      effective_status: c.effective_status, objective: c.objective,
      budget_cents: c.daily_budget_cents,
      perf_30d: p30.days ? { roas: p30.roas, cpa: p30.cpa_cents, spend: p30.spend, conversions: p30.conversions, ctr: p30.ctr_pct, frequency: p30.frequency, cpm: p30.cpm, page_views: p30.page_views, atc: p30.add_to_cart, ic: p30.initiate_checkout, days: p30.days } : null,
      perf_7d: p7.days ? { roas: p7.roas, cpa: p7.cpa_cents, spend: p7.spend, conversions: p7.conversions, ctr: p7.ctr_pct, frequency: p7.frequency, cpm: p7.cpm, page_views: p7.page_views, atc: p7.add_to_cart, ic: p7.initiate_checkout, days: p7.days } : null,
    };
  });

  // Creative cadence for this account's products
  const creativeCadence = context.creativeCadence || [];

  // Weekly actions summary
  const weeklyActions = context.recentActions.filter((a: any) => a.action_data?.ad_account_id === config.ad_account_id);
  const actionsSummary = {
    pauses: weeklyActions.filter((a: any) => a.action_type === "pause_campaign" && a.status === "executed").length,
    budget_adjustments: weeklyActions.filter((a: any) => a.action_type === "adjust_budget").length,
    campaigns_created: weeklyActions.filter((a: any) => a.action_type === "create_campaign").length,
    creatives_generated: weeklyActions.filter((a: any) => a.action_type === "generate_creative").length,
  };

  let triggerInstruction = "";
  switch (trigger) {
    case "start":
      triggerInstruction = `## TRIGGER: PRIMEIRA ATIVAÇÃO (Planejamento Estratégico com Análise Histórica Completa)
Nesta fase, você DEVE emitir APENAS um strategic_plan. NÃO crie campanhas, criativos ou públicos agora.
O usuário precisa APROVAR o plano antes de qualquer implementação.

## ANÁLISE HISTÓRICA PROFUNDA (PERÍODO MÁXIMO)
Você recebeu dados históricos COMPLETOS da conta de anúncios (período máximo disponível na Meta).
Esses dados incluem métricas por campanha, por conjunto de anúncios (público/audiência) e por anúncio individual,
além de breakdowns por posicionamento (Feed, Reels, Stories, etc.).

**ANÁLISE OBRIGATÓRIA POR TIPO DE CAMPANHA:**
1. **Público Frio (TOF/Aquisição):**
   - Quais PÚBLICOS (audiences/adsets) tiveram melhor ROAS e CPA historicamente?
   - Quais CRIATIVOS (ads) converteram mais? Que tipo de copy/headline funcionou?
   - Quais POSICIONAMENTOS (Feed, Reels, Stories) trouxeram mais conversões com menor CPA?
   - Quais produtos tiveram melhor performance em TOF?

2. **Remarketing (BOF):**
   - Quais segmentos de remarketing (visitantes, ATC, IC) converteram melhor?
   - Quais criativos e copys funcionaram melhor para remarketing?
   - Qual o ROAS médio histórico de remarketing?

3. **Testes:**
   - Quais testes A/B foram realizados? Resultados?
   - O que aprendemos sobre o que funciona e o que não funciona?

**DIAGNÓSTICO BASEADO EM DADOS HISTÓRICOS (OBRIGATÓRIO):**
No campo diagnosis do plano, inclua OBRIGATORIAMENTE:
- Top 5 públicos que mais converteram (nome, ROAS, CPA, conversões)
- Top 5 criativos/anúncios que mais converteram (nome, métricas)
- Top 3 posicionamentos que mais converteram (plataforma_posição, ROAS)
- Campanhas pausadas que tiveram bom desempenho (oportunidades de reativação/duplicação)
- Campanhas que falharam (o que evitar)

Seu plano estratégico DEVE incluir:
1. **Diagnóstico**: Análise histórica COMPLETA da conta (ver acima) + situação atual
2. **Ações Planejadas** (lista DETALHADA e ESPECÍFICA):
   - Para CADA campanha a criar: tipo (TOF/Teste/Remarketing/Duplicação), produto específico, orçamento diário, público-alvo
   - PRIORIZE replicar os públicos e formatos que HISTORICAMENTE converteram melhor
   - Campanhas de TESTE: mínimo 3 produtos diferentes, com criativos variados
   - Campanhas de DUPLICAÇÃO de vencedores: para escalar o que já funciona
   - Campanha de REMARKETING: segmentada por temperatura
   - Quantidade de copies por campanha: mínimo 2-4 variações de Primary Text + Headlines
3. **Alocação de Orçamento**: Distribuição clara entre funis (cold, remarketing, tests)
4. **Resultados Esperados**: Projeção realista baseada nos DADOS HISTÓRICOS REAIS
5. **Riscos**: O que pode dar errado

{{DEEP_HISTORICAL_DATA}}

REGRAS:
- O plano DEVE utilizar 100% do orçamento disponível (R$ ${((config.budget_cents || 0) / 100).toFixed(2)}/dia)
- NÃO use create_campaign, generate_creative ou qualquer outra ferramenta além de strategic_plan
- Seja ESPECÍFICO: nomes de produtos reais, valores exatos de orçamento, públicos detalhados
- Base TODAS as decisões nos dados históricos — não "invente" estratégias sem evidência`;
      break;
    case "weekly":
      triggerInstruction = `## TRIGGER: REVISÃO SEMANAL (Sábado → implementação Domingo 00:01)
Pipeline em 5 fases — execute TODAS:
1. **PLANNING**: Revise performance 7d vs 30d. Emita strategic_plan com diagnóstico.
2. **CRIATIVOS**: Verifique cadência criativa (mín 3/semana por top product). Gere faltantes.
3. **PÚBLICOS**: Avalie se Lookalikes existentes performam. Sugira novos se necessário.
4. **MONTAGEM**: Proponha novas campanhas se há oportunidade (ROAS > threshold + budget disponível).
5. **PUBLICAÇÃO**: Ajuste budgets (agendados para 00:01). Novas campanhas PAUSADAS → ativação agendada.

FOCO SEMANAL: Otimização incremental. Não reestruture tudo.`;
      break;
    case "monthly":
      triggerInstruction = `## TRIGGER: REVISÃO MENSAL (Dia 1 → planejamento do próximo mês)
ATENÇÃO: Use EXCLUSIVAMENTE os dados dos últimos 30 dias para esta análise. NÃO consulte dados históricos mais antigos.

Você DEVE emitir um strategic_plan com o PLANO PARA O PRÓXIMO MÊS. Mesmo que a conclusão seja manter o plano atual,
você DEVE emitir um novo plano estratégico justificando a manutenção com dados dos últimos 30 dias.

Análise OBRIGATÓRIA dos últimos 30 dias:
1. **DIAGNÓSTICO MENSAL**: 
   - Performance de CADA campanha ativa nos últimos 30d (ROAS, CPA, conversões, gasto)
   - Performance de CADA conjunto de anúncios (quais públicos converteram melhor?)
   - Performance de CADA anúncio (quais criativos/copys tiveram melhor CTR e conversão?)
   - Comparação com mês anterior (se disponível): melhorou ou piorou?
   - ROI real, custo por aquisição, ticket médio
2. **CRIATIVOS**: Identifique criativos com >30d (fadiga criativa). Proponha renovação.
3. **PÚBLICOS**: Reavalie TODOS os públicos. Expire Lookalikes com ROAS < mínimo. Proponha novos.
4. **CAMPANHAS**: Reestruturação se necessário. Proponha novas campanhas por funil.
5. **ORÇAMENTO**: Redistribuição de verba baseada nos resultados do mês.

O PLANO DEVE conter:
- Ações específicas para o próximo mês (criar, pausar, escalar, testar)
- Redistribuição de orçamento se necessário
- Metas quantitativas para o próximo mês (ROAS alvo, CPA alvo, conversões esperadas)
- Testes propostos para o mês seguinte

REGRA: Mesmo que tudo esteja funcionando bem, SEMPRE emita um strategic_plan — pode ser para MANTER a estratégia atual,
mas com justificativa baseada em dados e ajustes incrementais (ex: escalar vencedores, pausar perdedores).`;
      break;
    case "implement_approved_plan":
      // Phase 1: ONLY generate creatives and audiences — campaigns come in Phase 2
      triggerInstruction = `## TRIGGER: IMPLEMENTAÇÃO DE PLANO APROVADO — FASE 1 (CRIATIVOS E PÚBLICOS)
O usuário APROVOU o Plano Estratégico abaixo. Esta é a FASE 1: preparação de ativos.

{{APPROVED_PLAN_CONTENT}}

## CRIATIVOS JÁ EXISTENTES (NÃO GERAR DUPLICADOS!)
{{EXISTING_CREATIVES_INVENTORY}}

NESTA FASE VOCÊ DEVE:
1. **PRIMEIRO**: Verificar os criativos já existentes listados acima
   - Se já existir um criativo pronto (status=ready, com URL) para o produto + funnel_stage + formato desejado → NÃO gere novo, REUTILIZE
   - Gere novos criativos (generate_creative) APENAS para combinações (produto × funnel_stage × formato) que NÃO existam no inventário acima
2. Para criativos que precisam ser gerados:
   - Mínimo 2 variações por produto (estilos diferentes: ugc_style, product_natural, person_interacting)
   - Formatos: 9:16 para Stories/Reels + 1:1 para Feed
   - OBRIGATÓRIO: funnel_stage diferente para cada uso! Gere criativos SEPARADOS para TOF e BOF
   - Criativos de TOF (aquisição): estilo chamativo, gancho de atenção, produto em destaque
   - Criativos de BOF (remarketing): estilo diferente, foco em benefícios complementares, prova social
3. Criar públicos Lookalike (create_lookalike_audience) se o plano especificar

NESTA FASE VOCÊ NÃO DEVE:
- NÃO use create_campaign — campanhas serão criadas na FASE 2 (após criativos ficarem prontos)
- NÃO use create_adset — será feito na FASE 2
- NÃO use strategic_plan — o plano já foi aprovado
- NÃO use adjust_budget — será feito na FASE 2

A FASE 2 será disparada AUTOMATICAMENTE quando todos os criativos estiverem prontos.`;
      break;
    case "implement_campaigns":
      // Phase 2: Create campaigns WITH creative URLs already available
      triggerInstruction = `## TRIGGER: IMPLEMENTAÇÃO DE PLANO APROVADO — FASE 2 (CAMPANHAS)
Todos os criativos da Fase 1 estão PRONTOS. Agora é hora de criar as campanhas.

{{APPROVED_PLAN_CONTENT}}

CRIATIVOS DISPONÍVEIS (já gerados na Fase 1):
{{AVAILABLE_CREATIVES}}

⚠️ EXECUÇÃO OBRIGATÓRIA — SEM PAUSAS, SEM APROVAÇÃO
Você está em modo de EXECUÇÃO AUTOMÁTICA. O plano já foi aprovado pelo usuário.
NÃO peça aprovação. NÃO exiba previews. NÃO diga "aguardando confirmação".
EXECUTE TODAS as campanhas do plano IMEDIATAMENTE usando as tools disponíveis.
Cada round DEVE conter tool calls. Se não chamou tool = ERRO.

🔒 FIDELIDADE ESTRITA AO PLANO (REGRA INVIOLÁVEL — v1.44.0)
Você DEVE criar EXATAMENTE as campanhas listadas em planned_actions do plano aprovado.
- NÃO invente campanhas extras que não estejam no plano
- NÃO adicione adsets extras que não estejam listados nos adsets[] de cada ação do plano
- NÃO crie variações, duplicações ou extensões além do que foi planejado
- Se o plano tem 4 ações → você cria EXATAMENTE 4 campanhas (ou o equivalente conforme action_type)
- Se uma ação de teste tem 3 adsets no array → você cria 3 campanhas ABO (1 por variação), NÃO mais
- O número total de create_campaign + create_adset DEVE corresponder ao plano
- Qualquer campanha/adset FORA do plano será considerada ERRO e será rejeitada pelo usuário
- Se você achar que o plano precisa de ajustes, NÃO ajuste — execute fielmente e sugira melhorias via insights

NESTA FASE VOCÊ DEVE:
1. Criar TODAS as campanhas do plano aprovado usando create_campaign — e SOMENTE elas
   - CADA campanha DEVE ter entre 2 e 4 primary_texts (variações de copy)
   - CADA campanha DEVE ter entre 2 e 4 headlines
   - Copys devem atacar ângulos DIFERENTES (benefício, objeção, prova social, urgência)
   - Headlines curtas e diretas (máx 40 chars)
   - Inclua descriptions e CTA adequado
2. Criar ad sets (create_adset) SOMENTE os que estão listados em adsets[] do plano
3. Ajustar budgets (adjust_budget) de campanhas existentes SOMENTE se o plano pedir

REGRAS ESTRUTURAIS (INVIOLÁVEIS):
- **PRODUTO REAL OBRIGATÓRIO**: product_name DEVE ser o nome EXATO de um produto existente no catálogo do tenant (lista fornecida em "PRODUTOS"). É PROIBIDO inventar codinomes comerciais ("Fast Upgrade", "Boost", "Pro Edition" etc.) que não existam no catálogo. Sugestão com produto fantasma será bloqueada pelo Quality Gate e marcada como inválida.
- **COERÊNCIA PRODUTO × COPY × CRIATIVO**: campaign_name, headlines, primary_texts e creative DEVEM falar do MESMO produto. NUNCA misture Kit com produto isolado (ex.: vincular "Kit Banho" e escrever copy só sobre "Shampoo"). NUNCA use copy de um produto diferente do vinculado.
- **CRIATIVO EXISTENTE OBRIGATÓRIO**: você só pode propor create_campaign se houver um creative_asset_id (ou creative_url) DO TENANT, vinculado ao MESMO produto da campanha, em status ready no inventário "CRIATIVOS PRONTOS". Se não houver criativo válido, NÃO proponha create_campaign — registre como pendência para a Fase 1 (implement_creatives) regenerar.
- **REMARKETING vs TOF**: Copys e criativos de remarketing DEVEM ser DIFERENTES dos de venda direta. O público já viu os anúncios TOF. Use ângulos: objeção, urgência, prova social, benefícios complementares.
- **CAMPANHAS DE TESTE**: Cada anúncio em seu PRÓPRIO adset (1:1). Use ABO (budget no adset, NÃO no nível de campanha). Budget dividido igualmente entre variações.
- **VENDA DIRETA (TOF)**: Os adsets DEVEM corresponder EXATAMENTE aos listados em adsets[] do plano. NÃO adicione adsets extras.
- O orçamento TOTAL do plano deve ser RESPEITADO — verba ociosa é proibida
- Tudo criado PAUSADO. Ativações agendadas para 00:01-04:00 BRT
- Aumentos de budget limitados a +20% por campanha existente
- NUNCA use copy genérica como "Conheça nosso produto" — seja específico
- destination_url: Use URL com SLUG do produto (não UUID) — obrigatório quando objective for conversions/traffic/sales/leads

NESTA FASE VOCÊ NÃO DEVE:
- NÃO use generate_creative — criativos já foram gerados
- NÃO use strategic_plan — o plano já foi aprovado
- NÃO peça aprovação ou confirmação — EXECUTE diretamente
- NÃO crie campanhas ou adsets que NÃO estejam explicitamente no plano aprovado
- NÃO proponha create_campaign sem creative_asset_id do tenant vinculado ao mesmo produto`;
      break;
  }

  const storeName = context.storeSettings?.store_name || context.tenant?.name || "Loja";
  const storeDescription = context.storeSettings?.store_description || context.storeSettings?.seo_description || "";
  const categoryNames = context.categories?.map((c: any) => c.name).join(", ") || "";

  const system = `Você é o Motor Estrategista do Autopilot de Tráfego — focado em CRESCIMENTO ESTRATÉGICO.

## LOJA / MARCA
- Nome: ${storeName}
- Descrição: ${storeDescription || "Não informada"}
- URL da Loja: ${context.storeUrl || "Não configurada"}
- URL de Checkout: ${context.checkoutUrl || "Não configurada"}
- Categorias: ${categoryNames || "Nenhuma"}

## CONTA DE ANÚNCIOS: ${config.ad_account_id} (${config.channel})
- Orçamento: R$ ${((config.budget_cents || 0) / 100).toFixed(2)} / ${config.budget_mode || "monthly"}
- ROI Mín Frio: ${minRoiCold}x | ROI Mín Quente: ${minRoiWarm}x | ROI Alvo: ${targetRoi || "N/D"}x
- ROAS Scaling: ${roasThreshold ? roasThreshold + "x" : "Não definido"}
- Estratégia: ${config.strategy_mode || "balanced"}
- Splits de Funil: ${config.funnel_splits ? `Frio=${(config.funnel_splits as any).cold || 0}%, Remarketing=${(config.funnel_splits as any).remarketing || 0}%, Testes=${(config.funnel_splits as any).tests || 0}%, Leads=${(config.funnel_splits as any).leads || 0}%` : "AI decides"}
- Limite de ajuste: ±${platformLimit.max_change_pct}% a cada ${platformLimit.min_interval_hours}h
- Pode ajustar budget agora: ${budgetAdjustable ? "SIM" : "NÃO"}
- Modo aprovação: ${config.human_approval_mode || "approve_high_impact"}

## CONFIGURAÇÃO GLOBAL DO AUTOPILOT
${context.globalConfig ? `- Habilitado: ${context.globalConfig.is_enabled ? "SIM" : "NÃO"}
- Modelo AI: ${context.globalConfig.ai_model || "default"}
- Objetivo global: ${context.globalConfig.objective || "N/D"}
- Instruções globais: ${context.globalConfig.user_instructions || "Nenhuma"}` : "Sem configuração global"}

## INSTRUÇÕES ESTRATÉGICAS DO USUÁRIO
${config.user_instructions || "Nenhuma instrução adicional."}

## LINKS E DESTINOS DISPONÍVEIS
- Páginas da Loja: ${context.pageLinks?.length > 0 ? context.pageLinks.map((p: any) => `${p.title} (${p.url})`).join(", ") : "Nenhuma publicada"}
- Landing Pages IA: ${context.lpLinks?.length > 0 ? context.lpLinks.map((lp: any) => `${lp.name} → ${lp.url}${lp.products?.length ? ` [produtos: ${lp.products.join(", ")}]` : ""}`).join("\n  ") : "Nenhuma ativa"}

## CAPACIDADES DE LANDING PAGES (v1.48.0)
Você pode buscar e GERAR landing pages otimizadas para campanhas:

### search_landing_pages
- Use ANTES de criar campanhas para verificar se já existe uma LP dedicada
- LPs dedicadas tipicamente convertem 2-5x melhor que páginas de produto padrão
- Se encontrar uma LP relevante, use sua URL como destination_url

### generate_landing_page  
- Use quando identificar que uma LP dedicada melhoraria conversões
- Cenários ideais: produto carro-chefe sem LP, campanha de alto orçamento, lançamento
- A LP é gerada por IA com copy persuasivo, design responsivo e otimizada para conversão
- Forneça um prompt DESCRITIVO com tom, estilo visual e ângulo de venda
- A URL estará disponível em ~2 minutos — use-a como destination_url

### Quando NÃO gerar LP:
- Produto já tem LP existente (use search_landing_pages primeiro)
- Orçamento baixo (< R$30/dia) — a página padrão do produto é suficiente
- Campanha de remarketing quente — o cliente já conhece o produto

## REGRAS DO ESTRATEGISTA
- Analise TODO o contexto antes de tomar decisões: produtos, público, campanhas ativas, métricas, links disponíveis e instruções do usuário
- NUNCA delete campanhas/ad sets/anúncios (proibição permanente)
- Campanhas criadas sempre PAUSADAS — ativação agendada para 00:01-04:00 BRT
- Use CBO (Campaign Budget Optimization) por padrão
- Criativos: mínimo 3 variações/semana por top product
- Experimentos: exigem 3x CPA Target spend, 5 dias, 20 cliques ou 5 conversões
- Promoção: variante com CPA < 80% do controle ou ROAS > 120% por 3+ dias → promover
- Responda SEMPRE em Português do Brasil
- Cada tool call deve ter justificativa numérica
- Use os links reais da loja (landing pages, páginas) como destino dos anúncios — PREFIRA landing pages dedicadas quando disponíveis
- Considere as categorias de produtos e o posicionamento da marca ao criar copys

## MÉTRICAS ESTENDIDAS DISPONÍVEIS (v1.35.0)
Você tem acesso às seguintes métricas por campanha (30d e 7d), além do histórico profundo:
- **Frequência**: Média de vezes que cada pessoa viu o anúncio. Se >3 = fadiga. Se >5 = crítico, pausar ou renovar criativo.
- **CPM**: Custo por 1000 impressões em R$. Indica competitividade do leilão e qualidade do anúncio.
- **CTR**: Taxa de clique. Abaixo de 1% indica criativo fraco. Acima de 2% é excelente.
- **Visualizações de Página (PV)**: Quantas pessoas chegaram na página do produto. Indica qualidade do tráfego.
- **Adição ao Carrinho (ATC)**: Quantas adicionaram ao carrinho. Indica intenção de compra.
- **Checkout Iniciado (IC)**: Quantas iniciaram checkout. Se ATC alto e IC baixo = problema no checkout.
- **Video Views 25/50/95%**: Retenção do vídeo. Se VV25 alto mas VV95 baixo = gancho bom mas conteúdo fraco.

USE ESSAS MÉTRICAS para:
1. Identificar fadiga criativa (frequência alta + CTR caindo)
2. Diagnosticar funil quebrado (PV alto → ATC baixo = página ruim, ATC alto → IC baixo = checkout ruim)
3. Avaliar qualidade de vídeos (VV25 vs VV95 = taxa de retenção)
4. Comparar CPM entre públicos (CPM alto pode indicar audiência saturada)

${trigger === "start" ? `## ESTRATÉGIA DE REPLICAÇÃO INTELIGENTE (v1.36.0 — OBRIGATÓRIA NA PRIMEIRA ATIVAÇÃO)
Em contas com histórico de campanhas, você NUNCA deve criar tudo do zero. Siga esta hierarquia:

### 1. DUPLICAÇÃO EXATA (Prioridade Máxima)
- Se uma campanha/adset/anúncio teve ROAS ≥ meta E está pausado → DUPLIQUE exatamente com o mesmo público, copy, criativo e configurações
- Apenas ajuste: orçamento (escalar se ROAS permitir) e datas
- No plano, marque como "DUPLICAÇÃO" e referencie o nome/ID original

### 2. REPLICAÇÃO COM VARIAÇÃO (Prioridade Alta)
- Se um criativo/copy teve CTR > 2% e conversões → use como REFERÊNCIA para criar variações
- Mantenha o mesmo ângulo/hook/estrutura, mas mude palavras, imagens ou formato
- Copys vencedoras: mantenha a estrutura (gancho + benefício + CTA) e varie os detalhes
- Criativos vencedores: mantenha o estilo visual e mude composição ou produto em destaque
- No plano, cite o anúncio original como "INSPIRAÇÃO"

### 3. EXPANSÃO DE PÚBLICO (Prioridade Média)
- Se um adset com público X teve bom desempenho → crie novos adsets com o MESMO criativo/copy em públicos SIMILARES
- Ex: Se "Interesses Skincare" funcionou → teste "LAL 1% compradores" com o mesmo anúncio
- Ou: se "Broad 25-45 F" funcionou → teste "Broad 30-55 F" ou adicione interesses

### 4. TESTE GENUÍNO (Prioridade Baixa — apenas quando necessário)
- Criar do zero APENAS quando: (a) não há dados históricos suficientes, (b) novo produto sem referência, (c) necessidade de testar ângulo completamente diferente
- Mesmo em testes, use as copys e headlines vencedoras como ponto de partida

### REGRA DE OURO
Antes de propor QUALQUER campanha nova, verifique se já existe algo similar no histórico que pode ser duplicado ou adaptado.
Testar do zero em uma conta com centenas de campanhas é DESPERDÍCIO — os dados já dizem o que funciona.` : `## ANÁLISE BASEADA EM DADOS (v1.36.0)
Nas análises mensais e semanais, você tem liberdade para testar novos públicos, copys e criativos.
Use as métricas disponíveis (ROAS, CPA, Freq, CPM, Funil, Vídeo) para tomar decisões baseadas em dados dos últimos 30d (mensal) ou 7d (semanal).
Não é obrigatório replicar histórico — foque no que ESTÁ rodando agora e otimize incrementalmente.`}

## REGRAS DE CONFIGURAÇÃO COMPLETA (OBRIGATÓRIAS em create_campaign)
Cada create_campaign é uma campanha COMPLETA no Meta Ads. Você DEVE preencher TODOS os campos abaixo como se estivesse configurando manualmente:

### Nível Campanha:
- campaign_name: Nome descritivo seguindo padrão [AI] Objetivo | Produto | Público | Data
- objective: Objetivo da campanha (OUTCOME_SALES para e-commerce, OUTCOME_LEADS para captação)
- daily_budget_cents: Orçamento diário (CBO)
- special_ad_categories: ["NONE"] na maioria dos casos

### Nível Conjunto (Configurações OBRIGATÓRIAS — como no Meta Ads Manager):
- adset_name: Nome do conjunto (padrão: [AI] CJ - Público | Funil)
- optimization_goal: OBRIGATÓRIO. Use OFFSITE_CONVERSIONS para vendas, LINK_CLICKS para tráfego, LEAD_GENERATION para leads
- billing_event: IMPRESSIONS (padrão) ou LINK_CLICKS
- conversion_event: OBRIGATÓRIO para vendas (PURCHASE) ou leads (LEAD). Sem isso o pixel não otimiza!
- conversion_location: Local da conversão — "Site" para e-commerce (padrão). Nunca "Site e App" a menos que tenha app.
- performance_goal: Meta de desempenho — "Maximizar Conversões" (padrão) ou "Maximizar Valor das Conversões" para ROAS
- attribution_model: Modelo de atribuição — "Padrão" (padrão) ou "Incremental"

IMPORTANTE: No planned_actions do plano estratégico, inclua OBRIGATORIAMENTE: performance_goal, conversion_location e attribution_model para cada ação. Essas são as configurações reais do Conjunto de Anúncios que o lojista precisa validar.

### Targeting:
- geo_locations: Sempre definir. Default: {countries: ["BR"]}
- age_min / age_max: Faixa etária adequada ao produto
- genders: [0]=Todos, [1]=Masculino, [2]=Feminino
- interests: Usar IDs reais de interesses do Meta (disponíveis nos públicos da conta)
- custom_audience_ids / excluded_audience_ids: Usar IDs reais de públicos da conta

### Posicionamentos:
- publisher_platforms: Omitir para Automático (Advantage+), ou especificar ["facebook","instagram"]
- position_types: Omitir para Automático, ou especificar ["feed","story","reels"]

### Link & Destino:
- destination_url: OBRIGATÓRIO. URL real do produto, landing page ou loja. NUNCA deixar vazio!
- display_link: Link visual exibido no anúncio (opcional)
- utm_params: Sempre incluir para rastreamento. Ex: {source:"meta", medium:"paid", campaign:"nome"}

### Criativo:
- ad_name: Nome do anúncio
- ad_format: SINGLE_IMAGE (padrão), SINGLE_VIDEO, CAROUSEL ou COLLECTION
- primary_texts: 2-4 variações com ângulos DIFERENTES (benefício, objeção, prova social, urgência)
- headlines: 2-4 variações curtas (máx 40 chars)
- descriptions: 1-2 descrições curtas
- cta: Call to Action adequado (SHOP_NOW para e-commerce, LEARN_MORE para awareness)

### REGRAS CRÍTICAS:
- NUNCA use copy genérica como "Conheça nosso produto" — seja específico sobre o produto e benefícios
- destination_url DEVE ser uma URL real da loja — use os links disponíveis acima
- conversion_event é OBRIGATÓRIO para campanhas de vendas — sem ele o pixel não registra compras
- Se não souber os IDs de interesses, use targeting_type broad (segmentação ampla) — é melhor que inventar IDs

## REGRAS DE COMPLETUDE DO PLANO
- Na primeira ativação, o plano estratégico DEVE cobrir 100% do orçamento disponível
- Tipos de campanha a considerar: TOF (aquisição), Remarketing (catálogo ou custom), Testes (criativos/produtos), Duplicação de vencedores
- Cada campanha planejada deve ter: produto específico, orçamento diário, público-alvo, tipo de funil
- Proibido criar campanhas de remarketing com apenas 1 anúncio — mínimo 2 variações

## REGRAS ESTRUTURAIS OBRIGATÓRIAS (INVIOLÁVEIS)

### 1. CRIATIVOS DIFERENTES POR FUNIL (NÃO REUTILIZAR)
- Campanhas de REMARKETING (BOF/MOF) NUNCA devem usar os mesmos criativos e copys das campanhas de VENDA DIRETA (TOF)
- Motivo: O público de remarketing já viu os anúncios de aquisição. Se virem o mesmo criativo/copy, a taxa de conversão cai drasticamente.
- Na prática: Ao gerar criativos (generate_creative), use funnel_stage="tof" para aquisição e funnel_stage="bof" para remarketing
- Copys de remarketing devem abordar: objeções ("ainda pensando?"), urgência ("últimas unidades"), prova social, benefícios complementares
- Copys de aquisição (TOF) devem abordar: gancho de atenção, benefício principal, curiosidade, transformação
- NUNCA copie primary_texts ou headlines de campanhas TOF para campanhas BOF — escreva copys NOVAS com ângulos diferentes

### 2. CAMPANHAS DE TESTE: 1 CONJUNTO POR ANÚNCIO (ABO) — OBRIGATÓRIO no campo adsets[]
- Em campanhas de TESTE, cada anúncio DEVE estar em seu próprio conjunto de anúncios (Ad Set)
- Use ABO (Ad Set Budget Optimization) em vez de CBO para forçar orçamento igual por anúncio
- Motivo: Evita que a Meta concentre o orçamento em um único anúncio, invalidando o teste
- Se o teste tem 3 variações e budget de R$ 125, cada adset terá R$ 41,67/dia
- NO PLANO (planned_actions): declare CADA conjunto individualmente no array adsets[], com budget_brl = budget_total ÷ nº variações
- Exemplo: adsets = [{adset_name: "CJ1 - Fast Upgrade Ângulo A", ads_count: 1, budget_brl: 41.67}, {adset_name: "CJ2 - Shampoo Ângulo B", ads_count: 1, budget_brl: 41.67}, ...]

### 3. VENDA DIRETA (NÃO-TESTE): MÚLTIPLOS PÚBLICOS — OBRIGATÓRIO no campo adsets[]
- Campanhas de venda direta (TOF, não-teste) DEVEM ter múltiplos conjuntos de anúncios com PÚBLICOS DIFERENTES
- Os anúncios podem ser os mesmos em cada conjunto, mas os públicos (targeting) devem ser diferentes
- Motivo: Testar qual público converte melhor para o mesmo produto, ampliando o alcance qualificado
- Públicos sugeridos: Broad (amplo), Interesses específicos, Lookalikes, Custom Audiences
- Mínimo de 2 conjuntos por campanha de venda direta, idealmente 3-4 quando há budget suficiente
- Use os públicos disponíveis na conta (Custom Audiences, Lookalikes) como base para segmentação
- NO PLANO (planned_actions): declare CADA conjunto no array adsets[], com audience_type e audience_description específicos
- Exemplo: adsets = [{adset_name: "CJ1 - Broad", audience_type: "broad", audience_description: "Homens 30-65 BR sem segmentação", ads_count: 3}, {adset_name: "CJ2 - LAL 1% compradores", audience_type: "lookalike", audience_description: "Lookalike 1% COMPRA 180D", ads_count: 3}]

### 3b. REMARKETING (BOF): SEGMENTOS SEPARADOS — OBRIGATÓRIO no campo adsets[]
- Campanhas de remarketing DEVEM ter conjuntos separados por temperatura de audiência
- Exemplo de adsets: Visitantes 14d (mais frio), ATC 7d (quente), IC 7d (mais quente) — EXCLUINDO compradores recentes
- NO PLANO (planned_actions): declare cada segmento como um conjunto separado no array adsets[]

### 4. URL DE DESTINO (destination_url)
- SEMPRE use a URL real do produto (ex: loja.exemplo.com/produto/slug-do-produto)
- NUNCA use UUIDs na URL — use o slug do produto
- Se não houver URL da loja configurada, use o caminho relativo (/produto/slug)
- Inclua UTM params para rastreamento correto

${buildMetaProductionConfigBlock(context?.metaProductionConfigsByAccount?.[config.ad_account_id])}

${triggerInstruction}

## NEGÓCIO
- Ticket Médio: R$ ${(context.orderStats.avg_ticket_cents).toFixed(2)}
- Pedidos 30d: ${context.orderStats.paid_30d} (receita: R$ ${(context.orderStats.revenue_cents_30d).toFixed(2)})
- Catálogo Completo (${context.products.length} produtos ativos):
${context.products.map((p: any) => `  • ${p.name} — R$${Number(p.price).toFixed(2)}${p.cost_price ? ` (margem ~${Math.round(((p.price - p.cost_price) / p.price) * 100)}%)` : ""}${p.stock_quantity != null ? ` [estoque: ${p.stock_quantity}]` : ""}`).join("\n")}

⚠️ IMPORTANTE: A prioridade de produtos para campanhas é definida EXCLUSIVAMENTE pelo Prompt Estratégico do lojista (user_instructions). NÃO use a ordem do catálogo acima como indicador de importância. O catálogo é apenas referência de preços e estoque.`;

  // Build ads data per account
  const accountAds = context.ads?.filter((a: any) => a.ad_account_id === config.ad_account_id) || [];

  // === COMPACT TABULAR FORMAT (v1.33.0) ===
  // Instead of JSON, use TSV-like format to fit ALL data in fewer tokens
  
  // Helper: format currency from cents
  const fmtCents = (v: any) => v != null ? (Number(v) / 100).toFixed(2) : "-";
  const fmtNum = (v: any) => v != null ? String(v) : "-";
  const fmtPct = (v: any) => v != null ? Number(v).toFixed(2) + "%" : "-";
  
  // CAMPAIGNS - ALL of them in compact format (v1.35.0: added Freq, CPM, PageView, ATC, IC)
  const campaignHeaders = "ID | Nome | Status | EffStatus | Objetivo | Budget/dia | ROAS30d | CPA30d | Spend30d | Conv30d | CTR30d | Freq30d | CPM30d | PV30d | ATC30d | IC30d | ROAS7d | CPA7d | Spend7d | Conv7d | CTR7d | Freq7d";
  const campaignRows = campaignData.map((c: any) => {
    const p30 = c.perf_30d || {};
    const p7 = c.perf_7d || {};
    return `${c.id} | ${c.name} | ${c.status} | ${c.effective_status} | ${c.objective || "-"} | ${fmtCents(c.budget_cents)} | ${fmtNum(p30.roas)} | ${fmtCents(p30.cpa)} | ${fmtNum(p30.spend)} | ${fmtNum(p30.conversions)} | ${fmtPct(p30.ctr)} | ${fmtNum(p30.frequency)} | ${fmtCents(p30.cpm)} | ${fmtNum(p30.page_views)} | ${fmtNum(p30.atc)} | ${fmtNum(p30.ic)} | ${fmtNum(p7.roas)} | ${fmtCents(p7.cpa)} | ${fmtNum(p7.spend)} | ${fmtNum(p7.conversions)} | ${fmtPct(p7.ctr)} | ${fmtNum(p7.frequency)}`;
  }).join("\n");

  // ADSETS - Smart filter: ALL from active campaigns + top from paused (v1.34.0)
  const activeCampaignIds = new Set(activeCampaigns.map((c: any) => c.meta_campaign_id || c.id));
  const activeAdsets = accountAdsets.filter((as: any) => activeCampaignIds.has(as.meta_campaign_id));
  const pausedAdsets = accountAdsets.filter((as: any) => !activeCampaignIds.has(as.meta_campaign_id));
  // Keep top 50 paused adsets by name relevance (most recent usually)
  const selectedPausedAdsets = pausedAdsets.slice(0, 50);
  const filteredAdsets = [...activeAdsets, ...selectedPausedAdsets];
  
  const adsetHeaders = "ID | Nome | Status | EffStatus | CampaignID | BudgetDia | BudgetLife | OptGoal | BillingEvt | BidCents";
  const adsetRows = filteredAdsets.map((as: any) => 
    `${as.meta_adset_id} | ${as.name} | ${as.status} | ${as.effective_status} | ${as.meta_campaign_id} | ${fmtCents(as.daily_budget_cents)} | ${fmtCents(as.lifetime_budget_cents)} | ${as.optimization_goal || "-"} | ${as.billing_event || "-"} | ${fmtNum(as.bid_amount_cents)}`
  ).join("\n");

  // ADS - Smart filter: ALL from active campaigns + top from paused (v1.34.0)
  const activeAdsetIds = new Set(activeAdsets.map((as: any) => as.meta_adset_id));
  const activeAds = accountAds.filter((ad: any) => activeAdsetIds.has(ad.meta_adset_id) || activeCampaignIds.has(ad.meta_campaign_id));
  const pausedAds = accountAds.filter((ad: any) => !activeAdsetIds.has(ad.meta_adset_id) && !activeCampaignIds.has(ad.meta_campaign_id));
  const selectedPausedAds = pausedAds.slice(0, 50);
  const filteredAds = [...activeAds, ...selectedPausedAds];
  
  const adHeaders = "ID | Nome | Status | EffStatus | AdSetID | CampaignID";
  const adRows = filteredAds.map((ad: any) => 
    `${ad.meta_ad_id} | ${ad.name} | ${ad.status} | ${ad.effective_status} | ${ad.meta_adset_id} | ${ad.meta_campaign_id}`
  ).join("\n");

  // AUDIENCES - ALL
  const audienceHeaders = "ID | Nome | Tipo | Subtipo | Tamanho";
  const audienceRows = accountAudiences.map((a: any) => 
    `${a.meta_audience_id} | ${a.name} | ${a.audience_type || "-"} | ${a.subtype || "-"} | ${fmtNum(a.approximate_count)}`
  ).join("\n");

  // PRODUCTS - compact
  const productRows = context.products.slice(0, 20).map((p: any) => {
    const margin = p.cost_price ? Math.round(((p.price - p.cost_price) / p.price) * 100) : null;
    const imgs = ((context.imagesByProduct || {})[p.id] || []).slice(0, 2);
    const url = context.storeUrl ? `${context.storeUrl}/produto/${p.slug || p.id}` : null;
    return `• ${p.name} — R$${Number(p.price).toFixed(2)}${margin ? ` (margem ~${margin}%)` : ""}${p.stock_quantity != null ? ` [est:${p.stock_quantity}]` : ""} | ${p.brand || "-"} | ${url || "-"}${imgs.length ? ` | imgs: ${imgs.join(", ")}` : ""}`;
  }).join("\n");

  // Onda F — Bloco de Aprendizados ATIVOS da IA (somente os que o usuário ativou).
  const learningsBlock = (() => {
    const ll = (context.activeLearnings || []) as any[];
    if (!ll.length) return "";
    const lines = ll.map((l, i) => `${i + 1}. [${l.category}] ${l.title}${l.description ? ` — ${l.description}` : ""} (confiança ${Math.round(Number(l.confidence) * 100)}%, ${l.evidence_count} evidências)`).join("\n");
    return `\n## APRENDIZADOS ATIVOS DA IA (${ll.length}) — REGRAS APROVADAS PELO USUÁRIO, RESPEITE:\n${lines}\n`;
  })();

  const user = `## CAMPANHAS (${campaignData.length} total: ${activeCampaigns.length} ativas, ${pausedCampaigns.length} pausadas)
${campaignHeaders}
${campaignRows}
${learningsBlock}

## CONJUNTOS DE ANÚNCIOS (${filteredAdsets.length} exibidos de ${accountAdsets.length} total — ${activeAdsets.length} em campanhas ativas)
⚠️ Quando campanha não tem budget/dia, o orçamento está no nível do conjunto (ABO). Verifique antes de concluir falta de orçamento.
${adsetHeaders}
${adsetRows}

## ANÚNCIOS (${filteredAds.length} exibidos de ${accountAds.length} total — ${activeAds.length} em campanhas ativas)
${adHeaders}
${adRows}

## PÚBLICOS DISPONÍVEIS (${accountAudiences.length})
${audienceHeaders}
${audienceRows}

## PRODUTOS DO CATÁLOGO (${context.products.length})
${productRows}

## CADÊNCIA DE CRIATIVOS (últimos 7d)
${JSON.stringify(creativeCadence, null, 2)}

## AÇÕES DA SEMANA
Pausas: ${actionsSummary.pauses} | Ajustes budget: ${actionsSummary.budget_adjustments} | Campanhas criadas: ${actionsSummary.campaigns_created} | Criativos gerados: ${actionsSummary.creatives_generated}

## EXPERIMENTOS ATIVOS
${context.experiments.filter((e: any) => e.status === "active").length > 0 ? JSON.stringify(context.experiments.filter((e: any) => e.status === "active"), null, 2) : "Nenhum"}

Execute o pipeline completo de 5 fases. Use strategic_plan para o diagnóstico, depois as tools operacionais.`;

  // ============ Onda G — Blocos determinísticos anexados ao prompt ============
  // Calculados sem IA, sem rede. Servem como FONTE DE VERDADE numérica para
  // a IA não inventar orçamento ocupado, identificação de produto, fit etc.
  let ondaGBlock = "";
  try {
    const totalDailyCents = Number(config.budget_cents || 0);
    const funnelSplits = (config.funnel_splits as any) || null;
    const campaignBudgetInputs = accountCampaigns.map((c: any) => ({
      id: c.meta_campaign_id,
      name: c.name || c.meta_campaign_id,
      status: (c.status || c.effective_status || "").toUpperCase(),
      daily_budget_cents: Number(c.daily_budget_cents || 0),
      objective: c.objective || null,
    }));
    const funnelBudgetState: FunnelBudgetState = computeFunnelBudgetState({
      totalDailyCents,
      funnelSplits,
      campaigns: campaignBudgetInputs,
    });

    // Identificação determinística de produto por campanha existente.
    const catalogRefs = (context.products || []).map((p: any) => ({ id: p.id, name: p.name, slug: p.slug || null }));
    const adsetsByCampaign: Record<string, any[]> = {};
    for (const as of accountAdsets) {
      const cid = as.meta_campaign_id;
      if (!cid) continue;
      (adsetsByCampaign[cid] ||= []).push(as);
    }
    const productIdentifications: Array<{ campaign_id: string; campaign_name: string } & InferredProduct> = [];
    for (const c of accountCampaigns) {
      const cid = c.meta_campaign_id;
      const sets = adsetsByCampaign[cid] || [];
      const inf = identifyProductFromCampaign(
        {
          id: cid,
          name: c.name,
          adset_names: sets.map((s: any) => s.name).filter(Boolean),
          ad_names: [],
          destination_urls: [],
          copy_texts: [],
          creative_product_ids: [],
        },
        catalogRefs,
      );
      productIdentifications.push({ campaign_id: cid, campaign_name: c.name || cid, ...inf });
    }

    // Audience Budget Fit Lite por campanha (a partir do perf 30d).
    const fits: Array<{ campaign_id: string; campaign_name: string } & AudienceBudgetFitResult> = [];
    for (const c of accountCampaigns) {
      const p30 = context.perf30d[c.meta_campaign_id] || {};
      const fit = evaluateAudienceBudgetFit({
        current_daily_budget_cents: Number(c.daily_budget_cents || 0),
        impressions_30d: p30.impressions || 0,
        reach_30d: p30.reach || 0,
        frequency_avg: p30.frequency || 0,
        cpm_cents: p30.cpm ? Math.round(p30.cpm * 100) : 0,
        ctr_pct: p30.ctr_pct || 0,
        conversions_30d: p30.conversions || 0,
        cpa_cents: p30.cpa_cents || 0,
        roas: p30.roas || 0,
        spend_30d_cents: p30.spend || 0,
      });
      fits.push({ campaign_id: c.meta_campaign_id, campaign_name: c.name || c.meta_campaign_id, ...fit });
    }

    // Disponibilidade de catálogo Meta — pré-computada no contexto.
    const catalogInfo = (context.catalogAvailabilityByAccount || {})[config.ad_account_id]
      || { available: false, catalog_id: null, catalog_name: null };
    const catalogAvailability = catalogInfo.available
      ? `conectado (${catalogInfo.catalog_name || catalogInfo.catalog_id})`
      : "não detectado";

    // Disponibilidade do público de Clientes — pré-computada no contexto.
    const customerAudienceAvailability = (context.customerAudienceByAccount || {})[config.ad_account_id]
      || { found: false, meta_audience_id: null, audience_name: null };

    const lines: string[] = [];
    lines.push("\n\n## ONDA G — DADOS DETERMINÍSTICOS (FONTE DE VERDADE, NÃO INVENTAR)");
    lines.push("Use EXATAMENTE os números abaixo no diagnóstico e em planned_actions. Não recalcule.");
    lines.push("");
    lines.push("### ESTADO DO ORÇAMENTO POR FUNIL (planejado / ocupado / livre)");
    lines.push(formatFunnelBudgetStatePtBr(funnelBudgetState));
    lines.push("");
    lines.push("### REGRA SEQUENCIAL DE ORÇAMENTO");
    lines.push("- Criar/escalar só pode usar orçamento `livre` do funil naquele momento.");
    lines.push("- Para usar mais que o `livre`, declare antes uma ação de pausar/reduzir no MESMO funil e referencie-a no campo `references_release_from_action_index`.");
    lines.push("- NUNCA trate orçamento futuro como livre antes da liberação sequencial.");
    lines.push("- Espelhe os números em `funnel_budget_state` no strategic_plan.");
    lines.push("");
    lines.push("### IDENTIFICAÇÃO DE PRODUTO POR CAMPANHA EXISTENTE");
    if (productIdentifications.length === 0) {
      lines.push("(nenhuma campanha existente)");
    } else {
      for (const pi of productIdentifications.slice(0, 30)) {
        lines.push(`- ${pi.campaign_name} → ${pi.inferred_product_name || "—"} (confiança=${pi.product_identification_confidence}, fonte=${pi.inferred_product_source || "—"})${pi.diagnosis_limitation ? " | LIMITAÇÃO: " + pi.diagnosis_limitation : ""}`);
      }
    }
    lines.push("");
    lines.push("- Se confiança = low ou unknown: declare a limitação no diagnóstico e NÃO sugira pausa como ação principal. Permitidas: manter, reduzir com aviso, ou solicitar revisão do usuário.");
    lines.push("");
    lines.push("### AUDIENCE BUDGET FIT (histórico 30d — Lite, sem delivery_estimate)");
    if (fits.length === 0) {
      lines.push("(sem dados)");
    } else {
      for (const f of fits.slice(0, 30)) {
        lines.push(`- ${f.campaign_name} → fit=${f.fit}${f.suggested_budget_range_cents ? ` | sugestão R$ ${(f.suggested_budget_range_cents.min_cents/100).toFixed(2)}–${(f.suggested_budget_range_cents.max_cents/100).toFixed(2)}/dia` : ""} | ${f.explanation}`);
      }
    }
    lines.push("");
    lines.push(`### CATÁLOGO META: ${catalogAvailability}`);
    lines.push(`### PÚBLICO DE CLIENTES (exclusão fria): ${customerAudienceAvailability.found ? "detectado" : "NÃO detectado"}`);
    lines.push("");
    lines.push("### REGRAS DE CONTEÚDO DO PLANO (OBRIGATÓRIAS)");
    lines.push("- Para cada ação que crie/escale campanha de público frio, preencha `audience_exclusions.customers=true` e `audience_exclusions.reason`.");
    lines.push("- Se o público de Clientes NÃO foi detectado, marque `audience_exclusions.pending_dependency='customer_audience_missing'`.");
    lines.push("- Para campanha de catálogo, use `campaign_type` começando com `catalog_` e preencha `catalog_setup` (catálogo + product_set + janela + exclude_recent_buyers_days + creative_mode='dynamic'). Se o catálogo não foi detectado, marque `catalog_setup.pending_dependency='catalog_not_connected'` em vez de inventar IDs.");
    lines.push("- Para teste criativo, defina `campaign_intent='creative_test'`. Se incluir clientes, preencha `exclusion_override_reason` com justificativa.");
    lines.push("- Para ações sobre campanhas existentes com produto de baixa confiança, copie `product_identification_confidence` da lista acima e NUNCA sugira pausa direta — proponha manter, reduzir ou revisar.");
    lines.push("- Referencie `audience_budget_fit` sempre que mexer em orçamento.");

    ondaGBlock = lines.join("\n");

    // Onda G (rev2) — montar Preflight estruturado e guardar no context para o
    // handler do strategic_plan rodar o validador de contrato.
    try {
      const perfByCampaign: Record<string, any> = {};
      for (const c of accountCampaigns) {
        const cid = c.meta_campaign_id;
        const p30 = context.perf30d?.[cid] || {};
        const p7 = context.perf7d?.[cid] || {};
        perfByCampaign[cid] = {
          impressions_30d: p30.impressions || 0,
          reach_30d: p30.reach || 0,
          frequency_avg: p30.frequency || 0,
          cpm_cents: p30.cpm ? Math.round(p30.cpm * 100) : 0,
          ctr_pct: p30.ctr_pct || 0,
          conversions_30d: p30.conversions || 0,
          cpa_cents: p30.cpa_cents || 0,
          roas_30d: p30.roas || null,
          roas_7d: p7.roas || null,
          spend_30d_cents: p30.spend || 0,
          spend_7d_cents: p7.spend || 0,
        };
      }
      const adsByCampaign: Record<string, any[]> = {};
      const preflight: StrategicPlanPreflight = buildStrategicPlanPreflightContext({
        ad_account_id: config.ad_account_id,
        total_daily_cents: totalDailyCents,
        funnel_splits: (funnelSplits as any) || null,
        campaigns: campaignBudgetInputs,
        perf_by_campaign: perfByCampaign,
        adsets_by_campaign: adsetsByCampaign,
        ads_by_campaign: adsByCampaign,
        catalog_refs: catalogRefs,
        customer_audience: customerAudienceAvailability,
        catalog: catalogInfo
          ? {
              available: !!catalogInfo.available,
              catalog_id: catalogInfo.catalog_id || null,
              catalog_name: catalogInfo.catalog_name || null,
              product_sets: (catalogInfo as any).product_sets || [],
            }
          : null,
      });
      (context as any).strategicPreflightByAccount ||= {};
      (context as any).strategicPreflightByAccount[config.ad_account_id] = preflight;
    } catch (e: any) {
      console.warn(`[ads-autopilot-strategist][onda-g] preflight build failed (fail-open): ${e?.message}`);
    }
  } catch (e: any) {
    console.warn(`[ads-autopilot-strategist][onda-g] context block failed (fail-open): ${e?.message}`);
  }

  return { system: system + ondaGBlock, user };
}

// ============ BUILD TIKTOK STRATEGIST PROMPT ============

function buildTikTokStrategistPrompt(trigger: StrategistTrigger, config: AccountConfig, context: any) {
  const accountCampaigns = context.tiktokCampaigns.filter((c: any) => c.advertiser_id === config.ad_account_id);
  const activeCampaigns = accountCampaigns.filter((c: any) => c.status === "ENABLE"); // TikTok status is ENABLE/DISABLE
  const pausedCampaigns = accountCampaigns.filter((c: any) => c.status === "DISABLE");

  // Aggregate insights (7d)
  const perf7d: Record<string, any> = {};
  for (const ins of context.tiktokInsights) {
    const cid = ins.tiktok_campaign_id;
    if (!perf7d[cid]) perf7d[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    perf7d[cid].spend += (ins.spend_cents || 0);
    perf7d[cid].impressions += ins.impressions || 0;
    perf7d[cid].clicks += ins.clicks || 0;
    perf7d[cid].conversions += ins.conversions || 0;
    perf7d[cid].revenue += (ins.conversion_value_cents || 0);
  }

  const campaignRows = accountCampaigns.map((c: any) => {
    const p = perf7d[c.tiktok_campaign_id] || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    const spendVal = p.spend / 100;
    const roas = spendVal > 0 ? (p.revenue / 100 / spendVal).toFixed(2) : "0.00";
    const cpa = p.conversions > 0 ? (spendVal / p.conversions).toFixed(2) : "N/A";
    const ctr = p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(2) : "0.00";
    const budgetVal = (c.budget_cents || 0) / 100;
    
    return `| ${c.tiktok_campaign_id} | ${c.name.substring(0, 30)} | ${c.status} | ${c.objective_type} | R$${budgetVal} | R$${spendVal.toFixed(2)} | ${roas}x | R$${cpa} | ${p.conversions} | ${ctr}% |`;
  }).join("\n");

  const campaignHeaders = `| ID | Nome | Status | Objetivo | Budget | Gasto(7d) | ROAS | CPA | Conv | CTR |
|---|---|---|---|---|---|---|---|---|---|`;

  const triggerInstruction = trigger === "start" 
    ? `## GATILHO: PRIMEIRA ATIVAÇÃO (START)
Analise profundamente o histórico da conta. Identifique o que funcionou e o que falhou.
Proponha uma estrutura inicial sólida para TikTok Ads, focando em criativos nativos (UGC, dinâmicos).
Se não houver histórico, proponha testes de criativos (fase de aprendizado).`
    : `## GATILHO: ${trigger.toUpperCase()}
Analise a performance recente (7 dias). Pause campanhas com CPA alto ou ROAS baixo.
Escale o que está funcionando (aumente budget se ROAS > meta).
Proponha novos criativos se houver fadiga (CTR caindo).`;

  const system = `Você é o Motor Estrategista do TikTok Ads.
Sua missão é maximizar conversões e ROAS para o anunciante ${config.ad_account_id}.

## CONTEXTO DA LOJA
- Produtos: ${context.products.length} (top: ${context.products.slice(0, 3).map((p: any) => p.name).join(", ")})
- Orçamento Disponível: R$ ${(config.budget_cents || 0) / 100} (${config.budget_mode})
- ROI Alvo: ${config.target_roi || "N/A"} | Min Frio: ${config.min_roi_cold || 0.8}
- Estratégia: ${config.strategy_mode || "balanced"}

## DIRETRIZES TIKTOK ADS
- Criativos: TikTok é "Sound On". Vídeos dinâmicos, UGC, música em alta. Estática funciona menos.
- Estrutura: Campanha (Objetivo) → Ad Group (Público/Budget) → Ads (Criativos).
- Orçamento: Mínimo R$ 20,00/dia por Ad Group.
- Objetivos: WEB_CONVERSIONS (vendas) ou PRODUCT_SALES (catálogo/VSA).
- Funil: Separe TOF (frio) de BOF (remarketing/retargeting).
- Aprendizado: TikTok precisa de ~50 conversões/semana por Ad Group para estabilizar.

## SUAS FERRAMENTAS (TIKTOK)
- create_tiktok_campaign: Cria estrutura completa.
- toggle_tiktok_status: Pausa/Ativa entidades.
- update_tiktok_budget: Ajusta investimento.
- strategic_plan: Emite o plano tático.

${triggerInstruction}

Responda SEMPRE em Português do Brasil.`;

  const user = `## CAMPANHAS EXISTENTES (${accountCampaigns.length})
${campaignHeaders}
${campaignRows || "Nenhuma campanha encontrada."}

## PRODUTOS DISPONÍVEIS
${context.products.slice(0, 10).map((p: any) => `- ${p.name} (R$ ${p.price})`).join("\n")}

Analise os dados e execute as ações necessárias para TikTok Ads.`;

  return { system, user };
}

// ============ BUILD GOOGLE STRATEGIST PROMPT ============

function buildGoogleStrategistPrompt(trigger: StrategistTrigger, config: AccountConfig, context: any) {
  const googleCampaigns = (context.googleCampaigns || []).filter((c: any) => c.ad_account_id === config.ad_account_id);
  const googleAdGroups = (context.googleAdGroups || []).filter((ag: any) => ag.ad_account_id === config.ad_account_id);
  const googleAds = (context.googleAds || []).filter((ad: any) => ad.ad_account_id === config.ad_account_id);
  const googleKeywords = (context.googleKeywords || []).filter((kw: any) => kw.ad_account_id === config.ad_account_id);
  const googleAssets = (context.googleAssets || []).filter((a: any) => a.ad_account_id === config.ad_account_id);

  const activeCampaigns = googleCampaigns.filter((c: any) => c.status === "ENABLED");
  const pausedCampaigns = googleCampaigns.filter((c: any) => c.status === "PAUSED");

  const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.google;
  const budgetAdjustable = canAdjustBudget(config);

  const fmtMicros = (v: any) => v != null ? (Number(v) / 1_000_000).toFixed(2) : "-";

  // Campaign table
  const campaignHeaders = "ID | Nome | Status | Tipo | Estratégia | Budget/dia (R$) | CPA Alvo | ROAS Alvo | Otimização";
  const campaignRows = googleCampaigns.map((c: any) =>
    `${c.google_campaign_id} | ${c.name} | ${c.status} | ${c.campaign_type || "-"} | ${c.bidding_strategy_type || "-"} | ${fmtMicros(c.budget_amount_micros)} | ${fmtMicros(c.target_cpa_micros)} | ${c.target_roas ?? "-"} | ${c.optimization_score ?? "-"}`
  ).join("\n");

  // Ad Groups table
  const adGroupHeaders = "ID | Nome | Status | Tipo | CampaignID | CPC Max (R$)";
  const adGroupRows = googleAdGroups.map((ag: any) =>
    `${ag.google_ad_group_id} | ${ag.name} | ${ag.status} | ${ag.type || "-"} | ${ag.google_campaign_id} | ${fmtMicros(ag.cpc_bid_micros)}`
  ).join("\n");

  // Ads table
  const adHeaders = "ID | Nome | Tipo | Status | AdGroupID | Headlines | Descriptions";
  const adRows = googleAds.slice(0, 100).map((ad: any) => {
    const hl = Array.isArray(ad.headlines) ? ad.headlines.slice(0, 3).join("; ") : "-";
    const desc = Array.isArray(ad.descriptions) ? ad.descriptions.slice(0, 2).join("; ") : "-";
    return `${ad.google_ad_id} | ${ad.name || ad.ad_type} | ${ad.ad_type || "-"} | ${ad.status} | ${ad.google_ad_group_id} | ${hl} | ${desc}`;
  }).join("\n");

  // Keywords table
  const kwHeaders = "ID | Texto | Match | Status | QS | CPC Max (R$) | AdGroupID";
  const kwRows = googleKeywords.slice(0, 200).map((kw: any) =>
    `${kw.google_keyword_id} | ${kw.text} | ${kw.match_type} | ${kw.status} | ${kw.quality_score ?? "-"} | ${fmtMicros(kw.cpc_bid_micros)} | ${kw.google_ad_group_id}`
  ).join("\n");

  let triggerInstruction = "";
  switch (trigger) {
    case "start":
      triggerInstruction = `## TRIGGER: PRIMEIRA ATIVAÇÃO — PLANEJAMENTO ESTRATÉGICO GOOGLE ADS
Emita APENAS um strategic_plan. NÃO crie campanhas, ad groups ou anúncios agora.
O plano deve cobrir 100% do orçamento disponível (R$ ${((config.budget_cents || 0) / 100).toFixed(2)}/dia).

Analise:
1. Campanhas existentes (ativas e pausadas) e performance histórica
2. Tipos de campanha recomendados (Search, PMax, Display, Shopping)
3. Palavras-chave de alto potencial para Search
4. Estrutura de Ad Groups ideal
5. Alocação de orçamento por tipo de campanha

{{DEEP_HISTORICAL_DATA}}`;
      break;
    case "weekly":
      triggerInstruction = `## TRIGGER: REVISÃO SEMANAL GOOGLE ADS
Revise performance 7d. Proponha ajustes:
1. Quality Scores baixos → otimizar anúncios ou pausar keywords
2. Keywords sem conversão → pausar
3. Ad Groups com CTR < 1% → revisar anúncios
4. Budget mal distribuído → redistribuir`;
      break;
    case "monthly":
      triggerInstruction = `## TRIGGER: REVISÃO MENSAL GOOGLE ADS
Emita um strategic_plan completo para o próximo mês. Analise 30d de dados.`;
      break;
    case "implement_approved_plan":
      triggerInstruction = `## TRIGGER: IMPLEMENTAÇÃO DE PLANO GOOGLE — FASE 1
Crie as campanhas, ad groups, keywords e anúncios conforme o plano aprovado.
{{APPROVED_PLAN_CONTENT}}
Execute TODAS as ações usando create_google_campaign, create_google_ad_group, create_google_keyword e create_google_ad.`;
      break;
    case "implement_campaigns":
      triggerInstruction = `## TRIGGER: IMPLEMENTAÇÃO GOOGLE — FASE 2
{{APPROVED_PLAN_CONTENT}}
Continue a implementação conforme o plano. Execute TODAS as ações pendentes.`;
      break;
  }

  const storeName = context.storeSettings?.store_name || context.tenant?.name || "Loja";
  const storeDescription = context.storeSettings?.store_description || "";

  const system = `Você é o Motor Estrategista do Autopilot de Tráfego — canal GOOGLE ADS.

## LOJA / MARCA
- Nome: ${storeName}
- Descrição: ${storeDescription || "Não informada"}
- URL: ${context.storeUrl || "Não configurada"}

## CONTA GOOGLE ADS: ${config.ad_account_id}
- Orçamento: R$ ${((config.budget_cents || 0) / 100).toFixed(2)} / ${config.budget_mode || "monthly"}
- ROI Alvo: ${config.target_roi || "N/D"}x
- Estratégia: ${config.strategy_mode || "balanced"}
- Pode ajustar budget: ${budgetAdjustable ? "SIM" : "NÃO"}

## INSTRUÇÕES DO USUÁRIO
${config.user_instructions || "Nenhuma."}

## REGRAS GOOGLE ADS
- Campanhas criadas sempre PAUSADAS
- Hierarquia: Campanha → Ad Group → Keywords + Ads
- Search: RSA com 3-15 headlines (30 chars) e 2-4 descriptions (90 chars)
- PMax: Requer assets (imagens, textos, vídeos)
- Budget em micros (R$ 1 = 1.000.000 micros)
- Keywords: Use EXACT e PHRASE para maior controle. BROAD apenas com dados suficientes.
- Quality Score: Monitorar e otimizar (>7 bom, <5 ação necessária)
- NUNCA delete campanhas — apenas pause
- Responda SEMPRE em Português do Brasil

## PRODUTOS DO CATÁLOGO (${context.products.length})
${context.products.slice(0, 20).map((p: any) => {
    const url = context.storeUrl ? `${context.storeUrl}/produto/${p.slug || p.id}` : null;
    return `• ${p.name} — R$${Number(p.price).toFixed(2)}${p.stock_quantity != null ? ` [est:${p.stock_quantity}]` : ""} | ${url || "-"}`;
  }).join("\n")}

${triggerInstruction}`;

  const user = `## CAMPANHAS GOOGLE (${googleCampaigns.length} total: ${activeCampaigns.length} ativas, ${pausedCampaigns.length} pausadas)
${campaignHeaders}
${campaignRows || "Nenhuma campanha"}

## GRUPOS DE ANÚNCIOS (${googleAdGroups.length})
${adGroupHeaders}
${adGroupRows || "Nenhum grupo"}

## ANÚNCIOS (${googleAds.length})
${adHeaders}
${adRows || "Nenhum anúncio"}

## PALAVRAS-CHAVE (${googleKeywords.length})
${kwHeaders}
${kwRows || "Nenhuma keyword"}

## ASSETS (${googleAssets.length})
${googleAssets.slice(0, 50).map((a: any) => `- ${a.name || a.asset_type} [${a.status}] tipo=${a.asset_type}`).join("\n") || "Nenhum asset"}

Execute o pipeline para Google Ads.`;

  return { system, user };
}

// ============ EXECUTE TOOL CALLS ============

async function executeToolCall(
  supabase: any,
  tenantId: string,
  sessionId: string,
  config: AccountConfig,
  tc: any,
  context: any
): Promise<{ status: string; data?: any }> {
  const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
  const toolName = tc.function.name;
  // Fase C.1: bypass de `human_approval_mode='auto'` neutralizado.
  // Enquanto `autonomy_mode` não existir, nenhuma execução automática nova é
  // disparada por causa do modo antigo de aprovação. Toda ação técnica cai em
  // pending_approval e seguirá o caminho normal de aprovação humana.
  const isAutoMode = false;

  if (toolName === "strategic_plan") {
    // Build preview text from structured actions
    const actionsPreview = (args.planned_actions || []).map((a: any) => {
      if (typeof a === "string") return `• ${a}`;
      return `• [${a.campaign_type || "Ação"}] ${a.product_name || ""} — R$ ${a.daily_budget_brl || "?"}/dia — ${a.target_audience || ""} (${a.rationale || ""})`;
    }).join("\n");
    const planBody = args.diagnosis + "\n\n**Ações Planejadas:**\n" + actionsPreview + "\n\n**Resultados Esperados:** " + (args.expected_results || "") + "\n\n**Riscos:** " + (args.risk_assessment || "");

    // Onda G (rev2) — Validar contrato do plano contra o Preflight determinístico.
    let contract: any = null;
    let preflightSnapshot: StrategicPlanPreflight | null = null;
    try {
      preflightSnapshot = ((context as any)?.strategicPreflightByAccount || {})[config.ad_account_id] || null;
      if (preflightSnapshot) {
        contract = validateStrategicPlanContract(args, preflightSnapshot);
        if (!contract.ok) {
          console.warn(
            `[ads-autopilot-strategist][plan-contract] INVALID v${PLAN_CONTRACT_VERSION} blockers=${contract.blockers_count} codes=${contract.errors.map((e: any) => e.code).join(",")}`,
          );
        } else {
          console.log(`[ads-autopilot-strategist][plan-contract] OK v${PLAN_CONTRACT_VERSION}`);
        }
      } else {
        contract = {
          ok: false,
          version: PLAN_CONTRACT_VERSION,
          errors: [{ code: "preflight_unavailable", severity: "blocker", message: "Preflight determinístico indisponível — plano não pode ser validado." }],
          blockers_count: 1,
          warnings_count: 0,
        };
      }
    } catch (e: any) {
      console.error(`[ads-autopilot-strategist][plan-contract] validator threw:`, e?.message);
      contract = {
        ok: false,
        version: PLAN_CONTRACT_VERSION,
        errors: [{ code: "contract_validator_error", severity: "blocker", message: `Erro ao validar contrato: ${e?.message || "desconhecido"}` }],
        blockers_count: 1,
        warnings_count: 0,
      };
    }

    return {
      status: "pending_approval",
      data: {
        type: "strategic_plan",
        ad_account_id: config.ad_account_id,
        diagnosis: args.diagnosis,
        planned_actions: args.planned_actions,
        expected_results: args.expected_results,
        risk_assessment: args.risk_assessment,
        timeline: args.timeline,
        budget_allocation: args.budget_allocation,
        funnel_budget_state: args.funnel_budget_state || preflightSnapshot?.funnel_budget_state || null,
        active_campaigns_summary: args.active_campaigns_summary || preflightSnapshot?.active_campaigns_summary || null,
        // Snapshot do Preflight + resultado do contrato (UI bloqueia aprovação se contract.ok === false)
        strategic_plan_preflight: preflightSnapshot,
        contract,
        contract_version: PLAN_CONTRACT_VERSION,
        preview: {
          headline: contract && !contract.ok
            ? "Plano Estratégico — INCOMPLETO (não aprovável)"
            : "Plano Estratégico — Motor Estrategista",
          copy_text: planBody,
          targeting_summary: `${(args.planned_actions || []).length} ações planejadas`,
        },
      },
    };
  }

          if (toolName === "create_tiktok_campaign") {
            return {
              status: isAutoMode ? "executed" : "pending_approval",
              data: {
                ...args,
                ad_account_id: config.ad_account_id,
                preview: {
                  campaign_name: args.campaign_name || `[AI] TikTok | ${args.product_name}`,
                  objective_type: args.objective_type,
                  budget_cents: args.budget_cents,
                  budget_display: `R$ ${(args.budget_cents / 100).toFixed(2)}`,
                  product_name: args.product_name,
                  ad_creative: args.ad_creative,
                }
              }
            };
          }

          if (toolName === "toggle_tiktok_status") {
            const edgeFn = "tiktok-ads-campaigns"; // Generic handler
            try {
              if (isAutoMode) {
                const { error } = await supabase.functions.invoke(edgeFn, {
                  body: { 
                    tenant_id: tenantId, 
                    action: "update_status", 
                    entity_type: args.entity_type,
                    entity_id: args.entity_id,
                    status: args.new_status,
                    advertiser_id: args.advertiser_id
                  },
                });
                if (error) throw error;
                return { status: "executed", data: { message: `Status de ${args.entity_id} alterado para ${args.new_status}` } };
              }
              return { status: "pending_approval", data: { ...args } };
            } catch (err: any) {
              return { status: "failed", data: { error: err.message } };
            }
          }

          if (toolName === "update_tiktok_budget") {
            const edgeFn = "tiktok-ads-campaigns";
            try {
              if (isAutoMode) {
                const { error } = await supabase.functions.invoke(edgeFn, {
                  body: { 
                    tenant_id: tenantId, 
                    action: "update_budget", 
                    entity_type: args.entity_type,
                    entity_id: args.entity_id,
                    budget_cents: args.budget_cents,
                    advertiser_id: args.advertiser_id
                  },
                });
                if (error) throw error;
                return { status: "executed", data: { message: `Budget de ${args.entity_id} alterado para R$ ${(args.budget_cents / 100).toFixed(2)}` } };
              }
              return { status: "pending_approval", data: { ...args } };
            } catch (err: any) {
              return { status: "failed", data: { error: err.message } };
            }
          }

          if (toolName === "generate_creative") {
    // v1.20.0: STRICT matching — NO fallback to products[0] to prevent wrong product images
    const topProduct = context.products.find((p: any) => p.name.trim() === (args.product_name || "").trim());

    // ============ PREFLIGHT generate_creative — evita gasto de crédito ============
    try {
      const gcGate = runGenerateCreativeQualityGate({
        args,
        matchedProduct: topProduct
          ? { id: topProduct.id, name: topProduct.name, price: topProduct.price }
          : null,
        catalog: (context.products || []).map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
      });
      if (!gcGate.ok) {
        console.warn(
          `[ads-autopilot-strategist][${VERSION}] generate_creative BLOCKED by Quality Gate v${gcGate.version}: ${gcGate.reason_codes.join(",")}`,
        );
        return {
          status: "skipped",
          data: {
            ...args,
            quality_gate: {
              ok: false,
              version: gcGate.version,
              reason_codes: gcGate.reason_codes,
              details: gcGate.details,
              blocked_at: new Date().toISOString(),
            },
            reason: `Preflight de criativo bloqueou: ${gcGate.reason_codes.join(", ")}`,
          },
        };
      }
    } catch (gcErr: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] generate_creative gate threw (fail-open):`, gcErr?.message);
    }

    if (!topProduct) {
      console.error(`[ads-autopilot-strategist][${VERSION}] generate_creative: produto "${args.product_name}" NÃO encontrado no catálogo. Rejeitando para evitar imagem genérica.`);
      return { status: "failed", data: { error: `Produto "${args.product_name}" não encontrado no catálogo. Use o nome EXATO do catálogo.` } };
    }

    // v1.28.0: DEDUP — Check if we already have ready creatives for this product + funnel_stage + format
    const requestedFunnel = args.funnel_stage || "tof";
    const requestedFormat = args.format || "1:1";
    
    const { data: existingCreatives } = await supabase
      .from("ads_creative_assets")
      .select("id, asset_url, format, funnel_stage, angle, created_at")
      .eq("tenant_id", tenantId)
      .eq("product_id", topProduct.id)
      .eq("status", "ready")
      .eq("funnel_stage", requestedFunnel)
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Filter by format if specified (some may have different formats)
    const matchingCreatives = (existingCreatives || []).filter((c: any) => 
      !requestedFormat || c.format === requestedFormat || !c.format
    );

    if (matchingCreatives.length >= (args.variations || 3)) {
      console.log(`[ads-autopilot-strategist][${VERSION}] DEDUP: Found ${matchingCreatives.length} existing creatives for "${topProduct.name}" (${requestedFunnel}/${requestedFormat}). Skipping generation.`);
      return { 
        status: "executed", 
        data: { 
          reused: true, 
          reused_count: matchingCreatives.length,
          product_name: topProduct.name,
          creative_urls: matchingCreatives.map((c: any) => c.asset_url),
          message: `Reutilizados ${matchingCreatives.length} criativos existentes para "${topProduct.name}" (${requestedFunnel}). Nenhuma geração necessária.`
        } 
      };
    }

    // Resolve product image URL
    let productImageUrl: string | null = null;
    if (topProduct.images) {
      const images = Array.isArray(topProduct.images) ? topProduct.images : [];
      const firstImg = images[0];
      productImageUrl = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || null;
    }

    // Calculate how many NEW variations are actually needed
    const existingCount = matchingCreatives.length;
    const neededVariations = Math.max(1, (args.variations || 3) - existingCount);
    
    if (existingCount > 0) {
      console.log(`[ads-autopilot-strategist][${VERSION}] PARTIAL REUSE: ${existingCount} existing, generating ${neededVariations} more for "${topProduct.name}" (${requestedFunnel}/${requestedFormat})`);
    }

    // ============ FRENTE 4 — Etapa 1: NÃO gerar criativo aqui ============
    // Estrategista salva o brief e devolve `deferred=true`. A geração real
    // só acontece quando o usuário clicar "Aprovar e gerar criativos"
    // (edge function ads-autopilot-approve-strategy).
    if (TWO_STEP_ENABLED) {
      const brief = buildCreativeBrief(args, {
        product_id: topProduct.id,
        product_image_url: productImageUrl,
      });
      console.log(`[ads-autopilot-strategist][${VERSION}] two-step: generate_creative DEFERRED for "${topProduct.name}"`);
      return {
        status: "executed",
        data: {
          deferred: true,
          flow_version: TWO_STEP_FLOW_VERSION,
          creative_brief: brief,
          product_name: topProduct.name,
          product_id: topProduct.id,
          message: `Brief salvo. Geração de criativo aguarda aprovação da estratégia.`,
        },
      };
    }

    try {
      const { data: creativeResult, error: creativeErr } = await supabase.functions.invoke("ads-autopilot-creative", {
        body: {
          tenant_id: tenantId,
          session_id: sessionId,
          channel: config.channel,
          product_id: topProduct.id,
          product_name: topProduct.name,
          product_image_url: productImageUrl,
          campaign_objective: args.campaign_objective,
          target_audience: args.target_audience,
          style_preference: args.style_preference || "promotional",
          format: requestedFormat,
          variations: neededVariations,
          funnel_stage: requestedFunnel,
        },
      });
      if (creativeErr) throw creativeErr;
      return { 
        status: "executed", 
        data: { 
          creative_job_id: creativeResult?.data?.job_id, 
          product_name: topProduct.name,
          reused_count: existingCount,
          new_count: neededVariations,
        } 
      };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_lookalike_audience") {
    try {
      // v1.18.0: Dedup — check if a LAL with same source + ratio + country already exists
      const safeRatio = args.ratio || 0.05;
      const safeCountry = args.country || "BR";
      const { data: existingAudiences } = await supabase
        .from("meta_ad_audiences")
        .select("id, meta_audience_id, name, lookalike_spec")
        .eq("tenant_id", tenantId)
        .eq("ad_account_id", config.ad_account_id)
        .eq("audience_type", "lookalike");

      const existingMatch = (existingAudiences || []).find((a: any) => {
        const spec = a.lookalike_spec;
        if (!spec) return false;
        return spec.source === args.source_audience_id 
          && Math.abs((spec.ratio || 0) - safeRatio) < 0.005
          && (spec.country || "BR") === safeCountry;
      });

      if (existingMatch) {
        console.log(`[ads-autopilot-strategist][${VERSION}] LAL dedup: "${existingMatch.name}" (${existingMatch.meta_audience_id}) already exists for source=${args.source_audience_id} ratio=${safeRatio}`);
        return { status: "executed", data: { lookalike_audience_id: existingMatch.meta_audience_id, deduplicated: true, existing_name: existingMatch.name } };
      }

      const metaConn = await getMetaConnectionForTenant(supabase, tenantId);

      if (!metaConn?.access_token) throw new Error("Meta não conectada");

      const accountId = config.ad_account_id.replace("act_", "");
      const lalRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}/customaudiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.lookalike_name,
          subtype: "LOOKALIKE",
          origin_audience_id: args.source_audience_id,
          lookalike_spec: JSON.stringify({ type: "similarity", ratio: safeRatio, country: safeCountry }),
          access_token: metaConn.access_token,
        }),
      });
      const lalResult = await lalRes.json();
      if (lalResult.error) throw new Error(lalResult.error.message);

      await supabase.from("meta_ad_audiences").upsert({
        tenant_id: tenantId,
        meta_audience_id: lalResult.id,
        ad_account_id: config.ad_account_id,
        name: args.lookalike_name,
        audience_type: "lookalike",
        subtype: "LOOKALIKE",
        description: `LAL ${(safeRatio * 100).toFixed(0)}% de ${args.source_audience_name}`,
        lookalike_spec: { ratio: safeRatio, country: safeCountry, source: args.source_audience_id },
        synced_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,meta_audience_id" });

      return { status: "executed", data: { lookalike_audience_id: lalResult.id } };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_campaign") {
    // v1.12.0: Enrich campaign action with resolved product data
    console.log(`[ads-autopilot-strategist][${VERSION}] create_campaign → pending_approval (always)`);

    // v1.45.0 — Resolução robusta: product_id → nome exato → nome normalizado.
    // O matching estrito por nome (v1.14.0) gerava falso-positivo quando o
    // modelo passava product_id correto mas product_name com variação de
    // acento/espaço/caixa, deixando matchedProduct=null e impedindo a
    // auto-resolução de criativo ready (caso real do tenant Respeite o Homem).
    const resolved = resolveProduct({
      args: { product_id: args.product_id, product_name: args.product_name },
      catalog: (context.products || []).map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
    });
    const matchedProduct = resolved
      ? context.products.find((p: any) => p.id === resolved.id) || null
      : null;

    if (args.product_name && !matchedProduct) {
      console.warn(`[ads-autopilot-strategist][${VERSION}] ⚠️ product not resolved (id=${args.product_id || "∅"}, name="${args.product_name}")`);
    }

    // Resolve product image
    let productImageUrl: string | null = null;
    if (matchedProduct) {
      const prodImages = (context.imagesByProduct || {})[matchedProduct.id] || [];
      productImageUrl = prodImages[0]?.url || prodImages[0] || null;
    }

    // Format price correctly — price is already in BRL, NOT cents (ads-data-scaling-standards)
    const productPriceDisplay = matchedProduct?.price ? `R$ ${Number(matchedProduct.price).toFixed(2)}` : null;

    // ============ PREFLIGHT — Resolução determinística de criativo ============
    // Busca o inventário de criativos ready do tenant para o product_id
    // resolvido. Se o produto não pôde ser resolvido mas args.product_id foi
    // fornecido pelo modelo, ainda assim consultamos por aquele product_id
    // como fallback seguro (a query é tenant-scoped). Kit vs isolado fica
    // automaticamente protegido pelo filtro estrito por product_id.
    let tenantCreatives: any[] = [];
    const lookupProductId = matchedProduct?.id || args.product_id || null;
    if (lookupProductId) {
      const { data: assets } = await supabase
        .from("ads_creative_assets")
        .select("id, asset_url, product_id, tenant_id, status, funnel_stage, format, created_at")
        .eq("tenant_id", tenantId)
        .eq("product_id", lookupProductId)
        .eq("status", "ready")
        .not("asset_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      tenantCreatives = assets || [];
      const selection = selectReadyCreative({
        product: matchedProduct ? { id: matchedProduct.id, name: matchedProduct.name, price: matchedProduct.price } : (args.product_id ? { id: String(args.product_id), name: matchedProduct?.name || String(args.product_name || "") } : null),
        tenantCreatives,
      });
      if (!args.creative_asset_id && !args.creative_url && selection.asset) {
        args.creative_asset_id = selection.asset.id;
        args.creative_url = selection.asset.asset_url;
      }
      console.log(
        `[ads-autopilot-strategist][${VERSION}] creative-resolver`,
        JSON.stringify(
          describeResolverDecision({
            product: matchedProduct ? { id: matchedProduct.id, name: matchedProduct.name } : null,
            args: { product_id: args.product_id, product_name: args.product_name },
            result: selection,
          }),
        ),
      );
    } else {
      console.warn(`[ads-autopilot-strategist][${VERSION}] creative-resolver skipped: no product_id available`);
    }

    // ============ FRENTE 1 — Exclusão automática de Clientes em Públicos Frios ============
    // Antes do Quality Gate, se a campanha for fria/prospecting, resolvemos o
    // público de Clientes do sistema e o injetamos como exclusão. Se não existir,
    // o gate bloqueia com `cold_audience_requires_customer_exclusion`.
    let customerAudienceResolution: any = null;
    let customerExclusionMetadata: Record<string, unknown> | null = null;
    try {
      if (config.channel === "meta" && isColdFunnelStage(args.funnel_stage)) {
        customerAudienceResolution = await resolveCustomerAudienceForMetaAccount(
          supabase,
          tenantId,
          config.ad_account_id,
        );
        const applied = customerAudienceResolution.found && !!customerAudienceResolution.meta_audience_id;
        if (applied) {
          const current: Array<any> = Array.isArray(args.excluded_audience_ids) ? args.excluded_audience_ids : [];
          const currentIds = current.map((e: any) => String(e?.id ?? e));
          if (!currentIds.includes(String(customerAudienceResolution.meta_audience_id))) {
            args.excluded_audience_ids = [
              ...current,
              { id: customerAudienceResolution.meta_audience_id, name: customerAudienceResolution.audience_name },
            ];
          }
        }
        customerExclusionMetadata = buildCustomerExclusionMetadata(customerAudienceResolution, true);
        console.log(
          `[ads-autopilot-strategist][${VERSION}] cold-audience-exclusion`,
          JSON.stringify({
            funnel_stage: args.funnel_stage,
            found: customerAudienceResolution.found,
            meta_audience_id: customerAudienceResolution.meta_audience_id,
            applied,
          }),
        );
      }
    } catch (caErr: any) {
      console.warn(`[ads-autopilot-strategist][${VERSION}] customer-audience resolver failed (fail-open):`, caErr?.message);
    }

    // ============ QUALITY GATE — Subfase saneamento create_campaign ============
    // Validação determinística pura: produto×copy×criativo×destino×orçamento×exclusão_clientes.
    // Sem LLM, sem Meta. Falha = `skipped` (não-aprovável) com reason_codes.
    try {
      const gateInput = {
        args: {
          ...args,
          headline: args.headlines?.[0] || args.headline || null,
          primary_text: args.primary_texts?.[0] || args.primary_text || null,
        },
        matchedProduct: matchedProduct
          ? { id: matchedProduct.id, name: matchedProduct.name, price: matchedProduct.price }
          : null,
        catalog: (context.products || []).map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
        tenantCreatives: tenantCreatives.map((c: any) => ({
          id: c.id, product_id: c.product_id, tenant_id: c.tenant_id,
        })),
        customerAudience: customerAudienceResolution
          ? {
              found: customerAudienceResolution.found,
              meta_audience_id: customerAudienceResolution.meta_audience_id,
              audience_name: customerAudienceResolution.audience_name,
            }
          : undefined,
        // Onda G.5 — propaga intenção e justificativa para o gate decidir override em creative_test.
        campaign_intent: (args as any).campaign_intent ?? null,
      };
      // Propaga override_reason em args, se vier da proposta.
      if ((args as any).exclusion_override_reason) {
        (gateInput.args as any).exclusion_override_reason = (args as any).exclusion_override_reason;
      }
      const gate = runCreateCampaignQualityGate(gateInput);
      if (!gate.ok) {
        console.warn(
          `[ads-autopilot-strategist][${VERSION}] create_campaign BLOCKED by Quality Gate v${gate.version}: ${gate.reason_codes.join(",")}`,
        );
        return {
          status: "skipped",
          data: {
            ...args,
            ad_account_id: config.ad_account_id,
            product_id: matchedProduct?.id || args.product_id || null,
            product_name: matchedProduct?.name || args.product_name || null,
            customer_audience_exclusion: customerExclusionMetadata,
            quality_gate: {
              ok: false,
              version: gate.version,
              reason_codes: gate.reason_codes,
              details: gate.details,
              blocked_at: new Date().toISOString(),
            },
            reason: gate.reason_codes.includes("cold_audience_requires_customer_exclusion")
              ? "Crie ou sincronize o público de Clientes antes de propor campanhas frias."
              : `Quality Gate bloqueou sugestão: ${gate.reason_codes.join(", ")}`,
          },
        };
      }
    } catch (gateErr: any) {
      // Fail-open: gate nunca pode derrubar o fluxo principal.
      console.error(`[ads-autopilot-strategist][${VERSION}] Quality Gate threw (fail-open):`, gateErr?.message);
    }

    // Onda F — Aplica UTM padrão interno ao link final do anúncio (preserva existentes).
    let utmAppliedWarnings: string[] = [];
    try {
      const adSlug = slugifyForUtm(args.ad_name || args.campaign_name);
      const audSlug = slugifyForUtm(args.funnel_stage || args.targeting_description || "publico");
      const campSlug = slugifyForUtm(args.campaign_name);
      if (args.destination_url) {
        const utmRes = applyUtm(String(args.destination_url), {
          campaignSlug: campSlug, adSlug, audienceSlug: audSlug,
        });
        if (utmRes.url && utmRes.url !== args.destination_url) {
          args.destination_url = utmRes.url;
        }
        utmAppliedWarnings = utmRes.warnings || [];
        if (utmAppliedWarnings.length > 0) {
          console.log(`[ads-autopilot-strategist][${VERSION}] UTM warnings: ${utmAppliedWarnings.join(",")}`);
        }
      }
    } catch (utmErr: any) {
      console.warn(`[ads-autopilot-strategist][${VERSION}] UTM apply failed (fail-open):`, utmErr?.message);
    }

    return {
      status: "pending_approval",
      data: { 
        ...args, 
        ad_account_id: config.ad_account_id,
        product_id: matchedProduct?.id || args.product_id || null,
        product_name: matchedProduct?.name || args.product_name || null,
        product_price: matchedProduct?.price || null,
        customer_audience_exclusion: customerExclusionMetadata,
        preview: {
          campaign_name: args.campaign_name,
          objective: args.objective,
          daily_budget_cents: args.daily_budget_cents,
          daily_budget_display: `R$ ${((args.daily_budget_cents || 0) / 100).toFixed(2)}/dia`,
          lifetime_budget_cents: args.lifetime_budget_cents || null,
          bid_strategy: args.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
          bid_amount_cents: args.bid_amount_cents || null,
          roas_avg_floor: args.roas_avg_floor || null,
          special_ad_categories: args.special_ad_categories || ["NONE"],

          // Adset-level
          adset_name: args.adset_name || args.campaign_name?.replace("[AI]", "[AI] CJ -"),
          optimization_goal: args.optimization_goal || "OFFSITE_CONVERSIONS",
          billing_event: args.billing_event || "IMPRESSIONS",
          conversion_event: args.conversion_event || null,

          // Targeting
          targeting_description: args.targeting_description,
          targeting_summary: args.targeting_description,
          funnel_stage: args.funnel_stage,
          age_min: args.age_min || 18,
          age_max: args.age_max || 65,
          age_range: `${args.age_min || 18}-${args.age_max || 65}`,
          genders: args.genders || [0],
          geo_locations: args.geo_locations || { countries: ["BR"] },
          interests: args.interests || [],
          behaviors: args.behaviors || [],
          custom_audience_ids: args.custom_audience_ids || [],
          excluded_audience_ids: args.excluded_audience_ids || [],
          lookalike_spec: args.lookalike_spec || null,

          // Placements
          publisher_platforms: args.publisher_platforms || null, // null = Advantage+
          position_types: args.position_types || null,
          device_platforms: args.device_platforms || null,

          // Link & destination
          destination_url: args.destination_url || null,
          display_link: args.display_link || null,
          utm_params: args.utm_params || null,

          // Creative
          headline: args.headlines?.[0] || args.campaign_name,
          headlines: args.headlines || [],
          copy_text: args.primary_texts?.[0] || null,
          primary_texts: args.primary_texts || [],
          descriptions: args.descriptions || [],
          cta_type: args.cta || null,
          ad_name: args.ad_name || null,
          ad_format: args.ad_format || "SINGLE_IMAGE",

          // Product
          product_name: matchedProduct?.name || args.product_name || null,
          product_price: matchedProduct?.price || null,
          product_price_display: productPriceDisplay,
          product_image: productImageUrl,

          // Scheduling
          start_time: args.start_time || null,
          end_time: args.end_time || null,

          // Frente 1 — Exclusão de Clientes em Públicos Frios (UI lê daqui)
          customer_audience_exclusion: customerExclusionMetadata,
        },
      } 
    };
  }

  if (toolName === "create_adset") {
    // v1.8.0: ALWAYS require approval for adset creation
    console.log(`[ads-autopilot-strategist][${VERSION}] create_adset → pending_approval (always)`);
    return { 
      status: "pending_approval", 
      data: { 
        ...args, 
        ad_account_id: config.ad_account_id,
        preview: {
          adset_name: args.adset_name,
          targeting_type: args.targeting_type,
          targeting_description: args.targeting_description || null,
          daily_budget_cents: args.daily_budget_cents,
          daily_budget_display: args.daily_budget_cents ? `R$ ${(args.daily_budget_cents / 100).toFixed(2)}/dia` : null,
          lifetime_budget_cents: args.lifetime_budget_cents || null,
          optimization_goal: args.optimization_goal || "OFFSITE_CONVERSIONS",
          billing_event: args.billing_event || "IMPRESSIONS",
          conversion_event: args.conversion_event || null,
          bid_amount_cents: args.bid_amount_cents || null,
          age_min: args.age_min || 18,
          age_max: args.age_max || 65,
          age_range: `${args.age_min || 18}-${args.age_max || 65}`,
          genders: args.genders || [0],
          geo_locations: args.geo_locations || { countries: ["BR"] },
          interests: args.interests || [],
          behaviors: args.behaviors || [],
          custom_audience_ids: args.custom_audience_ids || [],
          excluded_audience_ids: args.excluded_audience_ids || [],
          lookalike_spec: args.lookalike_spec || null,
          publisher_platforms: args.publisher_platforms || null,
          position_types: args.position_types || null,
          device_platforms: args.device_platforms || null,
          destination_url: args.destination_url || null,
          start_time: args.start_time || null,
          end_time: args.end_time || null,
        },
      } 
    };
  }

  if (toolName === "adjust_budget") {
    const changePct = Math.abs(args.change_pct || 0);
    const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;

    if (changePct > platformLimit.max_change_pct) {
      return { status: "rejected", data: { reason: `Ajuste de ${args.change_pct}% excede limite de ±${platformLimit.max_change_pct}%` } };
    }
    if (!canAdjustBudget(config)) {
      return { status: "rejected", data: { reason: `Intervalo mínimo de ${platformLimit.min_interval_hours}h não atingido` } };
    }

    const scheduledFor = getNextSchedulingTime();
    return {
      status: "scheduled",
      data: {
        campaign_id: args.campaign_id,
        new_budget_cents: args.new_budget_cents,
        change_pct: args.change_pct,
        scheduled_for: scheduledFor,
        ad_account_id: config.ad_account_id,
      },
    };
  }

  // ============ GOOGLE ADS TOOL HANDLERS ============

  if (toolName === "create_google_campaign") {
    console.log(`[ads-autopilot-strategist][${VERSION}] create_google_campaign → pending_approval`);
    return {
      status: "pending_approval",
      data: {
        type: "google_campaign",
        ad_account_id: config.ad_account_id,
        name: args.name,
        channel_type: args.channel_type,
        budget_micros: args.budget_micros,
        budget_display: `R$ ${((args.budget_micros || 0) / 1_000_000).toFixed(2)}/dia`,
        bidding_strategy: args.bidding_strategy,
        target_roas: args.target_roas || null,
        target_cpa_micros: args.target_cpa_micros || null,
        start_date: args.start_date || null,
        reasoning: args.reasoning,
        preview: {
          campaign_name: args.name,
          campaign_type: args.channel_type,
          budget_display: `R$ ${((args.budget_micros || 0) / 1_000_000).toFixed(2)}/dia`,
          bidding_strategy: args.bidding_strategy,
        },
      },
    };
  }

  if (toolName === "create_google_ad_group") {
    console.log(`[ads-autopilot-strategist][${VERSION}] create_google_ad_group → pending_approval`);
    return {
      status: "pending_approval",
      data: {
        type: "google_ad_group",
        ad_account_id: config.ad_account_id,
        campaign_name: args.campaign_name,
        name: args.name,
        ad_group_type: args.type || "SEARCH_STANDARD",
        cpc_bid_micros: args.cpc_bid_micros || null,
        reasoning: args.reasoning,
        preview: {
          ad_group_name: args.name,
          campaign_name: args.campaign_name,
          type: args.type || "SEARCH_STANDARD",
          cpc_bid_display: args.cpc_bid_micros ? `R$ ${(args.cpc_bid_micros / 1_000_000).toFixed(2)}` : "Automático",
        },
      },
    };
  }

  if (toolName === "create_google_keyword") {
    console.log(`[ads-autopilot-strategist][${VERSION}] create_google_keyword → pending_approval`);
    return {
      status: "pending_approval",
      data: {
        type: "google_keyword",
        ad_account_id: config.ad_account_id,
        campaign_name: args.campaign_name,
        ad_group_name: args.ad_group_name,
        text: args.text,
        match_type: args.match_type,
        reasoning: args.reasoning,
        preview: {
          keyword: args.text,
          match_type: args.match_type,
          ad_group_name: args.ad_group_name,
        },
      },
    };
  }

  if (toolName === "create_google_ad") {
    console.log(`[ads-autopilot-strategist][${VERSION}] create_google_ad → pending_approval`);
    return {
      status: "pending_approval",
      data: {
        type: "google_ad",
        ad_account_id: config.ad_account_id,
        campaign_name: args.campaign_name,
        ad_group_name: args.ad_group_name,
        headlines: args.headlines,
        descriptions: args.descriptions,
        final_url: args.final_url,
        path1: args.path1 || null,
        path2: args.path2 || null,
        reasoning: args.reasoning,
        preview: {
          ad_group_name: args.ad_group_name,
          headlines: args.headlines?.slice(0, 3) || [],
          descriptions: args.descriptions?.slice(0, 2) || [],
          final_url: args.final_url,
        },
      },
    };
  }

  // ============ LANDING PAGE TOOL HANDLERS ============

  if (toolName === "search_landing_pages") {
    try {
      console.log(`[ads-autopilot-strategist][${VERSION}] search_landing_pages for tenant ${tenantId}`);
      
      let query = supabase
        .from("ai_landing_pages")
        .select("id, name, slug, status, is_published, seo_title, product_ids, created_at")
        .eq("tenant_id", tenantId);
      
      if (!args.include_drafts) {
        query = query.eq("is_published", true);
      }
      
      const { data: lps, error } = await query.order("created_at", { ascending: false }).limit(30);
      
      if (error) {
        console.error(`[ads-autopilot-strategist][${VERSION}] search_landing_pages error:`, error);
        return { status: "failed", data: { error: "Erro interno. Se o problema persistir, entre em contato com o suporte." } };
      }

      // Also fetch store_pages (builder landing pages)
      const { data: builderPages } = await supabase
        .from("store_pages")
        .select("id, title, slug, type, is_published, seo_title")
        .eq("tenant_id", tenantId)
        .eq("type", "landing_page")
        .eq("is_published", true)
        .limit(20);
      
      // Resolve store URL
      const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
      const { data: tenantRow } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
      const baseUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenantRow?.slug ? `https://${tenantRow.slug}.comandocentral.com.br` : "");
      
      // Filter by product name if provided
      let filteredLPs = lps || [];
      if (args.product_name) {
        const searchName = (args.product_name || "").toLowerCase().trim();
        // Match by product_ids (resolve names) or by LP name containing product name
        const { data: matchedProducts } = await supabase
          .from("products")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .ilike("name", `%${searchName}%`)
          .limit(10);
        const matchedIds = (matchedProducts || []).map((p: any) => p.id);
        
        filteredLPs = filteredLPs.filter((lp: any) => {
          const nameMatch = lp.name?.toLowerCase().includes(searchName);
          const productMatch = lp.product_ids?.some((pid: string) => matchedIds.includes(pid));
          return nameMatch || productMatch;
        });
      }

      const aiLpResults = filteredLPs.map((lp: any) => ({
        name: lp.name,
        slug: lp.slug,
        url: `${baseUrl}/ai-lp/${lp.slug}`,
        status: lp.is_published ? "published" : "draft",
        seo_title: lp.seo_title,
        product_ids: lp.product_ids,
        type: "ai_landing_page",
      }));

      const builderResults = (builderPages || []).map((p: any) => ({
        name: p.title,
        slug: p.slug,
        url: `${baseUrl}/lp/${p.slug}`,
        status: p.is_published ? "published" : "draft",
        seo_title: p.seo_title,
        type: "builder_landing_page",
      }));

      const allResults = [...aiLpResults, ...builderResults];

      return {
        status: "executed",
        data: {
          landing_pages: allResults,
          total: allResults.length,
          message: allResults.length > 0 
            ? `Encontradas ${allResults.length} landing pages. Use a URL na destination_url da campanha.`
            : "Nenhuma landing page encontrada. Considere usar generate_landing_page para criar uma LP otimizada.",
        },
      };
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] search_landing_pages exception:`, err.message);
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "generate_landing_page") {
    try {
      console.log(`[ads-autopilot-strategist][${VERSION}] generate_landing_page for product "${args.product_name}"`);
      
      // Find the product
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .limit(100);
      
      const matchedProduct = (products || []).find((p: any) => p.name.trim() === (args.product_name || "").trim());
      if (!matchedProduct) {
        return { status: "failed", data: { error: `Produto "${args.product_name}" não encontrado no catálogo. Verifique o nome exato.` } };
      }

      // Check if an LP already exists for this product
      const { data: existingLPs } = await supabase
        .from("ai_landing_pages")
        .select("id, name, slug, is_published")
        .eq("tenant_id", tenantId)
        .contains("product_ids", [matchedProduct.id])
        .limit(5);
      
      if (existingLPs && existingLPs.length > 0) {
        const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
        const { data: tenantRow } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
        const baseUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenantRow?.slug ? `https://${tenantRow.slug}.comandocentral.com.br` : "");
        
        const existingList = existingLPs.map((lp: any) => ({
          name: lp.name,
          url: `${baseUrl}/ai-lp/${lp.slug}`,
          is_published: lp.is_published,
        }));

        return {
          status: "executed",
          data: {
            action: "existing_found",
            existing_landing_pages: existingList,
            message: `Já existem ${existingLPs.length} landing page(s) para "${matchedProduct.name}". Use a URL existente ou prossiga com a geração de uma nova.`,
          },
        };
      }

      // Get the user's auth info for the created_by field
      const { data: ownerRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("role", "owner")
        .limit(1)
        .single();
      
      const createdBy = ownerRole?.user_id || tenantId;

      // Generate a unique slug
      const baseSlug = matchedProduct.slug || matchedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const slug = `${baseSlug}-lp-${Date.now().toString(36)}`;

      // Create the landing page record
      const { data: newLP, error: insertError } = await supabase
        .from("ai_landing_pages")
        .insert({
          tenant_id: tenantId,
          name: `LP - ${matchedProduct.name}`,
          slug,
          status: "generating",
          is_published: false,
          show_header: args.show_header !== false,
          show_footer: args.show_footer !== false,
          initial_prompt: args.prompt,
          product_ids: [matchedProduct.id],
          created_by: createdBy,
        })
        .select("id, slug")
        .single();

      if (insertError) {
        console.error(`[ads-autopilot-strategist][${VERSION}] generate_landing_page insert error:`, insertError);
        return { status: "failed", data: { error: insertError.message } };
      }

      // Trigger the AI generation edge function
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const generatePayload = {
        landingPageId: newLP.id,
        tenantId,
        prompt: args.prompt,
        promptType: "initial",
        productIds: [matchedProduct.id],
        briefing: {
          objective: "sale",
          trafficTemp: "cold",
          trafficSource: "meta",
          awarenessLevel: "pain_aware",
          preferredCTA: "buy",
          restrictions: [],
          assumedBySystem: true,
        },
      };

      // Fire and forget — don't await the full generation
      fetch(`${supabaseUrl}/functions/v1/ai-landing-page-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(generatePayload),
      }).then(async (res) => {
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[ads-autopilot-strategist][${VERSION}] LP generation trigger failed: ${res.status} ${errText}`);
        } else {
          console.log(`[ads-autopilot-strategist][${VERSION}] LP generation triggered successfully for ${newLP.id}`);
        }
      }).catch((err) => {
        console.error(`[ads-autopilot-strategist][${VERSION}] LP generation trigger exception:`, err.message);
      });

      // Resolve URL
      const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
      const { data: tenantRow } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
      const baseUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenantRow?.slug ? `https://${tenantRow.slug}.comandocentral.com.br` : "");
      const lpUrl = `${baseUrl}/ai-lp/${slug}`;

      return {
        status: "executed",
        data: {
          action: "generation_triggered",
          landing_page_id: newLP.id,
          slug: newLP.slug,
          url: lpUrl,
          product_name: matchedProduct.name,
          message: `Landing page "${matchedProduct.name}" sendo gerada por IA. URL futura: ${lpUrl}. A página estará pronta em ~2 minutos. Use esta URL como destination_url nas campanhas.`,
        },
      };
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] generate_landing_page exception:`, err.message);
      return { status: "failed", data: { error: err.message } };
    }
  }

  return { status: "unknown", data: { tool: toolName } };
}

// ============ RUN STRATEGIST FOR TENANT ============

async function runStrategistForTenant(supabase: any, tenantId: string, trigger: StrategistTrigger, targetAccountId?: string | null, revisionFeedback?: string | null, body?: any) {
  const startTime = Date.now();
  console.log(`[ads-autopilot-strategist][${VERSION}] Starting ${trigger} for tenant ${tenantId}${targetAccountId ? ` (account: ${targetAccountId})` : ""}`);

  // Get account configs
  let query = supabase
    .from("ads_autopilot_account_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_ai_enabled", true);

  // If targeting a specific account, filter to just that one
  if (targetAccountId) {
    query = query.eq("ad_account_id", targetAccountId);
  }

  const { data: configs } = await query;

  const activeConfigs = (configs || []).filter((c: any) => !c.kill_switch) as AccountConfig[];
  if (activeConfigs.length === 0) {
    return { trigger, accounts: 0, message: "No active accounts" };
  }

  // Collect deep context
  const context = await collectStrategistContext(supabase, tenantId, activeConfigs, trigger);

  // Create strategist session
  const { data: session } = await supabase
    .from("ads_autopilot_sessions")
    .insert({
      tenant_id: tenantId,
      channel: "global",
      trigger_type: `strategist_${trigger}`,
      motor_type: "strategist",
      context_snapshot: { trigger, accounts: activeConfigs.map(a => a.ad_account_id) },
    })
    .select("id")
    .single();

  const sessionId = session!.id;
  let totalPlanned = 0;
  let totalExecuted = 0;
  let totalRejected = 0;

  // Onda F: vínculo de filhas com plano-pai e rodada de análise.
  let sourcePlanId: string | null = body?.source_plan_id || null;
  let planAnalysisRunId: string | null = body?.analysis_run_id || null;

  // If implementing approved plan OR campaigns phase, fetch the plan content
  let approvedPlanContent = "";
  if (trigger === "implement_approved_plan" || trigger === "implement_campaigns") {
    const { data: planActions } = await supabase
      .from("ads_autopilot_actions")
      .select("id, action_data, reasoning, analysis_run_id")
      .eq("tenant_id", tenantId)
      .eq("action_type", "strategic_plan")
      .in("status", ["approved", "executed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (planActions && planActions.length > 0) {
      const planRow = planActions[0];
      if (!sourcePlanId) sourcePlanId = planRow.id;
      if (!planAnalysisRunId) planAnalysisRunId = planRow.analysis_run_id || (planRow.action_data?.analysis_run_id ?? null);
      const plan = planRow.action_data || {};
      const diagnosis = plan.diagnosis || "";
      const plannedActions = (plan.planned_actions || []).map((a: string, i: number) => `${i + 1}. ${a}`).join("\n");
      const expectedResults = plan.expected_results || "";
      const budgetAllocation = plan.budget_allocation ? JSON.stringify(plan.budget_allocation, null, 2) : "";

      approvedPlanContent = `### PLANO APROVADO PELO USUÁRIO (SEGUIR À RISCA):

**Diagnóstico:**
${diagnosis}

**Ações Planejadas (executar na ordem):**
${plannedActions}

**Resultados Esperados:**
${expectedResults}

${budgetAllocation ? `**Alocação de Orçamento:**\n${budgetAllocation}` : ""}`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Approved plan loaded: ${(plan.planned_actions || []).length} actions, plan_id=${sourcePlanId}, analysis_run=${planAnalysisRunId}`);
    } else {
      console.warn(`[ads-autopilot-strategist][${VERSION}] No approved plan found, falling back to general context`);
    }
  }

  // v1.28.0: Load ALL existing creatives for Phase 1 (reuse inventory) and Phase 2 (available URLs)
  let existingCreativesInventory = "";
  if (trigger === "implement_approved_plan" || trigger === "weekly" || trigger === "monthly" || trigger === "start") {
    // Fetch ALL ready creatives for this tenant (not just from a specific session)
    const { data: allCreatives } = await supabase
      .from("ads_creative_assets")
      .select("id, product_id, asset_url, format, status, funnel_stage, angle, session_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "ready")
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (allCreatives && allCreatives.length > 0) {
      // Also check which creatives are already linked to active Meta ads
      const { data: activeAds } = await supabase
        .from("meta_ad_ads")
        .select("creative_id")
        .eq("tenant_id", tenantId)
        .in("effective_status", ["ACTIVE", "PENDING_REVIEW", "PREAPPROVED"]);
      
      const usedCreativeIds = new Set((activeAds || []).map((a: any) => a.creative_id).filter(Boolean));
      
      // Map product names
      const productIds = [...new Set(allCreatives.map((c: any) => c.product_id).filter(Boolean))];
      const { data: creativeProducts } = productIds.length > 0
        ? await supabase.from("products").select("id, name").in("id", productIds)
        : { data: [] };
      const prodNameMap: Record<string, string> = {};
      (creativeProducts || []).forEach((p: any) => { prodNameMap[p.id] = p.name; });

      const lines = allCreatives.map((c: any) => {
        const inUse = usedCreativeIds.has(c.id) ? "🟢 EM USO" : "⚪ DISPONÍVEL";
        const age = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return `- [${inUse}] Produto: ${prodNameMap[c.product_id] || "Multi-produto"} | Funil: ${c.funnel_stage || "N/A"} | Formato: ${c.format || "N/A"} | Ângulo: ${c.angle || "N/A"} | Idade: ${age}d | URL: ${c.asset_url}`;
      });
      
      const available = allCreatives.filter((c: any) => !usedCreativeIds.has(c.id)).length;
      existingCreativesInventory = `Total: ${allCreatives.length} criativos (${available} disponíveis para reutilização, ${usedCreativeIds.size} em uso na Meta)\n\n${lines.join("\n")}`;
      
      console.log(`[ads-autopilot-strategist][${VERSION}] Creative inventory: ${allCreatives.length} total, ${available} available, ${usedCreativeIds.size} in use`);
    } else {
      existingCreativesInventory = "Nenhum criativo existente. Todos precisam ser gerados do zero.";
      console.log(`[ads-autopilot-strategist][${VERSION}] No existing creatives found`);
    }
  }

  // For implement_campaigns (Phase 2): load available creative URLs
  let availableCreativesText = "";
  if (trigger === "implement_campaigns") {
    const sourceSessionId = body?.source_session_id;
    let creativeQuery = supabase
      .from("ads_creative_assets")
      .select("id, product_id, asset_url, format, status, meta")
      .eq("tenant_id", tenantId)
      .eq("status", "ready")
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (sourceSessionId) {
      creativeQuery = creativeQuery.eq("session_id", sourceSessionId);
    }

    const { data: readyCreatives } = await creativeQuery;
    
    if (readyCreatives && readyCreatives.length > 0) {
      // Map creatives to product names
      const productIds = [...new Set(readyCreatives.map((c: any) => c.product_id).filter(Boolean))];
      const { data: creativeProducts } = productIds.length > 0
        ? await supabase.from("products").select("id, name").in("id", productIds)
        : { data: [] };
      const prodNameMap: Record<string, string> = {};
      (creativeProducts || []).forEach((p: any) => { prodNameMap[p.id] = p.name; });

      availableCreativesText = readyCreatives.map((c: any) => 
        `- Produto: ${prodNameMap[c.product_id] || "N/A"} | Formato: ${c.format || "N/A"} | URL: ${c.asset_url}`
      ).join("\n");
      
      console.log(`[ads-autopilot-strategist][${VERSION}] Phase 2: ${readyCreatives.length} creatives available`);
    } else {
      availableCreativesText = "Nenhum criativo encontrado — use imagens do catálogo como fallback.";
      console.warn(`[ads-autopilot-strategist][${VERSION}] Phase 2: No ready creatives found`);
    }
  }

  // === REVISION: fetch rejected plan + feedback to guide new analysis ===
  let revisionContext = "";
  const revisionActionType = body?.revision_action_type || null;
  const revisionActionData = body?.revision_action_data || null;
  
  // Collect names of other pending campaigns that should NOT be touched
  const otherPendingCampaigns = body?.other_pending_campaigns || [];
  
  // Also fetch pending campaigns from DB for extra safety
  if (trigger === "revision") {
    const { data: dbPending } = await supabase
      .from("ads_autopilot_actions")
      .select("id, action_type, action_data")
      .eq("tenant_id", tenantId)
      .eq("status", "pending_approval")
      .eq("action_type", "create_campaign");
    
    if (dbPending) {
      for (const p of dbPending) {
        const name = (p.action_data as any)?.campaign_name || (p.action_data as any)?.preview?.campaign_name;
        if (name && !otherPendingCampaigns.includes(name)) {
          otherPendingCampaigns.push(name);
        }
      }
    }
  }

  if (trigger === "revision" && revisionFeedback) {
    // Scoped revision: only regenerate the specific rejected action
    if (revisionActionType === "create_campaign" && revisionActionData) {
      const campaignName = revisionActionData.campaign_name || "campanha";
      const productName = revisionActionData.product_name || "";
      const funnelStage = revisionActionData.funnel_stage || "";
      
      // Build list of campaigns to NOT recreate
      const protectedList = otherPendingCampaigns
        .filter((n: string) => n !== campaignName)
        .map((n: string) => `  - "${n}"`)
        .join("\n");
      
      revisionContext = `### REVISÃO ESPECÍFICA — APENAS UMA CAMPANHA

O usuário pediu ajuste APENAS na campanha "${campaignName}"${productName ? ` (produto: ${productName})` : ""}${funnelStage ? ` (funil: ${funnelStage})` : ""}.

Feedback do usuário: "${revisionFeedback}"

**REGRA ABSOLUTA — VIOLAÇÃO RESULTA EM FALHA TOTAL:**
1. Você DEVE criar APENAS UMA nova campanha (create_campaign) substituindo a campanha "${campaignName}" rejeitada
2. NÃO gere um novo plano estratégico (strategic_plan)
3. NÃO recrie NEM modifique outras campanhas
4. Siga LITERALMENTE o feedback do usuário — se ele pedir campanha de catálogo, crie campanha de catálogo
5. Se o feedback mencionar tipo específico (catálogo, remarketing, etc.), use o objective_type correspondente
6. Mantenha o mesmo produto/funil a menos que o feedback peça mudança explícita
7. Gere novos criativos APENAS se o feedback pedir — caso contrário, reutilize existentes
${protectedList ? `\n**CAMPANHAS EXISTENTES (NÃO TOCAR — já estão pendentes de aprovação):**\n${protectedList}` : ""}

Se o usuário pedir "campanha de catálogo", use:
- objective_type: "OUTCOME_PRODUCT_CATALOG_SALES"
- Inclua TODOS os produtos relevantes no targeting`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Scoped revision for campaign "${campaignName}" feedback: ${revisionFeedback.substring(0, 100)}`);
    } else if (revisionActionType === "strategic_plan") {
      // Full plan revision — fetch previous plan
      const { data: rejectedPlans } = await supabase
        .from("ads_autopilot_actions")
        .select("action_data, reasoning")
        .eq("tenant_id", tenantId)
        .eq("action_type", "strategic_plan")
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1);

      const prevDiagnosis = rejectedPlans?.[0]?.reasoning || "";
      revisionContext = `### REVISÃO DO PLANO ESTRATÉGICO

O plano anterior foi rejeitado com o seguinte feedback:
"${revisionFeedback}"

**Diagnóstico do plano anterior (para referência, NÃO repetir erros):**
${prevDiagnosis.substring(0, 2000)}

**INSTRUÇÕES:** Gere um NOVO plano estratégico incorporando obrigatoriamente o feedback do usuário. Mantenha o diagnóstico base mas ajuste a estratégia conforme solicitado.`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Full plan revision with feedback: ${revisionFeedback.substring(0, 100)}`);
    } else {
      // Generic revision fallback
      const { data: rejectedPlans } = await supabase
        .from("ads_autopilot_actions")
        .select("action_data, reasoning")
        .eq("tenant_id", tenantId)
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1);

      const prevDiagnosis = rejectedPlans?.[0]?.reasoning || "";
      revisionContext = `### REVISÃO SOLICITADA PELO USUÁRIO

Feedback: "${revisionFeedback}"

**Contexto anterior:** ${prevDiagnosis.substring(0, 1000)}

**REGRA:** Ajuste APENAS o que o feedback pede. NÃO recrie tudo do zero.`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Generic revision with feedback: ${revisionFeedback.substring(0, 100)}`);
    }
  }

  // Analyze each account with full pipeline
  for (const config of activeConfigs) {
    const prompt = buildStrategistPrompt(trigger, config, context);
    
    // Inject approved plan content into the prompt if available
    if (approvedPlanContent) {
      prompt.system = prompt.system.replace("{{APPROVED_PLAN_CONTENT}}", approvedPlanContent);
    } else if (revisionContext) {
      prompt.system = prompt.system.replace("{{APPROVED_PLAN_CONTENT}}", revisionContext);
    } else {
      prompt.system = prompt.system.replace("{{APPROVED_PLAN_CONTENT}}", "Nenhum plano específico encontrado. Use o contexto disponível para decidir os produtos e estratégias.");
    }

    // Inject deep historical data for start trigger
    if (context.deepHistorical && context.deepHistorical[config.ad_account_id]) {
      const dh = context.deepHistorical[config.ad_account_id];
      // Sort by conversions desc to find top performers
      const topCampaigns = [...dh.campaigns].filter((c: any) => c.conversions > 0).sort((a: any, b: any) => b.conversions - a.conversions).slice(0, 10);
      const topAdsets = [...dh.adsets].filter((a: any) => a.conversions > 0).sort((a: any, b: any) => b.roas - a.roas).slice(0, 15);
      const topAds = [...dh.ads].filter((a: any) => a.conversions > 0).sort((a: any, b: any) => b.conversions - a.conversions).slice(0, 15);
      
      // Build placement summary across all campaigns
      const placementAgg: Record<string, { spend: number; conversions: number; revenue: number }> = {};
      for (const c of dh.campaigns) {
        if (c.placements) {
          for (const [key, val] of Object.entries(c.placements as Record<string, any>)) {
            if (!placementAgg[key]) placementAgg[key] = { spend: 0, conversions: 0, revenue: 0 };
            placementAgg[key].spend += val.spend || 0;
            placementAgg[key].conversions += val.conversions || 0;
            placementAgg[key].revenue += (val.roas || 0) * (val.spend || 0);
          }
        }
      }
      const topPlacements = Object.entries(placementAgg)
        .map(([k, v]) => ({ placement: k, ...v, roas: v.spend > 0 ? Math.round((v.revenue / v.spend) * 100) / 100 : 0 }))
        .filter(p => p.conversions > 0)
        .sort((a, b) => b.roas - a.roas)
        .slice(0, 10);

      const deepText = `## DADOS HISTÓRICOS COMPLETOS DA CONTA (PERÍODO MÁXIMO)
### Top Campanhas por Conversões (todas, incluindo pausadas):
${topCampaigns.map((c: any) => `- ${c.name} [${c.status}] — ROAS: ${c.roas}x | CPA: R$${c.cpa.toFixed(2)} | Conv: ${c.conversions} | Gasto: R$${c.spend.toFixed(2)} | CTR: ${c.ctr}% | Freq: ${c.frequency ?? "-"} | CPM: R$${c.cpm?.toFixed(2) ?? "-"} | PV: ${c.page_views ?? "-"} | ATC: ${c.add_to_cart ?? "-"} | IC: ${c.initiate_checkout ?? "-"} | VV25: ${c.video_p25 ?? "-"} | VV50: ${c.video_p50 ?? "-"} | VV95: ${c.video_p95 ?? "-"}`).join("\n") || "Nenhuma campanha com conversões"}

### Top Conjuntos de Anúncios por ROAS (públicos que mais converteram):
${topAdsets.map((a: any) => `- ${a.name} [${a.status}] — ROAS: ${a.roas}x | CPA: R$${a.cpa.toFixed(2)} | Conv: ${a.conversions} | Gasto: R$${a.spend.toFixed(2)} | Freq: ${a.frequency ?? "-"} | CPM: R$${a.cpm?.toFixed(2) ?? "-"} | PV: ${a.page_views ?? "-"} | ATC: ${a.add_to_cart ?? "-"} | IC: ${a.initiate_checkout ?? "-"}${a.targeting ? ` | Targeting: ${JSON.stringify(a.targeting).substring(0, 200)}` : ""}`).join("\n") || "Nenhum adset com conversões"}

### Top Anúncios por Conversões (criativos/copys que mais converteram):
${topAds.map((a: any) => {
        const cr = a.creative_data || {};
        return `- ${a.name} [${a.status}] — ROAS: ${a.roas}x | CPA: R$${a.cpa.toFixed(2)} | Conv: ${a.conversions} | CTR: ${a.ctr}% | Freq: ${a.frequency ?? "-"} | CPM: R$${a.cpm?.toFixed(2) ?? "-"} | VV25: ${a.video_p25 ?? "-"} | VV50: ${a.video_p50 ?? "-"} | VV95: ${a.video_p95 ?? "-"}${cr.title ? ` | Headline: "${cr.title}"` : ""}${cr.body ? ` | Copy: "${(cr.body || "").substring(0, 150)}"` : ""}${cr.call_to_action_type ? ` | CTA: ${cr.call_to_action_type}` : ""}`;
      }).join("\n") || "Nenhum anúncio com conversões"}

### Funil de Conversão Histórico (toda a conta):
- Visualizações de Página: ${dh.campaigns.reduce((s: number, c: any) => s + (c.page_views || 0), 0)}
- Adições ao Carrinho: ${dh.campaigns.reduce((s: number, c: any) => s + (c.add_to_cart || 0), 0)}
- Checkouts Iniciados: ${dh.campaigns.reduce((s: number, c: any) => s + (c.initiate_checkout || 0), 0)}
- Compras: ${dh.campaigns.reduce((s: number, c: any) => s + c.conversions, 0)}

### Top Posicionamentos por ROAS:
${topPlacements.map(p => `- ${p.placement} — ROAS: ${p.roas}x | Conversões: ${p.conversions} | Gasto: R$${p.spend.toFixed(2)}`).join("\n") || "Sem dados de posicionamento"}

### Resumo Geral da Conta (período máximo):
- Total de campanhas: ${dh.campaigns.length} (${dh.campaigns.filter((c: any) => c.status === "ACTIVE").length} ativas, ${dh.campaigns.filter((c: any) => c.status === "PAUSED").length} pausadas)
- Total de conjuntos: ${dh.adsets.length}
- Total de anúncios: ${dh.ads.length}
- Gasto total histórico: R$ ${dh.campaigns.reduce((s: number, c: any) => s + c.spend, 0).toFixed(2)}
- Conversões totais históricas: ${dh.campaigns.reduce((s: number, c: any) => s + c.conversions, 0)}`;

      prompt.system = prompt.system.replace("{{DEEP_HISTORICAL_DATA}}", deepText);
    } else {
      prompt.system = prompt.system.replace("{{DEEP_HISTORICAL_DATA}}", "Dados históricos profundos não disponíveis. Baseie-se nos dados de 7d e 30d disponíveis.");
    }

    // Inject existing creatives inventory for Phase 1 and other triggers
    if (existingCreativesInventory) {
      prompt.system = prompt.system.replace("{{EXISTING_CREATIVES_INVENTORY}}", existingCreativesInventory);
    } else {
      prompt.system = prompt.system.replace("{{EXISTING_CREATIVES_INVENTORY}}", "Nenhum criativo existente encontrado.");
    }

    // Inject available creatives for Phase 2
    if (availableCreativesText) {
      prompt.system = prompt.system.replace("{{AVAILABLE_CREATIVES}}", availableCreativesText);
    } else {
      prompt.system = prompt.system.replace("{{AVAILABLE_CREATIVES}}", "Nenhum criativo pré-gerado disponível.");
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      resetAIRouterCache();

      console.log(`[ads-autopilot-strategist][${VERSION}] Using aiChatCompletion with auto-fallback (Gemini → OpenAI → Lovable)`);

      // === MULTI-ROUND EXECUTION LOOP ===
      const MAX_ROUNDS = 8; // Safety limit to prevent infinite loops
      let round = 0;
      let allAiText = "";
      
      // Build tool set based on trigger AND channel
      const isGoogleAccount = config.channel === "google";
      const isScopedRevision = trigger === "revision" && revisionActionType === "create_campaign";
      
      let allowedTools: any[];
      const isTikTokAccount = config.channel === "tiktok";
      if (isTikTokAccount) {
        // TikTok Ads: use TikTok-specific tools + landing page tools
        allowedTools = trigger === "start"
          ? [...TIKTOK_STRATEGIST_TOOLS.filter((t: any) => t.function?.name === "strategic_plan"), ...LANDING_PAGE_TOOLS]
          : trigger === "implement_approved_plan" || trigger === "implement_campaigns"
          ? [...TIKTOK_STRATEGIST_TOOLS.filter((t: any) => ["create_tiktok_campaign", "toggle_tiktok_status", "update_tiktok_budget"].includes(t.function?.name)), ...LANDING_PAGE_TOOLS]
          : [...TIKTOK_STRATEGIST_TOOLS, ...LANDING_PAGE_TOOLS];
      } else if (isGoogleAccount) {
        // Google Ads: use Google-specific tools + landing page tools
        allowedTools = trigger === "start"
          ? [...GOOGLE_STRATEGIST_TOOLS.filter((t: any) => t.function?.name === "strategic_plan"), ...LANDING_PAGE_TOOLS]
          : trigger === "implement_approved_plan" || trigger === "implement_campaigns"
          ? [...GOOGLE_STRATEGIST_TOOLS.filter((t: any) => ["create_google_campaign", "create_google_ad_group", "create_google_keyword", "create_google_ad"].includes(t.function?.name)), ...LANDING_PAGE_TOOLS]
          : [...GOOGLE_STRATEGIST_TOOLS, ...LANDING_PAGE_TOOLS];
      } else {
        // Meta Ads: use Meta-specific tools + landing page tools (default)
        allowedTools = trigger === "implement_approved_plan" 
          ? [...STRATEGIST_TOOLS.filter((t: any) => ["generate_creative", "create_lookalike_audience"].includes(t.function?.name)), ...LANDING_PAGE_TOOLS]
          : trigger === "implement_campaigns"
          ? [...STRATEGIST_TOOLS.filter((t: any) => ["create_campaign", "create_adset", "adjust_budget"].includes(t.function?.name)), ...LANDING_PAGE_TOOLS]
          : trigger === "start"
          ? [...STRATEGIST_TOOLS.filter((t: any) => t.function?.name === "strategic_plan"), ...LANDING_PAGE_TOOLS]
          : isScopedRevision
          ? [...STRATEGIST_TOOLS.filter((t: any) => ["create_campaign", "create_adset", "generate_creative", "create_lookalike_audience"].includes(t.function?.name)), ...LANDING_PAGE_TOOLS]
          : [...STRATEGIST_TOOLS, ...LANDING_PAGE_TOOLS];
      }

      // Inject AI Brain insights (aprendizados aprovados para tráfego)
      try {
        const brainContext = await getBrainContextForPrompt(supabase, tenantId, "trafego", { limit: 12 });
        if (brainContext) {
          prompt.system = prompt.system + brainContext;
          console.log(`[ads-autopilot-strategist] Brain insights injected (${brainContext.length} chars)`);
        }
      } catch (e) {
        console.error("[ads-autopilot-strategist] Brain fetch error:", e);
      }

      // Messages history for multi-round conversation
      const messages: any[] = [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ];

      // Track generated creative URLs per product for linking to campaign actions
      const creativeUrlsByProduct: Record<string, string> = {};
      // Frente 4 — Briefs salvos durante a Etapa 1 (geração diferida)
      const creativeBriefsByProduct: Record<string, CreativeBrief> = {};

      while (round < MAX_ROUNDS) {
        round++;
        console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round}/${MAX_ROUNDS} for account ${config.ad_account_id}`);

        // Force tool calling for triggers that MUST produce tool calls
        // v1.43.0: implement_campaigns forces "required" on ALL rounds (not just round 1) to prevent AI from pausing to ask approval
        const forceToolChoice = (trigger === "implement_campaigns")
          ? "required"
          : (round === 1 && (trigger === "start" || trigger === "implement_approved_plan"))
            ? "required"
            : "auto";

        const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
          messages,
          tools: allowedTools,
          tool_choice: forceToolChoice,
        }, {
          supabaseUrl,
          supabaseServiceKey,
          logPrefix: `[ads-autopilot-strategist][${VERSION}][R${round}]`,
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[ads-autopilot-strategist][${VERSION}] AI error round ${round}: ${aiResponse.status} ${errText}`);
          break;
        }

        const aiResult = await aiResponse.json();
        const assistantMessage = aiResult.choices?.[0]?.message;
        if (!assistantMessage) break;

        const toolCalls = assistantMessage.tool_calls || [];
        const aiText = assistantMessage.content || "";
        allAiText += (aiText ? `\n--- Round ${round} ---\n${aiText}` : "");

        // If no tool calls, AI is done
        if (toolCalls.length === 0) {
          console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round}: No tool calls, AI finished`);
          break;
        }

        console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round}: ${toolCalls.length} tool calls`);

        // Add assistant message to history (with tool calls)
        // FIX v1.27.0: Gemini rejects content: null — ensure it's always a string
        const sanitizedAssistant = { ...assistantMessage, content: assistantMessage.content || "" };
        messages.push(sanitizedAssistant);

        // Process each tool call and collect results
        const toolResults: any[] = [];
        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          totalPlanned++;

          // Execute the tool
          const result = await executeToolCall(supabase, tenantId, sessionId, config, tc, context);

          // Track creative URLs/briefs from generate_creative results
          if (tc.function.name === "generate_creative" && result.status === "executed") {
            const productName = args.product_name;
            // Frente 4 — Etapa 1: brief diferido (sem URL ainda)
            if ((result.data as any)?.deferred && (result.data as any)?.creative_brief && productName) {
              creativeBriefsByProduct[productName] = (result.data as any).creative_brief as CreativeBrief;
            } else {
              // v1.20.0: STRICT matching — NO fallback to prevent wrong product URL tracking
              const matchedProduct = context.products.find((p: any) => p.name.trim() === (productName || "").trim());
              if (matchedProduct) {
                const { data: latestAsset } = await supabase
                  .from("ads_creative_assets")
                  .select("asset_url")
                  .eq("tenant_id", tenantId)
                  .eq("session_id", sessionId)
                  .eq("product_id", matchedProduct.id)
                  .not("asset_url", "is", null)
                  .order("created_at", { ascending: false })
                  .limit(1);
                if (latestAsset?.[0]?.asset_url) {
                  creativeUrlsByProduct[productName] = latestAsset[0].asset_url;
                }
              }
            }
          }

          // Get campaign name for logging
          const campaignName = context.campaigns.find((c: any) => c.meta_campaign_id === args.campaign_id)?.name || args.campaign_name || null;

          // For create_campaign, try to attach the creative_url from the same session
          let creativeUrl: string | null = null;
          if (tc.function.name === "create_campaign") {
            for (const [prodName, url] of Object.entries(creativeUrlsByProduct)) {
              if (args.campaign_name?.includes(prodName) || args.targeting_description?.includes(prodName) || args.product_name === prodName) {
                creativeUrl = url;
                break;
              }
            }
            if (!creativeUrl) {
              const { data: sessionAsset } = await supabase
                .from("ads_creative_assets")
                .select("asset_url")
                .eq("tenant_id", tenantId)
                .eq("session_id", sessionId)
                .not("asset_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(1);
              creativeUrl = sessionAsset?.[0]?.asset_url || null;
            }
          }

          // Frente 4 — Anexar brief e flow_version quando for create_campaign two-step
          let twoStepFields: Record<string, any> = {};
          if (TWO_STEP_ENABLED && tc.function.name === "create_campaign") {
            let attachedBrief: CreativeBrief | null = null;
            for (const [prodName, brief] of Object.entries(creativeBriefsByProduct)) {
              if (
                args.campaign_name?.includes(prodName) ||
                args.targeting_description?.includes(prodName) ||
                args.product_name === prodName
              ) {
                attachedBrief = brief;
                break;
              }
            }
            twoStepFields = {
              flow_version: TWO_STEP_FLOW_VERSION,
              ...(attachedBrief ? { creative_brief: attachedBrief } : {}),
            };
          }

          // Record action in DB
          const actionRecord: any = {
            tenant_id: tenantId,
            session_id: sessionId,
            channel: config.channel,
            action_type: tc.function.name,
            action_data: { 
              ...args, 
              ...(result.data || {}), 
              ad_account_id: config.ad_account_id, 
              campaign_name: campaignName,
              ...(creativeUrl ? { creative_url: creativeUrl } : {}),
              ...twoStepFields,
            },
            reasoning: args.reasoning || args.reason || args.diagnosis || "",
            confidence: String(args.confidence || "0.8"),
            status: result.status,
            action_hash: `${sessionId}_${tc.function.name}_${config.ad_account_id}_${totalPlanned}`,
          };

          if (result.status === "executed" || result.status === "scheduled") {
            actionRecord.executed_at = new Date().toISOString();
            if (tc.function.name === "adjust_budget") {
              actionRecord.rollback_data = { previous_budget_cents: args.current_budget_cents };
            }
            totalExecuted++;
          } else if (result.status === "rejected") {
            actionRecord.rejection_reason = result.data?.reason || "Rejeitado pelo sistema";
            totalRejected++;
          } else if (result.status === "failed") {
            actionRecord.error_message = result.data?.error || "Erro desconhecido";
          } else if (result.status === "skipped") {
            actionRecord.rejection_reason = result.data?.reason || "Sugestão bloqueada (skipped)";
          }

          // DEDUP RULE: Before inserting a new strategic_plan, supersede any existing pending ones
          if (tc.function.name === "strategic_plan" && result.status === "pending_approval") {
            // Intra-session dedup: skip if we already inserted a strategic_plan in THIS session
            const { data: sameSessionPlans } = await supabase
              .from("ads_autopilot_actions")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("session_id", sessionId)
              .eq("action_type", "strategic_plan")
              .eq("status", "pending_approval")
              .limit(1);
            
            if (sameSessionPlans && sameSessionPlans.length > 0) {
              console.log(`[ads-autopilot-strategist][${VERSION}] Skipping duplicate strategic_plan in same session`);
              toolResults.push({
                tool_call_id: tc.id,
                role: "tool",
                content: JSON.stringify({ status: "skipped", reason: "Duplicate strategic_plan in same session" }),
              });
              continue;
            }

            // Cross-session dedup: supersede old pending plans from OTHER sessions
            const { data: existingPlans, error: fetchErr } = await supabase
              .from("ads_autopilot_actions")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("action_type", "strategic_plan")
              .eq("status", "pending_approval")
              .neq("session_id", sessionId);
            
            if (!fetchErr && existingPlans && existingPlans.length > 0) {
              const oldPlanIds = existingPlans.map((p: any) => p.id);
              console.log(`[ads-autopilot-strategist][${VERSION}] Superseding ${oldPlanIds.length} old pending strategic_plan(s)`);
              await supabase
                .from("ads_autopilot_actions")
                .update({ status: "superseded", rejection_reason: "Substituído por novo plano estratégico" })
                .in("id", oldPlanIds);
            }
          }

          // ============ CONTROLE DE VOLUME — create_campaign ============
          // Aplica cap por ciclo, cap por produto e cooldown 24h ANTES do INSERT.
          // Quando o limite é atingido a proposta entra como `superseded` (preserva
          // auditoria, fora da fila operacional). Quando a nova proposta é
          // claramente superior, substitui a mais fraca existente.
          // Não aplica para `skipped` (Quality Gate já decidiu), `failed`,
          // `executed` nem para outros tool names — apenas create_campaign
          // candidatos a `pending_approval`.
          if (
            tc.function.name === "create_campaign" &&
            actionRecord.status === "pending_approval"
          ) {
            try {
              const ad = actionRecord.action_data || {};
              const pid = ad.product_id || null;
              // creative_asset_id só é auto-injetado pelo creativeResolver quando
              // pertence ao mesmo product_id, então sua presença + product_id
              // resolvido já implica match (validado em testes do resolver).
              const creativeMatchesProduct = !!(ad.creative_asset_id && pid);

              // Carrega pending atuais da MESMA conta do mesmo trigger (ciclo + janela 24h).
              const cooldownStart = new Date(Date.now() - DEFAULT_COOLDOWN_MS).toISOString();
              const { data: existingRows } = await supabase
                .from("ads_autopilot_actions")
                .select("id, action_data, created_at")
                .eq("tenant_id", tenantId)
                .eq("channel", config.channel)
                .eq("action_type", "create_campaign")
                .eq("status", "pending_approval")
                .gte("created_at", cooldownStart);

              const existing: ExistingPendingProposal[] = (existingRows || []).map((r: any) => ({
                id: r.id,
                product_id: r.action_data?.product_id || null,
                funnel_stage: r.action_data?.funnel_stage || null,
                ad_format: r.action_data?.ad_format || null,
                campaign_name: r.action_data?.campaign_name || null,
                score: Number(r.action_data?.proposal_score ?? 0),
                created_at: r.created_at,
              }));
              const productsInCycle = new Set(
                existing.map((e) => e.product_id).filter(Boolean) as string[],
              );
              const newScore = scoreProposal(ad, {
                qualityGateOk: true,
                creativeMatchesProduct,
                productsAlreadyInCycle: productsInCycle,
              });
              const decision = applyLimits({
                args: ad,
                newScore,
                existingPending: existing,
              });

              // Anexa metadados de auditoria.
              actionRecord.action_data = {
                ...ad,
                proposal_score: newScore,
                proposal_template_key: decision.templateKey,
                proposal_limiter: {
                  version: PROPOSAL_LIMITER_VERSION,
                  decision: decision.decision,
                  reason: decision.reason || null,
                  max_per_cycle: DEFAULT_MAX_PROPOSALS_PER_CYCLE,
                  max_per_product_per_cycle: DEFAULT_MAX_PROPOSALS_PER_PRODUCT_PER_CYCLE,
                  cooldown_ms: DEFAULT_COOLDOWN_MS,
                  decided_at: new Date().toISOString(),
                },
              };

              if (decision.decision === "supersede_self") {
                actionRecord.status = "superseded";
                actionRecord.rejection_reason = `Volume limitado pelo controle de propostas: ${decision.reason}`;
                console.log(
                  `[ads-autopilot-strategist][${VERSION}] proposal-limiter SUPERSEDE_SELF product=${pid} reason=${decision.reason} score=${newScore}`,
                );
              } else if (decision.decision === "replace" && decision.supersedeIds.length > 0) {
                const { error: supErr } = await supabase
                  .from("ads_autopilot_actions")
                  .update({
                    status: "superseded",
                    rejection_reason: "Substituída por proposta de score superior",
                  })
                  .in("id", decision.supersedeIds);
                if (supErr) {
                  console.error(`[ads-autopilot-strategist][${VERSION}] proposal-limiter replace update error:`, supErr);
                } else {
                  console.log(
                    `[ads-autopilot-strategist][${VERSION}] proposal-limiter REPLACE superseded=${decision.supersedeIds.length} product=${pid} score=${newScore}`,
                  );
                }
              } else {
                console.log(
                  `[ads-autopilot-strategist][${VERSION}] proposal-limiter ACCEPT product=${pid} score=${newScore}`,
                );
              }
            } catch (limErr: any) {
              // Fail-open: limiter nunca derruba o fluxo principal.
              console.error(`[ads-autopilot-strategist][${VERSION}] proposal-limiter threw (fail-open):`, limErr?.message);
            }
          }

          await attachObservationIfEligible(actionRecord, config, supabase);

          // Onda F: vincula filhas ao plano-pai e à rodada de análise quando aplicável.
          if (
            (trigger === "implement_approved_plan" || trigger === "implement_campaigns") &&
            tc.function.name !== "strategic_plan"
          ) {
            if (sourcePlanId && !actionRecord.parent_action_id) {
              actionRecord.parent_action_id = sourcePlanId;
              actionRecord.planned_action_index = totalPlanned;
            }
            if (planAnalysisRunId && !actionRecord.analysis_run_id) {
              actionRecord.analysis_run_id = planAnalysisRunId;
            }
          } else if (tc.function.name === "strategic_plan" && (body?.analysis_run_id || null) && !actionRecord.analysis_run_id) {
            actionRecord.analysis_run_id = body.analysis_run_id;
          }

          const { error: insertErr } = await supabase.from("ads_autopilot_actions").insert(actionRecord);
          if (insertErr) {
            // Dedup esperado: filhas já geradas para mesmo (parent_action_id, planned_action_index)
            if (String((insertErr as any).code) === "23505") {
              console.log(`[ads-autopilot-strategist][${VERSION}] Dedup: child already exists for plan=${sourcePlanId} index=${actionRecord.planned_action_index}`);
            } else {
              console.error(`[ads-autopilot-strategist][${VERSION}] Action insert error:`, insertErr);
            }
          }

          // Collect tool result for the next round
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify({ status: result.status, ...result.data }),
          });
        }

        // Add tool results to messages for the next round
        for (const tr of toolResults) {
          messages.push(tr);
        }

        console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round} complete: ${toolCalls.length} tools processed, continuing...`);
        
        // v1.34.0: Early exit for start trigger — only needs one strategic_plan, no need for R2
        if (trigger === "start" && toolCalls.some((tc: any) => tc.function.name === "strategic_plan")) {
          console.log(`[ads-autopilot-strategist][${VERSION}] Start trigger: strategic_plan produced, exiting loop early`);
          break;
        }
      }

      if (round >= MAX_ROUNDS) {
        console.warn(`[ads-autopilot-strategist][${VERSION}] Hit MAX_ROUNDS (${MAX_ROUNDS}) for account ${config.ad_account_id}`);
      }

      // ===== POST-PROCESSING: Link creative URLs to campaign actions =====
      try {
        const { data: pendingCampaigns } = await supabase
          .from("ads_autopilot_actions")
          .select("id, action_data")
          .eq("tenant_id", tenantId)
          .eq("session_id", sessionId)
          .eq("action_type", "create_campaign")
          .eq("status", "pending_approval");

        for (const campaign of (pendingCampaigns || [])) {
          const cData = campaign.action_data as Record<string, any> || {};
          const cPreview = cData.preview || {};
          if (cData.creative_url || cPreview.creative_url) continue;

          const productId = cData.product_id || cPreview.product_id;
          let resolvedUrl: string | null = null;

          if (productId) {
            const { data: asset } = await supabase
              .from("ads_creative_assets")
              .select("asset_url")
              .eq("tenant_id", tenantId)
              .eq("product_id", productId)
              .not("asset_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(1);
            resolvedUrl = asset?.[0]?.asset_url || null;
          }

          if (!resolvedUrl) {
            const { data: sessionAsset } = await supabase
              .from("ads_creative_assets")
              .select("asset_url")
              .eq("tenant_id", tenantId)
              .eq("session_id", sessionId)
              .not("asset_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(1);
            resolvedUrl = sessionAsset?.[0]?.asset_url || null;
          }

          if (!resolvedUrl && productId) {
            const { data: prodImg } = await supabase
              .from("product_images")
              .select("url")
              .eq("product_id", productId)
              .order("sort_order", { ascending: true })
              .limit(1);
            resolvedUrl = prodImg?.[0]?.url || null;
          }

          if (resolvedUrl) {
            const updatedData = { ...cData, creative_url: resolvedUrl, preview: { ...cPreview, creative_url: resolvedUrl } };
            await supabase.from("ads_autopilot_actions").update({ action_data: updatedData }).eq("id", campaign.id);
            console.log(`[ads-autopilot-strategist][${VERSION}] Post-process: linked creative_url to campaign ${campaign.id}`);
          }
        }
      } catch (ppErr: any) {
        console.error(`[ads-autopilot-strategist][${VERSION}] Post-process creative linking error (non-blocking):`, ppErr.message);
      }

      // Save per-account session detail
      if (allAiText || totalPlanned > 0) {
        await supabase.from("ads_autopilot_sessions").insert({
          tenant_id: tenantId,
          channel: config.channel,
          trigger_type: `strategist_${trigger}`,
          motor_type: "strategist",
          ai_response_raw: allAiText,
          actions_planned: totalPlanned,
          actions_executed: totalExecuted,
          actions_rejected: totalRejected,
          context_snapshot: { ad_account_id: config.ad_account_id, trigger, rounds: round },
        });
      }

      console.log(`[ads-autopilot-strategist][${VERSION}] Account ${config.ad_account_id}: ${totalPlanned} planned, ${totalExecuted} executed, ${totalRejected} rejected (${round} rounds)`);
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] Account ${config.ad_account_id} error:`, err.message);
    }
  }

  // Update main session
  const durationMs = Date.now() - startTime;
  const { error: sessionUpdateErr } = await supabase
    .from("ads_autopilot_sessions")
    .update({
      actions_planned: totalPlanned,
      actions_executed: totalExecuted,
      actions_rejected: totalRejected,
      duration_ms: durationMs,
    })
    .eq("id", sessionId);
  if (sessionUpdateErr) {
    console.error(`[ads-autopilot-strategist][${VERSION}] Failed to update session ${sessionId}:`, sessionUpdateErr.message);
  }

  console.log(`[ads-autopilot-strategist][${VERSION}] ${trigger} completed: ${activeConfigs.length} accounts, ${totalPlanned} planned, ${totalExecuted} executed, ${totalRejected} rejected in ${durationMs}ms`);

  return {
    trigger,
    session_id: sessionId,
    accounts: activeConfigs.length,
    actions: { planned: totalPlanned, executed: totalExecuted, rejected: totalRejected },
    duration_ms: durationMs,
  };
}

// ============ MAIN ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-strategist][${VERSION}] Request received`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    const trigger = (body.trigger || "weekly") as StrategistTrigger;
    const targetAccountId = body.target_account_id || null;
    const revisionFeedback = body.revision_feedback || null;
    const isManualBypass = body.bypass_cadence_policy === true; // reservado a admin/sistema

    // ---- Política Operacional v1: cooldown + fila + supressão weekly×monthly ----
    if (tenantId && !isManualBypass) {
      const now = new Date();
      // Suprime weekly quando cair no mesmo sábado do mensal.
      if (trigger === "weekly" && shouldWeeklyYieldToMonthly(now)) {
        return ok({
          skipped: true,
          reason: "weekly_yielded_to_monthly_same_saturday",
          cadence_policy_version: CADENCE_POLICY_VERSION,
        });
      }

      // Mapeia trigger para cooldown e tabela de última execução.
      let cooldownTrigger: StrategistTriggerKind | null = null;
      if (trigger === "implement_campaigns") cooldownTrigger = "manual_implement_campaigns";
      else if (trigger === "weekly") cooldownTrigger = "weekly";
      else if (trigger === "monthly") cooldownTrigger = "monthly";

      if (cooldownTrigger) {
        const { data: lastSession } = await supabase
          .from("ads_autopilot_sessions")
          .select("created_at, trigger_type")
          .eq("tenant_id", tenantId)
          .eq("trigger_type", trigger)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const cooldownDecision = evaluateStrategistCooldown({
          trigger: cooldownTrigger,
          lastRunAt: lastSession?.created_at ?? null,
          now,
        });
        if (!cooldownDecision.allowed) {
          console.warn(`[ads-autopilot-strategist][${VERSION}] cooldown active for ${trigger}`);
          return ok({
            skipped: true,
            reason: cooldownDecision.reason,
            trigger,
            cooldown_ms: cooldownDecision.cooldown_ms,
            elapsed_ms: cooldownDecision.elapsed_ms,
            cadence_policy_version: CADENCE_POLICY_VERSION,
          });
        }
      }

      // Gate de fila pending_approval ≥5 — bloqueia geração estrutural.
      if (trigger === "implement_campaigns" || trigger === "weekly" || trigger === "monthly") {
        const { count: pendingCount } = await supabase
          .from("ads_autopilot_actions")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "pending_approval");

        const queueGate = evaluatePendingQueueGate({
          pendingCount: pendingCount ?? 0,
          actionType: "create_campaign",
        });
        if (!queueGate.allowed) {
          console.warn(`[ads-autopilot-strategist][${VERSION}] queue limit reached: ${pendingCount}`);
          return ok({
            skipped: true,
            reason: "pending_queue_limit_reached",
            pending_count: pendingCount,
            max_queue: MAX_PENDING_APPROVAL_QUEUE,
            cadence_policy_version: CADENCE_POLICY_VERSION,
          });
        }
      }
    }


    // Cron mode: run for all tenants with active accounts
    if (!tenantId) {
      const { data: activeConfigs } = await supabase
        .from("ads_autopilot_account_configs")
        .select("tenant_id")
        .eq("is_ai_enabled", true)
        .is("kill_switch", false);

      const tenantIds = [...new Set((activeConfigs || []).map((c: any) => c.tenant_id))];
      console.log(`[ads-autopilot-strategist][${VERSION}] Cron ${trigger}: ${tenantIds.length} tenants`);

      const results: any[] = [];
      for (const tid of tenantIds) {
        try {
          const result = await runStrategistForTenant(supabase, tid, trigger);
          results.push({ tenant_id: tid, ...result });
        } catch (err: any) {
          results.push({ tenant_id: tid, error: err.message });
          console.error(`[ads-autopilot-strategist][${VERSION}] Error for tenant ${tid}:`, err.message);
        }
      }

      return ok({ trigger, tenants_processed: results.length, results });
    }

    // Manual invocation (with optional account filter)
    const result = await runStrategistForTenant(supabase, tenantId, trigger, targetAccountId, revisionFeedback, body);
    try {
      await chargeAfter({
        tenantId,
        serviceKey: "gemini.gemini-2.5-flash.per_1m_tokens_in",
        units: { tokens_in: 30000, tokens_out: 8000 },
        jobId: crypto.randomUUID(),
        feature: "ads-autopilot-strategist",
        metadata: { trigger, target_account_id: targetAccountId },
      });
    } catch (e) { console.warn("[ads-autopilot-strategist] charge skipped", String(e)); }
    return ok(result);
  } catch (err: any) {
    console.error(`[ads-autopilot-strategist][${VERSION}] Fatal:`, err.message);
    return fail(err.message || "Erro interno");
  }
});
