// =============================================
// AI LANDING PAGE ENHANCE IMAGES — V7.0.0
// Uses unified visual-engine.ts resilientGenerate()
// No more local callImageModel duplicate
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { getFalApiKey } from "../_shared/fal-client.ts";
import {
  resilientGenerate,
  downloadImageAsBase64,
} from "../_shared/visual-engine.ts";

const VERSION = "7.0.0";
const MAX_EXECUTION_MS = 130_000;
const ESTIMATED_IMAGE_GEN_MS = 30_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ========== SECTION SPECS ==========

interface SectionSpec {
  blockType: string;
  blockId: string;
  promptSuffix: string;
  aspectRatio: string;
  imageField: string;
  isSchema?: boolean;
}

function detectEnhanceableSections(blocks: any): SectionSpec[] {
  const specs: SectionSpec[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'Banner' && node.props?.slides?.length > 0) {
      specs.push({ blockType: 'Banner', blockId: node.id, promptSuffix: 'HERO', aspectRatio: '21:9', imageField: 'slides[0].imageDesktop' });
    }
    if (node.type === 'Hero' && node.props) {
      specs.push({ blockType: 'Hero', blockId: node.id, promptSuffix: 'HERO-CONTENT', aspectRatio: '16:9', imageField: 'backgroundImage' });
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
  walk(blocks);
  return specs;
}

function detectEnhanceableSchemaSections(schema: any): SectionSpec[] {
  const specs: SectionSpec[] = [];
  if (!schema?.sections) return specs;
  for (const section of schema.sections) {
    if (section.type === 'hero') {
      specs.push({ blockType: 'hero', blockId: section.id, promptSuffix: 'HERO-DESKTOP', aspectRatio: '16:9', imageField: 'heroSceneDesktopUrl', isSchema: true });
      specs.push({ blockType: 'hero', blockId: section.id, promptSuffix: 'HERO-MOBILE', aspectRatio: '9:16', imageField: 'heroSceneMobileUrl', isSchema: true });
    }
    if (section.type === 'cta_final') {
      specs.push({ blockType: 'cta_final', blockId: section.id, promptSuffix: 'CTA-DESKTOP', aspectRatio: '16:9', imageField: 'ctaSceneDesktopUrl', isSchema: true });
      specs.push({ blockType: 'cta_final', blockId: section.id, promptSuffix: 'CTA-MOBILE', aspectRatio: '9:16', imageField: 'ctaSceneMobileUrl', isSchema: true });
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
        if (node.props.slides?.[0]) { node.props.slides[0].imageDesktop = imageUrl; node.props.slides[0].imageMobile = node.props.slides[0].imageMobile || imageUrl; updated = true; }
      } else if (imageField === 'backgroundImage') {
        node.props.backgroundImage = imageUrl; node.props.imageDesktop = imageUrl; updated = true;
      } else { node.props[imageField] = imageUrl; updated = true; }
    }
    if (node.children && Array.isArray(node.children)) { for (const child of node.children) walk(child); }
  }
  walk(blocks);
  return updated;
}

function applyImageToSchema(schema: any, sectionId: string, imageField: string, imageUrl: string): boolean {
  if (!schema?.sections) return false;
  for (const section of schema.sections) {
    if (section.id === sectionId && section.props) { section.props[imageField] = imageUrl; return true; }
  }
  return false;
}

// ========== MOOD SCENE POOLS ==========

