/**
 * Creative Process — Edge Function
 * 
 * Processa um job de geração de criativo, executando o pipeline de modelos.
 * Chamado pelo scheduler ou manualmente para processar jobs na fila.
 * 
 * MODELOS ATUALIZADOS (Plano v2):
 * - Kling I2V usa start_image_url (não image_url)
 * - F5-TTS usa gen_text + ref_audio_url
 * - GPT Image usa enums corretos (size/quality)
 * - PixVerse não aceita texto para fundo
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const VERSION = '2.0.2'; // Fix Fal.ai status polling - use GET method

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configuração de endpoints (atualizados)
const FAL_ENDPOINTS: Record<string, string> = {
  // PixVerse
  'pixverse-swap-person': 'fal-ai/pixverse/swap',
  'pixverse-swap-bg': 'fal-ai/pixverse/swap',
  // Voz
  'f5-tts': 'fal-ai/f5-tts',
  'sync-lipsync': 'fal-ai/sync-lipsync/v2/pro',
  // Avatares
  'kling-avatar': 'fal-ai/kling-video/ai-avatar/v2/pro',
  'kling-avatar-mascot-pro': 'fal-ai/kling-video/ai-avatar/v2/pro',
  'kling-avatar-mascot-std': 'fal-ai/kling-video/ai-avatar/v2/standard',
  // Image-to-Video (NOVO - Plano v2)
  'kling-i2v-pro': 'fal-ai/kling-video/v2.6/pro/image-to-video',
  // Veo (apenas prompt-only)
  'veo31-text-video': 'fal-ai/veo3.1',
  // GPT Image (para gerar fundo)
  'gpt-image-bg': 'gpt-image-1.5/edit',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[creative-process v${VERSION}] Starting...`);
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar FAL_API_KEY do banco (platform_credentials) ou env var
    const falApiKey = await getCredential(supabaseUrl, supabaseServiceKey, 'FAL_API_KEY');

    // Parse body
    const body = await req.json().catch(() => ({}));
    const { job_id, limit = 5 } = body;

    let jobs: any[] = [];

    if (job_id) {
      // Processar job específico
      const { data } = await supabase
        .from('creative_jobs')
        .select('*')
        .eq('id', job_id)
        .eq('status', 'queued')
        .single();
      
      if (data) jobs = [data];
    } else {
      // Buscar jobs na fila (FIFO)
      const { data } = await supabase
        .from('creative_jobs')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(limit);
      
      jobs = data || [];
    }

    if (jobs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No jobs to process',
          stats: { processed: 0 },
          version: VERSION,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[creative-process] Processing ${jobs.length} jobs`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const job of jobs) {
      try {
        // Marcar como running
        await supabase
          .from('creative_jobs')
          .update({ 
            status: 'running', 
            started_at: new Date().toISOString() 
          })
          .eq('id', job.id);

        console.log(`[creative-process] Processing job ${job.id}, type: ${job.type}`);

        // Processar baseado no tipo
        let outputUrls: string[] = [];
        let totalCost = 0;

        if (job.type === 'product_image') {
          // Usar Lovable AI Gateway para GPT Image
          const result = await processProductImage(job, lovableApiKey!);
          outputUrls = result.urls;
          totalCost = result.cost;
        } else if (job.type === 'product_video') {
          // NOVO: Vídeos de produto sem pessoas (Kling I2V)
          if (!falApiKey) {
            throw new Error('FAL_API_KEY não configurada');
          }
          const result = await processProductVideo(job, falApiKey, lovableApiKey!);
          outputUrls = result.urls;
          totalCost = result.cost;
        } else if (job.type === 'ugc_ai_video') {
          // UGC 100% IA com produto
          if (!falApiKey) {
            throw new Error('FAL_API_KEY não configurada');
          }
          const result = await processUGCAI(job, falApiKey, lovableApiKey!);
          outputUrls = result.urls;
          totalCost = result.cost;
        } else {
          // Usar fal.ai para outros vídeos
          if (!falApiKey) {
            throw new Error('FAL_API_KEY não configurada');
          }
          const result = await processFalPipeline(job, falApiKey, lovableApiKey);
          outputUrls = result.urls;
          totalCost = result.cost;
        }

        // Marcar como succeeded
        await supabase
          .from('creative_jobs')
          .update({
            status: 'succeeded',
            output_urls: outputUrls,
            cost_cents: totalCost,
            processing_time_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Registrar uso de IA
        try {
          await supabase.rpc('increment_creative_usage', {
            p_tenant_id: job.tenant_id,
            p_cost_cents: totalCost,
          });
        } catch {
          // Ignorar se RPC não existir
        }

        results.succeeded++;
        console.log(`[creative-process] Job ${job.id} succeeded with ${outputUrls.length} outputs`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[creative-process] Job ${job.id} failed:`, errorMessage);

        await supabase
          .from('creative_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            processing_time_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        results.failed++;
        results.errors.push(`${job.id}: ${errorMessage}`);
      }

      results.processed++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats: results,
        duration_ms: Date.now() - startTime,
        version: VERSION,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[creative-process] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', version: VERSION }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ================== PROCESSADORES POR TIPO ==================

/**
 * Processa imagem de produto (GPT Image 1.5 Edit)
 * Enums corretos: size, quality, background, input_fidelity
 */
