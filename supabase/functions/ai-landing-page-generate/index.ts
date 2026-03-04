// =============================================
// AI LANDING PAGE GENERATE — V4.0 ENGINE
// Deterministic backend pipeline for landing page generation
// Backend is AUTHORITY, AI is EXECUTOR
// v4.0.0: Engine plan + modular prompt + structured parser + hard checks
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { isPromptIncomplete, selectBestFallback } from "../_shared/marketing/fallback-prompts.ts";
import {
  resolveEnginePlan,
  runHardChecks,
  getNicheRules,
  getTrafficRules,
  getAwarenessCopyRules,
  type BriefingInput,
  type EnginePlanInput,
  type HardCheckOutput,
} from "../_shared/marketing/engine-plan.ts";
import {
  BLOCK_TOOL_DEFINITION,
  getBlockPropsDocumentation,
  assembleBlockTree,
} from "../_shared/marketing/block-assembler.ts";

const VERSION = "5.0.0"; // Engine V5: JSON-to-React blocks via tool calling — same system as Lovable editor

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ========== CREATIVE IMAGE GENERATION ==========

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("[AI-LP-Generate] Failed to download image:", e);
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
    console.error("[AI-LP-Generate] " + model + " error: " + response.status, errText.substring(0, 300));
    return null;
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function ensureDriveFolder(supabase: any, tenantId: string, userId: string, folderName: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase.from("files").select("id").eq("tenant_id", tenantId).eq("is_folder", true).eq("filename", folderName).limit(1).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabase.from("files").insert({
      tenant_id: tenantId, filename: folderName, original_name: folderName,
      storage_path: `drive/${tenantId}/criativos-de-pagina`,
      is_folder: true, is_system_folder: true, created_by: userId,
      metadata: { source: "ai_landing_page_generate", system_managed: true },
    }).select("id").single();
    if (error) { console.error("[AI-LP-Generate] Error creating folder:", error); return null; }
    return created?.id || null;
  } catch (e) { console.error("[AI-LP-Generate] Folder ensure error:", e); return null; }
}

async function registerFileToDrive(supabase: any, tenantId: string, userId: string, folderId: string, publicUrl: string, storagePath: string, originalName: string, mimeType: string, sizeBytes: number): Promise<void> {
  try {
    await supabase.from("files").insert({
      tenant_id: tenantId, folder_id: folderId, filename: originalName, original_name: originalName,
      storage_path: storagePath, mime_type: mimeType, size_bytes: sizeBytes,
      is_folder: false, is_system_folder: false, created_by: userId,
      metadata: { source: "ai_landing_page_generate", url: publicUrl, bucket: "store-assets", system_managed: true },
    });
  } catch (e) { console.warn("[AI-LP-Generate] Drive registration error (non-blocking):", e); }
}

async function uploadCreativeToStorage(supabase: any, tenantId: string, dataUrl: string, productName: string, userId?: string, driveFolderId?: string | null): Promise<string | null> {
  try {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }
    const timestamp = Date.now();
    const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40);
    const filename = 'hero-' + safeName + '-' + timestamp + '.png';
    const filePath = tenantId + '/lp-creatives/' + filename;
    const { error: uploadError } = await supabase.storage.from('store-assets').upload(filePath, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) { console.error("[AI-LP-Generate] Upload error:", uploadError); return null; }
    const { data: publicUrlData } = supabase.storage.from('store-assets').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (publicUrl && driveFolderId && userId) {
      await registerFileToDrive(supabase, tenantId, userId, driveFolderId, publicUrl, filePath, filename, 'image/png', bytes.length);
    }
    return publicUrl || null;
  } catch (error) { console.error("[AI-LP-Generate] Upload creative error:", error); return null; }
}

async function generateHeroCreative(supabase: any, lovableApiKey: string, tenantId: string, productName: string, productImageUrl: string, storeName: string, userId?: string, driveFolderId?: string | null, driveReferenceBase64s?: string[]): Promise<string | null> {
  try {
    const referenceBase64 = await imageUrlToBase64(productImageUrl);
    if (!referenceBase64) return null;
    const driveContext = driveReferenceBase64s && driveReferenceBase64s.length > 0
      ? '\n\nREFERÊNCIAS VISUAIS ADICIONAIS: As imagens extras anexadas são referências visuais do Drive do lojista para este produto. Use-as como inspiração de estilo, ângulo e composição, mas GERE uma imagem NOVA e ORIGINAL.'
      : '';
    const prompt = 'FOTOGRAFIA PUBLICITÁRIA DE ALTO IMPACTO para landing page de venda.\n\nPRODUTO: "' + productName + '" pela marca "' + storeName + '"\n\nOBJETIVO: Criar uma imagem hero profissional de alta conversão para landing page.\n\nREGRAS ABSOLUTAS:\n1. O produto na imagem de referência DEVE ser mantido EXATAMENTE como é — mesmo rótulo, mesmas cores, mesmo formato\n2. NÃO altere o texto do rótulo, marca ou embalagem do produto\n3. NÃO invente novos produtos ou embalagens\n\nCOMPOSIÇÃO:\n- Produto em destaque central ou em posição hero (leve ângulo 3/4)\n- Sombra de contato realista\n- Efeitos de brilho/reflexo sutis para transmitir qualidade premium\n- Aspect ratio: 16:9 (paisagem) para hero banner\n\nCENÁRIO E AMBIENTAÇÃO (baseado no nicho do produto):\n- Cosméticos/Saúde/Beleza: bancada de banheiro premium com iluminação natural dourada\n- Suplementos/Fitness/Masculino: superfície de concreto polido escuro, iluminação dramática lateral\n- Tech/Eletrônicos/Gadgets: mesa de escritório moderna, iluminação LED azulada sutil\n- Alimentos/Bebidas/Orgânicos: mesa de madeira rústica, ingredientes frescos ao redor\n- Moda/Acessórios: fundo de tecido nobre, iluminação de estúdio suave\n- Default: superfície minimalista escura com gradiente de luz lateral suave\n\nESTILO VISUAL: Coerência com landing page dark/premium. Use backgrounds escuros ou médios. Qualidade de catálogo profissional. Ultra realista.' + driveContext;
    let imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-3-pro-image-preview', prompt, referenceBase64, driveReferenceBase64s);
    if (!imageDataUrl) imageDataUrl = await callImageModel(lovableApiKey, 'google/gemini-2.5-flash-image', prompt, referenceBase64, driveReferenceBase64s);
    if (!imageDataUrl) return null;
    return await uploadCreativeToStorage(supabase, tenantId, imageDataUrl, productName, userId, driveFolderId);
  } catch (error) { console.error("[AI-LP-Generate] Creative generation error:", error); return null; }
}

