// =============================================
// AI LANDING PAGE ENHANCE IMAGES — V4.1.0
// Step 2: Generates BACKGROUND-ONLY scenes (no product in image)
// Product is ALWAYS composited via CSS overlay in the frontend
// This eliminates AI distortion of labels/colors/shapes
// v4.1.0: Background-only generation + CSS composition
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { generateWithNativeGemini } from "../_shared/native-gemini.ts";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { generateImageWithFalPro, generateImageWithFalTurbo, getFalApiKey, downloadImageAsBase64 as falDownload } from "../_shared/fal-client.ts";

const VERSION = "4.0.0"; // fal.ai FLUX priority: 1. FLUX 2 Pro → 2. FLUX 2 Turbo → 3. Gemini Nativa → 4. Lovable Gateway
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
  productBase64: string | null,
  styleReferences?: string[],
  geminiApiKey?: string | null,
  falApiKeyVal?: string | null,
): Promise<string | null> {
  // Step 1: Try fal.ai FLUX 2 Pro (PRIORIDADE MÁXIMA)
  if (falApiKeyVal) {
    console.log(`[AI-LP-Enhance] Trying fal.ai FLUX 2 Pro first...`);
    const proResult = await generateImageWithFalPro(falApiKeyVal, { prompt, imageSize: { width: 1920, height: 1080 } });
    if (proResult?.imageUrl) {
      const b64 = await falDownload(proResult.imageUrl);
      if (b64) {
        console.log(`[AI-LP-Enhance] ✅ fal.ai FLUX 2 Pro succeeded`);
        return `data:image/png;base64,${b64}`;
      }
    }
    // Try FLUX 2 Turbo
    console.log(`[AI-LP-Enhance] Trying fal.ai FLUX 2 Turbo...`);
    const turboResult = await generateImageWithFalTurbo(falApiKeyVal, { prompt, imageSize: { width: 1920, height: 1080 } });
    if (turboResult?.imageUrl) {
      const b64 = await falDownload(turboResult.imageUrl);
      if (b64) {
        console.log(`[AI-LP-Enhance] ✅ fal.ai FLUX 2 Turbo succeeded`);
        return `data:image/png;base64,${b64}`;
      }
    }
    console.warn(`[AI-LP-Enhance] fal.ai failed. Falling back to Gemini/Gateway...`);
  }

  // Step 2: Try native Gemini
  if (geminiApiKey) {
    console.log(`[AI-LP-Enhance] Trying Gemini Nativa...`);
    const nativeResult = await generateWithNativeGemini(geminiApiKey, prompt, productBase64);
    if (nativeResult.imageBase64) {
      console.log(`[AI-LP-Enhance] ✅ Gemini Nativa succeeded`);
      return `data:image/png;base64,${nativeResult.imageBase64}`;
    }
    console.warn(`[AI-LP-Enhance] Gemini Nativa failed: ${nativeResult.error}. Falling back to Lovable Gateway...`);
  }

  // Step 3: Lovable Gateway (fallback)
  const content: any[] = [
    { type: 'text', text: prompt },
  ];
  if (productBase64) {
    content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + productBase64 } });
  }
  if (styleReferences && styleReferences.length > 0) {
    for (const refB64 of styleReferences.slice(0, 2)) {
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
    const { ensureFolderPathEdge } = await import("../_shared/drive-register.ts");
    return await ensureFolderPathEdge(supabase, tenantId, userId, "Criativos IA/Landing Pages");
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
        metadata: { source: "ai_creative_landing", url: publicUrl, bucket: "store-assets", system_managed: true },
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
  isSchema?: boolean; // V7 schema mode
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

// V7: Detect enhanceable sections from schema — generates DESKTOP + MOBILE for hero and CTA
function detectEnhanceableSchemaSections(schema: any): SectionSpec[] {
  const specs: SectionSpec[] = [];
  if (!schema?.sections) return specs;
  
  for (const section of schema.sections) {
    if (section.type === 'hero') {
      // Hero DESKTOP: wide landscape, product RIGHT, text area LEFT
      specs.push({
        blockType: 'hero',
        blockId: section.id,
        promptSuffix: 'HERO-DESKTOP',
        aspectRatio: '16:9 (1920x1080 pixels, wide landscape)',
        imageField: 'heroSceneDesktopUrl',
        isSchema: true,
      });
      // Hero MOBILE: tall portrait, product CENTER/BOTTOM, text area TOP
      specs.push({
        blockType: 'hero',
        blockId: section.id,
        promptSuffix: 'HERO-MOBILE',
        aspectRatio: '9:16 (1080x1920 pixels, tall portrait)',
        imageField: 'heroSceneMobileUrl',
        isSchema: true,
      });
    }
    if (section.type === 'cta_final') {
      // CTA DESKTOP: wide landscape
      specs.push({
        blockType: 'cta_final',
        blockId: section.id,
        promptSuffix: 'CTA-DESKTOP',
        aspectRatio: '16:9 (1920x1080 pixels, wide landscape)',
        imageField: 'ctaSceneDesktopUrl',
        isSchema: true,
      });
      // CTA MOBILE: tall portrait
      specs.push({
        blockType: 'cta_final',
        blockId: section.id,
        promptSuffix: 'CTA-MOBILE',
        aspectRatio: '9:16 (1080x1920 pixels, tall portrait)',
        imageField: 'ctaSceneMobileUrl',
        isSchema: true,
      });
    }
  }
  
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

// V7: Apply image to schema section
function applyImageToSchema(schema: any, sectionId: string, imageField: string, imageUrl: string): boolean {
  if (!schema?.sections) return false;
  for (const section of schema.sections) {
    if (section.id === sectionId && section.props) {
      section.props[imageField] = imageUrl;
      return true;
    }
  }
  return false;
}

// ========== SCENE COMPOSITION PROMPT BUILDER ==========

// V8.0: Mood-specific scene vibe pools for diversity
const MOOD_SCENE_POOLS: Record<string, string[]> = {
  luxury: [
    'bancada de mármore Carrara branco polido, iluminação dourada suave de estúdio, reflexos elegantes, vasos de cristal desfocados',
    'superfície de veludo escuro premium, bokeh dourado ao fundo, iluminação lateral cinematográfica, elementos de joalheria desfocados',
    'estúdio fotográfico com fundo de vidro fumê, luzes spot direcionais, superfície espelhada preta, atmosfera sofisticada',
    'penteadeira clássica com espelho dourado desfocado, flores frescas brancas, mármore rosé, luz natural suave de janela',
  ],
  bold: [
    'superfície de concreto polido escuro, iluminação dramática lateral azulada, halteres desfocados ao fundo, atmosfera de ginásio premium',
    'estúdio neon com fundo escuro intenso, LED vermelho e azul como accent, superfície metálica fosca, energia dinâmica',
    'bancada industrial preta, spotlights dramáticos de cima, partículas de pó iluminadas, contraste extremo',
    'superfície de aço escovado, backlight neon sutil, fumaça suave, atmosfera de alta performance',
  ],
  organic: [
    'mesa de madeira rústica nobre, ingredientes naturais espalhados (folhas, sementes), iluminação quente de janela, folhas verdes',
    'jardim ensolarado com mesa de pedra natural, ervas frescas ao redor, luz golden hour, fundo de vegetação desfocada',
    'superfície de bambu com textura natural, gotas de orvalho, plantas tropicais ao fundo desfocado, luz suave matinal',
    'bancada de cozinha rústica com linho natural, flores secas, iluminação quente lateral, atmosfera acolhedora',
  ],
  corporate: [
    'mesa de escritório moderna minimalista, acabamento fosco escuro, LED ambiental azul/roxo sutil, setup clean',
    'superfície branca polida com reflexo sutil, gradiente de luz lateral, formas geométricas abstratas desfocadas',
    'desk setup premium com monitor ultra-wide desfocado ao fundo, iluminação bias azulada, superfície cinza grafite',
    'mesa de reunião minimalista, fundo de vidro translúcido, iluminação difusa de escritório premium',
  ],
  minimal: [
    'superfície elegante escura, gradiente de luz lateral suave, bokeh premium desfocado, iluminação de estúdio profissional',
    'fundo infinito branco suave com sombra sutil, iluminação soft de estúdio, pureza visual, sem distração',
    'superfície de concreto claro liso, luz natural indireta, sombras suaves geometricamente perfeitas, minimalismo absoluto',
    'gradiente suave de cinza a branco, luz difusa de todas as direções, floating feeling, espaço limpo',
  ],
};

// Seeded pick helper for scene vibes
function seededScenePick(arr: string[], seed: number): string {
  let s = seed;
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return arr[s % arr.length];
}

function buildCompositionPrompt(
  product: { name: string; tags?: string[] },
  storeName: string,
  spec: SectionSpec,
  hasDriveRefs: boolean,
  brandColors?: { primary?: string; accent?: string },
  mood?: string,
  variantSeed?: number,
): string {
  const nameAndTags = `${product.name} ${(product.tags || []).join(' ')}`.toLowerCase();
  
  // V8.0: Use mood-based scene pool when available, with seed for reproducibility
  let sceneVibe: string;
  const moodKey = mood || 'minimal';
  const pool = MOOD_SCENE_POOLS[moodKey] || MOOD_SCENE_POOLS['minimal'];
  const sceneSeed = (variantSeed || Date.now()) + (spec.promptSuffix.includes('CTA') ? 9999 : 0);
  
  // Start from mood pool, but enhance with niche-specific details
  sceneVibe = seededScenePick(pool, sceneSeed);
  
  // Add niche-specific refinements on top of mood base
  if (/cabelo|shampoo|condicion|capilar|calvíc|queda|fio/.test(nameAndTags)) {
    sceneVibe += ', gotas d\'água sutis, toalha branca dobrada';
  } else if (/skin|pele|facial|anti.?idade|colág|sérum|creme|hidrat/.test(nameAndTags)) {
    sceneVibe += ', flores frescas, textura de seda';
  } else if (/suplement|whey|proteín|creatina|bcaa|fitness|treino|músculo/.test(nameAndTags)) {
    sceneVibe += ', shaker desfocado ao fundo, energia intensa';
  } else if (/aliment|comida|orgânic|natural|chá|café|erva/.test(nameAndTags)) {
    sceneVibe += ', ingredientes frescos ao redor, vapor sutil';
  }

  const brandNote = brandColors?.primary 
    ? `Cores de destaque da marca: ${brandColors.primary}${brandColors.accent ? ` e ${brandColors.accent}` : ''}. Use essas cores nas luzes ambiente, reflexos sutis e gradientes.`
    : '';

  const isMobile = spec.promptSuffix.includes('MOBILE');
  const isHero = spec.promptSuffix.includes('HERO');
  const sectionLabel = isHero ? 'HERO' : 'CTA';
  const orientation = isMobile ? 'VERTICAL RETRATO 9:16 (1080x1920px)' : 'HORIZONTAL PAISAGEM 16:9 (1920x1080px)';

  // V4.1: Background-only composition — product will be overlaid via CSS
  const layoutInstruction = isMobile
    ? `- TODA a imagem é cenário/ambiente — SEM produto
- Terço superior levemente mais escuro (gradiente) para acomodar texto branco sobreposto
- Centro e terço inferior com elementos de cenário interessantes mas não muito carregados
- A imagem servirá de FUNDO; o produto real será sobreposto via CSS no terço inferior`
    : `- TODA a imagem é cenário/ambiente — SEM produto
- Lado ESQUERDO (60%) deve ser mais escuro ou com gradiente para acomodar texto branco sobreposto
- Lado DIREITO (40%) pode ter elementos de cenário mas com área "respirável" onde o produto será sobreposto via CSS
- A imagem servirá de FUNDO; o produto real será sobreposto via CSS no lado direito`;

  return `BACKGROUND PREMIUM PARA LANDING PAGE — ${sectionLabel} ${isMobile ? 'MOBILE' : 'DESKTOP'} (${orientation})

TAREFA: Criar um CENÁRIO/FUNDO fotorrealista premium para landing page de e-commerce.
O produto "${product.name}" da marca "${storeName}" será sobreposto por cima via CSS — portanto NÃO inclua nenhum produto na imagem.
${hasDriveRefs ? 'A primeira imagem anexada é o produto (apenas para referência de cores/atmosfera). As demais são referências de estilo da marca.' : 'A imagem anexada é o produto (apenas para referência de cores/atmosfera — NÃO reproduza o produto).'}

COMPOSIÇÃO DO FUNDO (${orientation}):
${layoutInstruction}

CENÁRIO/AMBIENTE:
${sceneVibe}

REGRAS CRÍTICAS:
1. NÃO inclua nenhum produto, frasco, embalagem, ou objeto de produto na imagem
2. Gere APENAS o cenário/fundo/ambiente — superfícies, luzes, bokeh, texturas
3. Profundidade de campo com bokeh suave e cinematográfico
4. Iluminação premium de estúdio que criará atmosfera quando o produto for sobreposto
5. Qualidade de foto publicitária profissional (4K, sem ruído, sem artefatos)
6. O fundo deve ter boa harmonia cromática com as cores do produto de referência
${brandNote}

PROIBIDO:
- ❌ NÃO incluir nenhum produto, frasco, garrafa, caixa, embalagem ou item à venda
- ❌ NÃO gerar texto, lettering, logos ou badges na imagem
- ❌ NÃO usar fundo branco chapado — o cenário deve ser rico e premium
- ❌ NÃO incluir mãos, pessoas ou modelos
- ❌ NÃO incluir mockups ou representações de produtos`;
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

    // Fetch API keys
    const geminiApiKey = await getCredential(supabaseUrl, supabaseKey, 'GEMINI_API_KEY');
    const falApiKeyVal = await getFalApiKey(supabaseUrl, supabaseKey);
    if (falApiKeyVal) {
      console.log(`[AI-LP-Enhance v${VERSION}] ✅ FAL_API_KEY found — fal.ai FLUX enabled (priority 1-2)`);
    }
    if (geminiApiKey) {
      console.log(`[AI-LP-Enhance v${VERSION}] ✅ GEMINI_API_KEY found — Gemini Nativa enabled (priority 3)`);
    }

    // 1. Fetch landing page + blocks/schema
    const { data: lp, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("id, product_ids, generated_blocks, generated_schema, current_version, metadata")
      .eq("id", landingPageId)
      .single();

    if (lpError || !lp) {
      console.error("[AI-LP-Enhance] LP not found:", lpError);
      return new Response(
        JSON.stringify({ success: false, error: "Landing page not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if V7 (schema) or V5 (blocks)
    const isV7 = !!lp.generated_schema;
    const hasContent = isV7 || !!lp.generated_blocks;

    if (!hasContent) {
      return new Response(
        JSON.stringify({ success: false, error: "No content to enhance — generate page first" }),
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

    // 3. Store name + brand colors (prefer schema colorScheme over store_settings)
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("tenant_id", tenantId)
      .single();
    const storeName = storeSettings?.store_name || "Loja";
    
    // Extract brand colors from schema colorScheme (which was derived from PRODUCT image)
    const schemaColors = lp.generated_schema?.colorScheme;
    const brandColors = {
      primary: schemaColors?.accent || schemaColors?.ctaBg || undefined,
      accent: schemaColors?.priceCurrent || schemaColors?.badgeText || undefined,
    };
    console.log(`[AI-LP-Enhance] Using brand colors from schema: primary=${brandColors.primary}, accent=${brandColors.accent}`);

    // 4. Drive references — search brand/creative folders first, then product name (non-blocking)
    let driveReferenceBase64s: string[] = [];
    try {
      // Step 1: Search brand/creative folders
      const { data: brandFolders } = await supabase
        .from("files")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_folder", true)
        .or('filename.ilike.%criativo%,filename.ilike.%banner%,filename.ilike.%brand%,filename.ilike.%marca%,filename.ilike.%ads%,filename.ilike.%anúncio%,filename.ilike.%key visual%,filename.ilike.%gestor%')
        .limit(10);

      let driveFiles: any[] = [];
      
      if (brandFolders && brandFolders.length > 0) {
        const folderIds = brandFolders.map((f: any) => f.id);
        const { data: folderFiles } = await supabase
          .from("files")
          .select("storage_path, metadata")
          .eq("tenant_id", tenantId)
          .eq("is_folder", false)
          .ilike("mime_type", "image/%")
          .in("folder_id", folderIds)
          .order("created_at", { ascending: false })
          .limit(6);
        driveFiles = folderFiles || [];
        console.log(`[AI-LP-Enhance] Found ${driveFiles.length} files in brand/creative folders`);
      }
      
      // Step 2: Fallback - search by product name if not enough brand references
      if (driveFiles.length < 3) {
        const searchTerm = product.name.split(' ').slice(0, 3).join(' ');
        const { data: nameFiles } = await supabase
          .from("files")
          .select("storage_path, metadata")
          .eq("tenant_id", tenantId)
          .eq("is_folder", false)
          .ilike("mime_type", "image/%")
          .ilike("original_name", `%${searchTerm}%`)
          .limit(3);
        if (nameFiles) driveFiles = [...driveFiles, ...nameFiles];
      }

      if (driveFiles?.length) {
        for (const file of driveFiles.slice(0, 4)) {
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

    // 5. Download product image for AI reference
    const productBase64 = await imageUrlToBase64(primaryImageUrl);
    if (!productBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to download product image" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[AI-LP-Enhance] Product image downloaded (${Math.round(productBase64.length / 1024)}KB)`);

    // 6. Ensure drive folder
    const driveFolderId = await ensureDriveFolder(supabase, tenantId, userId);

    // 6. Detect enhanceable sections
    const blocks = isV7 ? null : JSON.parse(JSON.stringify(lp.generated_blocks));
    const schema = isV7 ? JSON.parse(JSON.stringify(lp.generated_schema)) : null;
    const allSpecs = isV7 
      ? detectEnhanceableSchemaSections(schema)
      : detectEnhanceableSections(blocks);

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
      
      // V8.0: Extract mood and seed from schema for diversified scene prompts
      const schemaMood = schema?.mood as string | undefined;
      const schemaVariantSeed = schema?.variantSeed as number | undefined;
      const prompt = buildCompositionPrompt(product, storeName, spec, driveReferenceBase64s.length > 0, brandColors, schemaMood, schemaVariantSeed);
      
      // Try Gemini Nativa first, then Lovable Gateway Pro, then Flash
      let imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-3-pro-image-preview', prompt, productBase64, driveReferenceBase64s.length > 0 ? driveReferenceBase64s : undefined, geminiApiKey, falApiKeyVal);
      if (!imageDataUrl) {
        console.log(`[AI-LP-Enhance] Primary failed for ${spec.promptSuffix}, trying flash fallback...`);
        imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-2.5-flash-image', prompt, productBase64, driveReferenceBase64s.length > 0 ? driveReferenceBase64s : undefined, null, null); // Don't retry fal/native
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

      // Apply to block tree or schema
      const applied = spec.isSchema
        ? applyImageToSchema(schema, spec.blockId, spec.imageField, publicUrl)
        : applyImageToBlock(blocks, spec.blockId, spec.imageField, publicUrl);
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

    const updatePayload: Record<string, any> = {
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
    };
    // Save to the right column based on content type
    if (isV7) {
      updatePayload.generated_schema = schema;
    } else {
      updatePayload.generated_blocks = blocks;
    }

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update(updatePayload)
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
    return errorResponse(error, corsHeaders, { module: 'ai', action: 'landing-page-enhance-images' });
  }
});
