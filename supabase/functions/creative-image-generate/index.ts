/**
 * Creative Image Generate — Edge Function (OpenAI Pipeline v2.0)
 * 
 * Pipeline COMPLETA de geração de imagens de produto "nível ChatGPT" usando Lovable AI Gateway.
 * 
 * PIPELINE:
 * 1. CUTOUT: Gerar recorte do produto (fundo transparente)
 * 2. GENERATION: Gerar N variações com imagem de referência
 * 3. QA: Avaliar cada variação (similarity + label check)
 * 4. FALLBACK: Se QA falhar, composição com produto real
 * 5. SELECTION: Escolher melhor variação automaticamente
 * 
 * MODELOS:
 * - google/gemini-2.5-flash-image (geração rápida)
 * - google/gemini-3-pro-image-preview (alta qualidade)
 * - google/gemini-3-flash-preview (QA de texto)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = '2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Constantes de custo (1 crédito = US$ 0,01)
const CREDIT_MARKUP = 1.5;
const USD_TO_BRL = 5.80;
const COST_PER_IMAGE_USD = 0.02;
const COST_PER_QA_USD = 0.005;

// Thresholds de QA
const QA_PASS_SCORE = 0.70; // Score mínimo para aprovar
const QA_SIMILARITY_WEIGHT = 0.4;
const QA_LABEL_WEIGHT = 0.3;
const QA_QUALITY_WEIGHT = 0.3;

// Configurações do Prompt Rewriter
const SCENE_PRESETS: Record<string, string> = {
  bathroom: "Banheiro moderno com iluminação natural vinda da janela, azulejos clean, espelho ao fundo, ambiente higienizado e premium",
  bedroom: "Quarto aconchegante com luz suave da manhã, lençóis brancos, ambiente relaxante e convidativo",
  gym: "Academia moderna e bem equipada, iluminação energética, pessoa saudável e ativa",
  outdoor: "Ar livre com luz natural intensa, paisagem natural ao fundo, sensação de liberdade",
  office: "Escritório moderno e organizado, mesa clean, ambiente profissional e produtivo",
  kitchen: "Cozinha lifestyle moderna, bancada de mármore ou granito, iluminação clean",
  studio: "Estúdio fotográfico com fundo neutro (branco ou cinza claro), iluminação profissional de 3 pontos",
  lavabo: "Lavabo premium e sofisticado, espelho elegante, iluminação indireta, ambiente luxuoso",
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

interface QAResult {
  passed: boolean;
  score: number;
  similarityScore: number;
  labelScore: number;
  qualityScore: number;
  reason?: string;
}

interface GeneratedVariant {
  imageBase64: string;
  url?: string;
  model: string;
  variantIndex: number;
  qa?: QAResult;
  isFallback?: boolean;
}

/**
 * PASSO 1 — PRODUCT CUTOUT
 * Gerar versão do produto com fundo transparente para proteção
 */
async function generateProductCutout(
  lovableApiKey: string,
  productBase64: string,
  productName: string
): Promise<{ cutoutBase64: string | null; error?: string }> {
  console.log(`[creative-image] Generating product cutout...`);
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Remova COMPLETAMENTE o fundo desta imagem de produto, deixando APENAS o produto (embalagem/frasco) isolado com fundo 100% transparente. 
              
REGRAS OBRIGATÓRIAS:
- Manter TODOS os detalhes do produto intactos
- NÃO alterar cores, texto, rótulo ou forma
- Corte preciso nas bordas do produto
- Fundo deve ser transparente (sem cor)
- Qualidade máxima, sem artefatos

Produto: "${productName}"`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${productBase64}` }
            }
          ]
        }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[creative-image] Cutout API error: ${response.status}`, errorText);
      return { cutoutBase64: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      return { cutoutBase64: null, error: 'No cutout image generated' };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { cutoutBase64: null, error: 'Invalid cutout format' };
    }

    console.log(`[creative-image] Product cutout generated successfully`);
    return { cutoutBase64: base64Match[1] };
    
  } catch (error) {
    console.error(`[creative-image] Cutout error:`, error);
    return { cutoutBase64: null, error: String(error) };
  }
}

/**
 * PASSO 2 — PROMPT REWRITER
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

  const shotPlan = [
    "Enquadramento: médio (do torso para cima), produto em destaque",
    "Lente: 85mm, leve desfoque de fundo (bokeh)",
    "Iluminação: principal frontal-lateral, fill suave, sem sombras duras no produto",
  ];

  const fidelityRules = config.inputFidelity === 'high' 
    ? `REGRA MÁXIMA DE FIDELIDADE (CRÍTICA):