// ========== CORS ==========

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== REQUEST TYPE ==========

interface GenerateRequest {
  landingPageId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  promptType: 'initial' | 'adjustment' | 'regenerate';
  referenceUrl?: string;
  productIds?: string[];
  briefing?: BriefingInput;
}

// ========== MODULAR PROMPT BUILDER ==========

function buildV5SystemPrompt(params: {
  enginePlan: EnginePlanInput;
  storeName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  themeColors: Record<string, string>;
  productsInfo: string;
  productImages: string[];
  productNames: string[];
  productPrimaryImageMap: Record<string, string>;
  reviewsInfo: string;
  creativesInfo: string;
  generatedCreativeUrls: string[];
  lifestyleImageUrls: string[];
  socialProofImageUrls: string[];
  referenceUrl?: string;
  currentBlocks?: string;
}): string {
  const {
    enginePlan, storeName, logoUrl, primaryColor, secondaryColor, accentColor,
    themeColors, productsInfo, productImages, productNames, productPrimaryImageMap, reviewsInfo,
    creativesInfo, generatedCreativeUrls, lifestyleImageUrls,
    referenceUrl, currentBlocks,
  } = params;

  const sections: string[] = [];

  // === A. ROLE ===
  sections.push(`Você é um diretor criativo de elite, especialista em landing pages de altíssima conversão.
Você vai montar uma landing page usando COMPONENTES REAIS pré-construídos (React). 
Você NÃO gera HTML. Você chama a função build_landing_page com a estrutura de seções.
Cada seção que você escolher será renderizada por um componente real com design profissional.`);

  // === B. AUTHORITATIVE CONTEXT ===
  sections.push(`## ⚡ CONTEXTO AUTORITATIVO (NÃO NEGOCIÁVEL)

- **Arquétipo**: ${enginePlan.resolvedArchetype} (${TEMPLATE_REGISTRY_NAMES[enginePlan.resolvedArchetype]})
- **Nicho**: ${enginePlan.resolvedNiche}
- **Profundidade**: ${enginePlan.resolvedDepth} ${enginePlan.resolvedDepth === 'short' ? '(3-5 seções)' : enginePlan.resolvedDepth === 'medium' ? '(5-8 seções)' : '(8-12 seções)'}
- **Peso Visual**: ${enginePlan.resolvedVisualWeight}
- **Força de Prova**: ${enginePlan.proofStrength}
- **CTA Padrão**: "${enginePlan.defaultCTA}"
- **Seções Obrigatórias**: ${enginePlan.requiredSections.join(', ')}
- **Seções Opcionais**: ${enginePlan.optionalSections.join(', ')}
- **Ordem Preferida**: ${enginePlan.preferredOrder.join(' → ')}
- **Objetivo**: ${enginePlan.briefing.objective}
- **Temperatura do Tráfego**: ${enginePlan.briefing.trafficTemp}
- **Fonte de Tráfego**: ${enginePlan.briefing.trafficSource}
- **Nível de Consciência**: ${enginePlan.briefing.awarenessLevel}
${enginePlan.briefing.restrictions?.length ? `- **Restrições**: ${enginePlan.briefing.restrictions.join(', ')}` : ''}`);

  // === C. SECTION MAPPING ===
  sections.push(`## 📐 MAPEAMENTO DE SEÇÕES → COMPONENTES

Use a função build_landing_page com os seguintes tipos de seção:

| Seção do Engine Plan | Tipo no Tool Call | Quando Usar |
|-----|-----|-----|
| hero | hero_banner | SEMPRE primeiro — headline + CTA + imagem hero |
| credibilidade | info_highlights | Badges de confiança (Frete Grátis, Pagamento Seguro) |
| dor_problema | content_columns | Texto sobre o problema + imagem | 
| solucao | content_columns | Solução + imagem do produto |
| beneficios | feature_list | Lista de benefícios com ícones |
| produto_destaque | content_columns | Produto em destaque com features |
| prova_social | testimonials OU image_gallery | Reviews reais ou galeria de fotos |
| comparativo | pricing_table | Comparação de kits/planos |
| oferta | pricing_table | Cards de preço/oferta |
| faq | faq | Perguntas frequentes |
| garantia | text_section + button_cta | Texto de garantia + CTA |
| como_funciona | steps_timeline | Passo a passo |
| cta_final | button_cta | CTA de fechamento |

Siga a ordem do Engine Plan. Inclua seções obrigatórias E opcionais conforme a profundidade.`);

  // === D. NICHE + TRAFFIC RULES ===
  sections.push(getNicheRules(enginePlan.resolvedNiche));
  sections.push(getTrafficRules(enginePlan.briefing.trafficSource));
  sections.push(getAwarenessCopyRules(enginePlan.briefing.awarenessLevel));

  // === E. VISUAL ===
  sections.push(`## 🎨 CORES E VISUAL

- Cor Primária: ${primaryColor}
${secondaryColor ? `- Cor Secundária: ${secondaryColor}` : ''}
${accentColor ? `- Cor de Acento: ${accentColor}` : ''}
${themeColors.buttonPrimaryBg ? `- Botão Primário BG: ${themeColors.buttonPrimaryBg}` : ''}
${themeColors.buttonPrimaryText ? `- Botão Primário Text: ${themeColors.buttonPrimaryText}` : ''}
${themeColors.priceColor ? `- Cor do Preço: ${themeColors.priceColor}` : ''}

### Peso Visual: ${enginePlan.resolvedVisualWeight}
${enginePlan.resolvedVisualWeight === 'premium' ? '- Use page_background_color escuro (#0a0a0a), textColor claro (#ffffff), accentColor dourado' : ''}
${enginePlan.resolvedVisualWeight === 'comercial' ? '- Use cores vibrantes nos CTAs, badges de desconto, preço em destaque' : ''}
${enginePlan.resolvedVisualWeight === 'minimalista' ? '- Use page_background_color claro (#ffffff), poucos elementos, tipografia elegante' : ''}
${enginePlan.resolvedVisualWeight === 'direto' ? '- Layout simples, sem ornamentos, CTAs claros' : ''}

Use as cores da marca em buttonColor, iconColor, accentColor dos blocos.`);

  // === F. ANTI-PADRÕES ===
  const restrictionRules = enginePlan.briefing.restrictions?.map(r => {
    if (r === 'no_countdown') return '- NÃO inclua countdown timers';
    if (r === 'no_video') return '- NÃO inclua seções de vídeo';
    if (r === 'no_comparisons') return '- NÃO inclua tabelas comparativas';
    return '';
  }).filter(Boolean).join('\n') || '';

  sections.push(`## 🚫 REGRAS ABSOLUTAS

- NUNCA invente nomes de produto — use EXATAMENTE: ${productNames.map(n => `"${n}"`).join(', ')}
- NUNCA invente URLs de imagem — use APENAS as fornecidas
- NUNCA use Lorem ipsum
- Use EXATAMENTE os preços fornecidos nos dados
- NÃO crie urgência artificial (estoque falso, countdown sem dados reais)
- Header e Footer são adicionados automaticamente — NÃO os inclua nas seções
${restrictionRules}`);

  // === G. DATA ===
  const dataSections: string[] = [];

  dataSections.push(`## Loja: ${storeName}
- Logo: ${logoUrl || 'Sem logo'}
- Cor Principal: ${primaryColor}`);

  if (productsInfo) dataSections.push(`## PRODUTOS:\n${productsInfo}`);

  // Asset slots
  const assetSlots: string[] = [];
  
  if (generatedCreativeUrls.length > 0) {
    assetSlots.push(`### HERO IMAGE: ${generatedCreativeUrls[0]}
Use como imageDesktop no hero_banner.`);
  } else if (lifestyleImageUrls.length > 0) {
    assetSlots.push(`### HERO IMAGE: ${lifestyleImageUrls[0]}
Use como imageDesktop no hero_banner.`);
  } else if (productImages.length > 0) {
    assetSlots.push(`### HERO IMAGE: ${productImages[0]}`);
  }

  const primaryMapEntries = Object.entries(productPrimaryImageMap);
  if (primaryMapEntries.length > 0) {
    assetSlots.push(`### IMAGENS POR PRODUTO (para pricing_table e content_columns):
${primaryMapEntries.map(([name, url]) => `- "${name}": ${url}`).join('\n')}`);
  }

  if (params.socialProofImageUrls && params.socialProofImageUrls.length > 0) {
    assetSlots.push(`### PROVA SOCIAL REAL (use em image_gallery ou testimonials.image):
${params.socialProofImageUrls.map((url: string, i: number) => `${i + 1}. ${url}`).join('\n')}`);
  }

  if (assetSlots.length > 0) {
    dataSections.push(`## 🎯 ASSETS DISPONÍVEIS:\n${assetSlots.join('\n\n')}`);
  }

  if (reviewsInfo) dataSections.push(`## AVALIAÇÕES REAIS (use no testimonials):\n${reviewsInfo}`);
  if (creativesInfo) dataSections.push(`## REFERÊNCIAS DE MARKETING:\n${creativesInfo}`);
  if (referenceUrl) dataSections.push(`## URL DE REFERÊNCIA (apenas inspiração de layout):\n${referenceUrl}`);
  if (currentBlocks) dataSections.push(`## ESTRUTURA ATUAL (para ajustes):\n${currentBlocks}`);

  // === H. BLOCK PROPS DOCUMENTATION ===
  sections.push(getBlockPropsDocumentation());

  return `${sections.join('\n\n---\n\n')}

---

${dataSections.join('\n\n')}

---

IMPORTANTE: Chame a função build_landing_page com a estrutura completa de seções. NÃO escreva HTML. NÃO escreva texto fora da chamada de função.`;
}

