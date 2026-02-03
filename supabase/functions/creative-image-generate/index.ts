/**
 * Creative Image Generate — Edge Function (OpenAI Pipeline v1.0)
 * 
 * Pipeline de geração de imagens de produto "nível ChatGPT" usando OpenAI via Lovable AI Gateway.
 * 
 * PRINCÍPIO-CHAVE: Fidelidade do Produto
 * - Sempre usar imagem REAL do produto como referência
 * - Modo Edit para preservar rótulo/cores
 * - QA automático com retries
 * - Fallback por composição se necessário
 * 
 * MODELOS:
 * - google/gemini-2.5-flash-image (geração rápida)
 * - google/gemini-3-pro-image-preview (alta qualidade)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = '1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Constantes de custo (1 crédito = US$ 0,01)
const CREDIT_MARKUP = 1.5; // 50% markup
const USD_TO_BRL = 5.80;

// Custo estimado por imagem (será atualizado com custo real quando possível)
const COST_PER_IMAGE_USD = 0.02; // Gemini image generation

// Configurações do Prompt Rewriter
const SCENE_PRESETS: Record<string, string> = {
  bathroom: "Banheiro moderno com iluminação natural vindo da janela, azulejos clean, espelho ao fundo, ambiente higienizado e premium",
  bedroom: "Quarto aconchegante com luz suave da manhã, lençóis brancos, ambiente relaxante e convidativo",
  gym: "Academia moderna e bem equipada, iluminação energética, pessoa saudável e ativa",
  outdoor: "Ar livre com luz natural intensa, paisagem natural ao fundo, sensação de liberdade",
  office: "Escritório moderno e organizado, mesa clean, ambiente profissional e produtivo",
  kitchen: "Cozinha lifestyle moderna, bancada de mármore ou granito, iluminação clean",
  studio: "Estúdio fotográfico com fundo neutro (branco ou cinza claro), iluminação profissional de 3 pontos",
};

const GENDER_DESCRIPTIONS: Record<string, string> = {
  female: "mulher atraente com aparência natural e saudável",
  male: "homem atraente com aparência natural e saudável",
  any: "pessoa atraente com aparência natural e saudável",
};

const AGE_DESCRIPTIONS: Record<string, string> = {
  young: "na faixa de 25-35 anos, pele jovem e vibrante",
  middle: "na faixa de 35-50 anos, aparência madura e confiante",
  mature: "na faixa de 50-65 anos, aparência sofisticada e experiente",
};

const POSE_DESCRIPTIONS: Record<string, string> = {
  holding: "segurando o produto com uma mão de forma natural e elegante, produto bem visível e centralizado",
  using: "usando/aplicando o produto de forma natural, demonstrando uso real",
  displaying: "mostrando o produto para a câmera com expressão confiante, como se apresentasse para um amigo",
};

/**
 * PASSO 2 — PROMPT REWRITER
 * Transforma inputs do usuário em prompt final otimizado
 */
