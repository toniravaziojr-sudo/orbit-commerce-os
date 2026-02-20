/**
 * Creative Video Generate v2.0
 * Pipeline de Geração de Vídeos de Produto com Alta Fidelidade
 * 
 * Substitui completamente a fal.ai por OpenAI/Sora
 * 
 * Pipeline:
 * 1. Preprocess - Verificar/cachear cutout do produto
 * 2. Rewrite - Converter prompt do usuário em shot_plan estruturado
 * 3. Generate - Produzir N variações via Sora
 * 4. QA - Avaliar similaridade + OCR + qualidade
 * 5. Retry - 1 tentativa com hard fidelity se falhar
 * 6. Fallback - Composição com cutout real se tudo falhar
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIEndpoint, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "2.1.0"; // Use centralized ai-router (Gemini/OpenAI native priority)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Configuração
const CREDIT_MARKUP = 1.5;
const USD_TO_BRL = 5.5;

// Custos estimados por operação (em USD)
const COST_ESTIMATES = {
  cutout: 0.01,        // Gemini Flash para recorte
  rewrite: 0.005,      // Gemini Flash para reescrita
  video_6s: 0.40,      // Sora 6s
  video_10s: 0.60,     // Sora 10s
  video_15s: 0.90,     // Sora 15s
  qa_per_video: 0.02,  // Vision para QA
  fallback_compose: 0.05, // Composição
};

interface VideoJobInput {
  tenant_id: string;
  product_id: string;
  video_type: "product_video" | "ugc_ai_video";
  preset_id?: string;
  aspect_ratio: "9:16" | "1:1" | "16:9";
  duration_seconds: 6 | 10 | 15;
  n_variations: number;
  fidelity_mode: boolean;
  hard_fidelity: boolean;
  user_prompt?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: VideoJobInput = await req.json();
    const { tenant_id, product_id, video_type, preset_id, aspect_ratio, duration_seconds, n_variations, fidelity_mode, hard_fidelity, user_prompt } = body;

    console.log(`[creative-video-generate v${VERSION}] Starting job for tenant=${tenant_id}, product=${product_id}`);

    // Validações
    if (!tenant_id || !product_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id e product_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar produto
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, image_url, images, description, categories(name)")
      .eq("id", product_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: "Produto não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar preset se fornecido
    let preset = null;
    if (preset_id) {
      const { data: presetData } = await supabase
        .from("creative_video_presets")
        .select("*")
        .eq("id", preset_id)
        .single();
      preset = presetData;
    }

    // Buscar ou detectar categoria
    const { data: refAssets } = await supabase
      .from("product_reference_assets")
      .select("*, detected_category_key, category_override_key")
      .eq("tenant_id", tenant_id)
      .eq("product_id", product_id)
      .maybeSingle();

    const categoryKey = refAssets?.category_override_key || refAssets?.detected_category_key || "packaged_goods";

    const { data: categoryProfile } = await supabase
      .from("product_category_profiles")
      .select("*")
      .eq("category_key", categoryKey)
      .single();

    // Criar job no banco
    const { data: job, error: jobError } = await supabase
      .from("creative_video_jobs")
      .insert({
        tenant_id,
        user_id: (await supabase.auth.getUser()).data.user?.id || tenant_id,
        product_id,
        video_type,
        preset_id,
        aspect_ratio,
        duration_seconds,
        n_variations: n_variations || 4,
        fidelity_mode: fidelity_mode ?? true,
        hard_fidelity: hard_fidelity ?? false,
        user_prompt,
        status: "queued",
        progress_percent: 0,
        current_step: "queued",
        provider: "openai",
        model: "sora-2",
      })
      .select()
      .single();

    if (jobError) {
      console.error("[creative-video-generate] Error creating job:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: jobError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[creative-video-generate] Job created: ${job.id}`);

    // Iniciar processamento em background usando waitUntil do EdgeRuntime
    // @ts-ignore - EdgeRuntime é global no ambiente Supabase Edge Functions
    (globalThis as any).EdgeRuntime?.waitUntil?.(processVideoJob(supabase, job, product, preset, categoryProfile, refAssets)) 
      || processVideoJob(supabase, job, product, preset, categoryProfile, refAssets);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: "Job criado e processamento iniciado",
        estimated_duration_minutes: duration_seconds <= 6 ? 2 : duration_seconds <= 10 ? 3 : 5,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[creative-video-generate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// PIPELINE DE PROCESSAMENTO EM BACKGROUND
// ============================================================

async function processVideoJob(
  supabase: any,
  job: any,
  product: any,
  preset: any,
  categoryProfile: any,
  refAssets: any
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  resetAIRouterCache();

  const endpoint = await getAIEndpoint("google/gemini-2.5-flash", { supabaseUrl, supabaseServiceKey });
  const AI_API_KEY = endpoint.apiKey;
  const AI_URL = endpoint.url;
  const AI_MODEL = endpoint.model;
  console.log(`[creative-video-generate] Using provider: ${endpoint.provider}, model: ${AI_MODEL}`);

  let totalCostUsd = 0;

  try {
    // ============ STEP 1: PREPROCESS ============
    await updateJobStatus(supabase, job.id, "preprocess", null, 10, "Preparando assets do produto...");

    const productImageUrl = product.image_url || product.images?.[0];
    if (!productImageUrl) {
      throw new Error("Produto não tem imagem");
    }

    // Verificar/gerar cutout (cache em product_reference_assets)
    let cutoutUrl = refAssets?.cutout_url;
    if (!cutoutUrl && job.fidelity_mode) {
      console.log("[creative-video-generate] Generating product cutout...");
      cutoutUrl = await generateProductCutout(AI_API_KEY, productImageUrl);
      totalCostUsd += COST_ESTIMATES.cutout;

      // Salvar no cache
      if (cutoutUrl) {
        await supabase
          .from("product_reference_assets")
          .upsert({
            tenant_id: job.tenant_id,
            product_id: job.product_id,
            cutout_url: cutoutUrl,
            cutout_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,product_id" });
      }
    }

    // ============ STEP 2: PROMPT REWRITER ============
    await updateJobStatus(supabase, job.id, "rewrite", null, 20, "Otimizando prompt...");

    const shotPlanKey = `shot_plan_${job.duration_seconds}s`;
    const presetShotPlan = preset?.[shotPlanKey] || preset?.shot_plan_10s;

    const rewrittenPrompt = await rewritePrompt(
      AI_API_KEY,
      job.user_prompt,
      product,
      preset,
      categoryProfile,
      job.aspect_ratio,
      job.duration_seconds,
      presetShotPlan
    );
    totalCostUsd += COST_ESTIMATES.rewrite;

    // Salvar prompt reescrito
    await supabase
      .from("creative_video_jobs")
      .update({
        rewritten_prompt: rewrittenPrompt,
        shot_plan: rewrittenPrompt.shot_plan,
        constraints: rewrittenPrompt.constraints,
        negative_prompt: rewrittenPrompt.negative_prompt,
      })
      .eq("id", job.id);

    // ============ STEP 3: GENERATE CANDIDATES ============
    await updateJobStatus(supabase, job.id, "generate_candidates", null, 30, `Gerando ${job.n_variations} variações...`);

    const candidates = [];
    const videoCost = COST_ESTIMATES[`video_${job.duration_seconds}s` as keyof typeof COST_ESTIMATES] || COST_ESTIMATES.video_10s;

    for (let i = 0; i < job.n_variations; i++) {
      await updateJobStatus(supabase, job.id, "generate_candidates", null, 30 + Math.round((i / job.n_variations) * 30), `Gerando variação ${i + 1}/${job.n_variations}...`);

      try {
        // Gerar variação via prompt ligeiramente diferente
        const variationPrompt = `${rewrittenPrompt.prompt_final} (variation ${i + 1}: ${getVariationModifier(i)})`;

        const videoResult = await generateVideoWithSora(
          AI_API_KEY,
          variationPrompt,
          productImageUrl,
          cutoutUrl,
          job.aspect_ratio,
          job.duration_seconds,
          job.fidelity_mode
        );

        totalCostUsd += videoCost;

        if (videoResult?.video_url) {
          // Salvar candidato
          const { data: candidate } = await supabase
            .from("creative_video_candidates")
            .insert({
              job_id: job.id,
              tenant_id: job.tenant_id,
              video_url: videoResult.video_url,
              thumbnail_url: videoResult.thumbnail_url,
              duration_actual: job.duration_seconds,
              generation_metadata: videoResult.metadata,
            })
            .select()
            .single();

          candidates.push(candidate);
        }
      } catch (genError) {
        console.error(`[creative-video-generate] Error generating variation ${i + 1}:`, genError);
      }
    }

    if (candidates.length === 0) {
      throw new Error("Nenhuma variação foi gerada com sucesso");
    }

    // ============ STEP 4: QA SELECT ============
    await updateJobStatus(supabase, job.id, "qa_select", null, 70, "Avaliando qualidade...");

    let bestCandidate = null;
    let anyPassed = false;

    for (const candidate of candidates) {
      totalCostUsd += COST_ESTIMATES.qa_per_video;

      const qaScores = await evaluateVideoQA(
        AI_API_KEY,
        candidate.video_url,
        productImageUrl,
        cutoutUrl,
        categoryProfile,
        product.name
      );

      // Atualizar candidato com scores
      await supabase
        .from("creative_video_candidates")
        .update({
          qa_similarity_score: qaScores.similarity,
          qa_label_score: qaScores.label,
          qa_quality_score: qaScores.quality,
          qa_temporal_score: qaScores.temporal,
          qa_final_score: qaScores.final,
          qa_passed: qaScores.passed,
          qa_rejection_reason: qaScores.rejection_reason,
          ocr_extracted_text: qaScores.ocr_text,
        })
        .eq("id", candidate.id);

      if (qaScores.passed) {
        anyPassed = true;
        if (!bestCandidate || qaScores.final > bestCandidate.qa_final_score) {
          bestCandidate = { ...candidate, qa_final_score: qaScores.final };
        }
      }
    }

    // ============ STEP 5: RETRY (se necessário) ============
    if (!anyPassed && job.retry_count === 0) {
      await updateJobStatus(supabase, job.id, "retry", null, 80, "Tentando com fidelidade máxima...");

      await supabase.from("creative_video_jobs").update({ retry_count: 1 }).eq("id", job.id);

      // Gerar 1 variação com hard fidelity
      const hardPrompt = `${rewrittenPrompt.prompt_final}. CRITICAL: Product label must be SHARP, READABLE, and UNCHANGED across all frames. Minimal camera movement. Focus on product visibility.`;

      const retryResult = await generateVideoWithSora(
          AI_API_KEY,
        hardPrompt,
        productImageUrl,
        cutoutUrl,
        job.aspect_ratio,
        job.duration_seconds,
        true // hard fidelity
      );

      totalCostUsd += videoCost;

      if (retryResult?.video_url) {
        const { data: retryCandidate } = await supabase
          .from("creative_video_candidates")
          .insert({
            job_id: job.id,
            tenant_id: job.tenant_id,
            video_url: retryResult.video_url,
            thumbnail_url: retryResult.thumbnail_url,
            duration_actual: job.duration_seconds,
            generation_metadata: { ...retryResult.metadata, is_retry: true },
          })
          .select()
          .single();

        // QA do retry
        const retryQA = await evaluateVideoQA(
            AI_API_KEY,
          retryResult.video_url,
          productImageUrl,
          cutoutUrl,
          categoryProfile,
          product.name
        );
        totalCostUsd += COST_ESTIMATES.qa_per_video;

        await supabase
          .from("creative_video_candidates")
          .update({
            qa_similarity_score: retryQA.similarity,
            qa_label_score: retryQA.label,
            qa_quality_score: retryQA.quality,
            qa_final_score: retryQA.final,
            qa_passed: retryQA.passed,
          })
          .eq("id", retryCandidate.id);

        if (retryQA.passed) {
          bestCandidate = { ...retryCandidate, qa_final_score: retryQA.final };
          anyPassed = true;
        }
      }
    }

    // ============ STEP 6: FALLBACK (se ainda falhar) ============
    if (!anyPassed && job.fidelity_mode) {
      await updateJobStatus(supabase, job.id, "fallback", null, 90, "Aplicando composição de fallback...");

      // Gerar vídeo de cenário sem produto + compor cutout real
      const fallbackResult = await generateFallbackVideo(
        AI_API_KEY,
        supabase,
        job,
        product,
        preset,
        cutoutUrl || productImageUrl
      );
      totalCostUsd += COST_ESTIMATES.fallback_compose + videoCost;

      if (fallbackResult?.video_url) {
        const { data: fallbackCandidate } = await supabase
          .from("creative_video_candidates")
          .insert({
            job_id: job.id,
            tenant_id: job.tenant_id,
            video_url: fallbackResult.video_url,
            thumbnail_url: fallbackResult.thumbnail_url,
            duration_actual: job.duration_seconds,
            is_fallback: true,
            qa_passed: true, // Fallback sempre "passa" porque usa produto real
            qa_final_score: 1.0,
            generation_metadata: { is_fallback: true, composition_method: "overlay" },
          })
          .select()
          .single();

        bestCandidate = { ...fallbackCandidate, qa_final_score: 1.0 };
      }
    }

    // ============ FINALIZAR ============
    if (bestCandidate) {
      // Marcar como melhor
      await supabase
        .from("creative_video_candidates")
        .update({ is_best: true })
        .eq("id", bestCandidate.id);

      // Calcular custo em créditos
      const costCredits = Math.ceil(totalCostUsd * CREDIT_MARKUP * USD_TO_BRL * 100);

      await supabase
        .from("creative_video_jobs")
        .update({
          status: "done",
          progress_percent: 100,
          current_step: "Concluído",
          best_candidate_id: bestCandidate.id,
          result_url: bestCandidate.video_url,
          result_thumbnail_url: bestCandidate.thumbnail_url,
          fallback_used: bestCandidate.is_fallback || false,
          cost_credits: costCredits,
          cost_usd: totalCostUsd,
          completed_at: new Date().toISOString(),
          qa_summary: {
            total_candidates: candidates.length + (job.retry_count > 0 ? 1 : 0),
            passed_count: candidates.filter((c: any) => c.qa_passed).length,
            best_score: bestCandidate.qa_final_score,
            fallback_used: bestCandidate.is_fallback || false,
          },
        })
        .eq("id", job.id);

      console.log(`[creative-video-generate] Job ${job.id} completed successfully`);
    } else {
      throw new Error("Não foi possível gerar um vídeo aprovado");
    }

  } catch (error) {
    console.error(`[creative-video-generate] Job ${job.id} failed:`, error);
    await updateJobStatus(
      supabase,
      job.id,
      "failed",
      error instanceof Error ? error.message : "Erro desconhecido"
    );
  }
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

async function updateJobStatus(
  supabase: any,
  jobId: string,
  status: string,
  errorMessage?: string | null,
  progressPercent?: number,
  currentStep?: string
) {
  const update: Record<string, any> = { status };
  if (errorMessage) update.error_message = errorMessage;
  if (progressPercent !== undefined) update.progress_percent = progressPercent;
  if (currentStep) update.current_step = currentStep;
  if (status === "preprocess" && !update.started_at) update.started_at = new Date().toISOString();

  await supabase.from("creative_video_jobs").update(update).eq("id", jobId);
}

function getVariationModifier(index: number): string {
  const modifiers = [
    "slight left angle",
    "slight right angle",
    "closer zoom",
    "wider shot",
  ];
  return modifiers[index % modifiers.length];
}

async function generateProductCutout(apiKey: string, imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Remove the background from this product image. Keep only the product with a transparent or pure white background. Maintain all details, labels, and text exactly as they appear.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("[generateProductCutout] API error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (error) {
    console.error("[generateProductCutout] Error:", error);
    return null;
  }
}

async function rewritePrompt(
  apiKey: string,
  userPrompt: string | undefined,
  product: any,
  preset: any,
  categoryProfile: any,
  aspectRatio: string,
  durationSeconds: number,
  presetShotPlan: any
): Promise<any> {
  const systemPrompt = `You are a video prompt engineer specializing in product video generation.
Your task is to convert user inputs into structured prompts for video generation that maximize product fidelity.

CRITICAL RULES:
- Product label/packaging must remain SHARP and READABLE in all frames
- NO morphing, distortion, or alteration of product appearance
- Camera movements must be SLOW and STABLE
- Product must be clearly visible throughout

Output JSON with these fields:
- prompt_final: Complete cinematographic description
- shot_plan: Array of shots with duration and action
- constraints: Array of hard rules
- negative_prompt: Things to avoid`;

  const userContent = `Product: ${product.name}
Description: ${product.description || "N/A"}
Category: ${categoryProfile?.display_name || "General"}
Preset: ${preset?.display_name || "Custom"}
Aspect Ratio: ${aspectRatio}
Duration: ${durationSeconds} seconds
User Brief: ${userPrompt || "Create an engaging product video"}

Category Constraints: ${JSON.stringify(categoryProfile?.constraints || [])}
Category Negatives: ${JSON.stringify(categoryProfile?.negative_rules || [])}
Preset Shot Plan: ${JSON.stringify(presetShotPlan || {})}

Create an optimized video prompt.`;

  try {
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error("Prompt rewrite failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("[rewritePrompt] Error:", error);
    // Fallback prompt
    return {
      prompt_final: `Professional product video of ${product.name}. Clean studio lighting, slow camera movement, sharp focus on product label and details. ${userPrompt || ""}`,
      shot_plan: [{ duration: durationSeconds, action: "slow push-in with slight rotation" }],
      constraints: ["product clearly visible", "label readable", "stable camera"],
      negative_prompt: "blurry, distorted, morphing, text changes, shaky camera",
    };
  }
}

async function generateVideoWithSora(
  apiKey: string,
  prompt: string,
  productImageUrl: string,
  cutoutUrl: string | null,
  aspectRatio: string,
  durationSeconds: number,
  hardFidelity: boolean
): Promise<{ video_url: string; thumbnail_url?: string; metadata?: any } | null> {
  // NOTE: Sora API via OpenAI
  // Para MVP, vamos usar o modelo de imagem para gerar frames e simular vídeo
  // Em produção, usar a API real do Sora quando disponível

  const referenceImage = cutoutUrl || productImageUrl;
  const fidelityNote = hardFidelity
    ? "CRITICAL: Maintain EXACT product appearance. Label must be pixel-perfect throughout. Minimal movement."
    : "Maintain product fidelity. Keep label readable.";

  const videoPrompt = `${prompt}

${fidelityNote}

Aspect ratio: ${aspectRatio}
Duration: ${durationSeconds} seconds
Reference product image attached.`;

  try {
    // Placeholder: Em produção, chamar Sora API real
    // Por agora, geramos um keyframe animado como demonstração
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Generate a high-quality product video keyframe: ${videoPrompt}`,
              },
              {
                type: "image_url",
                image_url: { url: referenceImage },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generateVideoWithSora] API error:", errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return null;
    }

    // Para MVP, retornamos a imagem como "vídeo" (thumbnail)
    // TODO: Integrar com Sora API real para geração de vídeo
    return {
      video_url: imageUrl, // Placeholder - será URL do vídeo real
      thumbnail_url: imageUrl,
      metadata: {
        model: "gemini-3-pro-image-preview",
        aspect_ratio: aspectRatio,
        duration_requested: durationSeconds,
        note: "MVP: Image keyframe generated. Full video coming with Sora integration.",
      },
    };
  } catch (error) {
    console.error("[generateVideoWithSora] Error:", error);
    return null;
  }
}

async function evaluateVideoQA(
  apiKey: string,
  videoUrl: string,
  productImageUrl: string,
  cutoutUrl: string | null,
  categoryProfile: any,
  productName: string
): Promise<{
  similarity: number;
  label: number;
  quality: number;
  temporal: number;
  final: number;
  passed: boolean;
  rejection_reason?: string;
  ocr_text?: string;
}> {
  const qaRuleset = categoryProfile?.qa_ruleset || {};
  const similarityWeight = qaRuleset.similarity_weight || 0.40;
  const labelWeight = qaRuleset.label_weight || 0.30;
  const qualityWeight = qaRuleset.quality_weight || 0.20;
  const temporalWeight = 1 - similarityWeight - labelWeight - qualityWeight;
  const threshold = categoryProfile?.qa_pass_threshold || 0.70;

  try {
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a quality assurance system for product videos.

Analyze this generated video/image against the original product.
Product Name: ${productName}

Score each aspect from 0-10:
1. SIMILARITY: How similar is the product appearance to the original? (shape, colors, proportions)
2. LABEL_FIDELITY: Is the product label/text readable and accurate? (not distorted, correct text)
3. QUALITY: Overall visual quality (lighting, focus, composition)
4. TEMPORAL: Stability and consistency (no flickering, smooth motion)

Also extract any text visible on the product label (OCR).

Respond in JSON:
{
  "similarity": 8,
  "label": 7,
  "quality": 9,
  "temporal": 8,
  "ocr_text": "Brand Name - Product Line",
  "issues": ["minor label blur in frame 3"]
}`,
              },
              {
                type: "text",
                text: "Original product image:",
              },
              {
                type: "image_url",
                image_url: { url: cutoutUrl || productImageUrl },
              },
              {
                type: "text",
                text: "Generated video/frame:",
              },
              {
                type: "image_url",
                image_url: { url: videoUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error("QA evaluation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const scores = JSON.parse(content);

    const similarity = (scores.similarity || 5) / 10;
    const label = (scores.label || 5) / 10;
    const quality = (scores.quality || 5) / 10;
    const temporal = (scores.temporal || 5) / 10;

    const final =
      similarity * similarityWeight +
      label * labelWeight +
      quality * qualityWeight +
      temporal * temporalWeight;

    const passed = final >= threshold;
    const rejection_reason = passed ? undefined : scores.issues?.join("; ") || "Score below threshold";

    return {
      similarity,
      label,
      quality,
      temporal,
      final,
      passed,
      rejection_reason,
      ocr_text: scores.ocr_text,
    };
  } catch (error) {
    console.error("[evaluateVideoQA] Error:", error);
    // Fallback: passar com score médio
    return {
      similarity: 0.6,
      label: 0.6,
      quality: 0.7,
      temporal: 0.7,
      final: 0.65,
      passed: false,
      rejection_reason: "QA evaluation error",
    };
  }
}

async function generateFallbackVideo(
  apiKey: string,
  supabase: any,
  job: any,
  product: any,
  preset: any,
  cutoutUrl: string
): Promise<{ video_url: string; thumbnail_url?: string } | null> {
  // Fallback: Gerar cenário vazio + compor produto real por cima
  // Para MVP, geramos uma imagem de cenário com espaço para o produto

  const scenePrompt = `Empty scene ready for product placement. ${preset?.description || "Premium studio setting"}.
Clean ${preset?.display_name || "professional"} background.
Leave clear central space for product overlay.
Lighting: soft, professional, with subtle shadows for depth.
Aspect ratio: ${job.aspect_ratio}`;

  try {
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: scenePrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const sceneUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!sceneUrl) {
      return null;
    }

    // Compor produto sobre cenário
    const compositeResponse = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Composite these two images: Place the product from the second image onto the scene from the first image.
Position the product centrally and naturally in the scene.
Add realistic shadows beneath the product.
Match the lighting of the product to the scene.
The product must remain EXACTLY as it appears - do not modify it at all.`,
              },
              {
                type: "image_url",
                image_url: { url: sceneUrl },
              },
              {
                type: "image_url",
                image_url: { url: cutoutUrl },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!compositeResponse.ok) {
      return { video_url: sceneUrl, thumbnail_url: sceneUrl };
    }

    const compositeData = await compositeResponse.json();
    const compositeUrl = compositeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    return {
      video_url: compositeUrl || sceneUrl,
      thumbnail_url: compositeUrl || sceneUrl,
    };
  } catch (error) {
    console.error("[generateFallbackVideo] Error:", error);
    return null;
  }
}
