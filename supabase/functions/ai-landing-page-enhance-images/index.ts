// =============================================
// AI LANDING PAGE ENHANCE IMAGES — V2.1.0
// Step 2: Generates full-section visual compositions using product PNG as reference
// The AI generates COMPLETE scene compositions (1920x800) with the product naturally integrated
// Product PNG with transparent background → AI creates the entire environment around it
// v2.1.0: Timeout-aware chunking — processes sections in batches, returns remaining for recursive calls
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const VERSION = "2.1.0";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Timeout budget: Edge Functions have 150s limit, reserve margin for persistence + overhead
const MAX_EXECUTION_MS = 130_000; // 130s usable budget
const ESTIMATED_IMAGE_GEN_MS = 30_000; // ~30s per image generation (model + upload)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ========== IMAGE HELPERS ==========

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("[AI-LP-Enhance] Failed to download image:", e);
    return null;
  }
}

async function callImageModel(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceBase64: string,
  additionalReferences?: string[],
): Promise<string | null> {
  const content: any[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,' + referenceBase64 } },
  ];
  if (additionalReferences && additionalReferences.length > 0) {
    for (const refB64 of additionalReferences.slice(0, 2)) {
      content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + refB64 } });
    }
  }
  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + lovableApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`[AI-LP-Enhance] ${model} error: ${response.status}`, errText.substring(0, 300));
    return null;
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function ensureDriveFolder(supabase: any, tenantId: string, userId: string): Promise<string | null> {
  try {
    const folderName = "Criativos de página";
    const { data: existing } = await supabase.from("files").select("id").eq("tenant_id", tenantId).eq("is_folder", true).eq("filename", folderName).limit(1).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabase.from("files").insert({
      tenant_id: tenantId, filename: folderName, original_name: folderName,
      storage_path: `drive/${tenantId}/criativos-de-pagina`,
      is_folder: true, is_system_folder: true, created_by: userId,
      metadata: { source: "ai_landing_page_enhance", system_managed: true },
    }).select("id").single();
    if (error) { console.error("[AI-LP-Enhance] Error creating folder:", error); return null; }
    return created?.id || null;
  } catch (e) { console.error("[AI-LP-Enhance] Folder ensure error:", e); return null; }
}

async function uploadCreativeToStorage(
  supabase: any, tenantId: string, dataUrl: string, label: string, suffix: string,
  userId?: string, driveFolderId?: string | null,
): Promise<string | null> {
  try {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }
    const timestamp = Date.now();
    const safeName = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    const filename = `section-${suffix}-${safeName}-${timestamp}.png`;
    const filePath = `${tenantId}/lp-creatives/${filename}`;
    const { error: uploadError } = await supabase.storage.from('store-assets').upload(filePath, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) { console.error("[AI-LP-Enhance] Upload error:", uploadError); return null; }
    const { data: publicUrlData } = supabase.storage.from('store-assets').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (publicUrl && driveFolderId && userId) {
      await supabase.from("files").insert({
        tenant_id: tenantId, folder_id: driveFolderId, filename, original_name: filename,
        storage_path: filePath, mime_type: 'image/png', size_bytes: bytes.length,
        is_folder: false, is_system_folder: false, created_by: userId,
        metadata: { source: "ai_landing_page_enhance", url: publicUrl, bucket: "store-assets", system_managed: true },
      });
    }
    return publicUrl || null;
  } catch (error) { console.error("[AI-LP-Enhance] Upload creative error:", error); return null; }
}

// ========== SECTION COMPOSITION PROMPTS ==========

interface SectionSpec {
  blockType: string;
  blockId: string;
  promptSuffix: string;
  aspectRatio: string;
  imageField: string;
}

