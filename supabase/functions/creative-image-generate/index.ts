/**
 * Creative Image Generate — Edge Function v9.0.0 (Unified Engine)
 * 
 * Uses shared visual-engine.ts resilientGenerate() for ALL image generation.
 * No more local duplicate — single pipeline for the entire system.
 * 
 * PIPELINE: GPT Image 1 → Gemini Nativa → OpenAI → Lovable Gateway
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { getFalApiKey } from "../_shared/fal-client.ts";
import {
  resilientGenerate,
  downloadImageAsBase64,
  scoreImageForRealism,
  getActualProviderFromModel,
  type ActualProvider,
  type ResilientGenerateResult,
} from "../_shared/visual-engine.ts";
import { estimateCredits } from "../_shared/credits/charge.ts";
import {
  resolveImageServiceKey,
  buildImageShadowIdempotencyKey,
} from "../_shared/credits/image-resolver.ts";
import {
  preRouteImageGeneration,
  computePreRouteMatch,
  normalizeProviderForMatch,
  PRE_ROUTER_VERSION,
  type PreRouteDecision,
} from "../_shared/credits/image-prerouter.ts";
import {
  buildShadowReservationMetadata,
  finalizeShadowReservationOutcome,
  isShadowReservationEnabled,
  SHADOW_RESERVATION_VERSION,
  SHADOW_RESERVATION_SUPPORTED_KEYS,
  type ShadowReservationMetadata,
  type PricingSnapshotInput,
  type WalletSnapshotInput,
} from "../_shared/credits/shadow-reservation.ts";
import {
  isFallbackShadowEnabled,
  recordFallbackShadowEvent,
  normalizeProviderForFallback,
  FALLBACK_SHADOW_VERSION,
} from "../_shared/credits/fallback-shadow.ts";
import {
  callReserveCreditsV2,
  callCaptureReservation,
  callReleaseReservation,
  loadLiveServiceKeys,
} from "../_shared/credits/live-v2.ts";
import { generateImageWithGptImage1, downloadImageAsBase64 as falDownloadImage } from "../_shared/fal-client.ts";

const VERSION = '10.0'; // Unified engine v10.0 (alinhado ao frontend ImageGenerationTabV3)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Custos base (em USD)
const COST_PER_IMAGE: Record<string, number> = {
  'fal-ai': 0.04,
  openai: 0.04,
  gemini: 0.02,
  lovable: 0.02,
};
const COST_PER_QA = 0.005;
const COST_MARKUP = 1.5;
const USD_TO_BRL = 5.80;

const QA_PASS_SCORE = 0.70;

type Provider = 'openai' | 'gemini';
type ImageStyle = 'product_natural' | 'person_interacting' | 'promotional';

interface QAScores {
  realism: number;
  quality: number;
  composition: number;
  label: number;
  overall: number;
}

// ========== PROMPT BUILDERS ==========

function detectProductType(productName: string): { isKit: boolean; estimatedItems: number; kitType: string } {
  const name = productName.toLowerCase().trim();
  if (/\bkit\b/i.test(name)) {
    const qtyMatch = name.match(/(\d+)\s*(?:x|un|pç|peças|itens|produtos)/i) || name.match(/kit\s+(?:com\s+)?(\d+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 3;
    return { isKit: true, estimatedItems: qty, kitType: 'kit' };
  }
  const multiplierMatch = name.match(/\(?\s*(\d+)\s*x\s*\)?/i) || name.match(/\bpack\s+(\d+)/i) || name.match(/(\d+)\s*(?:un|unidade|unidades)\b/i);
  if (multiplierMatch) {
    const qty = parseInt(multiplierMatch[1]);
    if (qty >= 2) return { isKit: true, estimatedItems: qty, kitType: 'pack' };
  }
  if (/\b(combo|conjunto|pack|coleção)\b/i.test(name)) {
    return { isKit: true, estimatedItems: 3, kitType: 'combo' };
  }
  return { isKit: false, estimatedItems: 1, kitType: 'single' };
}

function buildHandInstructions(productName: string): string {
  const { isKit, estimatedItems, kitType } = detectProductType(productName);
  if (!isKit) {
    return `🖐️ REGRA DE MÃOS:\n- A pessoa pode segurar o produto com UMA ou DUAS mãos\n- Segurar pela base/corpo, rótulo frontal VISÍVEL\n- Mãos devem parecer naturais, não forçadas`;
  }
  if (estimatedItems <= 2) {
    return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems} itens):\n- NO MÁXIMO um produto em CADA MÃO (total: 2 nas mãos)\n- Mãos devem segurar com naturalidade\n- Rótulos frontais visíveis em ambos os produtos`;
  }
  return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems}+ itens):\n- SE o kit vier em uma embalagem única: a pessoa PODE segurar a embalagem\n- SE forem produtos avulsos: NO MÁXIMO 1 em cada mão (total: 2)\n- Os produtos restantes devem estar DISPOSTOS em uma superfície próxima\n- PROIBIDO: empilhar vários produtos nas mãos`;
}

function buildPromptForStyle(config: {
  productName: string;
  style: ImageStyle;
  styleConfig: Record<string, unknown>;
  contextBrief: string;
  format: string;
}): string {
  const { productName, style, styleConfig, contextBrief, format } = config;
  const formatDesc = {
    '1:1': 'formato quadrado 1:1 (1024x1024)',
    '9:16': 'formato vertical 9:16 (1024x1792)',
    '16:9': 'formato horizontal 16:9 (1792x1024)',
  }[format] || 'formato quadrado 1:1';

  // If user provided a custom prompt, prioritize it over style templates
  if (contextBrief && contextBrief.length > 20) {
    return `FOTOGRAFIA PROFISSIONAL DE PRODUTO — ${formatDesc}

📦 PRODUTO: "${productName}"
A imagem de referência mostra o produto REAL que deve ser fielmente reproduzido.

📝 DIREÇÃO CRIATIVA DO USUÁRIO: ${contextBrief}

REGRAS OBRIGATÓRIAS:
- O produto DEVE ser IDÊNTICO à referência (cores, rótulo, formato)
- Seguir a direção criativa do usuário como prioridade
- Qualidade editorial de revista
- Foco nítido no produto

PROIBIDO:
- Alterar cores, texto ou forma do produto
- Distorcer o rótulo
- Criar variações que não existem`;
  }

  if (style === 'product_natural') {
    const env = (styleConfig?.environment as string) || 'studio';
    const lighting = (styleConfig?.lighting as string) || 'natural';
    const mood = (styleConfig?.mood as string) || 'clean';
    return `FOTOGRAFIA PROFISSIONAL DE PRODUTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nA imagem de referência mostra o produto REAL que deve ser fielmente reproduzido.\n\n🏠 CENÁRIO: ${env}\n💡 ILUMINAÇÃO: ${lighting}\n🎨 MOOD: ${mood}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\nREGRAS OBRIGATÓRIAS:\n- O produto DEVE ser IDÊNTICO à referência (cores, rótulo, formato)\n- Ambiente natural e realista, sem pessoas\n- Iluminação profissional sem sombras duras\n- Foco nítido no produto, fundo levemente desfocado\n- Qualidade editorial de revista\n\nPROIBIDO:\n- Alterar cores, texto ou forma do produto\n- Adicionar elementos não solicitados\n- Distorcer o rótulo`;
  }
  
  if (style === 'person_interacting') {
    const action = (styleConfig?.action as string) || 'holding';
    const personProfile = (styleConfig?.personProfile as string) || '';
    const tone = (styleConfig?.tone as string) || 'lifestyle';
    const actionDesc = { holding: 'segurando o produto pela base/corpo, rótulo frontal visível', using: 'aplicando/usando o produto de forma natural', showing: 'mostrando o produto para câmera com expressão confiante' }[action] || 'segurando o produto';
    const toneDesc = { ugc: 'estilo UGC caseiro e autêntico', demo: 'demonstração profissional do produto em uso', review: 'pessoa fazendo review/avaliação do produto', lifestyle: 'fotografia lifestyle editorial de alta qualidade' }[tone] || 'lifestyle editorial';
    const handRules = buildHandInstructions(productName);
    return `FOTOGRAFIA PROFISSIONAL — PESSOA COM PRODUTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nA imagem de referência mostra o produto REAL.\n\n👤 PESSOA: ${personProfile || 'pessoa atraente com aparência natural e saudável'}\n🎬 AÇÃO: ${actionDesc}\n🎨 TOM: ${toneDesc}\n\n${handRules}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\nREGRAS CRÍTICAS DE FIDELIDADE:\n- O produto será SUBSTITUÍDO por composição (Label Lock)\n- Foque em criar a CENA perfeita (pessoa, mãos, iluminação)\n- Pessoa com aparência fotorrealista, sem cara de IA\n\nQUALIDADE:\n- Resolução 4K, nitidez profissional\n- Iluminação natural ou de estúdio\n- Expressão natural, não forçada`;
  }
  
  if (style === 'promotional') {
    const intensity = (styleConfig?.effectsIntensity as string) || 'medium';
    const elements = (styleConfig?.visualElements as string[]) || [];
    const overlayText = (styleConfig?.overlayText as string) || '';
    const intensityDesc = { low: 'efeitos sutis e elegantes', medium: 'efeitos moderados com impacto visual', high: 'efeitos intensos e dramáticos' }[intensity] || 'efeitos moderados';
    const elementsDesc = elements.length > 0 ? `Elementos visuais: ${elements.join(', ')}` : '';
    return `IMAGEM PROMOCIONAL DE ALTO IMPACTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nCriar imagem publicitária de alto impacto visual.\n\n✨ INTENSIDADE DE EFEITOS: ${intensityDesc}\n${elementsDesc}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\n${overlayText ? `⚠️ TEXTO OPCIONAL: "${overlayText}"` : ''}\n\nREGRAS:\n- Visual impactante para anúncios\n- Produto deve ser o foco central\n- Preservar cores e identidade do produto\n- Efeitos não devem cobrir o rótulo\n\nESTILO:\n- Publicitário profissional\n- Cores vibrantes e contraste alto\n- Composição dinâmica`;
  }
  
  return `Fotografia profissional do produto "${productName}". ${contextBrief}`;
}

function sanitizeProviderLabel(label: string): string {
  return label.replace(/[^a-z0-9-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'unknown';
}

function getCostBucketFromProvider(provider: ActualProvider): string {
  if (provider === 'fal-ai') return 'fal-ai';
  if (provider === 'gemini') return 'gemini';
  if (provider === 'openai') return 'openai';
  return 'lovable';
}

// ========== SHADOW v2 (Motor de Créditos — Fase 3B) ==========
// Registra service_usage_events com status='shadow' SEM debitar wallet, SEM credit_ledger,
// SEM chamar provider duas vezes. Falhas viram log WARN e não afetam a geração.
async function recordImageShadowV2(supabase: any, args: {
  tenantId: string;
  jobId: string;
  variationIndex: number;
  actualProvider: ActualProvider;
  model: string;
  outputSize: string;
  quality?: string;
  providerResponseId?: string | null;
  imageUrl?: string | null;
  preRouteDecision?: PreRouteDecision | null;
  preRouterError?: string | null;
  shadowReservationMeta?: ShadowReservationMetadata | null;
}): Promise<void> {
  try {
    // 1) Verifica se tenant está habilitado em shadow_service_keys
    const { data: cfg } = await supabase
      .from('tenant_credit_motor_config')
      .select('shadow_service_keys, metadata')
      .eq('tenant_id', args.tenantId)
      .maybeSingle();
    const shadowKeys: string[] = cfg?.shadow_service_keys || [];
    const tenantMeta: Record<string, any> = cfg?.metadata || {};

    if (!shadowKeys.length) {
      console.log('[creative-image.shadow] skip: tenant_not_enabled', { tenant_id: args.tenantId });
      return;
    }

    // 2) Resolve service_key real
    const resolved = resolveImageServiceKey({
      provider: args.actualProvider,
      actualProvider: args.actualProvider,
      model: args.model,
      size: args.outputSize,
      quality: args.quality || 'medium',
    });

    if (!resolved.resolved) {
      // WARN estruturado quando evento shadow não pode ser gravado
      console.warn(JSON.stringify({
        evt: 'creative-image.shadow.event_not_recorded',
        tenant_id: args.tenantId,
        job_id: args.jobId,
        variation_index: args.variationIndex,
        actual_provider: args.actualProvider,
        actual_model: args.model,
        predicted_provider: args.preRouteDecision?.predicted_provider ?? null,
        predicted_service_key: args.preRouteDecision?.predicted_service_key ?? null,
        event_not_recorded_reason: resolved.skip_reason,
        detail: resolved.detail,
      }));
      return;
    }

    if (!shadowKeys.includes(resolved.service_key)) {
      console.log('[creative-image.shadow] skip: service_key_not_in_tenant_shadow', {
        service_key: resolved.service_key, tenant_id: args.tenantId,
      });
      return;
    }

    // 3) Estima créditos v2 (sem debitar)
    const units = { quantity: 1, size: resolved.resolution, quality: resolved.quality };
    const est = await estimateCredits({
      tenantId: args.tenantId,
      serviceKey: resolved.service_key,
      units,
      publicSafe: false,
    });
    const v2CreditsEstimated = (est.data as any)?.credits ?? (est.data as any)?.total_credits ?? null;

    // 4) Idempotency key
    const idempotencyKey = buildImageShadowIdempotencyKey({
      tenantId: args.tenantId,
      jobId: args.jobId,
      variationIndex: args.variationIndex,
      serviceKey: resolved.service_key,
      providerResponseId: args.providerResponseId,
    });

    // 5) Sidecar pre-router metadata (Fase A1) — não bloqueia shadow se ausente
    let sidecarMeta: Record<string, any> = {};
    if (args.preRouteDecision) {
      const matchInfo = computePreRouteMatch(args.preRouteDecision, {
        provider: normalizeProviderForMatch(args.actualProvider),
        model: args.model,
        service_key: resolved.service_key,
      });
      sidecarMeta = {
        pre_router_version: args.preRouteDecision.pre_router_version,
        pre_route_decision: args.preRouteDecision,
        predicted_provider: args.preRouteDecision.predicted_provider,
        predicted_model: args.preRouteDecision.predicted_model,
        predicted_service_key: args.preRouteDecision.predicted_service_key,
        actual_provider: normalizeProviderForMatch(args.actualProvider),
        actual_model: args.model,
        actual_service_key: resolved.service_key,
        pre_route_match: matchInfo.match,
        pre_route_match_dimensions: matchInfo.dimensions,
        mismatch_reason: matchInfo.mismatch_reason,
        would_block_in_live: args.preRouteDecision.would_block_in_live,
        actual_pricing_missing: false,
        no_billing: true,
      };
    } else if (args.preRouterError) {
      sidecarMeta = {
        pre_router_version: PRE_ROUTER_VERSION,
        pre_router_error: args.preRouterError,
        no_billing: true,
      };
    }

    // 6) Insert service_usage_events status='shadow' (cost_owner='platform' + tenant_id real)
    const { error: insErr } = await supabase
      .from('service_usage_events')
      .insert({
        tenant_id: args.tenantId,
        service_key: resolved.service_key,
        category: 'ai_image',
        provider: resolved.provider,
        units_json: units,
        status: 'shadow',
        cost_owner: 'platform',
        origin_function: 'creative-image-generate',
        metadata: {
          motor_version: 'v2',
          mode: 'shadow',
          shadow_for_tenant_id: args.tenantId,
          provider: args.actualProvider,
          model: args.model,
          size: args.outputSize,
          quality: args.quality || 'medium',
          provider_response_id: args.providerResponseId || null,
          image_url: args.imageUrl || null,
          v1_credits: null,
          v2_credits_estimated: v2CreditsEstimated,
          provider_cost_source: 'service_pricing_estimate',
          is_internal_shadow: true,
          idempotency_key: idempotencyKey,
          shadow_error: est.success ? null : (est.error_message || est.error_code || null),
          ...sidecarMeta,
          ...(args.shadowReservationMeta ? args.shadowReservationMeta : {}),
        },
      });

    if (insErr) {
      console.warn('[creative-image.shadow] insert failed:', insErr.message);
      return;
    }
    console.log('[creative-image.shadow] recorded', {
      tenant_id: args.tenantId, service_key: resolved.service_key, v2_credits_estimated: v2CreditsEstimated,
      pre_route_match: sidecarMeta.pre_route_match ?? null,
    });
  } catch (e: any) {
    console.warn('[creative-image.shadow] error (ignored):', e?.message || e);
  }
}

// ========== PRE-ROUTER GATE (Fase A1) + SHADOW RESERVATION GATE (Fase A2) ==========
// Avalia metadata.pre_router_enabled e metadata.shadow_reservation_enabled no tenant.
async function loadTenantMotorGates(supabase: any, tenantId: string): Promise<{
  preRouterEnabled: boolean;
  shadowReservationEnabled: boolean;
  fallbackShadowEnabled: boolean;
}> {
  try {
    const { data } = await supabase
      .from('tenant_credit_motor_config')
      .select('metadata')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const meta = (data?.metadata || {}) as Record<string, any>;
    return {
      preRouterEnabled: meta.pre_router_enabled === true,
      shadowReservationEnabled: isShadowReservationEnabled(meta),
      fallbackShadowEnabled: isFallbackShadowEnabled(meta),
    };
  } catch (e: any) {
    console.warn('[creative-image.motor-gates] check failed (default off):', e?.message || e);
    return { preRouterEnabled: false, shadowReservationEnabled: false, fallbackShadowEnabled: false };
  }
}

// Helper: lê pricing ativo da service_key prevista (apenas SELECT)
async function loadActivePricingForKey(supabase: any, serviceKey: string): Promise<PricingSnapshotInput | null> {
  try {
    const { data } = await supabase
      .from('service_pricing')
      .select('id, service_key, cost_usd, markup_pct, unit, is_active, effective_until, metadata')
      .eq('service_key', serviceKey)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      pricing_id: data.id,
      service_key: data.service_key,
      cost_usd: Number(data.cost_usd),
      markup_pct: Number(data.markup_pct),
      unit: data.unit,
      is_active: data.is_active,
      effective_until: data.effective_until,
      approved_for_live: (data.metadata as any)?.approved_for_live ?? null,
    };
  } catch (e: any) {
    console.warn('[creative-image.shadow-reservation] pricing load failed:', e?.message || e);
    return null;
  }
}

// Helper: lê wallet do tenant (apenas SELECT, jamais muta)
async function loadWalletSnapshot(supabase: any, tenantId: string): Promise<WalletSnapshotInput> {
  try {
    const { data } = await supabase
      .from('credit_wallet')
      .select('balance_credits, reserved_credits')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return {
      balance_credits: Number(data?.balance_credits ?? 0),
      reserved_credits: Number(data?.reserved_credits ?? 0),
    };
  } catch (e: any) {
    console.warn('[creative-image.shadow-reservation] wallet load failed:', e?.message || e);
    return { balance_credits: 0, reserved_credits: 0 };
  }
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[creative-image-generate v${VERSION}] Starting unified pipeline...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "OPENAI_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY não configurada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const falApiKey = await getFalApiKey(supabaseUrl, supabaseServiceKey);
    const geminiApiKey = await getCredential(supabaseUrl, supabaseServiceKey, 'GEMINI_API_KEY');
    
    console.log(`[creative-image-generate v${VERSION}] Credentials: FAL=${!!falApiKey} GEMINI=${!!geminiApiKey} OPENAI=${!!openaiApiKey} LOVABLE=✅`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isM2M = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      if (token === supabaseServiceKey) {
        isM2M = true;
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid token' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        userId = authData.user.id;
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      tenant_id, product_id, product_name, product_description, product_image_url,
      prompt, output_folder_id, settings = {},
    } = body;

    if (!tenant_id || !product_id || !product_image_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id, product_id e product_image_url são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isM2M) {
      const { data: userRole } = await supabase
        .from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', tenant_id).maybeSingle();
      if (!userRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sem permissão para este tenant' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const {
      providers = ['openai', 'gemini'] as Provider[],
      generation_style = 'product_natural' as ImageStyle,
      format = '1:1',
      variations = 1,
      style_config = {},
      enable_qa = true,
      enable_fallback = true,
      label_lock = true,
    } = settings;

    const numVariations = Math.min(Math.max(1, variations), 4);
    const enabledProviders = providers.filter((p: string) => p === 'openai' || p === 'gemini') as Provider[];
    
    if (enabledProviders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Selecione ao menos um provedor' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure folder
    let folderId: string | null = output_folder_id || null;
    if (folderId) {
      const { data: existingFolder } = await supabase.from('files').select('id').eq('id', folderId).eq('tenant_id', tenant_id).eq('is_folder', true).maybeSingle();
      if (!existingFolder) folderId = null;
    }
    if (!folderId) {
      try {
        const { ensureFolderPathEdge } = await import("../_shared/drive-register.ts");
        folderId = (await ensureFolderPathEdge(supabase, tenant_id, userId as string, "Criativos IA")) || null;
      } catch (e) {
        console.warn("[creative-image] drive-register fallback:", e);
      }
      if (!folderId) {
        const { data: folder } = await supabase.from('files').select('id').eq('tenant_id', tenant_id).eq('filename', 'Criativos IA').eq('is_folder', true).limit(1);
        folderId = folder?.[0]?.id;
        if (!folderId) {
          const { data: newFolder } = await supabase.from('files').insert({
            tenant_id, filename: 'Criativos IA', original_name: 'Criativos IA',
            storage_path: `${tenant_id}/criativos-ia/`, is_folder: true, created_by: userId,
            metadata: { source: 'creatives_module', system_managed: true },
          }).select('id').single();
          folderId = newFolder?.id;
        }
      }
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('creative_jobs')
      .insert({
        tenant_id, type: 'product_image', status: 'running',
        prompt: prompt || '', product_id, product_name, product_image_url,
        settings: {
          providers: enabledProviders, generation_style, format,
          variations: numVariations, style_config, enable_qa, enable_fallback,
          label_lock, pipeline_version: VERSION,
        },
        output_folder_id: folderId, cost_cents: 0, created_by: userId,
      })
      .select().single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar job' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobId = job.id;

    // ========== BACKGROUND PROCESSING ==========
    const processPipeline = async () => {
      try {
        const productBase64 = await downloadImageAsBase64(product_image_url);
        if (!productBase64) {
          await supabase.from('creative_jobs').update({ 
            status: 'failed', error_message: 'Não foi possível baixar a imagem do produto',
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
          return;
        }

        const descriptionContext = product_description 
          ? `\n\n📋 DESCRIÇÃO DO PRODUTO: ${product_description}` 
          : '';

        const finalPrompt = buildPromptForStyle({
          productName: product_name || 'Produto',
          style: generation_style,
          styleConfig: style_config,
          contextBrief: (prompt || '') + descriptionContext,
          format,
        });

        const allResults: Array<{
          actualProvider: ActualProvider;
          model: string;
          imageBase64: string;
          scores: QAScores;
          preRouteDecision: PreRouteDecision | null;
          preRouterError: string | null;
          shadowReservationMeta: ShadowReservationMetadata | null;
        }> = [];
        let totalCostCents = 0;

        // ===== Fase A1 + A2: gates do motor (sidecar pre-router + reserva sombra) =====
        const motorGates = await loadTenantMotorGates(supabase, tenant_id);
        const preRouterEnabled = motorGates.preRouterEnabled;
        const shadowReservationEnabled = motorGates.shadowReservationEnabled;
        console.log('[creative-image.motor-gates]', {
          tenant_id,
          pre_router_enabled: preRouterEnabled,
          pre_router_version: PRE_ROUTER_VERSION,
          shadow_reservation_enabled: shadowReservationEnabled,
          shadow_reservation_version: SHADOW_RESERVATION_VERSION,
          fallback_shadow_enabled: motorGates.fallbackShadowEnabled,
          fallback_shadow_version: FALLBACK_SHADOW_VERSION,
        });

        // ===== Fase A3.1: gate fino LIVE por service_key (Motor v2) =====
        const liveServiceKeys = await loadLiveServiceKeys(supabase, tenant_id);
        const LIVE_TARGET_KEY = 'fal.gpt-image-1.5.per_image.medium_1024';
        const liveTargetEnabled = liveServiceKeys.has(LIVE_TARGET_KEY);
        if (liveTargetEnabled) {
          console.log('[creative-image.live]', JSON.stringify({
            evt: 'live_gate_enabled',
            tenant_id,
            service_key: LIVE_TARGET_KEY,
            live_keys_count: liveServiceKeys.size,
          }));
        }

        // Cache pricing+wallet uma vez por job (apenas leitura — jamais muta)
        let pricingSnapshot: PricingSnapshotInput | null = null;
        let walletSnapshot: WalletSnapshotInput | null = null;
        if (shadowReservationEnabled) {
          const sk = SHADOW_RESERVATION_SUPPORTED_KEYS[0];
          pricingSnapshot = await loadActivePricingForKey(supabase, sk);
          walletSnapshot = await loadWalletSnapshot(supabase, tenant_id);
        }

        for (let varIdx = 0; varIdx < numVariations; varIdx++) {
          const variantPrompt = varIdx === 0 
            ? finalPrompt 
            : `${finalPrompt}\n\n🔄 VARIAÇÃO ${varIdx + 1}: Varie sutilmente ângulo, iluminação ou composição.`;

          // ===== SIDECAR PRE-ROUTER (Fase A1) — observabilidade pura, antes da chamada real =====
          let preRouteDecision: PreRouteDecision | null = null;
          let preRouterError: string | null = null;
          if (preRouterEnabled) {
            try {
              preRouteDecision = preRouteImageGeneration({
                tenant_id,
                feature: 'creative_product_image',
                job_id: jobId,
                variation_index: varIdx + 1,
                outputSize: '1024x1024',
                quality: 'medium',
                has_reference_image: !!product_image_url,
                available_keys: {
                  fal: !!falApiKey,
                  gemini: !!geminiApiKey,
                  openai: !!openaiApiKey,
                  lovable: !!lovableApiKey,
                },
              });
              console.log('[creative-image.pre-router] decision', {
                job_id: jobId,
                variation_index: varIdx + 1,
                predicted_provider: preRouteDecision.predicted_provider,
                predicted_service_key: preRouteDecision.predicted_service_key,
                would_block_in_live: preRouteDecision.would_block_in_live,
              });
            } catch (e: any) {
              preRouterError = e?.message || 'pre_router_unknown_error';
              console.warn(JSON.stringify({
                evt: 'creative-image.pre-router.error',
                tenant_id, job_id: jobId, variation_index: varIdx + 1,
                error: preRouterError,
              }));
            }
          }

          // ===== Fase A3.1 — decisão LIVE por variação (gate fino por service_key) =====
          // Para creative-image-generate medium 1024x1024 a service_key prevista é
          // fal.gpt-image-1.5.per_image.medium_1024. Quando essa chave estiver no
          // live_service_keys do tenant, ativa fluxo Motor v2 (reserve→Fal→capture/release)
          // e SUPRIME reserva sombra A2 + fallback-shadow A2.1 nesta variação.
          const isLiveVariation = liveTargetEnabled
            && (preRouteDecision?.predicted_service_key === LIVE_TARGET_KEY
                || (!preRouteDecision && true)); // conservador: usa live se gate ativo

          // ===== SHADOW RESERVATION (Fase A2) — só roda quando NÃO é live =====
          let shadowReservationMeta: ShadowReservationMetadata | null = null;
          if (
            !isLiveVariation &&
            shadowReservationEnabled &&
            preRouteDecision &&
            preRouteDecision.predicted_service_key &&
            (SHADOW_RESERVATION_SUPPORTED_KEYS as readonly string[]).includes(preRouteDecision.predicted_service_key)
          ) {
            shadowReservationMeta = buildShadowReservationMetadata({
              pricing: pricingSnapshot,
              wallet: walletSnapshot ?? { balance_credits: 0, reserved_credits: 0 },
              service_key: preRouteDecision.predicted_service_key,
              units_quantity: 1,
            });
            console.log('[creative-image.shadow-reservation] reserve', {
              job_id: jobId,
              variation_index: varIdx + 1,
              service_key: preRouteDecision.predicted_service_key,
              credits: shadowReservationMeta.shadow_reserve.credits,
              would_run: shadowReservationMeta.shadow_reserve.would_run,
              would_block: shadowReservationMeta.shadow_would_block_provider_call,
            });
          }

          // ===== LIVE branch (Fase A3.1 — Fal-only, sem fallback) =====
          let liveReservationId: string | null = null;
          let liveSuppressFallbackShadow = false;
          let result: ResilientGenerateResult;

          if (isLiveVariation) {
            liveSuppressFallbackShadow = true;

            if (!falApiKey || !product_image_url) {
              console.warn('[creative-image.live]', JSON.stringify({
                evt: 'live_skipped_missing_prereq',
                has_fal_key: !!falApiKey,
                has_ref: !!product_image_url,
              }));
              continue;
            }

            const liveMetadata = {
              motor_version: 'v2',
              pipeline_version: VERSION,
              provider: 'fal',
              model: 'gpt-image-1.5',
              service_key: LIVE_TARGET_KEY,
              quality: 'medium',
              size: '1024x1024',
              variation_index: varIdx + 1,
              tenant_id,
              creative_job_id: jobId,
              feature: 'creative_image',
            };

            const reserve = await callReserveCreditsV2(supabase, {
              tenantId: tenant_id,
              userId: userId,
              serviceKey: LIVE_TARGET_KEY,
              units: { images: 1 },
              jobId,
              variationIndex: varIdx + 1,
              feature: 'creative_image',
              metadata: liveMetadata,
              reservationTtlMinutes: 30,
            });

            if (!reserve.success || !reserve.reservationId) {
              // não chama provider; segue para próxima variação
              continue;
            }
            liveReservationId = reserve.reservationId;

            // Chamada Fal direta — sem cadeia de fallback
            console.log('[creative-image.live]', JSON.stringify({
              evt: 'provider_started',
              provider: 'fal',
              reservation_id: liveReservationId,
              variation_index: varIdx + 1,
            }));
            const providerStartedAt = Date.now();
            try {
              const gptResult = await generateImageWithGptImage1(
                falApiKey,
                variantPrompt,
                [product_image_url],
                '1024x1024',
              );
              const b64 = gptResult?.imageUrl ? await falDownloadImage(gptResult.imageUrl) : null;
              if (!b64) throw new Error('fal_no_image');
              const latencyMs = Date.now() - providerStartedAt;
              console.log('[creative-image.live]', JSON.stringify({
                evt: 'provider_success',
                reservation_id: liveReservationId,
                latency_ms: latencyMs,
              }));

              const capture = await callCaptureReservation(supabase, {
                tenantId: tenant_id,
                reservationId: liveReservationId,
                actualUnits: { images: 1 },
                providerCostUsd: null,
                metadata: {
                  ...liveMetadata,
                  fal_request_id: gptResult?.requestId ?? null,
                  latency_ms: latencyMs,
                },
              });

              if (!capture.success) {
                // Incidente crítico — provider já entregou mas capture falhou.
                // Não duplica cobrança, não chama fallback. Mantém ledger reserve.
                console.error('[creative-image.live]', JSON.stringify({
                  evt: 'provider_success_capture_failed',
                  reservation_id: liveReservationId,
                  error_code: capture.errorCode,
                  error_message: capture.errorMessage,
                }));
              }

              result = {
                imageBase64: b64,
                model: 'fal-ai/gpt-image-1/edit-image',
                actualProvider: 'fal-ai',
              };
            } catch (err: any) {
              const latencyMs = Date.now() - providerStartedAt;
              console.warn('[creative-image.live]', JSON.stringify({
                evt: 'provider_failed',
                reservation_id: liveReservationId,
                latency_ms: latencyMs,
                error_message: String(err?.message || err),
              }));
              await callReleaseReservation(supabase, {
                tenantId: tenant_id,
                reservationId: liveReservationId,
                reason: 'provider_failed',
                metadata: { ...liveMetadata, error_message: String(err?.message || err) },
              });
              console.warn('[creative-image.live]', JSON.stringify({
                evt: 'fallback_blocked_without_pricing',
                reservation_id: liveReservationId,
                live_behavior: 'block_without_pricing',
              }));
              continue; // não tenta Gemini/OpenAI/Lovable em live
            }
          } else {
            // Use unified resilientGenerate from visual-engine (INALTERADO)
            result = await resilientGenerate({
              lovableApiKey,
              openaiApiKey,
              geminiApiKey,
              falApiKey,
              prompt: variantPrompt,
              referenceImageBase64: productBase64,
              referenceImageUrl: product_image_url,
              outputSize: '1024x1024',
              slotLabel: `product-v${varIdx + 1}`,
            });
          }

          // ===== SHADOW RESERVATION (Fase A2) — finalização capture/release =====
          if (shadowReservationMeta) {
            shadowReservationMeta = finalizeShadowReservationOutcome(shadowReservationMeta, {
              succeeded: !!result.imageBase64,
              failure_reason: result.imageBase64 ? null : (result.error || 'generation_failed'),
            });
          }

          if (!result.imageBase64) {
            console.warn(`[creative-image] Variation ${varIdx + 1} failed: ${result.error}`);
            continue;
          }

          totalCostCents += Math.ceil((COST_PER_IMAGE[getCostBucketFromProvider(result.actualProvider)] || 0.02) * COST_MARKUP * USD_TO_BRL * 100);

          let scores: QAScores = { realism: 7, quality: 7, composition: 7, label: 7, overall: 0.7 };
          if (enable_qa) {
            scores = await scoreImageForRealism(lovableApiKey, result.imageBase64, productBase64, product_name || 'Produto');
            totalCostCents += Math.ceil(COST_PER_QA * COST_MARKUP * USD_TO_BRL * 100);
          }

          allResults.push({
            actualProvider: result.actualProvider,
            model: result.model,
            imageBase64: result.imageBase64,
            scores,
            preRouteDecision,
            preRouterError,
            shadowReservationMeta,
            liveSuppressFallbackShadow,
          });
        }


        allResults.sort((a, b) => b.scores.overall - a.scores.overall);

        // Upload results
        const uploadedImages: Array<{
          url: string; actualProvider: ActualProvider; model: string;
          scores: QAScores; isWinner: boolean;
        }> = [];

        for (let i = 0; i < allResults.length; i++) {
          const result = allResults[i];
          const storagePath = `${tenant_id}/${jobId}/${sanitizeProviderLabel(result.actualProvider)}_${i + 1}.png`;
          
          try {
            const binaryData = Uint8Array.from(atob(result.imageBase64), c => c.charCodeAt(0));
            const { error: uploadError } = await supabase.storage.from('media-assets').upload(storagePath, binaryData, { contentType: 'image/png', upsert: true });
            if (uploadError) { console.error('[creative-image] Upload error:', uploadError); continue; }

            const { data: publicUrlData } = supabase.storage.from('media-assets').getPublicUrl(storagePath);
            if (publicUrlData?.publicUrl) {
              uploadedImages.push({
                url: publicUrlData.publicUrl,
                actualProvider: result.actualProvider,
                model: result.model,
                scores: result.scores,
                isWinner: i === 0,
              });

              // SHADOW v2 — Motor de Créditos (Fase 3B + Fase A1 sidecar): roda após persistência, sem custo, sem re-chamar provider
              await recordImageShadowV2(supabase, {
                tenantId: tenant_id,
                jobId,
                variationIndex: i + 1,
                actualProvider: result.actualProvider,
                model: result.model,
                outputSize: '1024x1024',
                quality: 'medium',
                providerResponseId: null,
                imageUrl: publicUrlData.publicUrl,
                preRouteDecision: result.preRouteDecision,
                preRouterError: result.preRouterError,
                shadowReservationMeta: result.shadowReservationMeta,
              });

              // FALLBACK SHADOW (Fase A2.1) — observabilidade de vencedores fora da cobertura A2.
              // Dispara quando o provider real normalizado não é Fal OU quando A2 não emitiu reserve para esta variação.
              if (motorGates.fallbackShadowEnabled) {
                const normalized = normalizeProviderForFallback(result.actualProvider);
                const a2Covered = !!result.shadowReservationMeta && normalized === 'fal';
                if (!a2Covered) {
                  try {
                    await recordFallbackShadowEvent(supabase, {
                      tenantId: tenant_id,
                      creative_job_id: jobId,
                      variation_index: i + 1,
                      predicted_provider: result.preRouteDecision?.predicted_provider ?? null,
                      predicted_model: result.preRouteDecision?.predicted_model ?? null,
                      predicted_service_key: result.preRouteDecision?.predicted_service_key ?? null,
                      actual_provider: result.actualProvider,
                      actual_model: result.model,
                      winner_provider: result.actualProvider,
                      winner_model: result.model,
                      fallback_reason: result.shadowReservationMeta
                        ? 'winner_outside_a2_scope'
                        : (normalized === 'fal' ? 'fal_without_pricing_match' : 'winner_not_fal'),
                      providers_requested: enabledProviders,
                      enable_fallback,
                    });
                  } catch (e: any) {
                    console.warn('[creative-image.fallback-shadow] error (ignored):', e?.message || e);
                  }
                }
              }
            }
          } catch (error) {
            console.error('[creative-image] Upload error:', error);
          }
        }

        // Save results
        const elapsedMs = Date.now() - startTime;
        const finalStatus = uploadedImages.length > 0 ? 'succeeded' : 'failed';
        const winner = uploadedImages.find(img => img.isWinner);

        await supabase.from('creative_jobs').update({
          status: finalStatus,
          external_model_id: winner?.model || null,
          output_urls: uploadedImages.map(img => img.url),
          cost_cents: totalCostCents,
          processing_time_ms: elapsedMs,
          completed_at: new Date().toISOString(),
          error_message: uploadedImages.length === 0 ? 'Nenhuma imagem gerada com sucesso' : null,
          settings: {
            ...job.settings,
            results: uploadedImages.map(img => ({
              url: img.url,
              actual_provider: img.actualProvider,
              model: img.model,
              scores: img.scores,
              isWinner: img.isWinner,
            })),
            winner_provider: winner?.actualProvider,
            winner_model: winner?.model,
            winner_score: winner?.scores.overall,
          },
        }).eq('id', jobId);

        // Register files in Drive
        for (let i = 0; i < uploadedImages.length; i++) {
          const img = uploadedImages[i];
          const urlMatch = img.url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
          const actualStoragePath = urlMatch ? urlMatch[1] : `${tenant_id}/${jobId}/${sanitizeProviderLabel(img.actualProvider)}_${i + 1}.png`;
          
          const now = new Date();
          const timestamp = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          const sanitizedProduct = (product_name || 'Produto').replace(/[^a-zA-Z0-9À-ÿ]/g, '_').substring(0, 30);
          const uniqueFilename = `${sanitizedProduct}_${sanitizeProviderLabel(img.actualProvider)}_${timestamp}${img.isWinner ? '_BEST' : ''}.png`;

          try {
            await supabase.from('files').insert({
              tenant_id, folder_id: folderId, filename: uniqueFilename, original_name: uniqueFilename,
              storage_path: actualStoragePath, mime_type: 'image/png', size_bytes: null, created_by: userId,
              metadata: {
                source: 'creative_job_v3', job_id: jobId, product_id,
                provider: img.actualProvider, is_winner: img.isWinner, scores: img.scores,
                url: img.url, bucket: 'media-assets', system_managed: true,
              },
            });
          } catch (e) {
            console.error('[creative-image] Drive register error:', e);
          }
        }

        // Update ads_creative_assets
        const { data: linkedAssets } = await supabase.from('ads_creative_assets').select('id, meta, session_id').eq('tenant_id', tenant_id).eq('product_id', product_id);
        const assetsToUpdate = (linkedAssets || []).filter((a: any) => (a.meta as any)?.image_job_id === jobId);

        if (uploadedImages.length > 0) {
          const winnerUrl = winner?.url || uploadedImages[0]?.url;
          const winnerStoragePath = (() => { const m = winnerUrl?.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/); return m ? m[1] : null; })();
          
          for (const asset of assetsToUpdate) {
            const existingMeta = asset.meta as any || {};
            await supabase.from('ads_creative_assets').update({
              asset_url: winnerUrl, storage_path: winnerStoragePath, status: 'ready',
              meta: { ...existingMeta, image_status: 'completed', image_job_id: jobId, image_scores: winner?.scores },
            }).eq('id', asset.id);
          }
        } else {
          // Fallback: Drive or catalog image
          let driveFallbackUrl: string | null = null;
          if (product_id) {
            try {
              const { data: driveFolder } = await supabase.from('files').select('id').eq('tenant_id', tenant_id).eq('filename', 'Gestor de Tráfego IA').eq('is_folder', true).maybeSingle();
              if (driveFolder) {
                const { data: driveCreatives } = await supabase.from('files').select('id, filename, metadata, storage_path').eq('tenant_id', tenant_id).eq('folder_id', driveFolder.id).eq('is_folder', false).order('created_at', { ascending: false }).limit(50);
                const matchingCreatives = (driveCreatives || []).filter((f: any) => (f.metadata as any)?.product_id === product_id);
                if (matchingCreatives.length > 0) {
                  matchingCreatives.sort((a: any, b: any) => {
                    const metaA = a.metadata as any || {}; const metaB = b.metadata as any || {};
                    if (metaA.is_winner && !metaB.is_winner) return -1;
                    if (!metaA.is_winner && metaB.is_winner) return 1;
                    return (metaB.scores?.overall || 0) - (metaA.scores?.overall || 0);
                  });
                  const bestMeta = matchingCreatives[0].metadata as any || {};
                  driveFallbackUrl = bestMeta.url || null;
                  if (!driveFallbackUrl && matchingCreatives[0].storage_path) {
                    const bucket = bestMeta.bucket || 'media-assets';
                    const { data: pubUrl } = supabase.storage.from(bucket).getPublicUrl(matchingCreatives[0].storage_path);
                    driveFallbackUrl = pubUrl?.publicUrl || null;
                  }
                }
              }
            } catch (e: any) { console.error('[creative-image] Drive fallback error:', e.message); }
          }

          const fallbackUrl = driveFallbackUrl || product_image_url;
          const fallbackSource = driveFallbackUrl ? 'fallback_drive' : 'fallback_catalog';
          for (const asset of assetsToUpdate) {
            const existingMeta = asset.meta as any || {};
            await supabase.from('ads_creative_assets').update({
              asset_url: fallbackUrl, status: 'ready',
              meta: { ...existingMeta, image_status: fallbackSource, image_job_id: jobId, fallback_reason: 'All AI generation attempts failed', fallback_source: fallbackSource },
            }).eq('id', asset.id);
          }
        }

        // Sequential Pipeline Callback
        if (assetsToUpdate.length > 0) {
          try {
            const assetSessionId = assetsToUpdate[0]?.session_id || null;
            if (assetSessionId) {
              const { data: pendingAssets } = await supabase.from('ads_creative_assets').select('id').eq('tenant_id', tenant_id).eq('session_id', assetSessionId).neq('status', 'ready').limit(1);
              if (!pendingAssets || pendingAssets.length === 0) {
                await supabase.functions.invoke("ads-autopilot-strategist", { body: { tenant_id, trigger: "implement_campaigns", source_session_id: assetSessionId } });
              }
            } else {
              await supabase.functions.invoke("ads-autopilot-analyze", { body: { tenant_id, trigger_type: "creative_ready" } });
            }
          } catch (e: any) { console.error('[creative-image] Callback error:', e.message); }
        }

        console.log(`[creative-image] Pipeline complete: ${uploadedImages.length} images in ${elapsedMs}ms`);
        
      } catch (pipelineError) {
        console.error('[creative-image] Pipeline error:', pipelineError);
        await supabase.from('creative_jobs').update({
          status: 'failed', error_message: String(pipelineError), completed_at: new Date().toISOString(),
        }).eq('id', jobId);
      }
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processPipeline());
    } else {
      processPipeline().catch(console.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          job_id: jobId, status: 'running',
          message: 'Job iniciado. Acompanhe o progresso na lista.',
          pipeline_version: VERSION,
        },
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[creative-image-generate v${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