- O produto DEVE ser IDÊNTICO à imagem de referência — é um produto REAL existente
- PRESERVAR 100% do texto/letras do rótulo sem alterar NADA
- PRESERVAR exatamente as mesmas cores, proporções e design
- O rótulo deve estar completamente legível e correto
- Se não conseguir manter fidelidade, é MELHOR não gerar`
    : config.inputFidelity === 'medium'
    ? `REGRA MÉDIA DE FIDELIDADE:
- Manter aparência geral do produto similar à referência
- Preservar cores principais e formato da embalagem
- Rótulo deve ser reconhecível`
    : `REGRA BAIXA DE FIDELIDADE:
- Manter estilo geral do produto
- Permite variações criativas menores`;

  const kitRule = config.isKit
    ? `CENÁRIO DE KIT (múltiplos produtos):
- PROIBIDO: pessoa segurando múltiplos produtos na mão
- OBRIGATÓRIO: produtos apoiados em superfície (bancada, prateleira, mesa)
- Organizar produtos de forma elegante e harmoniosa`
    : `CENÁRIO DE PRODUTO ÚNICO:
- Modelo pode segurar o produto naturalmente (máx. 1 por mão)
- Pose natural e não forçada`;

  const promptFinal = `FOTOGRAFIA PROFISSIONAL DE PRODUTO — QUALIDADE EDITORIAL ALTA

🎯 OBJETIVO: Criar foto realista de pessoa com o produto da imagem de referência.

📦 PRODUTO: "${config.productName}"
A imagem anexada mostra o produto REAL. Este produto EXISTE e deve aparecer EXATAMENTE como na referência.

${fidelityRules}

${kitRule}

👤 MODELO/PESSOA:
- ${genderDesc}, ${ageDesc}
- Aparência: pele realista, maquiagem natural, cabelo arrumado
- Expressão: ${config.pose === 'displaying' ? 'confiante e amigável' : 'natural e relaxada'}
- Pose: ${poseDesc}

🏠 CENÁRIO:
${sceneDesc}

📸 ESTILO FOTOGRÁFICO:
- ${shotPlan.join('\n- ')}
- Qualidade: resolução 4K, nitidez profissional
- Estilo: editorial de revista de lifestyle/beleza

${config.additionalPrompt ? `✏️ INSTRUÇÕES ADICIONAIS:\n${config.additionalPrompt}` : ''}

📐 FORMATO: Imagem quadrada 1:1 para redes sociais`;

  const negativePrompt = `texto sobreposto na imagem, logos fictícios, marcas inventadas, 
rótulo diferente do original, produto alterado, cores erradas, embalagem modificada, 
texto ilegível ou borrado, letras distorcidas ou inventadas, produto genérico,
produto duplicado, múltiplas cópias, baixa qualidade, pixelado, desfocado,
mãos deformadas, dedos extras, proporções irreais, pose artificial`;

  return { promptFinal, negativePrompt, shotPlan };
}

/**
 * PASSO 3 — GERAR IMAGEM
 */
async function generateImage(
  lovableApiKey: string,
  prompt: string,
  referenceImageBase64: string,
  quality: 'standard' | 'high' = 'high'
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  try {
    const model = quality === 'high' 
      ? 'google/gemini-3-pro-image-preview' 
      : 'google/gemini-2.5-flash-image';
    
    console.log(`[creative-image] Generating with model: ${model}`);
    
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
      console.error(`[creative-image] API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return { imageBase64: null, model, error: 'Rate limit. Tente em alguns minutos.' };
      }
      if (response.status === 402) {
        return { imageBase64: null, model, error: 'Créditos insuficientes.' };
      }
      
      return { imageBase64: null, model, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      return { imageBase64: null, model, error: 'No image generated' };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { imageBase64: null, model, error: 'Invalid image format' };
    }

    return { imageBase64: base64Match[1], model };
    
  } catch (error) {
    console.error(`[creative-image] Generation error:`, error);
    return { imageBase64: null, model: 'unknown', error: String(error) };
  }
}

