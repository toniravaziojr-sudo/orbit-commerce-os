/**
 * Creative Image Generate — Edge Function v4.0 (Resilient Pipeline)
 * 
 * Suporta:
 * - Gemini Flash + Gemini Pro como providers reais distintos
 * - Retry automático com modelo alternativo se o primeiro falhar
 * - Fallback final: usa imagem do catálogo para ads_creative_assets
 * - 3 estilos: product_natural, person_interacting, promotional
 * 
 * MODELOS:
 * - Primary: google/gemini-3-pro-image-preview
 * - Fallback: google/gemini-2.5-flash-image
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = '4.1.0'; // Fix: better error logging, download retry, timeout handling

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

// ========== KIT / MULTI-PRODUCT DETECTION ==========

function detectProductType(productName: string): { isKit: boolean; estimatedItems: number; kitType: string } {
  const name = productName.toLowerCase().trim();
  
  // Detect "Kit" keyword
  if (/\bkit\b/i.test(name)) {
    // Try to extract quantity from name like "Kit 3x" or "Kit com 5"
    const qtyMatch = name.match(/(\d+)\s*(?:x|un|pç|peças|itens|produtos)/i) || name.match(/kit\s+(?:com\s+)?(\d+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 3; // default 3 for kits
    return { isKit: true, estimatedItems: qty, kitType: 'kit' };
  }
  
  // Detect multiplier patterns: "2x", "3x", "(2x)", "Pack 2", "2 Un", "3 unidades"
  const multiplierMatch = name.match(/\(?\s*(\d+)\s*x\s*\)?/i) 
    || name.match(/\bpack\s+(\d+)/i)
    || name.match(/(\d+)\s*(?:un|unidade|unidades)\b/i);
  if (multiplierMatch) {
    const qty = parseInt(multiplierMatch[1]);
    if (qty >= 2) return { isKit: true, estimatedItems: qty, kitType: 'pack' };
  }
  
  // Detect "combo", "conjunto", "pack"
  if (/\b(combo|conjunto|pack|coleção)\b/i.test(name)) {
    return { isKit: true, estimatedItems: 3, kitType: 'combo' };
  }
  
  return { isKit: false, estimatedItems: 1, kitType: 'single' };
}

function buildHandInstructions(productName: string): string {
  const { isKit, estimatedItems, kitType } = detectProductType(productName);
  
  if (!isKit) {
    // Single product: can hold in one or two hands
    return `🖐️ REGRA DE MÃOS:
- A pessoa pode segurar o produto com UMA ou DUAS mãos
- Segurar pela base/corpo, rótulo frontal VISÍVEL
- Mãos devem parecer naturais, não forçadas`;
  }
  
  if (estimatedItems <= 2) {
    // 2 items: one in each hand max
    return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems} itens):
- NO MÁXIMO um produto em CADA MÃO (total: 2 nas mãos)
- Mãos devem segurar com naturalidade
- Rótulos frontais visíveis em ambos os produtos`;
  }
  
  // 3+ items: this is a kit — check if it comes in a box/package
  return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems}+ itens):
- SE o kit vier em uma embalagem única (caixa, sacola, pacote) que um humano consiga segurar: a pessoa PODE segurar a embalagem
- SE forem produtos avulsos: a pessoa segura NO MÁXIMO 1 em cada mão (total: 2)
- Os produtos restantes devem estar DISPOSTOS em uma superfície próxima (mesa, bancada, prateleira)
- A composição deve parecer natural e organizada
- PROIBIDO: empilhar vários produtos nas mãos, parecer desajeitado ou desproporcional
- Os produtos sobre a mesa devem ter rótulos visíveis`;
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
    
    const handRules = buildHandInstructions(productName);
    
    return `FOTOGRAFIA PROFISSIONAL — PESSOA COM PRODUTO — ${formatDesc}

📦 PRODUTO: "${productName}"
A imagem de referência mostra o produto REAL.

👤 PESSOA: ${personProfile || 'pessoa atraente com aparência natural e saudável'}
🎬 AÇÃO: ${actionDesc}
🎨 TOM: ${toneDesc}

${handRules}

${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}

REGRAS CRÍTICAS DE FIDELIDADE:
- O produto será SUBSTITUÍDO por composição (Label Lock)
- Foque em criar a CENA perfeita (pessoa, mãos, iluminação)
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

// ========== MODELS CONFIG ==========

const MODELS = {
  primary: 'google/gemini-3-pro-image-preview',
  fallback: 'google/gemini-2.5-flash-image',
} as const;

// ========== GENERATE WITH MODEL ==========

async function generateWithModel(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceImageBase64: string,
): Promise<{ imageBase64: string | null; error?: string }> {
  try {
    console.log(`[creative-image] Generating with model: ${model}...`);
    
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
      console.error(`[creative-image] ${model} API error: ${response.status}`, errorText.substring(0, 300));
      if (response.status === 429) return { imageBase64: null, error: `Rate limit ${model}` };
      if (response.status === 402) return { imageBase64: null, error: 'Créditos insuficientes' };
      return { imageBase64: null, error: `${model} error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.warn(`[creative-image] ${model} returned no image (silent failure)`);
      return { imageBase64: null, error: `${model} não retornou imagem` };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return { imageBase64: null, error: `Formato inválido ${model}` };
    }

    console.log(`[creative-image] ${model} generated image OK (${base64Match[1].length} chars)`);
    return { imageBase64: base64Match[1] };
    
  } catch (error) {
    console.error(`[creative-image] ${model} error:`, error);
    return { imageBase64: null, error: String(error) };
  }
}

// ========== RESILIENT GENERATE (with retry + fallback model) ==========

async function resilientGenerate(
  lovableApiKey: string,
  prompt: string,
  referenceImageBase64: string,
  provider: Provider,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  // Attempt 1: primary model
  const primaryModel = provider === 'gemini' ? MODELS.primary : MODELS.fallback;
  const fallbackModel = provider === 'gemini' ? MODELS.fallback : MODELS.primary;

  const attempt1 = await generateWithModel(lovableApiKey, primaryModel, prompt, referenceImageBase64);
  if (attempt1.imageBase64) {
    return { imageBase64: attempt1.imageBase64, model: primaryModel };
  }

  console.warn(`[creative-image] Primary ${primaryModel} failed: ${attempt1.error}. Retrying with ${fallbackModel}...`);

  // Attempt 2: fallback model
  const attempt2 = await generateWithModel(lovableApiKey, fallbackModel, prompt, referenceImageBase64);
  if (attempt2.imageBase64) {
    return { imageBase64: attempt2.imageBase64, model: fallbackModel };
  }

  console.warn(`[creative-image] Fallback ${fallbackModel} also failed: ${attempt2.error}. Trying simplified prompt...`);

  // Attempt 3: simplified prompt with primary model
  const simplifiedPrompt = `Crie uma fotografia profissional do produto "${prompt.match(/"([^"]+)"/)?.[1] || 'produto'}" em fundo branco limpo. O produto deve ser IDÊNTICO à imagem de referência. Qualidade editorial.`;
  const attempt3 = await generateWithModel(lovableApiKey, primaryModel, simplifiedPrompt, referenceImageBase64);
  if (attempt3.imageBase64) {
    return { imageBase64: attempt3.imageBase64, model: primaryModel };
  }

  return { imageBase64: null, model: primaryModel, error: `All 3 attempts failed: ${attempt1.error} | ${attempt2.error} | ${attempt3.error}` };
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
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[creative-image] Downloading (attempt ${attempt}/3): ${url.substring(0, 100)}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreativeBot/1.0)' },
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        console.error(`[creative-image] Download failed (attempt ${attempt}): HTTP ${response.status} ${response.statusText}`);
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        return null;
      }
      
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');
      console.log(`[creative-image] Download response: type=${contentType}, length=${contentLength}`);
      
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 100) {
        console.error(`[creative-image] Downloaded image too small: ${arrayBuffer.byteLength} bytes`);
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        return null;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
      console.log(`[creative-image] Downloaded OK: ${arrayBuffer.byteLength} bytes, base64 length: ${base64.length}`);
      return base64;
    } catch (error: any) {
      console.error(`[creative-image] Download error (attempt ${attempt}):`, error?.name, error?.message);
      if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
      return null;
    }
  }
  return null;
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
        userId = null; // M2M calls — created_by will be null (nullable after migration)
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
      output_folder_id,
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

    // Ensure folder exists — use output_folder_id if provided (e.g. from ads-autopilot-creative)
    let folderId = output_folder_id || null;

    if (folderId) {
      // Verify the provided folder exists
      const { data: existingFolder } = await supabase
        .from('files')
        .select('id')
        .eq('id', folderId)
        .eq('tenant_id', tenant_id)
        .eq('is_folder', true)
        .maybeSingle();
      
      if (!existingFolder) {
        console.log(`[creative-image] Provided output_folder_id ${folderId} not found, falling back to default`);
        folderId = null;
      } else {
        console.log(`[creative-image] Using provided output_folder_id: ${folderId}`);
      }
    }

    if (!folderId) {
      // Fallback: use/create default "Criativos com IA" folder
      const { data: folder } = await supabase
        .from('files')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('filename', 'Criativos com IA')
        .eq('is_folder', true)
        .maybeSingle();

      folderId = folder?.id;
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
        console.log(`[creative-image][${VERSION}] Pipeline start for job ${jobId}, product: ${product_name}, image: ${product_image_url?.substring(0, 100)}`);
        const productBase64 = await downloadImageAsBase64(product_image_url);
        if (!productBase64) {
          const errMsg = `Não foi possível baixar a imagem do produto: ${product_image_url?.substring(0, 100)}`;
          console.error(`[creative-image][${VERSION}] ${errMsg}`);
          await supabase.from('creative_jobs').update({ 
            status: 'failed', 
            error_message: errMsg,
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
          return;
        }
        console.log(`[creative-image][${VERSION}] Image downloaded OK (${productBase64.length} base64 chars)`);

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

          // Generate with resilient pipeline (retry + fallback model)
          const providerPromises = enabledProviders.map(async (provider): Promise<ProviderResult> => {
            const result = await resilientGenerate(lovableApiKey, variantPrompt, productBase64, provider);
            
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
          
          // Generate unique descriptive filename
          const now = new Date();
          const timestamp = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          const sanitizedProduct = (product_name || 'Produto').replace(/[^a-zA-Z0-9À-ÿ]/g, '_').substring(0, 30);
          const style = (job?.settings?.style || 'default').replace(/[^a-zA-Z0-9]/g, '_');
          const uniqueFilename = `${sanitizedProduct}_${style}_${img.provider}_${timestamp}${img.isWinner ? '_BEST' : ''}.png`;

          const { error: fileInsertError } = await supabase.from('files').insert({
            tenant_id,
            folder_id: folderId,
            filename: uniqueFilename,
            original_name: uniqueFilename,
            storage_path: actualStoragePath,
            mime_type: 'image/png',
            size_bytes: null,
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

        // Update ads_creative_assets that reference this job_id
        // Find linked assets first (needed for both success and fallback paths)
        const { data: linkedAssets } = await supabase
          .from('ads_creative_assets')
          .select('id, meta')
          .eq('tenant_id', tenant_id)
          .eq('product_id', product_id);
        
        const assetsToUpdate = (linkedAssets || []).filter((a: any) => {
          const m = a.meta as any;
          return m?.image_job_id === jobId;
        });

        if (uploadedImages.length > 0) {
          // SUCCESS PATH: use generated image
          const winnerUrl = (winner?.url || uploadedImages[0]?.url);
          const winnerStoragePath = (() => {
            const m = winnerUrl?.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
            return m ? m[1] : null;
          })();
          
          if (assetsToUpdate.length > 0) {
            for (const asset of assetsToUpdate) {
              const existingMeta = asset.meta as any || {};
              await supabase.from('ads_creative_assets').update({
                asset_url: winnerUrl,
                storage_path: winnerStoragePath,
                status: 'ready',
                meta: {
                  ...existingMeta,
                  image_status: 'completed',
                  image_job_id: jobId,
                  image_scores: winner?.scores || uploadedImages[0]?.scores,
                },
              }).eq('id', asset.id);
            }
            console.log(`[creative-image][${VERSION}] Updated ${assetsToUpdate.length} ads_creative_assets with generated image`);
          }
        } else {
          // FALLBACK PATH: ALL generation attempts failed — use catalog image
          console.warn(`[creative-image][${VERSION}] ALL generation attempts failed. Using catalog image as fallback.`);
          
          if (assetsToUpdate.length > 0 && product_image_url) {
            for (const asset of assetsToUpdate) {
              const existingMeta = asset.meta as any || {};
              await supabase.from('ads_creative_assets').update({
                asset_url: product_image_url,
                status: 'ready',
                meta: {
                  ...existingMeta,
                  image_status: 'fallback_catalog',
                  image_job_id: jobId,
                  fallback_reason: 'All AI generation attempts failed',
                },
              }).eq('id', asset.id);
            }
            console.log(`[creative-image][${VERSION}] Fallback: ${assetsToUpdate.length} ads_creative_assets updated with CATALOG image`);
          }
        }

        // Trigger analyze callback to continue campaign chain (both success and fallback)
        if (assetsToUpdate.length > 0) {
          try {
            const { error: cbErr } = await supabase.functions.invoke("ads-autopilot-analyze", {
              body: { tenant_id, trigger_type: "creative_ready" },
            });
            if (cbErr) {
              console.error(`[creative-image][${VERSION}] Analyze callback error:`, cbErr.message);
            } else {
              console.log(`[creative-image][${VERSION}] Analyze callback triggered (creative_ready)`);
            }
          } catch (cbCatchErr: any) {
            console.error(`[creative-image][${VERSION}] Analyze callback catch:`, cbCatchErr.message);
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