function rewritePrompt(config: {
  productName: string;
  scene: string;
  gender: string;
  ageRange: string;
  pose: string;
  additionalPrompt?: string;
  inputFidelity: string;
  isKit: boolean;
}): { promptFinal: string; negativePrompt: string; shotPlan: string[] } {
  const sceneDesc = SCENE_PRESETS[config.scene] || SCENE_PRESETS.studio;
  const genderDesc = GENDER_DESCRIPTIONS[config.gender] || GENDER_DESCRIPTIONS.any;
  const ageDesc = AGE_DESCRIPTIONS[config.ageRange] || AGE_DESCRIPTIONS.middle;
  const poseDesc = POSE_DESCRIPTIONS[config.pose] || POSE_DESCRIPTIONS.holding;

  // Shot plan para consistência
  const shotPlan = [
    "Enquadramento: médio (do torso para cima), produto em destaque",
    "Lente: 85mm, leve desfoque de fundo (bokeh)",
    "Iluminação: principal frontal-lateral, fill suave, sem sombras duras no produto",
  ];

  // Regras de fidelidade baseadas no nível
  const fidelityRules = config.inputFidelity === 'high' 
    ? `REGRA MÁXIMA DE FIDELIDADE:
       - O produto DEVE ser IDÊNTICO à imagem de referência
       - NÃO alterar NENHUM texto, letra ou número do rótulo
       - NÃO alterar cores, proporções ou design da embalagem
       - O rótulo deve estar 100% legível na imagem final`
    : config.inputFidelity === 'medium'
    ? `REGRA MÉDIA DE FIDELIDADE:
       - Manter aparência geral do produto similar à referência
       - Preservar cores principais e formato da embalagem
       - Rótulo deve ser reconhecível (não precisa estar perfeito)`
    : `REGRA BAIXA DE FIDELIDADE:
       - Manter estilo geral do produto
       - Permite variações criativas menores
       - Foco na cena/ambiente`;

  // Regras de kit
  const kitRule = config.isKit
    ? `CENÁRIO DE KIT (múltiplos produtos):
       - PROIBIDO: pessoa segurando múltiplos produtos na mão
       - OBRIGATÓRIO: produtos apoiados em superfície (bancada, prateleira, mesa)
       - Organizar produtos de forma elegante e visualmente harmoniosa`
    : `CENÁRIO DE PRODUTO ÚNICO:
       - Modelo pode segurar o produto naturalmente
       - Máximo 1 produto por mão
       - Pose natural e não forçada`;

  const promptFinal = `FOTOGRAFIA PROFISSIONAL DE PRODUTO — QUALIDADE EDITORIAL

PRODUTO: "${config.productName}"
A imagem de referência mostra o produto REAL. Seu trabalho é criar uma CENA com este produto EXATO.

${fidelityRules}

${kitRule}

PESSOA/MODELO:
- ${genderDesc}, ${ageDesc}
- Aparência: pele realista, maquiagem/skincare natural, cabelo arrumado mas não artificial
- Expressão: ${config.pose === 'displaying' ? 'confiante e amigável' : 'natural e relaxada'}
- Pose: ${poseDesc}

CENÁRIO:
${sceneDesc}

ESTILO FOTOGRÁFICO:
- ${shotPlan.join('\n- ')}
- Qualidade: resolução 4K, nitidez profissional, cores vibrantes mas naturais
- Estilo: editorial de revista de lifestyle/beleza

${config.additionalPrompt ? `INSTRUÇÕES ADICIONAIS DO CLIENTE:\n${config.additionalPrompt}` : ''}

FORMATO: Imagem quadrada 1:1, própria para feed de Instagram/redes sociais`;

  const negativePrompt = `texto sobreposto, logos fictícios, marcas inventadas, rótulo diferente, 
produto alterado, cores erradas, embalagem modificada, texto ilegível, letras distorcidas,
produto genérico, caixa genérica, produto duplicado, múltiplas cópias do mesmo produto,
baixa qualidade, pixelado, desfocado no produto, iluminação ruim, sombras duras,
mãos deformadas, dedos extras, proporções irreais, pose artificial,
claims médicos, selos de certificação, promessas de resultado`;

  return { promptFinal, negativePrompt, shotPlan };
}

/**
 * Download imagem como base64
 */
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`[creative-image] Downloading: ${url.substring(0, 80)}...`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[creative-image] Download failed: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    console.log(`[creative-image] Downloaded: ${uint8Array.length} bytes`);
    return base64;
  } catch (error) {
    console.error(`[creative-image] Download error:`, error);
    return null;
  }
}

/**
 * Gerar imagem via Lovable AI Gateway (OpenAI/Gemini)
 */