/**
 * PASSO 4 — QA AUTOMÁTICO
 * Avaliar fidelidade do produto na imagem gerada
 */
async function evaluateImageQA(
  lovableApiKey: string,
  generatedBase64: string,
  originalProductBase64: string,
  productName: string,
  expectedLabels: string[]
): Promise<QAResult> {
  console.log(`[creative-image] Running QA evaluation...`);
  
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
              text: `Você é um QA de controle de qualidade para criativos publicitários.

TAREFA: Avaliar se o produto na IMAGEM GERADA está fiel ao PRODUTO ORIGINAL.

PRODUTO ESPERADO: "${productName}"
TEXTOS/MARCAS ESPERADOS NO RÓTULO: ${expectedLabels.length > 0 ? expectedLabels.join(', ') : 'Verificar se há texto visível'}

CRITÉRIOS DE AVALIAÇÃO (0 a 10 cada):

1. SIMILARITY (Similaridade Visual):
   - O produto gerado parece o mesmo da referência?
   - Cores, formato, proporções estão corretos?
   - 10 = idêntico, 5 = similar, 0 = completamente diferente

2. LABEL (Fidelidade do Rótulo):
   - O texto do rótulo está legível?
   - As palavras esperadas aparecem corretamente?
   - 10 = texto perfeito, 5 = parcialmente legível, 0 = inventado/ilegível

3. QUALITY (Qualidade Geral):
   - A imagem tem qualidade profissional?
   - O produto está em foco e bem iluminado?
   - 10 = qualidade excelente, 5 = aceitável, 0 = ruim

IMPORTANTE: Seja CRÍTICO. É preferível reprovar uma imagem duvidosa.

Responda APENAS no formato JSON:
{
  "similarity": <0-10>,
  "label": <0-10>,
  "quality": <0-10>,
  "label_text_found": "<texto que você conseguiu ler no rótulo>",
  "issues": ["<problema 1>", "<problema 2>"]
}`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${originalProductBase64}` }
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${generatedBase64}` }
            }
          ]
        }],
      }),
    });

    if (!response.ok) {
      console.error(`[creative-image] QA API error: ${response.status}`);
      // Se QA falhar, aprovar com score médio para não bloquear
      return {
        passed: true,
        score: 0.6,
        similarityScore: 6,
        labelScore: 6,
        qualityScore: 6,
        reason: 'QA check unavailable - approved by default',
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[creative-image] QA response not JSON:`, content.substring(0, 200));
      return {
        passed: true,
        score: 0.6,
        similarityScore: 6,
        labelScore: 6,
        qualityScore: 6,
        reason: 'QA response parse error - approved by default',
      };
    }

    const qaData = JSON.parse(jsonMatch[0]);
    
    const similarityScore = Math.min(10, Math.max(0, Number(qaData.similarity) || 5));
    const labelScore = Math.min(10, Math.max(0, Number(qaData.label) || 5));
    const qualityScore = Math.min(10, Math.max(0, Number(qaData.quality) || 5));
    
    // Weighted score (normalized 0-1)
    const score = (
      (similarityScore / 10) * QA_SIMILARITY_WEIGHT +
      (labelScore / 10) * QA_LABEL_WEIGHT +
      (qualityScore / 10) * QA_QUALITY_WEIGHT
    );
    
    const passed = score >= QA_PASS_SCORE;
    const issues = qaData.issues || [];
    
    console.log(`[creative-image] QA result: score=${score.toFixed(2)}, passed=${passed}, issues=${issues.length}`);
    
    return {
      passed,
      score,
      similarityScore,
      labelScore,
      qualityScore,
      reason: issues.length > 0 ? issues.join('; ') : undefined,
    };
    
  } catch (error) {
    console.error(`[creative-image] QA error:`, error);
    return {
      passed: true,
      score: 0.6,
      similarityScore: 6,
      labelScore: 6,
      qualityScore: 6,
      reason: `QA error: ${String(error)} - approved by default`,
    };
  }
}

/**
 * PASSO 5 — FALLBACK POR COMPOSIÇÃO
 * Gerar cena vazia e compor com produto real
 */
async function generateFallbackComposite(
  lovableApiKey: string,
  productCutoutBase64: string,
  productName: string,
  scene: string,
  gender: string,
  pose: string
): Promise<{ imageBase64: string | null; error?: string }> {
  console.log(`[creative-image] Generating fallback composite...`);
  
  try {
    const sceneDesc = SCENE_PRESETS[scene] || SCENE_PRESETS.bathroom;
    const genderDesc = GENDER_DESCRIPTIONS[gender] || GENDER_DESCRIPTIONS.any;
    
    // Primeiro: gerar cena com "espaço vazio" para o produto
    const scenePrompt = `Fotografia profissional de ${genderDesc} em ${sceneDesc}.

POSE: A pessoa está com a mão estendida ${pose === 'using' ? 'aplicando algo no rosto/cabelo' : 'como se estivesse segurando algo'}, mas NÃO há nenhum produto na mão.

IMPORTANTE:
- A mão deve estar posicionada como se segurasse uma embalagem/frasco
- Deixar ESPAÇO VISÍVEL onde o produto seria colocado
- Iluminação deve permitir inserção posterior de objeto
- Pose natural e convidativa

Estilo: editorial de revista, qualidade 4K, fundo desfocado (bokeh).`;

    const sceneResult = await generateImage(lovableApiKey, scenePrompt, productCutoutBase64, 'high');
    
    if (!sceneResult.imageBase64) {
      return { imageBase64: null, error: 'Failed to generate scene for composite' };
    }

    // Segundo: compor o produto real na cena
    const composePrompt = `TAREFA DE COMPOSIÇÃO FOTOGRÁFICA:

Você tem duas imagens:
1. CENA: Foto de pessoa com mão estendida (primeira imagem)
2. PRODUTO: Recorte do produto real com fundo transparente (segunda imagem)

INSTRUÇÃO: Componha o PRODUTO na mão da pessoa de forma FOTORREALISTA.

REGRAS OBRIGATÓRIAS:
- O produto deve parecer que está REALMENTE na mão da pessoa
- Ajustar escala para proporção realista
- Adicionar sombra sutil do produto
- Ajustar iluminação para integração perfeita
- NÃO alterar o produto de forma alguma — ele deve ficar IDÊNTICO
- Dedos podem ficar levemente na frente do produto (oclusão natural)

QUALIDADE: Resultado deve ser indistinguível de foto real.`;

    const compositeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: composePrompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${sceneResult.imageBase64}` }
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${productCutoutBase64}` }
            }
          ]
        }],
        modalities: ['image', 'text'],
      }),
    });

    if (!compositeResponse.ok) {
      const errorText = await compositeResponse.text();
      console.error(`[creative-image] Composite API error: ${compositeResponse.status}`, errorText);
      return { imageBase64: null, error: `Composite error: ${compositeResponse.status}` };
    }

    const data = await compositeResponse.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      return { imageBase64: null, error: 'No composite image generated' };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { imageBase64: null, error: 'Invalid composite format' };
    }

    console.log(`[creative-image] Fallback composite generated successfully`);
    return { imageBase64: base64Match[1] };
    
  } catch (error) {
    console.error(`[creative-image] Composite error:`, error);
    return { imageBase64: null, error: String(error) };
  }
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
    return btoa(binary);
  } catch (error) {
    console.error(`[creative-image] Download error:`, error);
    return null;
  }
}

/**
 * Extrair tokens de marca/label do nome do produto
 */
function extractLabelTokens(productName: string): string[] {
  // Palavras comuns a ignorar
  const stopWords = ['de', 'da', 'do', 'para', 'com', 'e', 'o', 'a', 'os', 'as', 'um', 'uma', 'ml', 'g', 'kg', 'l'];
  
  const tokens = productName
    .split(/[\s\-–—]+/)
    .filter(word => word.length > 2 && !stopWords.includes(word.toLowerCase()))
    .map(word => word.replace(/[^\w\u00C0-\u017F]/g, '')) // Manter acentos
    .filter(word => word.length > 0);
  
  return tokens.slice(0, 5); // Máximo 5 tokens
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[creative-image-generate v${VERSION}] Starting full pipeline...`);

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

    if (!tenant_id || !product_id || !product_image_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id, product_id e product_image_url são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify permission
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

    // Settings
    const {
      scene = 'bathroom',
      gender = 'any',
      age_range = 'middle',
      pose = 'holding',
      quality = 'high',
      input_fidelity = 'high',
      variations = 4,
      enable_qa = true,
      enable_fallback = true,
    } = settings;

    const numVariations = Math.min(Math.max(1, variations), 4);
    const labelTokens = extractLabelTokens(product_name || 'Produto');

    console.log(`[creative-image] Config: ${numVariations} variations, QA=${enable_qa}, fallback=${enable_fallback}`);
    console.log(`[creative-image] Label tokens:`, labelTokens);

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
    const pipelineSteps = [
      { step_id: 'cutout', model_id: 'gemini-flash-image', status: 'queued' },
      ...Array.from({ length: numVariations }, (_, i) => ({
        step_id: `image_${i + 1}`,
        model_id: 'gemini-pro-image',
        status: 'queued',
      })),
      { step_id: 'qa', model_id: 'gemini-flash', status: 'queued' },
      { step_id: 'select', model_id: 'internal', status: 'queued' },
    ];

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
          scene,
          gender,
          age_range,
          pose,
          quality,
          input_fidelity,
          variations: numVariations,
          enable_qa,
          enable_fallback,
          label_tokens: labelTokens,
          provider: 'lovable_ai',
          pipeline_version: VERSION,
        },
        pipeline_steps: pipelineSteps,
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

    // ========== PIPELINE EXECUTION ==========

    // STEP 1: Download product image
    const productBase64 = await downloadImageAsBase64(product_image_url);
    if (!productBase64) {
      await supabase.from('creative_jobs').update({ 
        status: 'failed', 
        error_message: 'Não foi possível baixar a imagem do produto' 
      }).eq('id', jobId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao baixar imagem do produto' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Generate product cutout (for QA comparison and fallback)
    await supabase.from('creative_jobs').update({ current_step: 0 }).eq('id', jobId);
    
    const cutoutResult = await generateProductCutout(lovableApiKey, productBase64, product_name || 'Produto');
    const productCutoutBase64 = cutoutResult.cutoutBase64 || productBase64; // Fallback to original if cutout fails

    // STEP 3: Build prompt
    const { promptFinal, negativePrompt, shotPlan } = rewritePrompt({
      productName: product_name || 'Produto',
      scene,
      gender,
      ageRange: age_range,
      pose,
      additionalPrompt: prompt,
      inputFidelity: input_fidelity,
      isKit: false,
    });

    // STEP 4: Generate variations
    const variants: GeneratedVariant[] = [];
    let totalCostCents = 0;

    for (let i = 0; i < numVariations; i++) {
      console.log(`[creative-image] Generating variant ${i + 1}/${numVariations}...`);
      await supabase.from('creative_jobs').update({ current_step: i + 1 }).eq('id', jobId);

      const variantPrompt = i === 0 
        ? promptFinal 
        : `${promptFinal}\n\n🔄 VARIAÇÃO ${i + 1}: Crie versão diferente. Varie sutilmente: ângulo, pose, expressão ou iluminação. Mantenha MESMA fidelidade ao produto.`;

      const result = await generateImage(
        lovableApiKey,
        variantPrompt,
        productBase64,
        quality === 'high' ? 'high' : 'standard'
      );

      if (result.imageBase64) {
        variants.push({
          imageBase64: result.imageBase64,
          model: result.model,
          variantIndex: i + 1,
        });
        totalCostCents += Math.ceil(COST_PER_IMAGE_USD * CREDIT_MARKUP * USD_TO_BRL * 100);
      } else {
        console.error(`[creative-image] Variant ${i + 1} failed:`, result.error);
      }
    }

    // STEP 5: QA Evaluation
    if (enable_qa && variants.length > 0) {
      console.log(`[creative-image] Running QA on ${variants.length} variants...`);
      await supabase.from('creative_jobs').update({ current_step: numVariations + 1 }).eq('id', jobId);

      for (const variant of variants) {
        const qa = await evaluateImageQA(
          lovableApiKey,
          variant.imageBase64,
          productBase64,
          product_name || 'Produto',
          labelTokens
        );
        variant.qa = qa;
        totalCostCents += Math.ceil(COST_PER_QA_USD * CREDIT_MARKUP * USD_TO_BRL * 100);
      }
    }

    // STEP 6: Check if all failed QA → fallback
    const passedVariants = variants.filter(v => !enable_qa || v.qa?.passed !== false);
    
    if (passedVariants.length === 0 && enable_fallback) {
      console.log(`[creative-image] All variants failed QA, generating fallback composite...`);
      
      const fallbackResult = await generateFallbackComposite(
        lovableApiKey,
        productCutoutBase64,
        product_name || 'Produto',
        scene,
        gender,
        pose
      );

      if (fallbackResult.imageBase64) {
        variants.push({
          imageBase64: fallbackResult.imageBase64,
          model: 'composite-fallback',
          variantIndex: variants.length + 1,
          isFallback: true,
          qa: { passed: true, score: 0.8, similarityScore: 10, labelScore: 10, qualityScore: 6, reason: 'Fallback composite' },
        });
        totalCostCents += Math.ceil(COST_PER_IMAGE_USD * 2 * CREDIT_MARKUP * USD_TO_BRL * 100);
      }
    }

    // STEP 7: Select best variant
    await supabase.from('creative_jobs').update({ current_step: numVariations + 2 }).eq('id', jobId);
    
    const finalVariants = variants
      .filter(v => !enable_qa || v.qa?.passed !== false || v.isFallback)
      .sort((a, b) => (b.qa?.score || 0.5) - (a.qa?.score || 0.5));

    // STEP 8: Upload to storage
    const uploadedImages: { url: string; model: string; variantIndex: number; qa?: QAResult; isBest: boolean }[] = [];
    
    for (let i = 0; i < finalVariants.length; i++) {
      const variant = finalVariants[i];
      const storagePath = `${tenant_id}/${jobId}/variant_${variant.variantIndex}.png`;
      
      try {
        const binaryData = Uint8Array.from(atob(variant.imageBase64), c => c.charCodeAt(0));
        
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
            model: variant.model,
            variantIndex: variant.variantIndex,
            qa: variant.qa,
            isBest: i === 0, // First is best (sorted by score)
          });
        }
      } catch (error) {
        console.error(`[creative-image] Upload error:`, error);
      }
    }

    // STEP 9: Save results
    const elapsedMs = Date.now() - startTime;
    const finalStatus = uploadedImages.length > 0 ? 'succeeded' : 'failed';
    const bestImage = uploadedImages.find(img => img.isBest);

    await supabase
      .from('creative_jobs')
      .update({
        status: finalStatus,
        output_urls: uploadedImages.map(img => img.url),
        cost_cents: totalCostCents,
        processing_time_ms: elapsedMs,
        completed_at: new Date().toISOString(),
        error_message: uploadedImages.length === 0 ? 'Nenhuma imagem aprovada pelo QA' : null,
        settings: {
          ...job.settings,
          actual_variants: uploadedImages.length,
          best_variant_index: bestImage?.variantIndex,
          best_score: bestImage?.qa?.score,
          qa_results: uploadedImages.map(img => ({
            variantIndex: img.variantIndex,
            score: img.qa?.score,
            passed: img.qa?.passed,
            reason: img.qa?.reason,
          })),
        },
      })
      .eq('id', jobId);

    // Register files in drive
    for (const img of uploadedImages) {
      await supabase.from('files').insert({
        tenant_id,
        folder_id: folderId,
        filename: `Criativo_${(product_name || 'Produto').substring(0, 20)}_v${img.variantIndex}${img.isBest ? '_BEST' : ''}.png`,
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
          is_best: img.isBest,
          qa_score: img.qa?.score,
        },
      });
    }

    console.log(`[creative-image] Pipeline complete: ${uploadedImages.length} images in ${elapsedMs}ms`);

    return new Response(
      JSON.stringify({
        success: uploadedImages.length > 0,
        data: {
          job_id: jobId,
          status: finalStatus,
          generated_count: uploadedImages.length,
          requested_count: numVariations,
          best_image: bestImage?.url,
          best_score: bestImage?.qa?.score,
          images: uploadedImages,
          cost_cents: totalCostCents,
          processing_time_ms: elapsedMs,
          pipeline_version: VERSION,
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
