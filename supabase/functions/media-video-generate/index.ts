import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VideoGenerateRequest {
  tenant_id: string;
  calendar_item_id?: string;
  campaign_id?: string;
  product_id?: string;
  product_image_url?: string;
  prompt: string;
  preset_id?: string;
  niche?: string;
  duration_seconds?: number;
  variation_count?: number;
  enable_qa?: boolean;
  enable_fallback?: boolean;
}

interface ShotPlan {
  opening: string;
  main_action: string;
  closing: string;
  camera_movement: string;
  lighting_notes: string;
  duration_seconds: number;
  style_tokens: string[];
}

// Pipeline stages
const STAGES = {
  PENDING: 0,
  PREPROCESS: 1,
  REWRITE: 2,
  GENERATE_CANDIDATES: 3,
  QA_SELECT: 4,
  RETRY: 5,
  FALLBACK: 6,
  COMPLETED: 7,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  resetAIRouterCache();

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: VideoGenerateRequest = await req.json();
    const {
      tenant_id,
      calendar_item_id,
      campaign_id,
      product_id,
      product_image_url,
      prompt,
      preset_id,
      niche = "social_product",
      duration_seconds = 6,
      variation_count = 4,
      enable_qa = true,
      enable_fallback = true,
    } = body;

    if (!tenant_id || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id and prompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[media-video-generate v${VERSION}] Starting job for tenant ${tenant_id}`);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    // Load category profile for QA weights
    const { data: categoryProfile } = await supabase
      .from("media_category_profiles")
      .select("*")
      .eq("niche", niche)
      .single();

    const qaThreshold = categoryProfile?.qa_pass_threshold ?? 0.70;

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("media_video_jobs")
      .insert({
        tenant_id,
        calendar_item_id: calendar_item_id || null,
        campaign_id: campaign_id || null,
        product_id: product_id || null,
        product_image_url: product_image_url || null,
        original_prompt: prompt,
        preset_id: preset_id || null,
        niche,
        duration_seconds,
        variation_count,
        status: "pending",
        current_stage: STAGES.PENDING,
        provider: "openai",
        model: "sora",
        qa_threshold: qaThreshold,
        created_by: userId,
        metadata: {
          version: VERSION,
          enable_qa,
          enable_fallback,
          category_weights: categoryProfile ? {
            product_fidelity: categoryProfile.product_fidelity_weight,
            label_ocr: categoryProfile.label_ocr_weight,
            quality: categoryProfile.quality_weight,
            temporal_stability: categoryProfile.temporal_stability_weight,
          } : null,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error("[media-video-generate] Job creation failed:", jobError);
      throw jobError;
    }

    console.log(`[media-video-generate] Job created: ${job.id}`);

    // Start async pipeline processing
    const processPromise = processVideoPipeline(
      supabase,
      job.id,
      tenant_id,
      prompt,
      product_image_url,
      niche,
      duration_seconds,
      variation_count,
      enable_qa,
      enable_fallback,
      qaThreshold,
      categoryProfile,
      lovableApiKey
    );

    // Use waitUntil if available (Deno Deploy), otherwise fire-and-forget
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
      (globalThis as any).EdgeRuntime.waitUntil(processPromise);
    } else {
      processPromise.catch((err) => {
        console.error("[media-video-generate] Background processing error:", err);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: "pending",
        message: "Video generation job queued. Pipeline will process in background.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[media-video-generate v${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processVideoPipeline(
  supabase: any,
  jobId: string,
  tenantId: string,
  originalPrompt: string,
  productImageUrl: string | undefined,
  niche: string,
  durationSeconds: number,
  variationCount: number,
  enableQa: boolean,
  enableFallback: boolean,
  qaThreshold: number,
  categoryProfile: any,
  lovableApiKey: string | undefined
) {
  try {
    // ========================================
    // Stage 1: PREPROCESS
    // ========================================
    await updateJobStage(supabase, jobId, "preprocess", STAGES.PREPROCESS);
    console.log(`[media-video-generate] Stage 1: PREPROCESS for job ${jobId}`);

    let cutoutUrl: string | null = null;
    let maskUrl: string | null = null;

    if (productImageUrl) {
      // In production, we would call a background removal service here
      // For now, we'll use the original image as the "cutout"
      cutoutUrl = productImageUrl;
      console.log(`[media-video-generate] Using product image as cutout: ${cutoutUrl}`);
    }

    await supabase
      .from("media_video_jobs")
      .update({
        product_cutout_url: cutoutUrl,
        product_mask_url: maskUrl,
        stage_results: { preprocess: { completed: true, cutout_url: cutoutUrl } },
      })
      .eq("id", jobId);

    // ========================================
    // Stage 2: REWRITE PROMPT
    // ========================================
    await updateJobStage(supabase, jobId, "rewrite", STAGES.REWRITE);
    console.log(`[media-video-generate] Stage 2: REWRITE for job ${jobId}`);

    const shotPlan = await rewritePromptToShotPlan(
      originalPrompt,
      niche,
      durationSeconds,
      categoryProfile
    );

    const rewrittenPrompt = buildVideoPrompt(shotPlan, productImageUrl ? true : false);

    await supabase
      .from("media_video_jobs")
      .update({
        rewritten_prompt: rewrittenPrompt,
        shot_plan: shotPlan,
        stage_results: {
          preprocess: { completed: true, cutout_url: cutoutUrl },
          rewrite: { completed: true, shot_plan: shotPlan },
        },
      })
      .eq("id", jobId);

    // ========================================
    // Stage 3: GENERATE CANDIDATES
    // ========================================
    await updateJobStage(supabase, jobId, "generate_candidates", STAGES.GENERATE_CANDIDATES);
    console.log(`[media-video-generate] Stage 3: GENERATE CANDIDATES for job ${jobId}`);

    // Create candidate records
    const candidates = [];
    for (let i = 0; i < variationCount; i++) {
      const { data: candidate, error } = await supabase
        .from("media_video_candidates")
        .insert({
          job_id: jobId,
          tenant_id: tenantId,
          candidate_index: i,
          status: "pending",
        })
        .select()
        .single();

      if (!error && candidate) {
        candidates.push(candidate);
      }
    }

    console.log(`[media-video-generate] Created ${candidates.length} candidate records`);

    // Simulate video generation (in production, call OpenAI Sora API)
    // For now, we'll mark candidates as completed with mock URLs
    for (const candidate of candidates) {
      await supabase
        .from("media_video_candidates")
        .update({
          status: "completed",
          video_url: `https://placeholder-video-${candidate.candidate_index}.mp4`,
          thumbnail_url: `https://placeholder-thumb-${candidate.candidate_index}.jpg`,
          duration_seconds: durationSeconds,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);
    }

    // ========================================
    // Stage 4: QA SELECT
    // ========================================
    if (enableQa) {
      await updateJobStage(supabase, jobId, "qa_select", STAGES.QA_SELECT);
      console.log(`[media-video-generate] Stage 4: QA SELECT for job ${jobId}`);

      // Fetch updated candidates
      const { data: completedCandidates } = await supabase
        .from("media_video_candidates")
        .select("*")
        .eq("job_id", jobId)
        .eq("status", "completed");

      if (completedCandidates && completedCandidates.length > 0) {
        // Calculate QA scores for each candidate
        const weights = {
          similarity: categoryProfile?.product_fidelity_weight ?? 0.40,
          labelOcr: categoryProfile?.label_ocr_weight ?? 0.30,
          quality: categoryProfile?.quality_weight ?? 0.30,
          temporal: categoryProfile?.temporal_stability_weight ?? 0.00,
        };

        let bestCandidate = null;
        let bestScore = 0;

        for (const candidate of completedCandidates) {
          // Simulate QA scoring (in production, use vision AI)
          const scores = {
            similarity: 0.75 + Math.random() * 0.20,
            labelOcr: 0.70 + Math.random() * 0.25,
            quality: 0.80 + Math.random() * 0.15,
            temporal: 0.85 + Math.random() * 0.10,
          };

          const finalScore =
            scores.similarity * weights.similarity +
            scores.labelOcr * weights.labelOcr +
            scores.quality * weights.quality +
            scores.temporal * weights.temporal;

          const qaPassed = finalScore >= qaThreshold;

          await supabase
            .from("media_video_candidates")
            .update({
              similarity_score: scores.similarity,
              label_ocr_score: scores.labelOcr,
              quality_score: scores.quality,
              temporal_stability_score: scores.temporal,
              final_score: finalScore,
              qa_passed: qaPassed,
              qa_details: { weights, scores, threshold: qaThreshold },
            })
            .eq("id", candidate.id);

          if (qaPassed && finalScore > bestScore) {
            bestScore = finalScore;
            bestCandidate = candidate;
          }
        }

        if (bestCandidate) {
          // Mark best candidate
          await supabase
            .from("media_video_candidates")
            .update({ is_best: true, status: "selected" })
            .eq("id", bestCandidate.id);

          // Mark others as rejected
          await supabase
            .from("media_video_candidates")
            .update({ status: "rejected" })
            .eq("job_id", jobId)
            .neq("id", bestCandidate.id);

          // Complete the job
          await supabase
            .from("media_video_jobs")
            .update({
              status: "completed",
              current_stage: STAGES.COMPLETED,
              best_candidate_id: bestCandidate.id,
              output_url: bestCandidate.video_url,
              output_thumbnail_url: bestCandidate.thumbnail_url,
              qa_passed: true,
              qa_scores: { best_score: bestScore, threshold: qaThreshold },
              completed_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          console.log(`[media-video-generate] Job ${jobId} completed with best candidate ${bestCandidate.id}`);
          return;
        }
      }

      // No candidate passed QA, try retry or fallback
      if (enableFallback) {
        await handleFallback(supabase, jobId, tenantId, cutoutUrl, rewrittenPrompt, qaThreshold);
      } else {
        await supabase
          .from("media_video_jobs")
          .update({
            status: "failed",
            qa_passed: false,
            error_message: "No candidate passed QA threshold and fallback is disabled",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    } else {
      // No QA, just pick the first candidate
      const { data: firstCandidate } = await supabase
        .from("media_video_candidates")
        .select("*")
        .eq("job_id", jobId)
        .eq("status", "completed")
        .order("candidate_index")
        .limit(1)
        .single();

      if (firstCandidate) {
        await supabase
          .from("media_video_candidates")
          .update({ is_best: true, status: "selected" })
          .eq("id", firstCandidate.id);

        await supabase
          .from("media_video_jobs")
          .update({
            status: "completed",
            current_stage: STAGES.COMPLETED,
            best_candidate_id: firstCandidate.id,
            output_url: firstCandidate.video_url,
            output_thumbnail_url: firstCandidate.thumbnail_url,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    }
  } catch (error) {
    console.error(`[media-video-generate] Pipeline error for job ${jobId}:`, error);
    await supabase
      .from("media_video_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Pipeline processing failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

async function updateJobStage(supabase: any, jobId: string, status: string, stage: number) {
  const updateData: any = {
    status,
    current_stage: stage,
  };

  if (stage === STAGES.PREPROCESS) {
    updateData.started_at = new Date().toISOString();
  }

  await supabase.from("media_video_jobs").update(updateData).eq("id", jobId);
}

async function rewritePromptToShotPlan(
  originalPrompt: string,
  niche: string,
  durationSeconds: number,
  categoryProfile: any,
  _unused?: any
): Promise<ShotPlan> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await aiChatCompletion("google/gemini-2.5-flash", {
      messages: [
        {
          role: "system",
          content: `You are a video production director. Convert user prompts into structured shot plans for ${durationSeconds}-second product videos.
              
              Niche: ${niche}
              Context tokens: ${categoryProfile?.context_tokens?.join(", ") || "professional, clean"}
              Forbidden actions: ${categoryProfile?.forbidden_actions?.join(", ") || "none"}
              
              Return a JSON object with:
              - opening: Opening shot description (1-2 seconds)
              - main_action: Main product showcase action
              - closing: Closing shot description
              - camera_movement: Camera movement style
              - lighting_notes: Lighting recommendations
              - duration_seconds: Total duration
              - style_tokens: Array of style keywords`,
        },
        {
          role: "user",
          content: originalPrompt,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "create_shot_plan",
            description: "Create a structured video shot plan",
            parameters: {
              type: "object",
              properties: {
                opening: { type: "string" },
                main_action: { type: "string" },
                closing: { type: "string" },
                camera_movement: { type: "string" },
                lighting_notes: { type: "string" },
                duration_seconds: { type: "number" },
                style_tokens: { type: "array", items: { type: "string" } },
              },
              required: ["opening", "main_action", "closing", "camera_movement", "lighting_notes", "duration_seconds", "style_tokens"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "create_shot_plan" } },
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: "[media-video-generate]",
    });

    if (response.ok) {
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        return JSON.parse(toolCall.function.arguments);
      }
    }
  } catch (error) {
    console.error("[media-video-generate] LLM rewrite failed:", error);
  }

  // Fallback to basic shot plan
  return {
    opening: "Product reveal with soft lighting",
    main_action: originalPrompt,
    closing: "Product hero shot with brand focus",
    camera_movement: "slow orbit",
    lighting_notes: "soft diffused lighting",
    duration_seconds: durationSeconds,
    style_tokens: ["professional", "clean", "product-focused"],
  };
}

function buildVideoPrompt(shotPlan: ShotPlan, hasProduct: boolean): string {
  const parts = [
    `Opening: ${shotPlan.opening}`,
    `Main: ${shotPlan.main_action}`,
    `Closing: ${shotPlan.closing}`,
    `Camera: ${shotPlan.camera_movement}`,
    `Lighting: ${shotPlan.lighting_notes}`,
    `Duration: ${shotPlan.duration_seconds}s`,
    `Style: ${shotPlan.style_tokens.join(", ")}`,
  ];

  if (hasProduct) {
    parts.push("CRITICAL: Maintain exact product appearance and label fidelity throughout.");
  }

  return parts.join(". ");
}

async function handleFallback(
  supabase: any,
  jobId: string,
  tenantId: string,
  cutoutUrl: string | null,
  prompt: string,
  qaThreshold: number
) {
  await updateJobStage(supabase, jobId, "fallback", STAGES.FALLBACK);
  console.log(`[media-video-generate] Stage 6: FALLBACK for job ${jobId}`);

  // In production, this would:
  // 1. Generate a background-only video (no product)
  // 2. Composite the product cutout over each frame
  // 3. Add shadows and lighting effects

  // For now, mark as completed with fallback
  await supabase
    .from("media_video_jobs")
    .update({
      status: "completed",
      current_stage: STAGES.COMPLETED,
      fallback_used: true,
      output_url: "https://placeholder-fallback-video.mp4",
      output_thumbnail_url: "https://placeholder-fallback-thumb.jpg",
      completed_at: new Date().toISOString(),
      metadata: {
        fallback_reason: "No candidate passed QA threshold",
        qa_threshold: qaThreshold,
      },
    })
    .eq("id", jobId);

  console.log(`[media-video-generate] Job ${jobId} completed with fallback composition`);
}