const TEMPLATE_REGISTRY_NAMES: Record<string, string> = {
  lp_captura: 'Lead Capture Curta',
  lp_whatsapp: 'WhatsApp Push',
  lp_produto_fisico: 'Produto Físico / DTC',
  lp_click_through: 'Click-Through para Checkout',
  sales_page_longa: 'Sales Page Longa',
  lp_servico_premium: 'Serviço / Consultoria Premium',
  lp_saas: 'SaaS / Software',
};

// ========== STRUCTURED RESPONSE PARSER ==========

interface ParsedResponse {
  diagnostic: Record<string, any> | null;
  html: string;
  parseError?: string;
}

function parseStructuredResponse(raw: string): ParsedResponse {
  let diagnostic: Record<string, any> | null = null;
  let html = '';
  let parseError: string | undefined;

  // Try to extract JSON block: ```json ... ```
  const jsonMatch = raw.match(/```json\s*\n?([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      diagnostic = JSON.parse(jsonMatch[1].trim());
      console.log("[AI-LP-Generate] Diagnostic JSON parsed successfully");
    } catch (e) {
      parseError = `JSON parse failed: ${(e as Error).message}`;
      console.warn("[AI-LP-Generate] " + parseError);
    }
  } else {
    parseError = 'No ```json block found in response';
    console.warn("[AI-LP-Generate] " + parseError);
  }

  // Try to extract HTML block: ```html ... ```
  const htmlMatch = raw.match(/```html\s*\n?([\s\S]*?)```/);
  if (htmlMatch) {
    html = htmlMatch[1].trim();
    console.log("[AI-LP-Generate] HTML block extracted from structured response");
  } else {
    // Fallback: treat everything as HTML (compatibility)
    html = raw.replace(/```json\s*\n?[\s\S]*?```/g, '').trim();
    // Clean markdown wrappers
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!parseError) parseError = 'No ```html block found — used raw content as HTML';
    console.warn("[AI-LP-Generate] Fallback: treating response as raw HTML");
  }

  // === V4.2: ENFORCE BODY-ONLY CONTRACT ===
  const hasShell = /<!DOCTYPE|<html[\s>]|<head[\s>]/i.test(html);
  if (hasShell) {
    console.warn("[AI-LP-Generate] outputContractViolation: AI sent document shell, stripping...");
    // Try to extract <body> content first
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      html = bodyMatch[1].trim();
      console.log("[AI-LP-Generate] Extracted content from <body> tag");
    } else {
      // No <body> — strip known shell tags and use remaining content
      html = html
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .trim();
      console.log("[AI-LP-Generate] No <body> found — stripped shell tags, using remaining content");
    }
    parseError = (parseError ? parseError + '; ' : '') + 'outputContractViolation: AI sent document shell, extracted body content';
  }

  return { diagnostic, html, parseError };
}

