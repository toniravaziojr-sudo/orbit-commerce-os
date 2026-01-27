/**
 * Creative Generate — Edge Function
 * 
 * Inicia um job de geração de criativo (vídeo/imagem) e enfileira para processamento.
 * Suporta 5 tipos: ugc_client_video, ugc_ai_video, short_video, tech_product_video, product_image
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configuração de modelos por tipo
const MODEL_CONFIGS: Record<string, { endpoint: string; provider: string; costEstimate: number }> = {
  // UGC Client Video
  'pixverse-swap-person': { endpoint: 'fal-ai/pixverse/swap', provider: 'fal', costEstimate: 50 },
  'pixverse-swap-bg': { endpoint: 'fal-ai/pixverse/swap', provider: 'fal', costEstimate: 30 },
  'chatterbox-voice': { endpoint: 'resemble-ai/chatterboxhd/speech-to-speech', provider: 'fal', costEstimate: 20 },
  'sync-lipsync': { endpoint: 'fal-ai/sync-lipsync/v2/pro', provider: 'fal', costEstimate: 40 },
  
  // UGC AI Video
  'kling-avatar': { endpoint: 'fal-ai/kling-video/ai-avatar/v2/pro', provider: 'fal', costEstimate: 80 },
  'veo31-text-video': { endpoint: 'fal-ai/veo3.1', provider: 'fal', costEstimate: 100 },
  'sora2-text-video': { endpoint: 'fal-ai/sora-2/text-to-video/pro', provider: 'fal', costEstimate: 120 },
  
  // Short Video
  'kling-avatar-short': { endpoint: 'fal-ai/kling-video/ai-avatar/v2/pro', provider: 'fal', costEstimate: 80 },
  'sync-lipsync-final': { endpoint: 'fal-ai/sync-lipsync/v2/pro', provider: 'fal', costEstimate: 40 },
  
  // Tech Product Video
  'veo31-first-last': { endpoint: 'fal-ai/veo3.1/first-last-frame-to-video', provider: 'fal', costEstimate: 100 },
  'veo31-image-video': { endpoint: 'fal-ai/veo3.1/image-to-video', provider: 'fal', costEstimate: 80 },
  'sora2-image-video': { endpoint: 'fal-ai/sora-2/image-to-video/pro', provider: 'fal', costEstimate: 120 },
  
  // Product Image
  'gpt-image-edit': { endpoint: 'gpt-image-1.5/edit', provider: 'openai', costEstimate: 2 },
};

// Tipos válidos
const VALID_TYPES = ['ugc_client_video', 'ugc_ai_video', 'short_video', 'tech_product_video', 'product_image'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Parse body
    const body = await req.json();
    const { 
      tenant_id, 
      type, 
      prompt, 
      product_id,
      product_name,
      product_image_url,
      reference_images,
      reference_video_url,
      reference_audio_url,
      settings,
      has_authorization 
    } = body;

    // Validações
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório', code: 'MISSING_TENANT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: `Tipo inválido. Use: ${VALID_TYPES.join(', ')}`, code: 'INVALID_TYPE' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt || prompt.trim().length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt deve ter pelo menos 10 caracteres', code: 'INVALID_PROMPT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar permissão do usuário no tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para este tenant', code: 'FORBIDDEN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compliance: tipos que alteram rosto/voz precisam de autorização
    const requiresAuth = ['ugc_client_video', 'short_video'].includes(type);
    if (requiresAuth && !has_authorization) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'É necessário confirmar que possui autorização para uso de imagem/voz', 
          code: 'AUTHORIZATION_REQUIRED' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Definir modelo e custo estimado
    const modelId = settings?.model_id || getDefaultModel(type);
    const modelConfig = MODEL_CONFIGS[modelId];
    const costEstimate = modelConfig?.costEstimate || 50;

    // Verificar/criar pasta de criativos
    const { data: folder } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('filename', 'Criativos com IA')
      .eq('is_folder', true)
      .maybeSingle();

    let folderId = folder?.id;

    if (!folderId) {
      // Buscar pasta raiz do sistema
      const { data: systemFolder } = await supabase
        .from('files')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('is_system_folder', true)
        .maybeSingle();

      // Criar pasta
      const { data: newFolder, error: folderError } = await supabase
        .from('files')
        .insert({
          tenant_id,
          folder_id: systemFolder?.id || null,
          filename: 'Criativos com IA',
          original_name: 'Criativos com IA',
          storage_path: `${tenant_id}/criativos-ia/`,
          is_folder: true,
          is_system_folder: false,
          created_by: userId,
          metadata: { source: 'creatives_module', system_managed: true },
        })
        .select('id')
        .single();

      if (!folderError && newFolder) {
        folderId = newFolder.id;
      }
    }

    // Montar pipeline de steps baseado no tipo
    const pipelineSteps = buildPipeline(type, settings || {});

    // Criar job
    const { data: job, error: jobError } = await supabase
      .from('creative_jobs')
      .insert({
        tenant_id,
        type,
        status: 'queued',
        prompt: prompt.trim(),
        product_id: product_id || null,
        product_name: product_name || null,
        product_image_url: product_image_url || null,
        reference_images: reference_images || null,
        reference_video_url: reference_video_url || null,
        reference_audio_url: reference_audio_url || null,
        settings: {
          ...settings,
          model_id: modelId,
        },
        has_authorization: has_authorization || false,
        authorization_accepted_at: has_authorization ? new Date().toISOString() : null,
        pipeline_steps: pipelineSteps,
        current_step: 0,
        output_folder_id: folderId,
        cost_cents: costEstimate,
        created_by: userId,
      })
      .select()
      .single();

    if (jobError) {
      console.error('[creative-generate] Error creating job:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar job', code: 'DB_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[creative-generate] Job ${job.id} created for tenant ${tenant_id}, type: ${type}`);

    // TODO: Enfileirar para processamento (creative-process)
    // Por enquanto, o job fica em 'queued' e pode ser processado por um scheduler

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          job_id: job.id,
          status: job.status,
          type: job.type,
          cost_estimate_cents: costEstimate,
          folder_id: folderId,
          pipeline_steps: pipelineSteps.length,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[creative-generate] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getDefaultModel(type: string): string {
  switch (type) {
    case 'ugc_client_video': return 'pixverse-swap-person';
    case 'ugc_ai_video': return 'kling-avatar';
    case 'short_video': return 'kling-avatar-short';
    case 'tech_product_video': return 'veo31-first-last';
    case 'product_image': return 'gpt-image-edit';
    default: return 'gpt-image-edit';
  }
}

function buildPipeline(type: string, settings: Record<string, unknown>): Array<{ step_id: string; model_id: string; status: string }> {
  const steps: Array<{ step_id: string; model_id: string; status: string }> = [];

  switch (type) {
    case 'ugc_client_video':
      // Pipeline: swap person/bg -> voice -> lipsync
      if (settings.swap_person) {
        steps.push({ step_id: 'swap_person', model_id: 'pixverse-swap-person', status: 'queued' });
      }
      if (settings.swap_background) {
        steps.push({ step_id: 'swap_bg', model_id: 'pixverse-swap-bg', status: 'queued' });
      }
      if (settings.swap_voice) {
        steps.push({ step_id: 'voice', model_id: 'chatterbox-voice', status: 'queued' });
        steps.push({ step_id: 'lipsync', model_id: 'sync-lipsync', status: 'queued' });
      }
      break;

    case 'ugc_ai_video':
      // Pipeline: avatar ou text-to-video
      if (settings.mode === 'avatar') {
        steps.push({ step_id: 'avatar', model_id: 'kling-avatar', status: 'queued' });
      } else {
        steps.push({ step_id: 'text_video', model_id: settings.model_id as string || 'veo31-text-video', status: 'queued' });
      }
      break;

    case 'short_video':
      // Pipeline: avatar + lipsync
      steps.push({ step_id: 'avatar', model_id: 'kling-avatar-short', status: 'queued' });
      steps.push({ step_id: 'lipsync', model_id: 'sync-lipsync-final', status: 'queued' });
      break;

    case 'tech_product_video':
      // Pipeline: image/frame to video
      if (settings.first_frame || settings.last_frame) {
        steps.push({ step_id: 'first_last', model_id: 'veo31-first-last', status: 'queued' });
      } else {
        steps.push({ step_id: 'image_video', model_id: 'veo31-image-video', status: 'queued' });
      }
      break;

    case 'product_image':
      // Pipeline: GPT Image Edit
      const variations = (settings.variations as number) || 1;
      for (let i = 0; i < variations; i++) {
        steps.push({ step_id: `image_${i + 1}`, model_id: 'gpt-image-edit', status: 'queued' });
      }
      break;
  }

  // Se não tem steps, adicionar um padrão
  if (steps.length === 0) {
    steps.push({ step_id: 'default', model_id: getDefaultModel(type), status: 'queued' });
  }

  return steps;
}