async function processProductImage(
  job: any, 
  lovableApiKey: string
): Promise<{ urls: string[]; cost: number }> {
  const urls: string[] = [];
  const settings = job.settings || {};
  const variations = settings.variations || 1;
  const costPerImage = 2; // centavos

  for (let i = 0; i < variations; i++) {
    const imagePrompt = buildImagePrompt(job.prompt, {
      scene: settings.scene || 'bathroom',
      gender: settings.gender || 'any',
      pose: settings.pose || 'holding',
      productName: job.product_name,
      productImageUrl: job.product_image_url,
      inputFidelity: settings.input_fidelity || 'high',
    });

    const messages: any[] = [
      {
        role: "user",
        content: job.product_image_url ? [
          { type: "text", text: imagePrompt },
          { type: "image_url", image_url: { url: job.product_image_url } }
        ] : imagePrompt
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
    }

    // Ler resposta como texto primeiro para evitar erros de parsing
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[processProductImage] JSON parse error. Response preview:', responseText.substring(0, 200));
      throw new Error(`Invalid JSON response from image API`);
    }
    
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      urls.push(imageUrl);
    } else {
      console.error('[processProductImage] No image URL in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image URL in API response');
    }
  }

  return {
    urls,
    cost: urls.length * costPerImage,
  };
}

/**
 * Processa vídeo de produto sem pessoas (Kling I2V v2.6 Pro)
 * NOVO no Plano v2
 */
async function processProductVideo(
  job: any,
  falApiKey: string,
  lovableApiKey: string
): Promise<{ urls: string[]; cost: number }> {
  const urls: string[] = [];
  let totalCost = 0;
  const settings = job.settings || {};

  // Determinar start_image_url
  let startImageUrl = settings.start_frame || job.product_image_url;

  // Se precisa gerar cenário premium, usar GPT Image primeiro
  if (settings.generate_scene_first && job.product_image_url) {
    console.log('[creative-process] Generating premium scene frame...');
    const scenePrompt = buildScenePrompt(settings.style_preset, job.product_name);
    
    const sceneResult = await generateWithGPTImage(
      scenePrompt,
      job.product_image_url,
      lovableApiKey,
      { inputFidelity: 'high' }
    );
    
    if (sceneResult) {
      startImageUrl = sceneResult;
      totalCost += 2;
    }
  }

  if (!startImageUrl) {
    throw new Error('start_image_url é obrigatório para Kling I2V');
  }

  // Chamar Kling I2V v2.6 Pro
  const klingPayload = {
    prompt: buildVideoPrompt(settings.style_preset, job.prompt),
    start_image_url: startImageUrl,
    end_image_url: settings.end_frame || undefined,
    duration: String(settings.duration || 5), // "5" ou "10"
    aspect_ratio: settings.aspect_ratio || '16:9',
    negative_prompt: settings.negative_prompt,
  };

  console.log('[creative-process] Calling Kling I2V:', JSON.stringify(klingPayload).substring(0, 300));

  const videoUrl = await callFalModel('kling-i2v-pro', klingPayload, falApiKey);
  if (videoUrl) {
    urls.push(videoUrl);
    totalCost += getModelCost('kling-i2v-pro');
  }

  return { urls, cost: totalCost };
}