const MOOD_SCENE_POOLS: Record<string, string[]> = {
  luxury: ['bancada de mármore Carrara branco polido, iluminação dourada suave de estúdio, reflexos elegantes', 'superfície de veludo escuro premium, bokeh dourado ao fundo, iluminação lateral cinematográfica', 'estúdio fotográfico com fundo de vidro fumê, luzes spot direcionais, superfície espelhada preta', 'penteadeira clássica com espelho dourado desfocado, flores frescas brancas, mármore rosé'],
  bold: ['superfície de concreto polido escuro, iluminação dramática lateral azulada, atmosfera de ginásio premium', 'estúdio neon com fundo escuro intenso, LED vermelho e azul como accent, superfície metálica fosca', 'bancada industrial preta, spotlights dramáticos de cima, partículas de pó iluminadas', 'superfície de aço escovado, backlight neon sutil, fumaça suave'],
  organic: ['mesa de madeira rústica nobre, ingredientes naturais espalhados, iluminação quente de janela', 'jardim ensolarado com mesa de pedra natural, ervas frescas ao redor, luz golden hour', 'superfície de bambu com textura natural, gotas de orvalho, plantas tropicais ao fundo', 'bancada de cozinha rústica com linho natural, flores secas, iluminação quente lateral'],
  corporate: ['mesa de escritório moderna minimalista, acabamento fosco escuro, LED ambiental azul/roxo sutil', 'superfície branca polida com reflexo sutil, gradiente de luz lateral', 'desk setup premium com monitor ultra-wide desfocado, iluminação bias azulada', 'mesa de reunião minimalista, fundo de vidro translúcido, iluminação difusa de escritório'],
  minimal: ['superfície elegante escura, gradiente de luz lateral suave, bokeh premium desfocado', 'fundo infinito branco suave com sombra sutil, iluminação soft de estúdio, pureza visual', 'superfície de concreto claro liso, luz natural indireta, sombras suaves', 'gradiente suave de cinza a branco, luz difusa, floating feeling, espaço limpo'],
};

function seededScenePick(arr: string[], seed: number): string {
  let s = seed;
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return arr[s % arr.length];
}

function buildCompositionPrompt(
  product: { name: string; tags?: string[] }, storeName: string, spec: SectionSpec,
  hasDriveRefs: boolean, brandColors?: { primary?: string; accent?: string },
  mood?: string, variantSeed?: number,
): string {
  const nameAndTags = `${product.name} ${(product.tags || []).join(' ')}`.toLowerCase();
  const moodKey = mood || 'minimal';
  const pool = MOOD_SCENE_POOLS[moodKey] || MOOD_SCENE_POOLS['minimal'];
  const sceneSeed = (variantSeed || Date.now()) + (spec.promptSuffix.includes('CTA') ? 9999 : 0);
  let sceneVibe = seededScenePick(pool, sceneSeed);
  
  if (/cabelo|shampoo|condicion|capilar|calvíc/.test(nameAndTags)) sceneVibe += ', gotas d\'água sutis, toalha branca dobrada';
  else if (/skin|pele|facial|anti.?idade|sérum|creme/.test(nameAndTags)) sceneVibe += ', flores frescas, textura de seda';
  else if (/suplement|whey|proteín|creatina|fitness/.test(nameAndTags)) sceneVibe += ', shaker desfocado ao fundo';
  else if (/aliment|comida|orgânic|natural|chá|café/.test(nameAndTags)) sceneVibe += ', ingredientes frescos ao redor';

  const brandNote = brandColors?.primary ? `Cores de destaque da marca: ${brandColors.primary}${brandColors.accent ? ` e ${brandColors.accent}` : ''}.` : '';
  const isMobile = spec.promptSuffix.includes('MOBILE');
  const isHero = spec.promptSuffix.includes('HERO');
  const sectionLabel = isHero ? 'HERO' : 'CTA';
  const orientation = isMobile ? 'VERTICAL RETRATO 9:16 (1080x1920px)' : 'HORIZONTAL PAISAGEM 16:9 (1920x1080px)';

  const layoutInstruction = isMobile
    ? `- TODA a imagem é cenário/ambiente — SEM produto\n- Terço superior levemente mais escuro para texto\n- A imagem servirá de FUNDO; o produto será sobreposto via CSS`
    : `- TODA a imagem é cenário/ambiente — SEM produto\n- Lado ESQUERDO (60%) mais escuro para texto\n- Lado DIREITO (40%) com área respirável para produto CSS overlay`;

  return `BACKGROUND PREMIUM PARA LANDING PAGE — ${sectionLabel} ${isMobile ? 'MOBILE' : 'DESKTOP'} (${orientation})

TAREFA: Criar um CENÁRIO/FUNDO fotorrealista premium para landing page de e-commerce.
O produto "${product.name}" da marca "${storeName}" será sobreposto por cima via CSS — NÃO inclua nenhum produto na imagem.

COMPOSIÇÃO DO FUNDO (${orientation}):
${layoutInstruction}

CENÁRIO/AMBIENTE:
${sceneVibe}

REGRAS CRÍTICAS:
1. NÃO inclua nenhum produto, frasco, embalagem
2. Gere APENAS o cenário/fundo/ambiente
3. Profundidade de campo com bokeh suave
4. Iluminação premium de estúdio
5. Qualidade de foto publicitária profissional
${brandNote}

PROIBIDO:
- ❌ NÃO incluir nenhum produto
- ❌ NÃO gerar texto, lettering, logos
- ❌ NÃO usar fundo branco chapado
- ❌ NÃO incluir mãos, pessoas ou modelos`;
}