async function generateImageWithLovableAI(
  lovableApiKey: string,
  prompt: string,
  referenceImageBase64?: string,
  quality: 'standard' | 'high' = 'high'
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  try {
    const model = quality === 'high' 
      ? 'google/gemini-3-pro-image-preview' 
      : 'google/gemini-2.5-flash-image';
    
    console.log(`[creative-image] Generating with model: ${model}`);
    
    const messages: any[] = [];
    
    if (referenceImageBase64) {
      // Edit mode: use reference image
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${referenceImageBase64}` }
          }
        ]
      });
    } else {
      // Text-to-image mode
      messages.push({
        role: 'user',
        content: prompt
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[creative-image] API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return { imageBase64: null, model, error: 'Rate limit exceeded. Tente novamente em alguns minutos.' };
      }
      if (response.status === 402) {
        return { imageBase64: null, model, error: 'Créditos insuficientes. Adicione créditos ao workspace.' };
      }
      
      return { imageBase64: null, model, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[creative-image] Response received`);
    
    // Extract image from response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error(`[creative-image] No image in response:`, JSON.stringify(data).substring(0, 500));
      return { imageBase64: null, model, error: 'No image generated' };
    }

    // Extract base64 from data URL
    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { imageBase64: null, model, error: 'Invalid image format in response' };
    }

    console.log(`[creative-image] Image generated successfully`);
    return { imageBase64: base64Match[1], model };
    
  } catch (error) {
    console.error(`[creative-image] Generation error:`, error);
    return { imageBase64: null, model: 'unknown', error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[creative-image-generate v${VERSION}] Starting...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('[creative-image] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY não configurada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      product_id,
      product_name,
      product_image_url,
      prompt,
      settings = {},
    } = body;

    // Validations
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!product_id || !product_image_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Produto com imagem é obrigatório para geração de imagens' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user permission
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para este tenant' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract settings
    const {
      scene = 'bathroom',
      gender = 'any',
      age_range = 'middle',
      pose = 'holding',
      quality = 'high',
      input_fidelity = 'high',
      variations = 2,
    } = settings;

    const numVariations = Math.min(Math.max(1, variations), 4);

    console.log(`[creative-image] Generating ${numVariations} variations for product: ${product_name}`);
    console.log(`[creative-image] Settings:`, { scene, gender, age_range, pose, quality, input_fidelity });

    // PASSO 1: Download product image
    const productBase64 = await downloadImageAsBase64(product_image_url);
    if (!productBase64) {
      return new Response(
        JSON.stringify({ success: false, error: `Não foi possível baixar a imagem do produto. Verifique a URL.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PASSO 2: Build optimized prompt
    const { promptFinal, negativePrompt, shotPlan } = rewritePrompt({
      productName: product_name || 'Produto',
      scene,
      gender,
      ageRange: age_range,
      pose,
      additionalPrompt: prompt,
      inputFidelity: input_fidelity,
      isKit: false, // TODO: detect from product
    });

    // Ensure/create creatives folder
    const { data: folder } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('filename', 'Criativos com IA')
      .eq('is_folder', true)
      .maybeSingle();

    let folderId = folder?.id;
    if (!folderId) {
      const { data: newFolder } = await supabase
        .from('files')
        .insert({
          tenant_id,
          filename: 'Criativos com IA',
          original_name: 'Criativos com IA',
          storage_path: `${tenant_id}/criativos-ia/`,
          is_folder: true,
          created_by: userId,
          metadata: { source: 'creatives_module', system_managed: true },
        })
        .select('id')
        .single();
      folderId = newFolder?.id;
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('creative_jobs')
      .insert({
        tenant_id,
        type: 'product_image',
        status: 'running',
        prompt: promptFinal,
        product_id,
        product_name,
        product_image_url,
        settings: {
          scene,
          gender,
          age_range,
          pose,
          quality,
          input_fidelity,
          variations: numVariations,
          negative_prompt: negativePrompt,
          shot_plan: shotPlan,
          provider: 'lovable_ai',
        },
        pipeline_steps: Array.from({ length: numVariations }, (_, i) => ({
          step_id: `image_${i + 1}`,
          model_id: 'gemini-image',
          status: 'queued',
        })),
        current_step: 0,
        output_folder_id: folderId,
        cost_cents: 0,
        created_by: userId,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[creative-image] Job creation error:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar job' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobId = job.id;
    console.log(`[creative-image] Job created: ${jobId}`);

    // PASSO 3: Generate variations
    const generatedImages: { url: string; model: string; variantIndex: number }[] = [];
    const errors: string[] = [];
    let totalCostCents = 0;

    for (let i = 0; i < numVariations; i++) {
      console.log(`[creative-image] Generating variant ${i + 1}/${numVariations}...`);
      
      // Update current step
      await supabase
        .from('creative_jobs')
        .update({ current_step: i })
        .eq('id', jobId);

      // Add slight variation to prompt for diversity
      const variantPrompt = i === 0 
        ? promptFinal 
        : `${promptFinal}\n\nVARIAÇÃO ${i + 1}: Crie uma versão diferente mantendo o mesmo conceito. Varie sutilmente: ângulo, pose, expressão ou iluminação.`;

      const result = await generateImageWithLovableAI(
        lovableApiKey,
        variantPrompt,
        productBase64,
        quality === 'high' ? 'high' : 'standard'
      );

      if (!result.imageBase64) {
        console.error(`[creative-image] Variant ${i + 1} failed:`, result.error);
        errors.push(`Variação ${i + 1}: ${result.error}`);
        
        // Retry once with simpler prompt
        console.log(`[creative-image] Retrying variant ${i + 1} with simplified prompt...`);
        const retryResult = await generateImageWithLovableAI(
          lovableApiKey,
          `Criar foto profissional de pessoa segurando o produto "${product_name}" da imagem de referência. Manter produto EXATO da referência, sem alterar rótulo ou cores.`,
          productBase64,
          'standard'
        );
        
        if (!retryResult.imageBase64) {
          console.error(`[creative-image] Retry also failed`);
          continue;
        }
        
        // Use retry result
        result.imageBase64 = retryResult.imageBase64;
        result.model = retryResult.model;
      }

      // Upload to storage
      const storagePath = `${tenant_id}/${jobId}/variant_${i + 1}.png`;
      
      try {
        const binaryData = Uint8Array.from(atob(result.imageBase64), c => c.charCodeAt(0));
        
        const { error: uploadError } = await supabase.storage
          .from('media-assets')
          .upload(storagePath, binaryData, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.error(`[creative-image] Upload error for variant ${i + 1}:`, uploadError);
          errors.push(`Variação ${i + 1}: Falha no upload`);
          continue;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('media-assets')
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (publicUrl) {
          generatedImages.push({
            url: publicUrl,
            model: result.model,
            variantIndex: i + 1,
          });
          
          // Calculate cost
          const costCents = Math.ceil(COST_PER_IMAGE_USD * CREDIT_MARKUP * USD_TO_BRL * 100);
          totalCostCents += costCents;
        }
      } catch (uploadError) {
        console.error(`[creative-image] Processing error for variant ${i + 1}:`, uploadError);
        errors.push(`Variação ${i + 1}: ${String(uploadError)}`);
      }
    }

    // PASSO 4: Save results
    const elapsedMs = Date.now() - startTime;
    const finalStatus = generatedImages.length > 0 ? 'succeeded' : 'failed';
    
    await supabase
      .from('creative_jobs')
      .update({
        status: finalStatus,
        output_urls: generatedImages.map(img => img.url),
        cost_cents: totalCostCents,
        processing_time_ms: elapsedMs,
        completed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.join('; ') : null,
        settings: {
          ...job.settings,
          actual_variants: generatedImages.length,
          models_used: [...new Set(generatedImages.map(img => img.model))],
          provider: 'lovable_ai',
        },
      })
      .eq('id', jobId);

    // Register files in drive
    for (const img of generatedImages) {
      await supabase.from('files').insert({
        tenant_id,
        folder_id: folderId,
        filename: `Criativo_${product_name?.substring(0, 20)}_v${img.variantIndex}.png`,
        original_name: `variant_${img.variantIndex}.png`,
        storage_path: `${tenant_id}/${jobId}/variant_${img.variantIndex}.png`,
        file_type: 'image',
        mime_type: 'image/png',
        created_by: userId,
        metadata: {
          source: 'creative_job',
          job_id: jobId,
          product_id,
          variant_index: img.variantIndex,
          model: img.model,
        },
      });
    }

    console.log(`[creative-image] Completed: ${generatedImages.length}/${numVariations} variants in ${elapsedMs}ms`);

    return new Response(
      JSON.stringify({
        success: generatedImages.length > 0,
        data: {
          job_id: jobId,
          status: finalStatus,
          generated_count: generatedImages.length,
          requested_count: numVariations,
          images: generatedImages,
          cost_cents: totalCostCents,
          processing_time_ms: elapsedMs,
          errors: errors.length > 0 ? errors : undefined,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[creative-image-generate] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