/**
 * Processa UGC 100% IA com produto
 * Modos: scene_with_product (GPT Image + Kling I2V) ou talking_head (Kling Avatar)
 */
async function processUGCAI(
  job: any,
  falApiKey: string,
  lovableApiKey: string
): Promise<{ urls: string[]; cost: number }> {
  const urls: string[] = [];
  let totalCost = 0;
  const settings = job.settings || {};
  const mode = settings.mode || 'scene_with_product';

  if (mode === 'scene_with_product') {
    // Passo 1: Gerar keyframe com GPT Image (pessoa + produto)
    console.log('[creative-process] UGC AI: Generating keyframe with person and product...');
    
    const keyframePrompt = buildKeyframePrompt({
      productName: job.product_name,
      gender: settings.person_gender || 'female',
      age: settings.person_age || 'young',
      style: settings.person_style || 'casual',
      scenario: settings.scenario_preset || 'bathroom',
      script: job.prompt,
    });

    const keyframeUrl = await generateWithGPTImage(
      keyframePrompt,
      job.product_image_url,
      lovableApiKey,
      { inputFidelity: settings.input_fidelity || 'high' }
    );

    if (!keyframeUrl) {
      throw new Error('Falha ao gerar keyframe');
    }
    totalCost += 2;

    // Passo 2: Animar keyframe com Kling I2V
    console.log('[creative-process] UGC AI: Animating keyframe with Kling I2V...');
    
    const animationPrompt = `Natural movement, subtle gestures, ${settings.scenario_preset} ambiance`;
    const videoUrl = await callFalModel('kling-i2v-pro', {
      prompt: animationPrompt,
      start_image_url: keyframeUrl,
      duration: String(settings.duration || 5),
      aspect_ratio: settings.aspect_ratio || '9:16',
    }, falApiKey);

    if (videoUrl) {
      urls.push(videoUrl);
      totalCost += getModelCost('kling-i2v-pro');
    }

    // Passo 3 (opcional): Adicionar voiceover
    if (job.prompt && settings.voice) {
      // TODO: Implementar F5-TTS + merge de áudio
      console.log('[creative-process] UGC AI: Voiceover would be added here');
    }

  } else {
    // Talking Head: Kling Avatar v2
    const avatarPayload = {
      prompt: job.prompt,
      image_url: job.reference_images?.[0] || job.product_image_url,
      duration: settings.duration || 10,
      aspect_ratio: settings.aspect_ratio || '9:16',
    };

    const videoUrl = await callFalModel('kling-avatar', avatarPayload, falApiKey);
    if (videoUrl) {
      urls.push(videoUrl);
      totalCost += getModelCost('kling-avatar');
    }
  }

  return { urls, cost: totalCost };
}

/**
 * Processa pipeline genérico Fal.ai (UGC Client, Avatar Mascot)
 * Inclui lógica para gerar fundo por IA se necessário
 */
async function processFalPipeline(
  job: any, 
  falApiKey: string,
  lovableApiKey?: string
): Promise<{ urls: string[]; cost: number }> {
  const urls: string[] = [];
  let totalCost = 0;
  const settings = job.settings || {};
  const pipelineSteps = job.pipeline_steps || [];

  let previousOutput: string | null = job.reference_video_url || null;

  // NOVO: Se bg_mode === 'generate', gerar fundo primeiro
  if (settings.swap_background && settings.bg_mode === 'generate' && settings.bg_prompt && lovableApiKey) {
    console.log('[creative-process] Generating background image from prompt...');
    
    // Usar seed neutro (não o produto) para gerar fundo
    const bgPrompt = `${settings.bg_prompt}. Style: ${settings.bg_style || 'natural'}. High quality background, no people, no products.`;
    
    const bgImageUrl = await generateBackgroundImage(bgPrompt, lovableApiKey);
    if (bgImageUrl) {
      settings.background_reference = bgImageUrl;
      totalCost += 2;
    }
  }

  console.log(`[creative-process] Pipeline has ${pipelineSteps.length} steps:`, pipelineSteps.map((s: any) => s.model_id));

  for (const step of pipelineSteps) {
    const endpoint = FAL_ENDPOINTS[step.model_id];
    if (!endpoint) {
      console.warn(`[creative-process] Unknown model: ${step.model_id}, skipping step`);
      continue;
    }

    console.log(`[creative-process] Executing step: ${step.step_id}, model: ${step.model_id}`);

    try {
      const payload = buildFalPayload(step.model_id, job, previousOutput, settings);
      const outputUrl = await callFalModel(step.model_id, payload, falApiKey);
      
      if (outputUrl) {
        urls.push(outputUrl);
        previousOutput = outputUrl;
      }

      totalCost += getModelCost(step.model_id);

    } catch (error) {
      console.error(`[creative-process] Step ${step.step_id} failed:`, error);
      throw error;
    }
  }

  return { urls, cost: totalCost };
}