// ========== UPLOAD ==========

async function uploadCreativeToStorage(
  supabase: any, tenantId: string, imageBase64: string, label: string, suffix: string,
  userId?: string, driveFolderId?: string | null,
): Promise<string | null> {
  try {
    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const timestamp = Date.now();
    const safeName = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    const filename = `section-${suffix}-${safeName}-${timestamp}.png`;
    const filePath = `${tenantId}/lp-creatives/${filename}`;
    const { error: uploadError } = await supabase.storage.from('store-assets').upload(filePath, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) return null;
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
  } catch (error) { console.error("[AI-LP-Enhance] Upload error:", error); return null; }
}

async function ensureDriveFolder(supabase: any, tenantId: string, userId: string): Promise<string | null> {
  try {
    const { ensureFolderPathEdge } = await import("../_shared/drive-register.ts");
    return await ensureFolderPathEdge(supabase, tenantId, userId, "Criativos IA/Landing Pages");
  } catch (e) { return null; }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[AI-LP-Enhance v${VERSION}] Starting unified composition generation...`);

  try {
    const body = await req.json();
    const { landingPageId, tenantId, userId, startFromIndex = 0, stage = 1 } = body;

    if (!landingPageId || !tenantId || !userId) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const geminiApiKey = await getCredential(supabaseUrl, supabaseKey, 'GEMINI_API_KEY');
    const falApiKeyValue = await getFalApiKey(supabaseUrl, supabaseKey);
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || null;
    console.log(`[AI-LP-Enhance v${VERSION}] Credentials: FAL=${!!falApiKeyValue} GEMINI=${!!geminiApiKey} OPENAI=${!!openaiApiKey} LOVABLE=✅`);

    // 1. Fetch landing page
    const { data: lp, error: lpError } = await supabase.from("ai_landing_pages").select("id, product_ids, generated_blocks, generated_schema, current_version, metadata").eq("id", landingPageId).single();
    if (lpError || !lp) return new Response(JSON.stringify({ success: false, error: "Landing page not found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isV7 = !!lp.generated_schema;
    if (!isV7 && !lp.generated_blocks) return new Response(JSON.stringify({ success: false, error: "No content to enhance" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const productIds = lp.product_ids || [];
    if (productIds.length === 0) return new Response(JSON.stringify({ success: false, error: "No products linked" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 2. Fetch product
    const { data: products } = await supabase.from("products").select("id, name, tags").in("id", productIds).limit(1);
    if (!products?.length) return new Response(JSON.stringify({ success: false, error: "Products not found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const product = products[0];
    const { data: images } = await supabase.from("product_images").select("url, is_primary").eq("product_id", product.id).order("is_primary", { ascending: false }).limit(1);
    const primaryImageUrl = images?.[0]?.url;
    if (!primaryImageUrl) return new Response(JSON.stringify({ success: false, error: "Product has no image" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 3. Store name + brand colors
    const { data: storeSettings } = await supabase.from("store_settings").select("store_name").eq("tenant_id", tenantId).single();
    const storeName = storeSettings?.store_name || "Loja";
    const schemaColors = lp.generated_schema?.colorScheme;
    const brandColors = { primary: schemaColors?.accent || schemaColors?.ctaBg || undefined, accent: schemaColors?.priceCurrent || schemaColors?.badgeText || undefined };

    // 4. Drive references
    let driveReferenceBase64s: string[] = [];
    try {
      const { data: brandFolders } = await supabase.from("files").select("id").eq("tenant_id", tenantId).eq("is_folder", true)
        .or('filename.ilike.%criativo%,filename.ilike.%banner%,filename.ilike.%brand%,filename.ilike.%marca%,filename.ilike.%ads%').limit(10);
      let driveFiles: any[] = [];
      if (brandFolders?.length) {
        const { data: folderFiles } = await supabase.from("files").select("storage_path, metadata").eq("tenant_id", tenantId).eq("is_folder", false).ilike("mime_type", "image/%").in("folder_id", brandFolders.map((f: any) => f.id)).order("created_at", { ascending: false }).limit(6);
        driveFiles = folderFiles || [];
      }
      if (driveFiles.length < 3) {
        const searchTerm = product.name.split(' ').slice(0, 3).join(' ');
        const { data: nameFiles } = await supabase.from("files").select("storage_path, metadata").eq("tenant_id", tenantId).eq("is_folder", false).ilike("mime_type", "image/%").ilike("original_name", `%${searchTerm}%`).limit(3);
        if (nameFiles) driveFiles = [...driveFiles, ...nameFiles];
      }
      for (const file of (driveFiles || []).slice(0, 4)) {
        const meta = file.metadata as Record<string, any> | null;
        const bucket = (meta?.bucket as string) || 'tenant-files';
        let url: string | undefined;
        if (bucket === 'tenant-files') { const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600); url = signedData?.signedUrl; }
        else { const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path); url = pubData?.publicUrl; }
        if (url) { const b64 = await downloadImageAsBase64(url); if (b64) driveReferenceBase64s.push(b64); }
      }
    } catch (e) { console.warn("[AI-LP-Enhance] Drive ref fetch error:", e); }

    // 5. Download product image
    const productBase64 = await downloadImageAsBase64(primaryImageUrl);
    if (!productBase64) return new Response(JSON.stringify({ success: false, error: "Failed to download product image" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const driveFolderId = await ensureDriveFolder(supabase, tenantId, userId);

    // 6. Detect enhanceable sections
    const blocks = isV7 ? null : JSON.parse(JSON.stringify(lp.generated_blocks));
    const schema = isV7 ? JSON.parse(JSON.stringify(lp.generated_schema)) : null;
    const allSpecs = isV7 ? detectEnhanceableSchemaSections(schema) : detectEnhanceableSections(blocks);
    if (allSpecs.length === 0) return new Response(JSON.stringify({ success: true, enhanced: 0, message: "No enhanceable sections found", done: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const pendingSpecs = allSpecs.slice(startFromIndex);
    if (pendingSpecs.length === 0) return new Response(JSON.stringify({ success: true, enhanced: 0, done: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const elapsedMs = Date.now() - startTime;
    const remainingBudgetMs = MAX_EXECUTION_MS - elapsedMs;
    const maxSectionsInBudget = Math.max(1, Math.floor(remainingBudgetMs / ESTIMATED_IMAGE_GEN_MS));
    const sectionsToProcess = pendingSpecs.slice(0, maxSectionsInBudget);

    console.log(`[AI-LP-Enhance] Stage ${stage}: Processing ${sectionsToProcess.length}/${allSpecs.length} sections`);

    // 7. Generate composition for each section using unified engine
    const results: { section: string; url: string | null; applied: boolean }[] = [];

    for (const spec of sectionsToProcess) {
      const elapsedSoFar = Date.now() - startTime;
      if (elapsedSoFar > MAX_EXECUTION_MS - 10_000) break;

      const schemaMood = schema?.mood as string | undefined;
      const schemaVariantSeed = schema?.variantSeed as number | undefined;
      const prompt = buildCompositionPrompt(product, storeName, spec, driveReferenceBase64s.length > 0, brandColors, schemaMood, schemaVariantSeed);

      // Determine output size based on aspect ratio
      const isMobile = spec.promptSuffix.includes('MOBILE');
      const outputSize: '1024x1024' | '1536x1024' | '1024x1536' = isMobile ? '1024x1536' : '1536x1024';

      // Use unified resilientGenerate
      const result = await resilientGenerate({
        lovableApiKey,
        openaiApiKey,
        geminiApiKey,
        falApiKey: falApiKeyValue,
        prompt,
        referenceImageBase64: productBase64,
        referenceImageUrl: primaryImageUrl,
        outputSize,
        styleReferences: driveReferenceBase64s.length > 0 ? driveReferenceBase64s : undefined,
        slotLabel: `lp-${spec.promptSuffix}`,
      });

      if (!result.imageBase64) {
        console.error(`[AI-LP-Enhance] Generation failed for ${spec.promptSuffix}: ${result.error}`);
        results.push({ section: spec.promptSuffix, url: null, applied: false });
        continue;
      }

      const publicUrl = await uploadCreativeToStorage(supabase, tenantId, result.imageBase64, product.name, spec.promptSuffix.toLowerCase(), userId, driveFolderId);
      if (!publicUrl) { results.push({ section: spec.promptSuffix, url: null, applied: false }); continue; }

      const applied = spec.isSchema
        ? applyImageToSchema(schema, spec.blockId, spec.imageField, publicUrl)
        : applyImageToBlock(blocks, spec.blockId, spec.imageField, publicUrl);
      results.push({ section: spec.promptSuffix, url: publicUrl, applied });
      console.log(`[AI-LP-Enhance] ${spec.promptSuffix}: ${result.actualProvider} → ${applied ? 'applied' : 'NOT applied'}`);
    }

    // 8. Persist
    const existingMeta = (lp.metadata && typeof lp.metadata === 'object') ? lp.metadata as Record<string, any> : {};
    const enhancedSections = results.filter(r => r.applied).map(r => ({ section: r.section, url: r.url }));
    const previousEnhancement = existingMeta?.imageEnhancement as Record<string, any> | undefined;
    const allEnhancedSections = [...(previousEnhancement?.sections || []), ...enhancedSections];
    const nextIndex = startFromIndex + results.length;
    const isDone = nextIndex >= allSpecs.length;

    const updatePayload: Record<string, any> = {
      metadata: { ...existingMeta, imageEnhancement: { version: VERSION, enhancedAt: new Date().toISOString(), sections: allEnhancedSections, totalEnhanced: allEnhancedSections.length, totalSections: allSpecs.length, stage, done: isDone } },
    };
    if (isV7) updatePayload.generated_schema = schema;
    else updatePayload.generated_blocks = blocks;

    const { error: updateError } = await supabase.from("ai_landing_pages").update(updatePayload).eq("id", landingPageId);
    if (updateError) return new Response(JSON.stringify({ success: false, error: "Failed to save enhanced blocks" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const successCount = results.filter(r => r.applied).length;
    console.log(`[AI-LP-Enhance v${VERSION}] Stage ${stage} done! ${successCount}/${sectionsToProcess.length} enhanced. Done: ${isDone}`);

    return new Response(JSON.stringify({
      success: true, enhanced: successCount, total: allSpecs.length, results, done: isDone,
      nextIndex: isDone ? null : nextIndex, nextStage: isDone ? null : stage + 1, stage,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'ai', action: 'landing-page-enhance-images' });
  }
});
