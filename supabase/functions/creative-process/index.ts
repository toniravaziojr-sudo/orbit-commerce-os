/**
 * Creative Process — Edge Function
 * 
 * Processa um job de geração de criativo, executando o pipeline de modelos.
 * Chamado pelo scheduler ou manualmente para processar jobs na fila.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configuração de endpoints
const FAL_ENDPOINTS: Record<string, string> = {
  'pixverse-swap-person': 'fal-ai/pixverse/swap',
  'pixverse-swap-bg': 'fal-ai/pixverse/swap',
  'chatterbox-voice': 'resemble-ai/chatterboxhd/speech-to-speech',
  'sync-lipsync': 'fal-ai/sync-lipsync/v2/pro',
  'sync-lipsync-final': 'fal-ai/sync-lipsync/v2/pro',
  'kling-avatar': 'fal-ai/kling-video/ai-avatar/v2/pro',
  'kling-avatar-short': 'fal-ai/kling-video/ai-avatar/v2/pro',
  'veo31-text-video': 'fal-ai/veo3.1',
  'veo31-first-last': 'fal-ai/veo3.1/first-last-frame-to-video',
  'veo31-image-video': 'fal-ai/veo3.1/image-to-video',
  'sora2-text-video': 'fal-ai/sora-2/text-to-video/pro',
  'sora2-image-video': 'fal-ai/sora-2/image-to-video/pro',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const falApiKey = Deno.env.get('FAL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
          stats: { processed: 0 }
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
        } else {
          // Usar fal.ai para vídeos
          if (!falApiKey) {
            throw new Error('FAL_API_KEY não configurada');
          }
          const result = await processFalPipeline(job, falApiKey);
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
        await supabase.rpc('increment_creative_usage', {
          p_tenant_id: job.tenant_id,
          p_cost_cents: totalCost,
        });

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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[creative-process] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processProductImage(
  job: any, 
  lovableApiKey: string
): Promise<{ urls: string[]; cost: number }> {
  const urls: string[] = [];
  const variations = job.settings?.variations || 1;
  const costPerImage = 2; // centavos

  for (let i = 0; i < variations; i++) {
    // Montar prompt para GPT Image Edit
    const scene = job.settings?.scene || 'bathroom';
    const gender = job.settings?.gender || 'any';
    const pose = job.settings?.pose || 'holding';
    
    const imagePrompt = buildImagePrompt(job.prompt, {
      scene,
      gender,
      pose,
      productName: job.product_name,
      productImageUrl: job.product_image_url,
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

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      urls.push(imageUrl);
    }
  }

  return {
    urls,
    cost: urls.length * costPerImage,
  };
}

async function processFalPipeline(
  job: any, 
  falApiKey: string
): Promise<{ urls: string[]; cost: number }> {
  const urls: string[] = [];
  let totalCost = 0;
  const pipelineSteps = job.pipeline_steps || [];

  let previousOutput: string | null = job.reference_video_url || null;

  for (const step of pipelineSteps) {
    const endpoint = FAL_ENDPOINTS[step.model_id];
    if (!endpoint) {
      console.warn(`[creative-process] Unknown model: ${step.model_id}`);
      continue;
    }

    try {
      // Montar payload baseado no modelo
      const payload = buildFalPayload(step.model_id, job, previousOutput);

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

      const submitData = await submitResponse.json();
      const requestId = submitData.request_id;

      if (!requestId) {
        throw new Error('No request_id from fal.ai');
      }

      // Poll for result (com timeout de 5 minutos)
      const maxAttempts = 60;
      let attempts = 0;
      let result: any = null;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // 5s entre polls

        const statusResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, {
          headers: {
            'Authorization': `Key ${falApiKey}`,
          },
        });

        const statusData = await statusResponse.json();

        if (statusData.status === 'COMPLETED') {
          // Buscar resultado
          const resultResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, {
            headers: {
              'Authorization': `Key ${falApiKey}`,
            },
          });
          result = await resultResponse.json();
          break;
        } else if (statusData.status === 'FAILED') {
          throw new Error(`Fal job failed: ${statusData.error || 'Unknown error'}`);
        }

        attempts++;
      }

      if (!result) {
        throw new Error('Fal job timeout');
      }

      // Extrair URL do resultado (varia por modelo)
      const outputUrl = extractOutputUrl(result, step.model_id);
      if (outputUrl) {
        urls.push(outputUrl);
        previousOutput = outputUrl;
      }

      // Estimar custo (valores aproximados)
      totalCost += getModelCost(step.model_id);

    } catch (error) {
      console.error(`[creative-process] Step ${step.step_id} failed:`, error);
      throw error;
    }
  }

  return { urls, cost: totalCost };
}

function buildImagePrompt(
  basePrompt: string, 
  options: { scene: string; gender: string; pose: string; productName?: string; productImageUrl?: string }
): string {
  const sceneDescriptions: Record<string, string> = {
    bathroom: 'in a modern bathroom with natural lighting',
    bedroom: 'in a cozy bedroom with soft lighting',
    gym: 'at a fitness gym with energetic atmosphere',
    outdoor: 'outdoors with natural sunlight',
    office: 'in a professional office setting',
    kitchen: 'in a modern kitchen',
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
  
  prompt += ` ${basePrompt}`;
  prompt += ` The product label and packaging must be clearly visible and accurate. Ultra-realistic, professional photography, 8K quality.`;

  return prompt;
}

function buildFalPayload(modelId: string, job: any, previousOutput: string | null): Record<string, unknown> {
  const settings = job.settings || {};
  
  switch (modelId) {
    case 'pixverse-swap-person':
      return {
        video_url: previousOutput || job.reference_video_url,
        image_url: job.reference_images?.[0],
        mode: 'person',
      };

    case 'pixverse-swap-bg':
      return {
        video_url: previousOutput || job.reference_video_url,
        image_url: settings.background_reference,
        mode: 'background',
        prompt: settings.background_prompt,
      };

    case 'chatterbox-voice':
      return {
        audio_url: previousOutput || job.reference_audio_url,
        target_audio_url: settings.voice_reference,
      };

    case 'sync-lipsync':
    case 'sync-lipsync-final':
      return {
        video_url: previousOutput || job.reference_video_url,
        audio_url: job.reference_audio_url,
      };

    case 'kling-avatar':
    case 'kling-avatar-short':
      return {
        prompt: job.prompt,
        image_url: job.reference_images?.[0],
        duration: settings.duration || 10,
        aspect_ratio: settings.aspect_ratio || '9:16',
      };

    case 'veo31-text-video':
    case 'sora2-text-video':
      return {
        prompt: job.prompt,
        duration: settings.duration || 10,
        aspect_ratio: settings.aspect_ratio || '16:9',
      };

    case 'veo31-first-last':
      return {
        prompt: job.prompt,
        first_frame_image: settings.first_frame || job.product_image_url,
        last_frame_image: settings.last_frame,
        duration: settings.duration || 5,
      };

    case 'veo31-image-video':
    case 'sora2-image-video':
      return {
        prompt: job.prompt,
        image_url: job.product_image_url,
        duration: settings.duration || 5,
        aspect_ratio: settings.aspect_ratio || '16:9',
      };

    default:
      return { prompt: job.prompt };
  }
}

function extractOutputUrl(result: any, modelId: string): string | null {
  // Diferentes modelos retornam em diferentes formatos
  if (result.video?.url) return result.video.url;
  if (result.video_url) return result.video_url;
  if (result.output?.url) return result.output.url;
  if (result.audio?.url) return result.audio.url;
  if (result.images?.[0]?.url) return result.images[0].url;
  if (result.url) return result.url;
  
  return null;
}

function getModelCost(modelId: string): number {
  const costs: Record<string, number> = {
    'pixverse-swap-person': 50,
    'pixverse-swap-bg': 30,
    'chatterbox-voice': 20,
    'sync-lipsync': 40,
    'sync-lipsync-final': 40,
    'kling-avatar': 80,
    'kling-avatar-short': 80,
    'veo31-text-video': 100,
    'veo31-first-last': 100,
    'veo31-image-video': 80,
    'sora2-text-video': 120,
    'sora2-image-video': 120,
    'gpt-image-edit': 2,
  };
  return costs[modelId] || 50;
}