// ================== HELPERS ==================

async function callFalModel(
  modelId: string,
  payload: Record<string, unknown>,
  falApiKey: string
): Promise<string | null> {
  const endpoint = FAL_ENDPOINTS[modelId];
  if (!endpoint) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  console.log(`[creative-process] Calling Fal model ${modelId}:`, JSON.stringify(payload).substring(0, 500));

  // Submeter para fal.ai (usando queue para async)
  const submitResponse = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Fal submit error: ${submitResponse.status} - ${errorText}`);
  }

  // Parse response safely
  const submitText = await submitResponse.text();
  let submitData;
  try {
    submitData = JSON.parse(submitText);
  } catch (parseError) {
    console.error('[callFalModel] Submit JSON parse error. Response preview:', submitText.substring(0, 300));
    throw new Error(`Invalid JSON from Fal submit: ${submitText.substring(0, 100)}`);
  }
  
  const requestId = submitData.request_id;

  if (!requestId) {
    throw new Error('No request_id from fal.ai');
  }

  // Poll for result (com timeout de 5 minutos)
  const maxAttempts = 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000));

    const statusResponse = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${requestId}/status`,
      { 
        method: 'GET',
        headers: { 'Authorization': `Key ${falApiKey}` } 
      }
    );

    // Parse status safely
    const statusText = await statusResponse.text();
    let statusData;
    try {
      statusData = JSON.parse(statusText);
    } catch (parseError) {
      console.error('[callFalModel] Status JSON parse error. Response preview:', statusText.substring(0, 300));
      // Retry on parse error (might be transient)
      attempts++;
      continue;
    }

    if (statusData.status === 'COMPLETED') {
      const resultResponse = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${requestId}`,
        { 
          method: 'GET',
          headers: { 'Authorization': `Key ${falApiKey}` } 
        }
      );
      
      // Parse result safely
      const resultText = await resultResponse.text();
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        console.error('[callFalModel] Result JSON parse error. Response preview:', resultText.substring(0, 300));
        throw new Error(`Invalid JSON from Fal result: ${resultText.substring(0, 100)}`);
      }
      
      return extractOutputUrl(result, modelId);
    } else if (statusData.status === 'FAILED') {
      throw new Error(`Fal job failed: ${statusData.error || 'Unknown error'}`);
    }

    attempts++;
  }

  throw new Error('Fal job timeout');
}

async function generateWithGPTImage(
  prompt: string,
  referenceImageUrl: string,
  lovableApiKey: string,
  options: { inputFidelity?: string } = {}
): Promise<string | null> {
  try {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: referenceImageUrl } }
        ]
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generateWithGPTImage] HTTP error:', response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    // Ler resposta como texto primeiro para evitar erros de parsing
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[generateWithGPTImage] JSON parse error. Response preview:', responseText.substring(0, 200));
      throw new Error(`Invalid JSON response from image API`);
    }

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error('[generateWithGPTImage] No image URL in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image URL in response');
    }
    
    return imageUrl;
  } catch (error) {
    console.error('[generateWithGPTImage] Error:', error);
    throw error; // Re-throw para que o job falhe com mensagem clara
  }
}

async function generateBackgroundImage(
  prompt: string,
  lovableApiKey: string
): Promise<string | null> {
  try {
    const messages = [
      {
        role: "user",
        content: prompt
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error('[generateBackgroundImage] HTTP error:', response.status);
      return null;
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[generateBackgroundImage] JSON parse error. Response preview:', responseText.substring(0, 200));
      return null;
    }

    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (error) {
    console.error('[generateBackgroundImage] Error:', error);
    return null;
  }
}

function buildImagePrompt(
  basePrompt: string, 
  options: { 
    scene: string; 
    gender: string; 
    pose: string; 
    productName?: string; 
    productImageUrl?: string;
    inputFidelity?: string;
  }
): string {
  const sceneDescriptions: Record<string, string> = {
    bathroom: 'in a modern bathroom with natural lighting',
    bedroom: 'in a cozy bedroom with soft lighting',
    gym: 'at a fitness gym with energetic atmosphere',
    outdoor: 'outdoors with natural sunlight',
    office: 'in a professional office setting',
    kitchen: 'in a modern kitchen',
    studio: 'in a professional photography studio with neutral background',
  };

  const poseDescriptions: Record<string, string> = {
    holding: 'holding the product naturally',
    using: 'actively using the product',
    displaying: 'displaying the product to camera',
  };

  const genderDesc = options.gender === 'any' ? 'person' : options.gender === 'male' ? 'man' : 'woman';

  let prompt = `Create a hyper-realistic photograph of a ${genderDesc} ${sceneDescriptions[options.scene] || 'in a natural setting'}, ${poseDescriptions[options.pose] || 'holding the product'}.`;
  
  if (options.productName) {
    prompt += ` The product is "${options.productName}".`;
  }

  if (options.inputFidelity === 'high') {
    prompt += ` IMPORTANT: The product label, packaging, and colors must be preserved EXACTLY as shown in the reference image.`;
  }
  
  prompt += ` ${basePrompt}`;
  prompt += ` Ultra-realistic, professional photography, 8K quality.`;

  return prompt;
}

function buildKeyframePrompt(options: {
  productName?: string;
  gender: string;
  age: string;
  style: string;
  scenario: string;
  script?: string;
}): string {
  const ageMap: Record<string, string> = {
    young: '25-30 years old',
    middle: '40-45 years old',
    mature: '55-60 years old',
  };

  const scenarioMap: Record<string, string> = {
    bathroom: 'modern bathroom with natural light',
    bedroom: 'cozy bedroom',
    kitchen: 'bright kitchen',
    gym: 'fitness gym',
    outdoor: 'outdoor garden',
    office: 'professional office',
  };

  return `Create a hyper-realistic photograph of a ${options.gender} person, ${ageMap[options.age] || '30 years old'}, ${options.style} style, in a ${scenarioMap[options.scenario] || 'natural setting'}. They are holding or using the product "${options.productName || 'product'}". The product label and packaging must be clearly visible and accurate. Natural pose, authentic expression, professional lighting, 8K quality.`;
}

function buildScenePrompt(stylePreset: string, productName?: string): string {
  const styles: Record<string, string> = {
    'smooth_rotation': `Product showcase of ${productName || 'the product'} with premium lighting, subtle reflections, clean studio background`,
    'floating': `${productName || 'Product'} floating elegantly with soft particles around it, ethereal lighting`,
    'liquid_splash': `${productName || 'Product'} with dynamic liquid or gel splash effect, high-speed photography style`,
    'macro_closeup': `Extreme macro close-up of ${productName || 'product'} showing texture and details, shallow depth of field`,
    'tech_premium': `${productName || 'Product'} on dark premium background with dramatic rim lighting and reflections`,
    'clean_studio': `${productName || 'Product'} on pure white background, clean minimalist product photography`,
  };

  return styles[stylePreset] || `Professional product photography of ${productName || 'the product'}, high quality, commercial style`;
}

function buildVideoPrompt(stylePreset: string, basePrompt?: string): string {
  const motions: Record<string, string> = {
    'smooth_rotation': 'Slow 360 degree rotation, smooth camera movement, subtle reflections',
    'floating': 'Gentle floating motion, particles drifting around, ethereal atmosphere',
    'liquid_splash': 'Dynamic liquid movement, slow motion splash effect, high-speed capture feel',
    'macro_closeup': 'Slow dolly in, focus rack on details, shallow depth of field',
    'tech_premium': 'Dramatic reveal, rim lighting changes, sleek movements',
    'clean_studio': 'Simple rotation, clean presentation, professional product video',
  };

  return motions[stylePreset] || basePrompt || 'Natural product presentation';
}

function buildFalPayload(
  modelId: string, 
  job: any, 
  previousOutput: string | null,
  settings: Record<string, any> = {}
): Record<string, unknown> {
  const jobSettings = { ...job.settings, ...settings };
  
  switch (modelId) {
    case 'pixverse-swap-person':
      return {
        video_url: previousOutput || job.reference_video_url,
        image_url: job.reference_images?.[0],
        mode: 'person',
        resolution: jobSettings.resolution || '720p',
      };

    case 'pixverse-swap-bg':
      // PixVerse NÃO aceita texto - apenas image_url
      return {
        video_url: previousOutput || job.reference_video_url,
        image_url: jobSettings.background_reference,
        mode: 'background',
        resolution: jobSettings.resolution || '720p',
      };

    case 'f5-tts':
      // F5-TTS usa gen_text e ref_audio_url
      return {
        gen_text: jobSettings.voice_script || job.prompt,
        ref_audio_url: jobSettings.voice_reference || getVoicePresetUrl(jobSettings.voice_preset),
        ref_text: jobSettings.voice_ref_text,
        remove_silence: true,
      };

    case 'sync-lipsync':
      return {
        video_url: previousOutput || job.reference_video_url,
        audio_url: job.reference_audio_url,
        sync_mode: jobSettings.sync_mode || 'cut_off',
      };

    case 'kling-avatar':
    case 'kling-avatar-mascot-pro':
    case 'kling-avatar-mascot-std':
      return {
        prompt: job.prompt,
        image_url: job.reference_images?.[0] || job.product_image_url,
        audio_url: job.reference_audio_url,
        duration: jobSettings.duration || 10,
        aspect_ratio: jobSettings.aspect_ratio || '9:16',
      };

    case 'kling-i2v-pro':
      // Kling I2V usa start_image_url (não image_url)
      return {
        prompt: job.prompt,
        start_image_url: jobSettings.start_frame || job.product_image_url,
        end_image_url: jobSettings.end_frame || undefined,
        duration: String(jobSettings.duration || 5), // String: "5" ou "10"
        aspect_ratio: jobSettings.aspect_ratio || '16:9',
        negative_prompt: jobSettings.negative_prompt,
      };

    case 'veo31-text-video': {
      // Veo3.1 aceita apenas '4s', '6s', '8s' como duration
      const durationNum = Number(jobSettings.duration) || 8;
      const validDurations = [4, 6, 8];
      const closestDuration = validDurations.reduce((prev, curr) => 
        Math.abs(curr - durationNum) < Math.abs(prev - durationNum) ? curr : prev
      );
      return {
        prompt: job.prompt,
        duration: `${closestDuration}s`,
        aspect_ratio: jobSettings.aspect_ratio || '16:9',
      };
    }

    default:
      return { prompt: job.prompt };
  }
}

function getVoicePresetUrl(preset?: string): string | undefined {
  // TODO: Mapear para URLs reais da tabela voice_presets
  // Por enquanto, retornar undefined (F5-TTS falhará se não tiver ref_audio_url)
  return undefined;
}

function extractOutputUrl(result: any, modelId: string): string | null {
  // Diferentes modelos retornam em diferentes formatos
  if (result.video?.url) return result.video.url;
  if (result.video_url) return result.video_url;
  if (result.output?.url) return result.output.url;
  if (result.audio?.url) return result.audio.url;
  if (result.audio_url?.url) return result.audio_url.url;
  if (result.images?.[0]?.url) return result.images[0].url;
  if (result.url) return result.url;
  
  return null;
}

function getModelCost(modelId: string): number {
  const costs: Record<string, number> = {
    'pixverse-swap-person': 50,
    'pixverse-swap-bg': 30,
    'f5-tts': 10,
    'sync-lipsync': 40,
    'kling-avatar': 80,
    'kling-avatar-mascot-pro': 80,
    'kling-avatar-mascot-std': 40,
    'kling-i2v-pro': 60,
    'veo31-text-video': 100,
    'gpt-image-edit': 2,
    'gpt-image-bg': 2,
  };
  return costs[modelId] || 50;
}