// ========== V4.2: WRAP IN DOCUMENT SHELL ==========

/**
 * Wraps AI-generated section content in a full HTML document.
 * The backend is 100% authoritative over the document shell.
 * AI returns only sections; this function adds: head, fonts, CSS utilities, safety CSS, pixels, favicon, auto-resize.
 */
function wrapInDocumentShell(sectionHtml: string, options: {
  pixelScripts?: string;
  faviconTag?: string;
}): string {
  const cssUtilities = `
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse-cta { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.animate-section { animation: fadeInUp 0.8s ease-out forwards; }
.glass-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 80px 0; }
/* CTA constraints (v4.3) */
.cta-button, [class*="cta"], a[style*="padding"][style*="background"] {
  max-width: 400px; font-size: clamp(14px, 1.1vw, 18px); padding: 14px 32px;
  border-radius: 8px; display: inline-block; box-sizing: border-box;
}
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  h1 { font-size: 1.75rem !important; line-height: 1.2 !important; }
  h2 { font-size: 1.4rem !important; }
  h3 { font-size: 1.15rem !important; }
  p, li, span { font-size: 15px !important; }
  .section { padding: 48px 0 !important; }
  .container { padding: 0 16px !important; }
  /* Force single column on grids with 3+ columns, preserve 2-col */
  [style*="grid-template-columns: repeat(3"], [style*="grid-template-columns: repeat(4"],
  [style*="grid-template-columns: repeat(5"], [style*="grid-template-columns: repeat(6"] {
    grid-template-columns: 1fr !important;
  }
  [style*="grid-template-columns: 1fr 1fr 1fr"], [style*="grid-template-columns:1fr 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
  /* Grid catch-all removed in v4.2 — selective rules above handle 3+ columns correctly */
  .comparison-table-wrapper { overflow-x: auto; }
  .cta-button, [class*="cta"], a[style*="padding"][style*="background"] {
    max-width: 100% !important; width: 100% !important; text-align: center !important;
    padding: 14px 24px !important; font-size: 16px !important; display: block !important;
  }
  img { max-width: 100% !important; height: auto !important; }
  /* Prevent horizontal overflow */
  * { max-width: 100vw; }
  [style*="position: absolute"], [style*="position:absolute"] { max-width: 100% !important; }
}`;

  const safetyCss = `
/* Only fix stuck animations with fill-mode both/forwards */
[style*="animation-fill-mode: both"], [style*="animation-fill-mode: forwards"],
[style*="animation-fill-mode:both"], [style*="animation-fill-mode:forwards"] {
  animation-fill-mode: none !important;
}
section, .section, .hero, [class*="hero"] { min-height: auto !important; }
html, body { overflow-x: hidden !important; max-width: 100% !important; }
.cta-button { cursor: pointer; }`;

  const autoResizeScript = `
<script>
(function(){
  var locked = false;
  var lastH = 0;
  var stableCount = 0;
  function sendHeight(){
    if(locked) return;
    try {
      var h = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0
      );
      if(h > 0 && Math.abs(h - lastH) > 2){
        stableCount = 0;
        lastH = h;
        window.parent.postMessage({type:'ai-lp-resize', height: h}, '*');
      } else if(h > 0) {
        stableCount++;
        if(stableCount >= 3) { locked = true; }
      }
    } catch(e){}
  }
  sendHeight();
  setTimeout(sendHeight, 200);
  setTimeout(sendHeight, 600);
  setTimeout(sendHeight, 1500);
  setTimeout(sendHeight, 3000);
  var imgs = document.querySelectorAll('img');
  imgs.forEach(function(img){
    if(!img.complete){ img.addEventListener('load', function(){ sendHeight(); }, {once:true}); }
  });
})();
</script>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style id="lp-utilities">${cssUtilities}</style>
  <style id="lp-safety">${safetyCss}</style>
  ${options.faviconTag || ''}
  ${options.pixelScripts || ''}
</head>
<body style="margin:0;overflow-x:hidden">
  ${sectionHtml}
  ${autoResizeScript}
</body>
</html>`;
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[AI-LP-Generate v${VERSION}] Starting...`);

  try {
    const body: GenerateRequest = await req.json();
    let { landingPageId, tenantId, userId, prompt, promptType, referenceUrl, productIds, briefing } = body;

    if (!landingPageId || !tenantId || !userId || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ALWAYS fetch the landing page
    const { data: savedLandingPage, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, reference_url, generated_html, current_version, show_header, show_footer, briefing")
      .eq("id", landingPageId)
      .single();

    if (lpError) { console.error("[AI-LP-Generate] Error fetching landing page:", lpError); throw new Error("Landing page not found"); }

    productIds = productIds && productIds.length > 0 ? productIds : (savedLandingPage?.product_ids || []);
    referenceUrl = referenceUrl || savedLandingPage?.reference_url || undefined;
    // Use briefing from request, or from saved LP, or null
    briefing = briefing || (savedLandingPage?.briefing as BriefingInput | null) || undefined;

    console.log(`[AI-LP-Generate] Using ${productIds?.length || 0} products, referenceUrl: ${referenceUrl ? 'yes' : 'no'}, briefing: ${briefing ? 'provided' : 'defaults'}`);

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, logo_url, primary_color, secondary_color, accent_color, favicon_url, contact_phone, contact_email, published_template_id")
      .eq("tenant_id", tenantId)
      .single();

    // Fetch published theme colors
    let themeColors: Record<string, string> = {};
    if (storeSettings?.published_template_id) {
      const { data: templateSet } = await supabase
        .from("storefront_template_sets")
        .select("published_content")
        .eq("id", storeSettings.published_template_id)
        .eq("tenant_id", tenantId)
        .single();
      if (templateSet?.published_content) {
        const pc = templateSet.published_content as Record<string, any>;
        const ts = pc?.themeSettings?.colors;
        if (ts) { themeColors = ts; }
      }
    }

    // ===== STEP 1: FETCH PRODUCTS =====
    let productsInfo = "";
    let productImages: string[] = [];
    let productNames: string[] = [];
    let productPrimaryImageMap: Record<string, string> = {};
    let firstProduct: { name: string; product_type: string | null; tags: string[] | null; description: string | null; price: number | null } | null = null;
    let reviewCount = 0;

    if (productIds && productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, slug, sku, description, short_description, price, compare_at_price, cost_price, brand, vendor, product_type, tags, weight, width, height, depth, seo_title, seo_description")
        .in("id", productIds);

      if (productsError) console.error("[AI-LP-Generate] Error fetching products:", productsError);

      if (products && products.length > 0) {
        productNames = products.map(p => p.name);
        const fp = products[0];
        firstProduct = { name: fp.name, product_type: fp.product_type, tags: fp.tags, description: fp.description, price: fp.price };

        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url, is_primary, alt_text, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        const imagesByProduct = new Map<string, { url: string; alt_text: string | null; is_primary: boolean }[]>();
        images?.forEach(img => {
          if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
          imagesByProduct.get(img.product_id)!.push({ url: img.url, alt_text: img.alt_text, is_primary: img.is_primary });
        });

        productsInfo = products.map(p => {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImage = prodImages.find(img => img.is_primary)?.url || prodImages[0]?.url;
          const allImageUrls = prodImages.map(img => img.url);
          if (primaryImage) {
            productImages.push(primaryImage);
            productPrimaryImageMap[p.name] = primaryImage;
          }
          allImageUrls.forEach(url => { if (url && !productImages.includes(url)) productImages.push(url); });

          const priceInReais = p.price;
          const compareAtPriceInReais = p.compare_at_price || null;
          const discountPercent = compareAtPriceInReais && compareAtPriceInReais > priceInReais
            ? Math.round(((compareAtPriceInReais - priceInReais) / compareAtPriceInReais) * 100)
            : null;

          return `### Produto: ${p.name}
- **SKU**: ${p.sku || "N/A"}
- **Slug (URL)**: ${p.slug || "N/A"}
- **Descrição Curta**: ${p.short_description || "Sem descrição curta"}
- **Descrição Completa**: ${p.description || "Sem descrição disponível"}
- **Preço de Venda**: R$ ${priceInReais.toFixed(2).replace('.', ',')}
${compareAtPriceInReais ? `- **Preço Original (riscado)**: R$ ${compareAtPriceInReais.toFixed(2).replace('.', ',')}` : ""}
${discountPercent ? `- **Desconto**: ${discountPercent}% OFF` : ""}
${p.brand ? `- **Marca**: ${p.brand}` : ""}
${p.vendor ? `- **Fornecedor**: ${p.vendor}` : ""}
${p.product_type ? `- **Tipo de Produto**: ${p.product_type}` : ""}
${p.tags && p.tags.length > 0 ? `- **Tags**: ${p.tags.join(", ")}` : ""}
${p.weight ? `- **Peso**: ${p.weight}g` : ""}
- **Imagem Principal**: ${primaryImage || "SEM IMAGEM"}
- **TODAS AS IMAGENS**: 
${allImageUrls.length > 0 ? allImageUrls.map((url, i) => `  ${i + 1}. ${url}`).join("\n") : "  NENHUMA IMAGEM"}`;
        }).join("\n\n");

        // ===== STEP 1B: AUTO-DISCOVER RELATED KITS =====
        // Find kits (with_composition) that contain ANY of the selected products as components
        try {
          const { data: relatedKits } = await supabase
            .from("product_components")
            .select("parent_product_id, quantity, component_product_id")
            .in("component_product_id", productIds);

          if (relatedKits && relatedKits.length > 0) {
            const kitParentIds = [...new Set(relatedKits.map((r: any) => r.parent_product_id))].filter(
              (id: string) => !productIds!.includes(id) // exclude already-selected products
            ).slice(0, 6); // Limit to 6 most relevant kits to keep prompt lean

            if (kitParentIds.length > 0) {
              const { data: kitProducts } = await supabase
                .from("products")
                .select("id, name, slug, sku, price, compare_at_price, product_format, status")
                .in("id", kitParentIds)
                .eq("product_format", "with_composition")
                .eq("status", "active")
                .is("deleted_at", null);

              if (kitProducts && kitProducts.length > 0) {
                // Fetch primary images for kits
                const kitIds = kitProducts.map((k: any) => k.id);
                const { data: kitImages } = await supabase
                  .from("product_images")
                  .select("product_id, url, is_primary, sort_order")
                  .in("product_id", kitIds)
                  .order("is_primary", { ascending: false })
                  .order("sort_order", { ascending: true });

                const kitImageMap = new Map<string, string>();
                kitImages?.forEach((img: any) => {
                  if (!kitImageMap.has(img.product_id)) {
                    kitImageMap.set(img.product_id, img.url);
                  }
                });

                // Add kits to productsInfo and productPrimaryImageMap
                const kitInfoParts: string[] = [];
                for (const kit of kitProducts) {
                  const kitPrimaryImage = kitImageMap.get(kit.id);
                  if (kitPrimaryImage) {
                    productPrimaryImageMap[kit.name] = kitPrimaryImage;
                    if (!productImages.includes(kitPrimaryImage)) productImages.push(kitPrimaryImage);
                  }
                  if (!productNames.includes(kit.name)) productNames.push(kit.name);

                  const kitCompare = kit.compare_at_price || null;
                  const kitDiscount = kitCompare && kitCompare > kit.price
                    ? Math.round(((kitCompare - kit.price) / kitCompare) * 100)
                    : null;

                  kitInfoParts.push(`### Kit Relacionado: ${kit.name}
- **SKU**: ${kit.sku || "N/A"}
- **Preço de Venda**: R$ ${kit.price.toFixed(2).replace('.', ',')}
${kitCompare ? `- **Preço Original (riscado)**: R$ ${kitCompare.toFixed(2).replace('.', ',')}` : ""}
${kitDiscount ? `- **Desconto**: ${kitDiscount}% OFF` : ""}
- **Formato**: Kit com composição
- **Imagem Principal**: ${kitPrimaryImage || "SEM IMAGEM"}`);
                }

                if (kitInfoParts.length > 0) {
                  productsInfo += "\n\n## KITS QUE CONTÊM ESTE PRODUTO (use nas ofertas/pricing):\n\n" + kitInfoParts.join("\n\n");
                }

                console.log(`[AI-LP-Generate] Auto-discovered ${kitProducts.length} related kits with images`);
              }
            }
          }
        } catch (kitErr) {
          console.warn("[AI-LP-Generate] Kit discovery error (non-blocking):", kitErr);
        }
      }
    }

    // ===== STEP 2: BUSINESS CONTEXT =====
    let reviewsInfo = "";
    let creativesInfo = "";

    if (productIds && productIds.length > 0) {
      const { data: reviews } = await supabase
        .from("product_reviews")
        .select("reviewer_name, rating, comment, product_id")
        .in("product_id", productIds)
        .eq("status", "approved")
        .order("rating", { ascending: false })
        .limit(10);

      if (reviews && reviews.length > 0) {
        reviewsInfo = reviews.map(r => `- ⭐ ${r.rating}/5 — "${r.comment}" (${r.reviewer_name || 'Cliente'})`).join("\n");
        reviewCount = reviews.length;
      }
    }

    const { data: creatives } = await supabase
      .from("ads_creative_assets")
      .select("headline, copy_text, angle, funnel_stage, format")
      .eq("tenant_id", tenantId)
      .in("status", ["ready", "published"])
      .not("copy_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (creatives && creatives.length > 0) {
      creativesInfo = creatives.map(c => {
        const parts = [];
        if (c.headline) parts.push(`Headline: "${c.headline}"`);
        if (c.copy_text) parts.push(`Copy: "${c.copy_text.slice(0, 200)}"`);
        if (c.angle) parts.push(`Ângulo: ${c.angle}`);
        return `- ${parts.join(" | ")}`;
      }).join("\n");
    }

    // ===== STEP 3: SOCIAL PROOF =====
    let socialProofImageUrls: string[] = [];

    if (productIds && productIds.length > 0 && promptType !== "adjustment") {
      // Search for folders with social proof content (feedback, reviews, results, proofs)
      try {
        const { data: proofFolders } = await supabase
          .from("files")
          .select("id, filename, storage_path")
          .eq("tenant_id", tenantId)
          .eq("is_folder", true)
          .or("filename.ilike.%feedback%,filename.ilike.%review%,filename.ilike.%prova%,filename.ilike.%resultado%,filename.ilike.%depoimento%,filename.ilike.%antes%depois%")
          .limit(10);

        if (proofFolders && proofFolders.length > 0) {
          console.log(`[AI-LP-Generate] Found ${proofFolders.length} social proof folders`);
          const folderPaths = proofFolders.map((f: any) => f.storage_path || `drive/${tenantId}/${f.filename}`);
          
          const orConditions = folderPaths.map((fp: string) => `storage_path.like.${fp}/%`).join(",");
          const { data: proofFiles } = await supabase
            .from("files")
            .select("id, original_name, storage_path, mime_type, metadata")
            .eq("tenant_id", tenantId)
            .eq("is_folder", false)
            .ilike("mime_type", "image/%")
            .or(orConditions)
            .order("created_at", { ascending: false })
            .limit(10);

          if (proofFiles && proofFiles.length > 0) {
            for (const file of proofFiles.slice(0, 5)) {
              try {
                const meta = file.metadata as Record<string, any> | null;
                let imageUrl = meta?.url as string | undefined;
                if (!imageUrl) {
                  const bucket = (meta?.bucket as string) || 'tenant-files';
                  if (bucket === 'tenant-files') {
                    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
                    imageUrl = signedData?.signedUrl;
                  } else {
                    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
                    imageUrl = pubData?.publicUrl;
                  }
                }
                if (imageUrl) {
                  socialProofImageUrls.push(imageUrl);
                }
              } catch (spErr) { console.warn("[AI-LP-Generate] Social proof file error:", spErr); }
            }
            console.log(`[AI-LP-Generate] Found ${socialProofImageUrls.length} social proof images`);
          }
        }
      } catch (spSearchErr) { console.warn("[AI-LP-Generate] Social proof search error:", spSearchErr); }
    }

    // NOTE: Image generation (lifestyle/hero) removed in v5.1 — uses catalog images directly
    // This saves ~60-90s of timeout-prone AI image generation calls

    // ===== STEP 7: RESOLVE ENGINE PLAN =====
    const enginePlan = resolveEnginePlan({
      briefing: briefing || null,
      productType: firstProduct?.product_type,
      tags: firstProduct?.tags,
      description: firstProduct?.description,
      price: firstProduct?.price,
      reviewCount,
    });

    console.log(`[AI-LP-Generate] Engine Plan: archetype=${enginePlan.resolvedArchetype}, niche=${enginePlan.resolvedNiche}, depth=${enginePlan.resolvedDepth}, visual=${enginePlan.resolvedVisualWeight}, proof=${enginePlan.proofStrength}, assumptions=${enginePlan.assumptions.length}`);

    // ===== STEP 8: BUILD V5 PROMPT =====
    let currentBlocks = "";
    if (promptType === "adjustment") {
      // For adjustments, pass current blocks as context
      const currentBlocksData = savedLandingPage?.generated_blocks;
      if (currentBlocksData) {
        currentBlocks = JSON.stringify(currentBlocksData, null, 2);
      } else if (savedLandingPage?.generated_html) {
        currentBlocks = "[Legacy HTML - regenerate from scratch]";
      }
    }

    const systemPrompt = buildV5SystemPrompt({
      enginePlan,
      storeName: storeSettings?.store_name || "Loja",
      logoUrl: storeSettings?.logo_url || "",
      primaryColor: storeSettings?.primary_color || "#6366f1",
      secondaryColor: storeSettings?.secondary_color,
      accentColor: storeSettings?.accent_color,
      themeColors,
      productsInfo,
      productImages,
      productNames,
      productPrimaryImageMap,
      reviewsInfo,
      creativesInfo,
      generatedCreativeUrls,
      lifestyleImageUrls,
      socialProofImageUrls,
      referenceUrl,
      currentBlocks,
    });

    // ===== STEP 9: ENRICH PROMPT IF INCOMPLETE =====
    let enrichedPrompt = prompt;
    let fallbackUsed: string | null = null;

    if (promptType !== "adjustment" && isPromptIncomplete(prompt)) {
      const bestFallback = selectBestFallback(
        firstProduct?.product_type,
        firstProduct?.tags,
        firstProduct?.description,
        firstProduct?.name,
      );
      fallbackUsed = bestFallback.id;
      enrichedPrompt = `${prompt}\n\nDIREÇÃO CRIATIVA: ${bestFallback.prompt}`;
      console.log(`[AI-LP-Generate] Prompt enriched with fallback "${bestFallback.id}"`);
    }

    const hasUserMedia = prompt.includes("[Imagem:") || prompt.includes("[Vídeo:");
    const userMediaNote = hasUserMedia ? `\nAs URLs marcadas como [Imagem: URL] DEVEM ser usadas nos blocos.` : "";

    const userPrompt = promptType === "adjustment"
      ? `Ajuste a landing page:\n\n${prompt}${userMediaNote}\n\nChame build_landing_page com a estrutura completa atualizada.`
      : `Crie uma landing page de alta conversão:\n\n${enrichedPrompt}${userMediaNote}`;

    // ===== STEP 10: CALL AI WITH TOOL CALLING =====
    console.log(`[AI-LP-Generate v${VERSION}] Calling AI with tool calling for ${promptType}...`);
    resetAIRouterCache();

    const aiResponse = await aiChatCompletion("google/gemini-2.5-pro", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [BLOCK_TOOL_DEFINITION],
      tool_choice: { type: "function", function: { name: "build_landing_page" } },
      temperature: 0.7,
    }, {
      supabaseUrl,
      supabaseServiceKey: supabaseKey,
      logPrefix: "[AI-LP-Generate]",
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[AI-LP-Generate] AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // ===== STEP 11: PARSE TOOL CALL RESPONSE =====
    let toolCallOutput: any = null;
    let parseError: string | null = null;

    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const buildCall = toolCalls.find((tc: any) => tc.function?.name === "build_landing_page");
      if (buildCall) {
        try {
          toolCallOutput = JSON.parse(buildCall.function.arguments);
          console.log(`[AI-LP-Generate] Tool call parsed: ${toolCallOutput.sections?.length || 0} sections`);
        } catch (e) {
          parseError = `Tool call JSON parse failed: ${(e as Error).message}`;
          console.error("[AI-LP-Generate] " + parseError);
        }
      } else {
        parseError = "AI called wrong function";
        console.warn("[AI-LP-Generate] " + parseError);
      }
    } else {
      // Fallback: try to parse from content (some models return JSON in content)
      const rawContent = aiData.choices?.[0]?.message?.content || "";
      if (rawContent) {
        try {
          const jsonMatch = rawContent.match(/\{[\s\S]*"sections"[\s\S]*\}/);
          if (jsonMatch) {
            toolCallOutput = JSON.parse(jsonMatch[0]);
            parseError = "Extracted from content (no tool_calls)";
            console.warn("[AI-LP-Generate] " + parseError);
          }
        } catch (e) {
          parseError = "No tool_calls and content parse failed";
          console.error("[AI-LP-Generate] " + parseError);
        }
      }
      if (!toolCallOutput) {
        parseError = "AI did not use tool calling";
        console.error("[AI-LP-Generate] " + parseError);
      }
    }

    if (!toolCallOutput || !toolCallOutput.sections || toolCallOutput.sections.length === 0) {
      throw new Error("AI failed to generate page structure: " + (parseError || "empty output"));
    }

    // ===== STEP 12: ASSEMBLE BLOCK TREE =====
    const blockTree = assembleBlockTree(toolCallOutput);
    console.log(`[AI-LP-Generate] Block tree assembled: ${blockTree.children?.length || 0} children (incl header/footer)`);

    // ===== STEP 13: PERSIST =====
    const newVersion = (savedLandingPage?.current_version || 0) + 1;

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_blocks: blockTree,
        generated_html: null, // V5: blocks take priority, clear legacy HTML
        current_version: newVersion,
        status: "draft",
        metadata: {
          engineVersion: "v5.0",
          briefingSchemaVersion: "1.0",
          enginePlanInput: enginePlan,
          toolCallSections: toolCallOutput.sections?.length || 0,
          parseError: parseError || null,
          fallbackPromptUsed: fallbackUsed,
        },
      })
      .eq("id", landingPageId);

    if (updateError) { console.error("[AI-LP-Generate] Update error:", updateError); throw updateError; }

    const { error: versionError } = await supabase
      .from("ai_landing_page_versions")
      .insert({
        landing_page_id: landingPageId,
        tenant_id: tenantId,
        version: newVersion,
        prompt,
        prompt_type: promptType,
        html_content: JSON.stringify(blockTree), // Store block JSON in html_content for compatibility
        blocks_content: blockTree,
        created_by: userId,
        generation_metadata: {
          engineVersion: "v5.0",
          model: "google/gemini-2.5-pro",
          tool_calling: true,
          sections_count: toolCallOutput.sections?.length || 0,
          product_count: productIds?.length || 0,
          reviews_count: reviewCount,
          drive_references_used: driveReferenceBase64s.length,
          lifestyle_images_generated: lifestyleImageUrls.length,
          fallback_prompt_used: fallbackUsed,
          parseError: parseError || null,
        },
      });

    if (versionError) console.error("[AI-LP-Generate] Version error:", versionError);

    console.log(`[AI-LP-Generate v${VERSION}] Success! Version ${newVersion}, ${toolCallOutput.sections?.length} sections`);

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        sectionsCount: toolCallOutput.sections?.length || 0,
        engineVersion: "v5.0",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LP-Generate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