function detectEnhanceableSections(blocks: any): SectionSpec[] {
  const specs: SectionSpec[] = [];

  function walk(node: any) {
    if (!node) return;
    if (node.type === 'Banner' && node.props?.slides?.length > 0) {
      specs.push({
        blockType: 'Banner',
        blockId: node.id,
        promptSuffix: 'HERO',
        aspectRatio: '21:9 (2100x900 pixels, ultra-wide landscape)',
        imageField: 'slides[0].imageDesktop',
      });
    }
    if (node.type === 'Hero' && node.props) {
      specs.push({
        blockType: 'Hero',
        blockId: node.id,
        promptSuffix: 'HERO-CONTENT',
        aspectRatio: '16:9 (1920x1080 pixels, landscape)',
        imageField: 'backgroundImage',
      });
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }

  walk(blocks);
  return specs;
}

function applyImageToBlock(blocks: any, blockId: string, imageField: string, imageUrl: string): boolean {
  let updated = false;
  function walk(node: any) {
    if (!node) return;
    if (node.id === blockId && node.props) {
      if (imageField === 'slides[0].imageDesktop') {
        if (node.props.slides && Array.isArray(node.props.slides) && node.props.slides.length > 0) {
          node.props.slides[0].imageDesktop = imageUrl;
          node.props.slides[0].imageMobile = node.props.slides[0].imageMobile || imageUrl;
          updated = true;
        }
      } else if (imageField === 'backgroundImage') {
        node.props.backgroundImage = imageUrl;
        node.props.imageDesktop = imageUrl;
        updated = true;
      } else {
        node.props[imageField] = imageUrl;
        updated = true;
      }
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
  walk(blocks);
  return updated;
}

// ========== SCENE COMPOSITION PROMPT BUILDER ==========

function buildCompositionPrompt(
  product: { name: string; tags?: string[] },
  storeName: string,
  spec: SectionSpec,
  hasDriveRefs: boolean,
): string {
  const nameAndTags = `${product.name} ${(product.tags || []).join(' ')}`.toLowerCase();
  
  let sceneDescription: string;
  if (/cabelo|shampoo|condicion|capilar|calvíc|queda|fio/.test(nameAndTags)) {
    sceneDescription = `Banheiro moderno premium com bancada de mármore escuro. Iluminação dourada suave vindo de uma janela lateral. Gotas d'água e névoa sutil ao redor do produto. Plantas tropicais desfocadas ao fundo. Toalha branca dobrada ao lado.`;
  } else if (/skin|pele|facial|anti.?idade|colág|sérum|creme|hidrat/.test(nameAndTags)) {
    sceneDescription = `Vanity table elegante com espelho redondo dourado ao fundo. Flores frescas em vaso de vidro. Superfície de mármore branco com veios dourados. Iluminação natural suave de manhã. Gotas de produto ou ingredientes orgânicos decorativos.`;
  } else if (/suplement|whey|proteín|creatina|bcaa|fitness|treino|músculo/.test(nameAndTags)) {
    sceneDescription = `Superfície de concreto polido escuro texturizado. Iluminação dramática lateral com highlights azulados. Halteres ou equipamento fitness premium desfocado ao fundo. Atmosfera de academia high-end.`;
  } else if (/aliment|comida|orgânic|natural|chá|café|erva/.test(nameAndTags)) {
    sceneDescription = `Mesa de madeira rústica nobre com grãos e ingredientes naturais espalhados artisticamente. Iluminação natural quente de janela. Folhas verdes frescas. Texturas de linho e cerâmica artesanal.`;
  } else if (/tech|eletrôn|gadget|smart|digital/.test(nameAndTags)) {
    sceneDescription = `Mesa de escritório moderna minimalista com acabamento fosco escuro. LED ambiental azul/roxo sutil. Superfície limpa com reflexo suave. Atmosfera futurista e clean.`;
  } else {
    sceneDescription = `Superfície elegante escura com gradiente de luz lateral suave. Reflexo sutil na superfície. Background com bokeh premium desfocado. Iluminação de estúdio profissional com key light e fill light.`;
  }

  return `COMPOSIÇÃO VISUAL COMPLETA PARA SEÇÃO DE LANDING PAGE — ${spec.promptSuffix}

TAREFA PRINCIPAL: Criar uma imagem de seção COMPLETA e UNIFORME para uma landing page de vendas premium. Esta imagem será usada como background/visual de uma seção inteira — NÃO é uma foto de produto isolada.

PRODUTO DE REFERÊNCIA: "${product.name}" pela marca "${storeName}"
A imagem do produto anexada (com fundo transparente) DEVE ser integrada NATURALMENTE na composição.

REGRAS ABSOLUTAS DE FIDELIDADE DO PRODUTO:
1. O produto DEVE aparecer EXATAMENTE como na referência — mesmo rótulo, cores, formato, tipografia da embalagem
2. NÃO altere, invente ou modifique texto, marca ou design da embalagem
3. O produto deve parecer FOTOGRAFADO no cenário, não colado digitalmente

CENÁRIO E AMBIENTAÇÃO:
${sceneDescription}

COMPOSIÇÃO DA CENA (aspect ratio ${spec.aspectRatio}):
- O produto é o HERÓI VISUAL — posicionado com destaque (centro, regra dos terços, ou golden ratio)
- O cenário ENVOLVE o produto — não é um fundo chapado, é um AMBIENTE tridimensional
- Profundidade de campo: produto nítido, fundo com leve desfoque (bokeh)
- Sombra de contato REALISTA sob o produto
- Reflexos e highlights consistentes com a iluminação do cenário
- A composição deve ter "respiro" — espaços para overlay de texto (lado esquerdo ou direita livre)

QUALIDADE TÉCNICA:
- Fotorrealismo de catálogo premium (nível Sephora, Apple, Nike)
- Resolução e nitidez máximas
- Color grading coeso em toda a imagem
- Sem artefatos, sem bordas visíveis, sem aspecto de montagem
- A imagem final deve parecer UMA ÚNICA FOTOGRAFIA profissional

O QUE NÃO FAZER:
- NÃO gerar texto, lettering ou tipografia na imagem
- NÃO incluir logos, selos ou badges
- NÃO fazer molduras, bordas ou frames
- NÃO criar collages ou montagens — é UMA composição unificada
- NÃO usar fundo branco ou chapado${hasDriveRefs ? '\n\nREFERÊNCIAS VISUAIS: As imagens extras são referências de estilo do lojista. Use como inspiração para composição e atmosfera, mas GERE uma imagem NOVA e ORIGINAL.' : ''}`;
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[AI-LP-Enhance v${VERSION}] Starting full-section composition generation...`);

  try {
    const body = await req.json();
    const { landingPageId, tenantId, userId, startFromIndex = 0, stage = 1 } = body;

    if (!landingPageId || !tenantId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch landing page + blocks
    const { data: lp, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("id, product_ids, generated_blocks, current_version, metadata")
      .eq("id", landingPageId)
      .single();

    if (lpError || !lp) {
      console.error("[AI-LP-Enhance] LP not found:", lpError);
      return new Response(
        JSON.stringify({ success: false, error: "Landing page not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lp.generated_blocks) {
      return new Response(
        JSON.stringify({ success: false, error: "No blocks to enhance — generate page first" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productIds = lp.product_ids || [];
    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No products linked to landing page" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch product + primary image
    const { data: products } = await supabase
      .from("products")
      .select("id, name, tags")
      .in("id", productIds)
      .limit(1);

    if (!products?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "Products not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const product = products[0];
    const { data: images } = await supabase
      .from("product_images")
      .select("url, is_primary")
      .eq("product_id", product.id)
      .order("is_primary", { ascending: false })
      .limit(1);

    const primaryImageUrl = images?.[0]?.url;
    if (!primaryImageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Product has no image" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Store name
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("tenant_id", tenantId)
      .single();
    const storeName = storeSettings?.store_name || "Loja";

    // 4. Drive references (non-blocking)
    let driveReferenceBase64s: string[] = [];
    try {
      const searchTerm = product.name.split(' ').slice(0, 3).join(' ');
      const { data: driveFiles } = await supabase
        .from("files")
        .select("storage_path, metadata")
        .eq("tenant_id", tenantId)
        .eq("is_folder", false)
        .ilike("mime_type", "image/%")
        .ilike("original_name", `%${searchTerm}%`)
        .limit(3);

      if (driveFiles?.length) {
        for (const file of driveFiles.slice(0, 2)) {
          const meta = file.metadata as Record<string, any> | null;
          const bucket = (meta?.bucket as string) || 'tenant-files';
          let url: string | undefined;
          if (bucket === 'tenant-files') {
            const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
            url = signedData?.signedUrl;
          } else {
            const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
            url = pubData?.publicUrl;
          }
          if (url) {
            const b64 = await imageUrlToBase64(url);
            if (b64) driveReferenceBase64s.push(b64);
          }
        }
        console.log(`[AI-LP-Enhance] Loaded ${driveReferenceBase64s.length} Drive references`);
      }
    } catch (e) {
      console.warn("[AI-LP-Enhance] Drive ref fetch error (non-blocking):", e);
    }

    // 5. Ensure drive folder + download product image
    const [driveFolderId, referenceBase64] = await Promise.all([
      ensureDriveFolder(supabase, tenantId, userId),
      imageUrlToBase64(primaryImageUrl),
    ]);

    if (!referenceBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not download product image" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Detect enhanceable sections from the block tree
    const blocks = JSON.parse(JSON.stringify(lp.generated_blocks));
    const allSpecs = detectEnhanceableSections(blocks);

    if (allSpecs.length === 0) {
      console.warn("[AI-LP-Enhance] No enhanceable sections found in blocks");
      return new Response(
        JSON.stringify({ success: true, enhanced: 0, message: "No enhanceable sections found", done: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== TIMEOUT-AWARE CHUNKING =====
    // Only process sections from startFromIndex onwards
    const pendingSpecs = allSpecs.slice(startFromIndex);
    
    if (pendingSpecs.length === 0) {
      console.log("[AI-LP-Enhance] All sections already processed");
      return new Response(
        JSON.stringify({ success: true, enhanced: 0, done: true, message: "All sections already enhanced" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate how many sections we can fit in the remaining time budget
    const elapsedMs = Date.now() - startTime;
    const remainingBudgetMs = MAX_EXECUTION_MS - elapsedMs;
    const maxSectionsInBudget = Math.max(1, Math.floor(remainingBudgetMs / ESTIMATED_IMAGE_GEN_MS));
    const sectionsToProcess = pendingSpecs.slice(0, maxSectionsInBudget);
    const hasMoreAfterBatch = (startFromIndex + sectionsToProcess.length) < allSpecs.length;
    
    console.log(`[AI-LP-Enhance] Stage ${stage}: Processing ${sectionsToProcess.length}/${allSpecs.length} sections (startFrom=${startFromIndex}, budget=${Math.round(remainingBudgetMs/1000)}s, max=${maxSectionsInBudget})`);

    // 7. Generate composition for each section in this batch (sequentially to avoid rate limits)
    const results: { section: string; url: string | null; applied: boolean }[] = [];

    for (const spec of sectionsToProcess) {
      // Check remaining time before each generation
      const elapsedSoFar = Date.now() - startTime;
      if (elapsedSoFar > MAX_EXECUTION_MS - 10_000) {
        // Less than 10s left — stop processing, save what we have
        console.warn(`[AI-LP-Enhance] Timeout approaching (${Math.round(elapsedSoFar/1000)}s elapsed), stopping batch early`);
        break;
      }

      console.log(`[AI-LP-Enhance] Generating ${spec.promptSuffix} composition...`);
      
      const prompt = buildCompositionPrompt(product, storeName, spec, driveReferenceBase64s.length > 0);
      
      // Try pro model first, then flash
      let imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-3-pro-image-preview', prompt, referenceBase64, driveReferenceBase64s);
      if (!imageDataUrl) {
        console.log(`[AI-LP-Enhance] Pro failed for ${spec.promptSuffix}, trying flash...`);
        imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-2.5-flash-image', prompt, referenceBase64, driveReferenceBase64s);
      }

      if (!imageDataUrl) {
        console.error(`[AI-LP-Enhance] Both models failed for ${spec.promptSuffix}`);
        results.push({ section: spec.promptSuffix, url: null, applied: false });
        continue;
      }

      // Upload
      const publicUrl = await uploadCreativeToStorage(
        supabase, tenantId, imageDataUrl, product.name, spec.promptSuffix.toLowerCase(),
        userId, driveFolderId,
      );

      if (!publicUrl) {
        results.push({ section: spec.promptSuffix, url: null, applied: false });
        continue;
      }

      // Apply to block tree
      const applied = applyImageToBlock(blocks, spec.blockId, spec.imageField, publicUrl);
      results.push({ section: spec.promptSuffix, url: publicUrl, applied });
      console.log(`[AI-LP-Enhance] ${spec.promptSuffix}: uploaded & ${applied ? 'applied' : 'NOT applied'}`);
    }

    // 8. Persist updated blocks (save progress even if partial)
    const existingMeta = (lp.metadata && typeof lp.metadata === 'object') ? lp.metadata as Record<string, any> : {};
    const enhancedSections = results.filter(r => r.applied).map(r => ({
      section: r.section,
      url: r.url,
    }));

    // Merge with existing enhancement metadata (from previous stages)
    const previousEnhancement = existingMeta?.imageEnhancement as Record<string, any> | undefined;
    const allEnhancedSections = [
      ...(previousEnhancement?.sections || []),
      ...enhancedSections,
    ];

    const nextIndex = startFromIndex + results.length;
    const isDone = nextIndex >= allSpecs.length;

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_blocks: blocks,
        metadata: {
          ...existingMeta,
          imageEnhancement: {
            version: VERSION,
            enhancedAt: new Date().toISOString(),
            sections: allEnhancedSections,
            totalEnhanced: allEnhancedSections.length,
            totalSections: allSpecs.length,
            stage,
            done: isDone,
          },
        },
      })
      .eq("id", landingPageId);

    if (updateError) {
      console.error("[AI-LP-Enhance] Persist error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save enhanced blocks" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const successCount = results.filter(r => r.applied).length;
    const totalElapsed = Date.now() - startTime;
    console.log(`[AI-LP-Enhance v${VERSION}] Stage ${stage} done! ${successCount}/${sectionsToProcess.length} sections enhanced in ${Math.round(totalElapsed/1000)}s. Done: ${isDone}`);

    return new Response(
      JSON.stringify({
        success: true,
        enhanced: successCount,
        total: allSpecs.length,
        results,
        done: isDone,
        nextIndex: isDone ? null : nextIndex,
        nextStage: isDone ? null : stage + 1,
        stage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LP-Enhance] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
