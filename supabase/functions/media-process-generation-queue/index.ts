/**
 * Media Process Generation Queue — v6.0 (Real OpenAI + Gemini Lovable + QA Scorer)
 * 
 * Provedores de imagem:
 * - OpenAI: Real OpenAI API (gpt-image-1) — provider primário "openai"
 * - Gemini Flash (google/gemini-2.5-flash-image) via Lovable Gateway — provider "gemini"
 * - Gemini Pro (google/gemini-3-pro-image-preview) via Lovable Gateway — fallback
 * - QA Scorer (google/gemini-3-flash-preview) — scoring de realismo
 * - Seleção automática do melhor resultado por score
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = '6.0.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Provider = 'gemini' | 'openai';

interface GenerationSettings {
  use_packshot?: boolean;
  content_type?: string;
  packshot_url?: string;
  reference_source?: string;
  matched_products?: Array<{ id: string; name: string; image_url: string | null; is_kit?: boolean }>;
  needs_product_image?: boolean;
  is_kit_scenario?: boolean;
  image_size?: string;
  asset_type?: "image" | "video";
  duration?: number;
  aspect_ratio?: string;
  source_image_url?: string;
  product_name?: string;
  providers?: Provider[];
  enable_qa?: boolean;
}

interface QAScores {
  realism: number;
  quality: number;
  composition: number;
  label: number;
  overall: number;
}

interface ProviderResult {
  provider: Provider;
  imageBase64: string | null;
  scores: QAScores;
  error?: string;
  usedReference: boolean;
}

// ========== ENSURE MEDIA MONTH FOLDER (Drive) ==========

const MEDIA_ROOT_FOLDER = 'Mídias Sociais';

async function ensureMediaMonthFolderEdge(
  supabase: any,
  tenantId: string,
  userId: string,
  campaignStartDate: string
): Promise<string | null> {
  try {
    // Ensure root folder
    let rootFolderId: string | null = null;
    const { data: existingRootArr } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('filename', MEDIA_ROOT_FOLDER)
      .eq('is_folder', true)
      .is('folder_id', null)
      .order('created_at', { ascending: true })
      .limit(1);
    const existingRoot = existingRootArr?.[0];

    if (existingRoot) {
      rootFolderId = existingRoot.id;
    } else {
      const { data: createdRoot, error: rootErr } = await supabase
        .from('files')
        .insert({
          tenant_id: tenantId,
          folder_id: null,
          filename: MEDIA_ROOT_FOLDER,
          original_name: MEDIA_ROOT_FOLDER,
          storage_path: `${tenantId}/midias-sociais/`,
          is_folder: true,
          is_system_folder: false,
          created_by: userId,
          metadata: { source: 'media_module', system_managed: true },
        })
        .select('id')
        .single();
      if (rootErr || !createdRoot) return null;
      rootFolderId = createdRoot.id;
    }

    // Parse month from start_date
    const date = new Date(campaignStartDate + 'T00:00:00');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const monthSlug = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Ensure month folder
    const { data: existingMonthArr } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('folder_id', rootFolderId)
      .eq('filename', monthName)
      .eq('is_folder', true)
      .order('created_at', { ascending: true })
      .limit(1);
    const existingMonth = existingMonthArr?.[0];

    if (existingMonth) return existingMonth.id;

    const { data: createdMonth, error: monthErr } = await supabase
      .from('files')
      .insert({
        tenant_id: tenantId,
        folder_id: rootFolderId,
        filename: monthName,
        original_name: monthName,
        storage_path: `${tenantId}/midias-sociais/${monthSlug}/`,
        is_folder: true,
        is_system_folder: false,
        created_by: userId,
        metadata: { source: 'media_campaign', system_managed: true, month: monthSlug },
      })
      .select('id')
      .single();

    if (monthErr || !createdMonth) return null;
    return createdMonth.id;
  } catch (err) {
    console.error('⚠️ ensureMediaMonthFolderEdge error:', err);
    return null;
  }
}

// ========== DOWNLOAD IMAGE ==========

async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading: ${url.substring(0, 80)}...`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status}`);
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
    console.error(`❌ Download error:`, error);
    return null;
  }
}

// ========== GENERATE WITH GEMINI (Flash) ==========

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  referenceImageBase64: string | null,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  const model = "google/gemini-2.5-flash-image";
  try {
    console.log(`🎨 Gemini Flash generation (ref: ${!!referenceImageBase64})...`);

    const content: any[] = [{ type: "text", text: prompt }];
    if (referenceImageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${referenceImageBase64}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini error: ${response.status}`, errorText);
      if (response.status === 429) return { imageBase64: null, model, error: "Rate limit Gemini. Aguarde." };
      if (response.status === 402) return { imageBase64: null, model, error: "Créditos insuficientes." };
      return { imageBase64: null, model, error: `Gemini HTTP ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) return { imageBase64: null, model, error: "Gemini não retornou imagem" };

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) return { imageBase64: null, model, error: "Formato inválido Gemini" };

    console.log("✅ Gemini Flash image generated");
    return { imageBase64: base64Match[1], model };
  } catch (error) {
    console.error("❌ Gemini error:", error);
    return { imageBase64: null, model, error: String(error) };
  }
}

// ========== GENERATE WITH REAL OPENAI (gpt-image-1) ==========

async function generateWithOpenAI(
  apiKey: string,
  openaiApiKey: string | null,
  prompt: string,
  referenceImageBase64: string | null,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  
  // Try Real OpenAI first via Chat Completions API (gpt-image-1)
  if (openaiApiKey) {
    const model = "gpt-image-1";
    try {
      console.log(`🎨 Real OpenAI ${model} via Chat Completions (ref: ${!!referenceImageBase64})...`);

      // Build user content with optional reference image
      const userContent: any[] = [
        { type: 'text', text: prompt },
      ];
      
      if (referenceImageBase64) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${referenceImageBase64}`,
          },
        });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: userContent },
          ],
          modalities: ['image', 'text'],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let b64: string | null = null;
        
        // Extract from output_images
        const outputImages = data.choices?.[0]?.message?.output_images;
        if (outputImages && outputImages.length > 0) {
          const imgUrl = outputImages[0]?.url || outputImages[0];
          if (typeof imgUrl === 'string' && imgUrl.startsWith('data:')) {
            b64 = imgUrl.split(',')[1] || null;
          } else if (typeof imgUrl === 'string') {
            b64 = imgUrl;
          }
        }
        
        // Fallback: check content parts
        if (!b64) {
          const content = data.choices?.[0]?.message?.content;
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part.type === 'image_url' && part.image_url?.url) {
                const url = part.image_url.url;
                b64 = url.startsWith('data:') ? url.split(',')[1] : url;
                break;
              }
            }
          }
        }
        
        if (b64) {
          console.log(`✅ Real OpenAI ${model} image generated via Chat Completions`);
          return { imageBase64: b64, model: `${model} (OpenAI)` };
        }
        console.warn(`⚠️ OpenAI ${model} returned no image in response`);
      } else {
        const errorText = await response.text();
        console.error(`❌ OpenAI ${model} error: ${response.status}`, errorText.substring(0, 200));
      }

      console.warn("⚠️ Real OpenAI failed, falling back to Lovable Gateway (Gemini Pro)...");
    } catch (error) {
      console.error("❌ Real OpenAI error:", error);
    }
  } else {
    console.warn("⚠️ OPENAI_API_KEY not available, using Lovable Gateway fallback for OpenAI provider");
  }

  // Fallback: Lovable Gateway with Gemini Pro
  const fallbackModel = "google/gemini-3-pro-image-preview";
  try {
    console.log(`🎨 Lovable fallback (${fallbackModel}) for OpenAI provider...`);

    const openaiPrompt = `${prompt}

ESTILO OPENAI:
- Fotorrealismo extremo
- Iluminação natural cinematográfica
- Composição equilibrada
- Cores realistas sem oversaturation`;

    const content: any[] = [{ type: "text", text: openaiPrompt }];
    if (referenceImageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${referenceImageBase64}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: fallbackModel,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Lovable fallback error: ${response.status}`, errorText);
      if (response.status === 429) return { imageBase64: null, model: fallbackModel, error: "Rate limit. Aguarde." };
      if (response.status === 402) return { imageBase64: null, model: fallbackModel, error: "Créditos insuficientes." };
      return { imageBase64: null, model: fallbackModel, error: `Lovable HTTP ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) return { imageBase64: null, model: fallbackModel, error: "Lovable fallback não gerou imagem" };

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) return { imageBase64: null, model: fallbackModel, error: "Formato inválido Lovable" };

    console.log("✅ Lovable fallback (Gemini Pro) image generated for OpenAI provider");
    return { imageBase64: base64Match[1], model: `${fallbackModel} (Lovable fallback)` };
  } catch (error) {
    console.error("❌ Lovable fallback error:", error);
    return { imageBase64: null, model: fallbackModel, error: String(error) };
  }
}

// ========== REALISM SCORER ==========

async function scoreImageForRealism(
  apiKey: string,
  imageBase64: string,
  originalProductBase64: string | null,
  productName: string,
): Promise<QAScores> {
  console.log(`🔍 Scoring image for realism...`);
  try {
    const content: any[] = [
      {
        type: "text",
        text: `Você é um juiz especialista em avaliar FIDELIDADE de imagens de produto geradas por IA.

TAREFA: Avaliar se a IMAGEM GERADA mantém o produto IDÊNTICO ao original e se parece uma FOTO REAL.

PRODUTO ESPERADO: "${productName}"

REGRA CRÍTICA: Se o produto foi ALTERADO, REDESENHADO ou tem VARIAÇÕES que não existem na referência, a nota de LABEL deve ser 0-2.

Avalie de 0 a 10 cada critério:

1. REALISM (Parece foto real?):
   - 10 = Indistinguível de foto real
   - 7 = Muito boa, pequenos detalhes revelam IA
   - 5 = Obviamente IA mas aceitável
   - 0 = Claramente artificial

2. QUALITY (Qualidade técnica):
   - 10 = Qualidade profissional 4K
   - 0 = Baixa qualidade

3. COMPOSITION (Composição):
   - 10 = Composição perfeita
   - 0 = Composição ruim

4. LABEL (Fidelidade do produto — CRITÉRIO MAIS IMPORTANTE):
   - 10 = Produto 100% idêntico ao original (mesma embalagem, rótulo, cores)
   - 5 = Produto similar mas com pequenas diferenças
   - 2 = Produto foi redesenhado ou alterado significativamente
   - 0 = Produto completamente diferente, inventado, ou criou variações que não existem

Responda APENAS em JSON:
{
  "realism": <0-10>,
  "quality": <0-10>,
  "composition": <0-10>,
  "label": <0-10>,
  "reasoning": "<breve explicação, mencione se o produto foi alterado>"
}`,
      },
    ];

    // Add original product reference if available
    if (originalProductBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${originalProductBase64}` },
      });
    }

    // Add generated image
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${imageBase64}` },
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      console.error(`❌ Scorer API error: ${response.status}`);
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const scores = JSON.parse(jsonMatch[0]);
    const realism = Math.min(10, Math.max(0, Number(scores.realism) || 5));
    const quality = Math.min(10, Math.max(0, Number(scores.quality) || 5));
    const composition = Math.min(10, Math.max(0, Number(scores.composition) || 5));
    const label = Math.min(10, Math.max(0, Number(scores.label) || 5));

    // Peso: Realismo 40%, Label 25%, Quality 20%, Composition 15%
    const overall =
      (realism / 10) * 0.4 +
      (label / 10) * 0.25 +
      (quality / 10) * 0.2 +
      (composition / 10) * 0.15;

    console.log(`📊 Scores: realism=${realism}, quality=${quality}, composition=${composition}, label=${label}, overall=${overall.toFixed(2)}`);
    return { realism, quality, composition, label, overall };
  } catch (error) {
    console.error("❌ Scorer error:", error);
    return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
  }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || null;

  if (!lovableApiKey) {
    console.error("❌ LOVABLE_API_KEY not configured");
    return new Response(
      JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (openaiApiKey) {
    console.log(`[media-process-generation-queue v${VERSION}] OpenAI API key available — real OpenAI enabled`);
  } else {
    console.log(`[media-process-generation-queue v${VERSION}] No OPENAI_API_KEY — OpenAI provider will use Lovable fallback`);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch queued generations (limit 3)
    const { data: generations, error: fetchError } = await supabase
      .from("media_asset_generations")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(3);

    if (fetchError) {
      console.error("❌ Error fetching queued generations:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar fila" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!generations || generations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Fila vazia", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[media-process-generation-queue v${VERSION}] Processing ${generations.length} queued generations`);

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const generation of generations) {
      const genStartTime = Date.now();
      const genId = generation.id;

      try {
        // Mark as generating
        await supabase
          .from("media_asset_generations")
          .update({ status: "generating" })
          .eq("id", genId);

        console.log(`\n========== 🎬 Processing generation ${genId} ==========`);

        const settings = (generation.settings || {}) as GenerationSettings;
        const assetType = settings.asset_type || "image";
        const contentType = settings.content_type || "image";
        const needsProductImage = settings.needs_product_image ?? false;
        const matchedProducts = settings.matched_products || [];
        const isKitScenario = settings.is_kit_scenario ?? false;
        const enabledProviders: Provider[] = settings.providers || ['gemini', 'openai'];
        const enableQA = settings.enable_qa !== false; // default true

        console.log("📋 Settings:", JSON.stringify({
          assetType, contentType, needsProductImage,
          matchedProductsCount: matchedProducts.length,
          isKitScenario, providers: enabledProviders, enableQA,
        }));

        // Skip video generation
        if (assetType === "video") {
          throw new Error("Geração de vídeo não disponível. Use o Gestor de Criativos para vídeos.");
        }

        // ============ DUAL PROVIDER IMAGE GENERATION ============

        const productWithImage = matchedProducts.find((p) => p.image_url);
        let referenceBase64: string | null = null;
        let finalPrompt = generation.prompt_final;

        // Download product reference image
        if (needsProductImage && productWithImage?.image_url) {
          console.log(`📦 Product: "${productWithImage.name}" — downloading reference...`);
          referenceBase64 = await downloadImageAsBase64(productWithImage.image_url);
          if (!referenceBase64) {
            throw new Error(`Não foi possível baixar a imagem do produto "${productWithImage.name}".`);
          }

          const kitInstruction = isKitScenario
            ? `CENÁRIO DE KIT (${matchedProducts.length} produtos):
- PROIBIDO: pessoa segurando múltiplos produtos na mão
- OBRIGATÓRIO: apresentar em bancada, flatlay ou ambiente lifestyle
- Produtos APOIADOS em superfície, organizados elegantemente`
            : `CENÁRIO DE PRODUTO ÚNICO:
- Pode mostrar modelo segurando de forma natural
- Máximo 1 produto por mão, pose elegante`;

          finalPrompt = `REGRA ABSOLUTA — PRODUTO IMUTÁVEL:
A imagem anexada é a foto REAL do produto "${productWithImage.name}".
O produto NÃO PODE ser alterado de NENHUMA forma. Ele é SAGRADO e IMUTÁVEL.
- NÃO redesenhe, recrie ou reimagine o produto
- NÃO mude a embalagem, rótulo, formato, cores ou proporções
- NÃO crie variações do produto (ex: frascos diferentes, tamanhos diferentes)
- NÃO invente produtos que não existem na imagem de referência
- NÃO multiplique o produto além do que o briefing pede
- O produto na imagem gerada DEVE ser PIXEL-PERFECT idêntico ao da referência

VOCÊ PODE APENAS:
- Mudar o AMBIENTE/CENÁRIO ao redor do produto (fundo, superfície, iluminação)
- Adicionar CONTEXTO (mãos segurando, bancada, flatlay)
- Aplicar efeitos leves de iluminação/sombra NO AMBIENTE (nunca no produto)
- Posicionar o produto em diferentes ângulos (mantendo fidelidade total)

${kitInstruction}

ESTILO: Fotografia profissional editorial/UGC, iluminação premium.
FORMATO: ${contentType === "story" || contentType === "reel" ? "Vertical 9:16" : "Quadrado 1:1"}

PROIBIÇÕES ABSOLUTAS:
- NÃO inventar rótulos/logos
- NÃO alterar cores/design do produto
- NÃO duplicar produto sem instrução explícita
- NÃO adicionar texto sobreposto
- NÃO criar embalagens fictícias ou variações do produto

BRIEFING DO CRIATIVO: ${generation.prompt_final}`;
        }

        // Generate with both providers in parallel
        const providerPromises = enabledProviders.map(async (provider): Promise<ProviderResult> => {
          const generateFn = provider === 'gemini' ? generateWithGemini : generateWithOpenAI;
          const result = provider === 'gemini' 
            ? await generateFn(lovableApiKey, finalPrompt, referenceBase64)
            : await generateWithOpenAI(lovableApiKey, openaiApiKey, finalPrompt, referenceBase64);

          if (!result.imageBase64) {
            return {
              provider,
              imageBase64: null,
              scores: { realism: 0, quality: 0, composition: 0, label: 0, overall: 0 },
              error: result.error,
              usedReference: !!referenceBase64,
            };
          }

          // QA Scoring
          if (enableQA) {
            const scores = await scoreImageForRealism(
              lovableApiKey,
              result.imageBase64,
              referenceBase64,
              productWithImage?.name || "Produto",
            );
            return {
              provider,
              imageBase64: result.imageBase64,
              scores,
              usedReference: !!referenceBase64,
            };
          }

          return {
            provider,
            imageBase64: result.imageBase64,
            scores: { realism: 7, quality: 7, composition: 7, label: 7, overall: 0.7 },
            usedReference: !!referenceBase64,
          };
        });

        const providerResults = await Promise.all(providerPromises);
        const successfulResults = providerResults.filter((r) => r.imageBase64);

        if (successfulResults.length === 0) {
          const errors = providerResults.map((r) => r.error).filter(Boolean).join("; ");
          throw new Error(`Nenhum provedor gerou imagem: ${errors}`);
        }

        // Sort by overall score (best first)
        successfulResults.sort((a, b) => b.scores.overall - a.scores.overall);

        const winner = successfulResults[0];
        console.log(`🏆 Winner: ${winner.provider} (score: ${winner.scores.overall.toFixed(2)})`);

        // Upload winner to storage
        const binaryData = Uint8Array.from(atob(winner.imageBase64!), (c) => c.charCodeAt(0));
        const storagePath = `${generation.tenant_id}/${genId}/${winner.provider}_winner.png`;

        const { error: uploadError } = await supabase.storage
          .from("media-assets")
          .upload(storagePath, binaryData, { contentType: "image/png", upsert: true });

        if (uploadError) {
          console.error("❌ Upload error:", uploadError);
          throw new Error("Falha ao salvar imagem no storage");
        }

        // Create variant record
        await supabase.from("media_asset_variants").insert({
          generation_id: genId,
          variant_index: 1,
          storage_path: storagePath,
          mime_type: "image/png",
          file_size: binaryData.length,
          width: 1024,
          height: 1024,
        });

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("media-assets")
          .getPublicUrl(storagePath);
        const publicUrl = publicUrlData?.publicUrl;

        // Update calendar item with asset URL & register to Drive month folder
        if (publicUrl && generation.calendar_item_id) {
          await supabase
            .from("media_calendar_items")
            .update({ asset_url: publicUrl, asset_thumbnail_url: publicUrl })
            .eq("id", generation.calendar_item_id);
          console.log(`✅ Calendar item ${generation.calendar_item_id} updated with winner`);

          // Register in Drive month folder
          try {
            // Get campaign start_date via calendar_item → campaign
            const { data: calItem } = await supabase
              .from("media_calendar_items")
              .select("campaign_id")
              .eq("id", generation.calendar_item_id)
              .single();

            if (calItem?.campaign_id) {
              const { data: campaignData } = await supabase
                .from("media_campaigns")
                .select("start_date, created_by")
                .eq("id", calItem.campaign_id)
                .single();

              if (campaignData?.start_date) {
                const monthFolderId = await ensureMediaMonthFolderEdge(
                  supabase, generation.tenant_id, campaignData.created_by || generation.tenant_id, campaignData.start_date
                );

                if (monthFolderId) {
                  const filename = `${winner.provider}_winner_${genId.slice(0, 8)}.png`;
                  await supabase.from("files").insert({
                    tenant_id: generation.tenant_id,
                    folder_id: monthFolderId,
                    filename,
                    original_name: filename,
                    storage_path: storagePath,
                    mime_type: "image/png",
                    size_bytes: binaryData.length,
                    is_folder: false,
                    is_system_folder: false,
                    created_by: campaignData.created_by,
                    metadata: { source: "media_ai_creative", url: publicUrl, bucket: "media-assets", system_managed: true },
                  });
                  console.log(`📁 File registered in Drive month folder`);
                }
              }
            }
          } catch (driveErr) {
            console.error("⚠️ Drive registration failed (non-blocking):", driveErr);
          }
        }

        // Also upload runner-up if exists (for comparison)
        if (successfulResults.length > 1) {
          const runnerUp = successfulResults[1];
          const runnerUpPath = `${generation.tenant_id}/${genId}/${runnerUp.provider}_alt.png`;
          const runnerUpBinary = Uint8Array.from(atob(runnerUp.imageBase64!), (c) => c.charCodeAt(0));
          
          await supabase.storage
            .from("media-assets")
            .upload(runnerUpPath, runnerUpBinary, { contentType: "image/png", upsert: true });

          await supabase.from("media_asset_variants").insert({
            generation_id: genId,
            variant_index: 2,
            storage_path: runnerUpPath,
            mime_type: "image/png",
            file_size: runnerUpBinary.length,
            width: 1024,
            height: 1024,
          });
          console.log(`📸 Runner-up saved: ${runnerUp.provider} (score: ${runnerUp.scores.overall.toFixed(2)})`);
        }

        const elapsedMs = Date.now() - genStartTime;

        // Mark as succeeded with full metadata
        await supabase
          .from("media_asset_generations")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
            provider: winner.provider === 'openai' ? 'lovable-ai-pro' : 'lovable-ai',
            model: winner.provider === 'openai' ? 'google/gemini-3-pro-image-preview' : 'google/gemini-2.5-flash-image',
            settings: {
              ...settings,
              actual_variant_count: successfulResults.length,
              processing_time_ms: elapsedMs,
              used_product_reference: winner.usedReference,
              product_asset_url: productWithImage?.image_url || null,
              pipeline_version: VERSION,
              winner: {
                provider: winner.provider,
                scores: winner.scores,
              },
              all_results: successfulResults.map((r) => ({
                provider: r.provider,
                scores: r.scores,
              })),
            },
          })
          .eq("id", genId);

        processed++;
        results.push({
          id: genId,
          status: "succeeded",
          winner: winner.provider,
          winnerScore: winner.scores.overall,
          totalVariants: successfulResults.length,
          timeMs: elapsedMs,
        });
        console.log(`✅ Generation ${genId} done (${elapsedMs}ms, winner: ${winner.provider})`);

      } catch (genError) {
        console.error(`❌ Error processing ${genId}:`, genError);

        const errorMessage = genError instanceof Error ? genError.message : "Erro desconhecido";

        await supabase
          .from("media_asset_generations")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", genId);

        failed++;
        results.push({ id: genId, status: "failed", error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        results,
        version: VERSION,
        message: `${processed} gerações processadas, ${failed} falhas`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[media-process-generation-queue v${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
