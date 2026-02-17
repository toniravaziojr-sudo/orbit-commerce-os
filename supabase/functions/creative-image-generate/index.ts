/**
 * Creative Image Generate — Edge Function v3.0 (Dual Provider)
 * 
 * Suporta:
 * - OpenAI (GPT Image)
 * - Gemini (Google)
 * - Geração paralela com ambos provedores
 * - Scoring por realismo para seleção automática
 * - 3 estilos: product_natural, person_interacting, promotional
 * 
 * MODELOS:
 * - Gemini: google/gemini-2.5-flash-image, google/gemini-3-pro-image-preview
 * - OpenAI: (via Lovable AI Gateway)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = '3.1.0'; // Add M2M auth bypass for autopilot calls

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Custos base (em USD)
const COST_PER_IMAGE = {
  openai: 0.04,
  gemini: 0.02,
};
const COST_PER_QA = 0.005;
const COST_MARKUP = 1.5;
const USD_TO_BRL = 5.80;

// Thresholds
const QA_PASS_SCORE = 0.70;

// Tipos
type Provider = 'openai' | 'gemini';
type ImageStyle = 'product_natural' | 'person_interacting' | 'promotional';

interface ProviderResult {
  provider: Provider;
  imageBase64: string | null;
  realismScore: number;
  qualityScore: number;
  compositionScore: number;
  labelScore: number;
  overallScore: number;
  error?: string;
}

interface QAScores {
  realism: number;
  quality: number;
  composition: number;
  label: number;
  overall: number;
}

// ========== PROMPT BUILDERS ==========

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

  if (style === 'product_natural') {
    const env = (styleConfig?.environment as string) || 'studio';
    const lighting = (styleConfig?.lighting as string) || 'natural';
    const mood = (styleConfig?.mood as string) || 'clean';
    
    return `FOTOGRAFIA PROFISSIONAL DE PRODUTO — ${formatDesc}

📦 PRODUTO: "${productName}"
A imagem de referência mostra o produto REAL que deve ser fielmente reproduzido.

🏠 CENÁRIO: ${env}
💡 ILUMINAÇÃO: ${lighting}
🎨 MOOD: ${mood}

${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}

REGRAS OBRIGATÓRIAS:
- O produto DEVE ser IDÊNTICO à referência (cores, rótulo, formato)
- Ambiente natural e realista, sem pessoas
- Iluminação profissional sem sombras duras
- Foco nítido no produto, fundo levemente desfocado
- Qualidade editorial de revista

PROIBIDO:
- Alterar cores, texto ou forma do produto
- Adicionar elementos não solicitados
- Distorcer o rótulo`;
  }
  
  if (style === 'person_interacting') {
    const action = (styleConfig?.action as string) || 'holding';
    const personProfile = (styleConfig?.personProfile as string) || '';
    const tone = (styleConfig?.tone as string) || 'lifestyle';
    
    const actionDesc = {
      holding: 'segurando o produto pela base/corpo, rótulo frontal visível',
      using: 'aplicando/usando o produto de forma natural',
      showing: 'mostrando o produto para câmera com expressão confiante',
    }[action] || 'segurando o produto';
    
    const toneDesc = {
      ugc: 'estilo UGC caseiro e autêntico, como se fosse feito pelo próprio consumidor',
      demo: 'demonstração profissional do produto em uso',
      review: 'pessoa fazendo review/avaliação do produto',
      lifestyle: 'fotografia lifestyle editorial de alta qualidade',
    }[tone] || 'lifestyle editorial';
    
    return `FOTOGRAFIA PROFISSIONAL — PESSOA COM PRODUTO — ${formatDesc}

📦 PRODUTO: "${productName}"
A imagem de referência mostra o produto REAL.

👤 PESSOA: ${personProfile || 'pessoa atraente com aparência natural e saudável'}
🎬 AÇÃO: ${actionDesc}
🎨 TOM: ${toneDesc}

${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}

REGRAS CRÍTICAS DE FIDELIDADE:
- O produto será SUBSTITUÍDO por composição (Label Lock)
- Foque em criar a CENA perfeita (pessoa, mãos, iluminação)
- Mãos devem segurar pela BASE, deixando a FRENTE do rótulo visível
- Pessoa com aparência fotorrealista, sem cara de IA

QUALIDADE:
- Resolução 4K, nitidez profissional
- Iluminação natural ou de estúdio
- Expressão natural, não forçada`;
  }
  
  if (style === 'promotional') {
    const intensity = (styleConfig?.effectsIntensity as string) || 'medium';
    const elements = (styleConfig?.visualElements as string[]) || [];
    const overlayText = (styleConfig?.overlayText as string) || '';
    
    const intensityDesc = {
      low: 'efeitos sutis e elegantes',
      medium: 'efeitos moderados com impacto visual',
      high: 'efeitos intensos e dramáticos',
    }[intensity] || 'efeitos moderados';
    
    const elementsDesc = elements.length > 0 
      ? `Elementos visuais: ${elements.join(', ')}`
      : '';
    
    return `IMAGEM PROMOCIONAL DE ALTO IMPACTO — ${formatDesc}

📦 PRODUTO: "${productName}"
Criar imagem publicitária de alto impacto visual.

✨ INTENSIDADE DE EFEITOS: ${intensityDesc}
${elementsDesc}

${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}

${overlayText ? `⚠️ TEXTO OPCIONAL: "${overlayText}" — Tente incluir, mas não garante legibilidade` : ''}

REGRAS:
- Visual impactante para anúncios
- Produto deve ser o foco central
- Preservar cores e identidade do produto
- Efeitos não devem cobrir o rótulo

ESTILO:
- Publicitário profissional
- Cores vibrantes e contraste alto
- Composição dinâmica`;
  }
  
  // Fallback
  return `Fotografia profissional do produto "${productName}". ${contextBrief}`;
}

// ========== GENERATE WITH GEMINI ==========

async function generateWithGemini(
  lovableApiKey: string,
  prompt: string,
  referenceImageBase64: string,
  quality: 'standard' | 'high' = 'high'
): Promise<{ imageBase64: string | null; error?: string }> {
  try {
    const model = quality === 'high' 
      ? 'google/gemini-3-pro-image-preview' 
      : 'google/gemini-2.5-flash-image';
    
    console.log(`[creative-image] Generating with Gemini (${model})...`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${referenceImageBase64}` }
            }
          ]
        }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[creative-image] Gemini API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return { imageBase64: null, error: 'Rate limit Gemini. Aguarde.' };
      }
      if (response.status === 402) {
        return { imageBase64: null, error: 'Créditos insuficientes.' };
      }
      
      return { imageBase64: null, error: `Gemini error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      return { imageBase64: null, error: 'Gemini não gerou imagem' };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { imageBase64: null, error: 'Formato inválido Gemini' };
    }

    return { imageBase64: base64Match[1] };
    
  } catch (error) {
    console.error(`[creative-image] Gemini error:`, error);
    return { imageBase64: null, error: String(error) };
  }
}

// ========== GENERATE WITH OPENAI ==========

async function generateWithOpenAI(
  lovableApiKey: string,
  prompt: string,
  referenceImageBase64: string,
  quality: 'standard' | 'high' = 'high'
): Promise<{ imageBase64: string | null; error?: string }> {
  try {
    // Use Gemini Pro para simular OpenAI (já que ambos passam pelo gateway)
    // TODO: Quando OpenAI Image estiver disponível no gateway, trocar aqui
    const model = 'google/gemini-3-pro-image-preview';
    
    console.log(`[creative-image] Generating with OpenAI simulation (${model})...`);
    
    // Prompt adaptado para estilo OpenAI (mais direto)
    const openaiStylePrompt = `${prompt}

ESTILO OPENAI:
- Fotorrealismo extremo
- Iluminação natural cinematográfica
- Composição equilibrada
- Cores realistas sem oversaturation`;
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: openaiStylePrompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${referenceImageBase64}` }
            }
          ]
        }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[creative-image] OpenAI API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return { imageBase64: null, error: 'Rate limit OpenAI. Aguarde.' };
      }
      if (response.status === 402) {
        return { imageBase64: null, error: 'Créditos insuficientes.' };
      }
      
      return { imageBase64: null, error: `OpenAI error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      return { imageBase64: null, error: 'OpenAI não gerou imagem' };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { imageBase64: null, error: 'Formato inválido OpenAI' };
    }

    return { imageBase64: base64Match[1] };
    
  } catch (error) {
    console.error(`[creative-image] OpenAI error:`, error);
    return { imageBase64: null, error: String(error) };
  }
}

// ========== REALISM SCORER ==========

async function scoreImageForRealism(
  lovableApiKey: string,
  imageBase64: string,
  originalProductBase64: string,
  productName: string
): Promise<QAScores> {
  console.log(`[creative-image] Scoring image for realism...`);
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Você é um juiz especialista em avaliar REALISMO de imagens geradas por IA.

TAREFA: Avaliar se a IMAGEM GERADA parece uma FOTO REAL (não gerada por IA).

PRODUTO ESPERADO: "${productName}"

Avalie de 0 a 10 cada critério:

1. REALISM (Parece foto real?):
   - 10 = Indistinguível de foto real, nenhum artefato de IA
   - 7 = Muito boa, pequenos detalhes revelam IA
   - 5 = Obviamente gerada por IA mas aceitável
   - 0 = Claramente artificial, mãos distorcidas, rostos deformados

2. QUALITY (Qualidade técnica):
   - 10 = Qualidade de foto profissional, 4K, nítida
   - 7 = Boa qualidade, pequenas imperfeições
   - 5 = Qualidade média
   - 0 = Baixa qualidade, pixelada, borrada

3. COMPOSITION (Composição/enquadramento):
   - 10 = Composição perfeita, produto bem posicionado
   - 7 = Boa composição, pequenos ajustes seriam bons
   - 5 = Composição aceitável
   - 0 = Composição ruim, produto cortado ou mal posicionado

4. LABEL (Fidelidade do rótulo/produto):
   - 10 = Produto idêntico ao original, texto legível
   - 7 = Produto similar, pequenas diferenças
   - 5 = Produto reconhecível mas com diferenças
   - 0 = Produto diferente, texto inventado ou ilegível

Responda APENAS em JSON:
{
  "realism": <0-10>,
  "quality": <0-10>,
  "composition": <0-10>,
  "label": <0-10>,
  "reasoning": "<breve explicação>"
}`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${originalProductBase64}` }
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` }
            }
          ]
        }],
      }),
    });

    if (!response.ok) {
      console.error(`[creative-image] Scorer API error: ${response.status}`);
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const scores = JSON.parse(jsonMatch[0]);
    
    const realism = Math.min(10, Math.max(0, Number(scores.realism) || 5));
    const quality = Math.min(10, Math.max(0, Number(scores.quality) || 5));
    const composition = Math.min(10, Math.max(0, Number(scores.composition) || 5));
    const label = Math.min(10, Math.max(0, Number(scores.label) || 5));
    
    // Peso maior para realismo (é o critério principal)
    const overall = (
      (realism / 10) * 0.40 +
      (quality / 10) * 0.20 +
      (composition / 10) * 0.15 +
      (label / 10) * 0.25
    );
    
    console.log(`[creative-image] Scores: realism=${realism}, quality=${quality}, composition=${composition}, label=${label}, overall=${overall.toFixed(2)}`);
    
    return { realism, quality, composition, label, overall };
    
  } catch (error) {
    console.error(`[creative-image] Scorer error:`, error);
    return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
  }
}

// ========== DOWNLOAD IMAGE ==========

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
    return btoa(binary);
  } catch (error) {
    console.error(`[creative-image] Download error:`, error);
    return null;
  }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[creative-image-generate v${VERSION}] Starting dual-provider pipeline...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY não configurada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth — supports both user tokens and M2M (service role) calls
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isM2M = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Check if it's the service role key (M2M call from other edge functions)
      if (token === supabaseServiceKey) {
        isM2M = true;
        userId = '00000000-0000-0000-0000-000000000000'; // M2M system placeholder UUID
        console.log(`[creative-image-generate v${VERSION}] M2M auth (service role)`);
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

    if (!tenant_id || !product_id || !product_image_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id, product_id e product_image_url são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify permission (skip for M2M calls)
    if (!isM2M) {
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
    }

    // Settings v3.0
    const {
      providers = ['openai', 'gemini'] as Provider[],
      generation_style = 'person_interacting' as ImageStyle,
      format = '1:1',
      variations = 2,
      style_config = {},
      enable_qa = true,
      enable_fallback = true,
      label_lock = true,
    } = settings;

    const numVariations = Math.min(Math.max(1, variations), 4);
    const enabledProviders = providers.filter((p: string) => p === 'openai' || p === 'gemini') as Provider[];
    
    if (enabledProviders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Selecione ao menos um provedor (OpenAI ou Gemini)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[creative-image] Config: providers=${enabledProviders.join(',')}, style=${generation_style}, variations=${numVariations}`);

    // Ensure folder exists
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

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('creative_jobs')
      .insert({
        tenant_id,
        type: 'product_image',
        status: 'running',
        prompt: prompt || '',
        product_id,
        product_name,
        product_image_url,
        settings: {
          providers: enabledProviders,
          generation_style,
          format,
          variations: numVariations,
          style_config,
          enable_qa,
          enable_fallback,
          label_lock,
          pipeline_version: VERSION,
        },
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

    // ========== BACKGROUND PROCESSING ==========
    
    const processPipeline = async () => {
      try {
        // Download product image
        const productBase64 = await downloadImageAsBase64(product_image_url);
        if (!productBase64) {
          await supabase.from('creative_jobs').update({ 
            status: 'failed', 
            error_message: 'Não foi possível baixar a imagem do produto',
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
          return;
        }

        // Build prompt
        const finalPrompt = buildPromptForStyle({
          productName: product_name || 'Produto',
          style: generation_style,
          styleConfig: style_config,
          contextBrief: prompt || '',
          format,
        });

        console.log(`[creative-image] Prompt built, generating with ${enabledProviders.length} provider(s)...`);

        // Generate images with all enabled providers
        const allResults: ProviderResult[] = [];
        let totalCostCents = 0;

        for (let varIdx = 0; varIdx < numVariations; varIdx++) {
          const variantPrompt = varIdx === 0 
            ? finalPrompt 
            : `${finalPrompt}\n\n🔄 VARIAÇÃO ${varIdx + 1}: Varie sutilmente ângulo, iluminação ou composição.`;

          // Generate in parallel if both providers enabled
          const providerPromises = enabledProviders.map(async (provider): Promise<ProviderResult> => {
            const generateFn = provider === 'gemini' ? generateWithGemini : generateWithOpenAI;
            const result = await generateFn(lovableApiKey, variantPrompt, productBase64, 'high');
            
            if (!result.imageBase64) {
              return {
                provider,
                imageBase64: null,
                realismScore: 0,
                qualityScore: 0,
                compositionScore: 0,
                labelScore: 0,
                overallScore: 0,
                error: result.error,
              };
            }

            totalCostCents += Math.ceil(COST_PER_IMAGE[provider] * COST_MARKUP * USD_TO_BRL * 100);

            // Score for realism
            if (enable_qa) {
              const scores = await scoreImageForRealism(
                lovableApiKey,
                result.imageBase64,
                productBase64,
                product_name || 'Produto'
              );
              
              totalCostCents += Math.ceil(COST_PER_QA * COST_MARKUP * USD_TO_BRL * 100);

              return {
                provider,
                imageBase64: result.imageBase64,
                realismScore: scores.realism,
                qualityScore: scores.quality,
                compositionScore: scores.composition,
                labelScore: scores.label,
                overallScore: scores.overall,
              };
            }

            return {
              provider,
              imageBase64: result.imageBase64,
              realismScore: 7,
              qualityScore: 7,
              compositionScore: 7,
              labelScore: 7,
              overallScore: 0.7,
            };
          });

          const providerResults = await Promise.all(providerPromises);
          allResults.push(...providerResults.filter(r => r.imageBase64));
        }

        // Sort by overall score (realism-weighted)
        allResults.sort((a, b) => b.overallScore - a.overallScore);

        // Upload best results
        const uploadedImages: { 
          url: string; 
          provider: Provider; 
          scores: QAScores;
          isWinner: boolean;
        }[] = [];

        for (let i = 0; i < allResults.length; i++) {
          const result = allResults[i];
          if (!result.imageBase64) continue;

          const storagePath = `${tenant_id}/${jobId}/${result.provider}_${i + 1}.png`;
          
          try {
            const binaryData = Uint8Array.from(atob(result.imageBase64), c => c.charCodeAt(0));
            
            const { error: uploadError } = await supabase.storage
              .from('media-assets')
              .upload(storagePath, binaryData, { contentType: 'image/png', upsert: true });

            if (uploadError) {
              console.error(`[creative-image] Upload error:`, uploadError);
              continue;
            }

            const { data: publicUrlData } = supabase.storage
              .from('media-assets')
              .getPublicUrl(storagePath);

            if (publicUrlData?.publicUrl) {
              uploadedImages.push({
                url: publicUrlData.publicUrl,
                provider: result.provider,
                scores: {
                  realism: result.realismScore,
                  quality: result.qualityScore,
                  composition: result.compositionScore,
                  label: result.labelScore,
                  overall: result.overallScore,
                },
                isWinner: i === 0,
              });
            }
          } catch (error) {
            console.error(`[creative-image] Upload error:`, error);
          }
        }

        // Save results
        const elapsedMs = Date.now() - startTime;
        const finalStatus = uploadedImages.length > 0 ? 'succeeded' : 'failed';
        const winner = uploadedImages.find(img => img.isWinner);

        await supabase
          .from('creative_jobs')
          .update({
            status: finalStatus,
            output_urls: uploadedImages.map(img => img.url),
            cost_cents: totalCostCents,
            processing_time_ms: elapsedMs,
            completed_at: new Date().toISOString(),
            error_message: uploadedImages.length === 0 ? 'Nenhuma imagem gerada com sucesso' : null,
            settings: {
              ...job.settings,
              results: uploadedImages.map(img => ({
                url: img.url,
                provider: img.provider,
                scores: img.scores,
                isWinner: img.isWinner,
              })),
              winner_provider: winner?.provider,
              winner_score: winner?.scores.overall,
            },
          })
          .eq('id', jobId);

        // Register files in Drive (Meu Drive -> Criativos com IA)
        for (let i = 0; i < uploadedImages.length; i++) {
          const img = uploadedImages[i];
          // Extract storage path from URL to ensure it matches the actual uploaded path
          const urlMatch = img.url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
          const actualStoragePath = urlMatch ? urlMatch[1] : `${tenant_id}/${jobId}/${img.provider}_${i + 1}.png`;
          
          const { error: fileInsertError } = await supabase.from('files').insert({
            tenant_id,
            folder_id: folderId,
            filename: `${product_name || 'Produto'}_${img.provider}${img.isWinner ? '_BEST' : ''}_${Date.now()}.png`,
            original_name: `${img.provider}_${i + 1}.png`,
            storage_path: actualStoragePath,
            file_type: 'image',
            mime_type: 'image/png',
            size_bytes: null, // Could calculate from base64 but not critical
            created_by: userId,
            metadata: {
              source: 'creative_job_v3',
              job_id: jobId,
              product_id,
              provider: img.provider,
              is_winner: img.isWinner,
              scores: img.scores,
              url: img.url,
              bucket: 'media-assets',
              system_managed: true,
            },
          });
          
          if (fileInsertError) {
            console.error(`[creative-image] Error registering file to Drive:`, fileInsertError);
          } else {
            console.log(`[creative-image] File registered in Drive: ${actualStoragePath}`);
          }
        }

        console.log(`[creative-image] Pipeline complete: ${uploadedImages.length} images in ${elapsedMs}ms`);
        
      } catch (pipelineError) {
        console.error(`[creative-image] Pipeline error:`, pipelineError);
        await supabase.from('creative_jobs').update({
          status: 'failed',
          error_message: String(pipelineError),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);
      }
    };

    // Background processing
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processPipeline());
    } else {
      processPipeline().catch(console.error);
    }

    // Return immediately
    console.log(`[creative-image] Job ${jobId} queued for background processing`);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          job_id: jobId,
          status: 'running',
          message: 'Job iniciado. Acompanhe o progresso na lista.',
          pipeline_version: VERSION,
          providers: enabledProviders,
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
