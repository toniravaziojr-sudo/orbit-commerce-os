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

const VERSION = "4.2.0"; // Engine V4.2: body-only contract + wrapInDocumentShell + layout hard checks + parser enforcement

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

function buildModularPrompt(params: {
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
  reviewsInfo: string;
  creativesInfo: string;
  generatedCreativeUrls: string[];
  lifestyleImageUrls: string[];
  referenceUrl?: string;
  currentHtml?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}): string {
  const {
    enginePlan, storeName, logoUrl, primaryColor, secondaryColor, accentColor,
    themeColors, productsInfo, productImages, productNames, reviewsInfo,
    creativesInfo, generatedCreativeUrls, lifestyleImageUrls,
    referenceUrl, currentHtml, showHeader, showFooter,
  } = params;

  const sections: string[] = [];

  // === A. AUTHORITATIVE CONTEXT (non-negotiable) ===
  sections.push(`## ⚡ CONTEXTO AUTORITATIVO (NÃO NEGOCIÁVEL)

As seguintes decisões foram tomadas pelo sistema e NÃO podem ser alteradas pela IA:

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
${enginePlan.briefing.restrictions?.length ? `- **Restrições**: ${enginePlan.briefing.restrictions.join(', ')}` : ''}

ESTAS DECISÕES SÃO FINAIS. Siga-as à risca.`);

  // === B. SECTION ENGINE ===
  sections.push(`## 📐 SECTION ENGINE

Siga a ordem de seções especificada acima. Cada seção deve ter:
- Um ID ou class CSS identificável (ex: class="hero", class="beneficios")
- Transição visual clara entre seções
- Padding consistente (80px desktop, 48px mobile)

### Seções Obrigatórias (DEVEM estar presentes):
${enginePlan.requiredSections.map(s => `- **${s}**`).join('\n')}

### Seções Opcionais (inclua se a profundidade permitir):
${enginePlan.optionalSections.map(s => `- ${s}`).join('\n')}`);

  // === C. NICHE RULES (only for detected niche) ===
  sections.push(getNicheRules(enginePlan.resolvedNiche));

  // === D. TRAFFIC STRATEGY ===
  sections.push(getTrafficRules(enginePlan.briefing.trafficSource));

  // === E. AWARENESS COPY RULES ===
  sections.push(getAwarenessCopyRules(enginePlan.briefing.awarenessLevel));

  // === F. VISUAL ENGINE ===
  sections.push(`## 🎨 VISUAL ENGINE

### Cor Primária da Marca: ${primaryColor}
${secondaryColor ? `Cor Secundária: ${secondaryColor}` : ''}
${accentColor ? `Cor de Acento: ${accentColor}` : ''}
${themeColors.buttonPrimaryBg ? `Cor Botão Primário: ${themeColors.buttonPrimaryBg}` : ''}
${themeColors.buttonPrimaryText ? `Texto Botão: ${themeColors.buttonPrimaryText}` : ''}
${themeColors.priceColor ? `Cor do Preço: ${themeColors.priceColor}` : ''}

### Peso Visual: ${enginePlan.resolvedVisualWeight}
${enginePlan.resolvedVisualWeight === 'minimalista' ? '- Whitespace generoso, poucos elementos, tipografia elegante, paleta neutra' : ''}
${enginePlan.resolvedVisualWeight === 'comercial' ? '- Badges, selos, urgência visual, preço em destaque, CTAs vibrantes' : ''}
${enginePlan.resolvedVisualWeight === 'premium' ? '- Dark mode ou neutro escuro, tipografia sofisticada, gradientes sutis, gold accents' : ''}
${enginePlan.resolvedVisualWeight === 'direto' ? '- Layout simples, foco no essencial, sem ornamentos, CTAs claros' : ''}
${enginePlan.resolvedVisualWeight === 'informativo' ? '- Layout organizado, ícones, features em grid, specs técnicas, screenshots' : ''}

### Regras de Cores:
- USE as cores da marca como base para CTAs, badges, gradientes
- NÃO invente cores aleatórias que não fazem parte da identidade
- A paleta deve parecer extensão natural do site/loja

### Layout do HERO (escolha o mais adequado ao nicho):
- **Split Layout**: texto à esquerda, produto à direita (ideal para cosméticos, alimentos)
- **Hero Clean**: fundo sólido/gradiente, produto centralizado (ideal para tech, moda)
- **Background Composicional**: imagem lifestyle como fundo com overlay (ideal para urgência)

### Responsividade Mobile (CRÍTICA):
- Todas as grids 2+ colunas DEVEM empilhar em 1 coluna em < 768px
- CTAs width: 100% no mobile
- Tabelas com overflow-x: auto
- NUNCA use vw para font-size

### Logo: ${logoUrl || 'Sem logo'}
- Analise contraste do fundo para decidir tratamento da logo
- Max-width: 200px, height: auto
- Em fundo escuro: use diretamente ou com filter: brightness(1.3)
- Em fundo claro: envolva em container com fundo escuro harmonizado se necessário`);

  // === G. COPY ENGINE (moved outside visual) ===
  sections.push(`## ✍️ COPY ENGINE

### Emojis — Uso Inteligente:
- Use para checkmarks (✅), ícones de benefício (🛡️, 🚚, ⭐) quando fizerem sentido
- NÃO encha a página — máximo 5-8 por página
- Prefira ícones CSS/SVG quando disponíveis
- Aparência PROFISSIONAL — emojis complementam, não dominam

### Hero Copy — Técnica PAS:
- Headline: frase de impacto que ataca a DOR do cliente
- Sub-headline: agita o problema e apresenta a solução
- CTA primário: verbo de ação + benefício ("${enginePlan.defaultCTA}")

### Regras Gerais de Copy:
- Headlines com NÚMEROS ESPECÍFICOS e power words
- Bullets de benefícios com ✓ — foque em RESULTADOS, não features
- Garantia junto ao preço
- NUNCA use "Lorem ipsum" ou texto genérico`);

  // === H. ANTI-PADRÕES ===
  const restrictionRules = enginePlan.briefing.restrictions?.map(r => {
    if (r === 'no_countdown') return '- ❌ NÃO inclua countdown timers ou contadores regressivos';
    if (r === 'no_video') return '- ❌ NÃO inclua seções de vídeo ou embeds de YouTube';
    if (r === 'no_comparisons') return '- ❌ NÃO inclua tabelas comparativas ou "vs concorrente"';
    return '';
  }).filter(Boolean).join('\n') || '';

  sections.push(`## 🚫 ANTI-PADRÕES

### PROIBIÇÕES ABSOLUTAS:
- NUNCA invente nomes de produto — use EXATAMENTE os nomes fornecidos
- NUNCA use placeholder.com, via.placeholder, unsplash ou imagens genéricas
- NUNCA use imgur.com, postimg.cc, imgbb.com, cloudinary.com ou qualquer host externo de imagens — use APENAS as URLs fornecidas
- NUNCA use Lorem ipsum ou texto placeholder
- NUNCA deixe tags HTML visíveis como texto
- NUNCA inclua header/navegação (a plataforma renderiza automaticamente)
- NUNCA inclua <footer>, rodapé ou seção de copyright (a plataforma renderiza o footer)
- NUNCA use badges "OFERTA LIMITADA", "PROMOÇÃO" ou selos de urgência a menos que o produto tenha compare_at_price (preço riscado) real
- NUNCA use imagens de catálogo (fundo branco) como hero/background quando existem criativos gerados
${restrictionRules}

### NOMES DE PRODUTOS (COPIE LETRA POR LETRA):
${productNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')}

### VERIFICAÇÃO OBRIGATÓRIA:
1. O <title> contém "${productNames[0] || 'Produto'}"
2. A H1 usa o nome exato do produto
3. TODAS as menções usam o nome correto
4. NENHUM nome inventado aparece no HTML`);

  // === I. QUALITY ENGINE ===
  sections.push(`## 📊 QUALITY ENGINE

Antes de finalizar, faça uma autoavaliação (0-100) considerando:
- Fidelidade ao nome do produto (0-20)
- Uso correto das imagens fornecidas (0-20)
- Qualidade do copy PAS (0-20)
- Responsividade mobile (0-20)
- Coerência visual com a marca (0-20)

Inclua no bloco JSON: score total, risks (pontos fracos), strengths (pontos fortes).`);

  // === J. OUTPUT FORMAT (V4.2: body-only contract) ===
  sections.push(`## 📤 FORMATO DE SAÍDA (OBRIGATÓRIO)

Retorne EXATAMENTE dois blocos separados e fechados:

1. Bloco JSON com diagnóstico:
\`\`\`json
{
  "diagnostic": {
    "archetype": "${enginePlan.resolvedArchetype}",
    "depth": "${enginePlan.resolvedDepth}",
    "cta_primary": "${enginePlan.defaultCTA}",
    "sections_used": ["hero", "..."],
    "score": { "total": 85, "product_fidelity": 20, "image_usage": 18, "copy_quality": 17, "mobile": 15, "brand_coherence": 15 },
    "risks": ["risk1", "risk2"],
    "strengths": ["strength1", "strength2"],
    "alt_headline": "Headline alternativa",
    "alt_cta": "CTA alternativo"
  }
}
\`\`\`

2. Bloco HTML — APENAS conteúdo das seções (body-only):
\`\`\`html
<style>
  /* CSS específico desta landing page */
</style>
<section class="hero">...</section>
<section class="beneficios">...</section>
...último CTA...
\`\`\`

### REGRAS DO FORMATO HTML:
- Comece na primeira <section> (Hero)
- Termine no último CTA ou seção de conteúdo
- NÃO inclua <!DOCTYPE>, <html>, <head>, <body> — o sistema monta o documento completo
- Inclua um único bloco <style> no início com os CSS específicos desta LP
- O sistema adicionará: charset, viewport, fonts, CSS utilities, safety CSS, favicon, pixels e auto-resize

AMBOS os blocos são obrigatórios. O JSON vem PRIMEIRO, o HTML SEGUNDO.`);

  // === HEADER/FOOTER RULES ===
  // === HEADER/FOOTER — ALWAYS PROHIBITED (v4.1) ===
  // The platform ALWAYS renders header/footer separately.
  // The AI must NEVER generate footer content — it creates duplication and layout breaks.
  sections.push(`## ⚠️ HEADER E FOOTER — PROIBIÇÃO ABSOLUTA
A plataforma renderiza header e footer automaticamente.
- NÃO inclua NENHUM header, navegação, menu ou barra de topo
- NÃO inclua NENHUM footer, rodapé, copyright, links de rodapé ou seção final com "©"
- NÃO inclua tags <header>, <footer> ou <nav> de nível superior
- Comece DIRETO no Hero e termine no último CTA ou seção de conteúdo
- A última seção DEVE ser um CTA de conversão, NÃO informação institucional

### PROIBIÇÃO DE CONTEÚDO SEMÂNTICO DE RODAPÉ:
A IA NÃO deve gerar nenhum dos itens abaixo, mesmo sem usar a tag <footer>:
- Seções com dados de SAC, contato institucional, telefone/email de suporte
- Blocos de redes sociais (Instagram, Facebook, Twitter, TikTok)
- "Menu Footer", links institucionais ("Política de Privacidade", "Termos de Uso", "Sobre Nós")
- Endereço físico, CNPJ, razão social como seção de fechamento
- Qualquer seção que funcione como rodapé de um site — isso é responsabilidade da PLATAFORMA
- A última seção da landing page DEVE ser um CTA de conversão com botão de ação`);

  // === DATA SECTIONS ===
  const dataSections: string[] = [];

  dataSections.push(`## Informações da Loja
- Nome: ${storeName}
- Logo: ${logoUrl || 'Sem logo'}
- Cor Principal: ${primaryColor}`);

  if (productsInfo) dataSections.push(`## PRODUTOS A SEREM DESTACADOS:\n${productsInfo}`);
  else dataSections.push(`## ATENÇÃO: Nenhum produto selecionado. Crie uma landing page genérica para a loja.`);

  // === IMAGE PRIORITY SYSTEM (v4.1) ===
  // Generated creatives and lifestyle images ALWAYS take priority over catalog images
  // Catalog images are only used as fallback when no creatives were generated

  if (generatedCreativeUrls.length > 0) {
    dataSections.push(`## 🎨 IMAGENS CRIATIVAS GERADAS (PRIORIDADE MÁXIMA — USE ESTAS):
${generatedCreativeUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

REGRA: Use como IMAGEM PRINCIPAL no HERO e seções visuais.
Estas imagens foram geradas profissionalmente para esta landing page.
NÃO use imagens de catálogo (fundo branco) no Hero quando houver criativos gerados.`);
  }

  if (lifestyleImageUrls.length > 0) {
    dataSections.push(`## 🌿 IMAGENS DE LIFESTYLE (SEGUNDA PRIORIDADE):
${lifestyleImageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Use em seções de ambientação, transformação, prova visual.
Estas são superiores às imagens de catálogo para contexto visual.`);
  }

  if (productImages.length > 0) {
     const imageUsageNote = generatedCreativeUrls.length > 0 || lifestyleImageUrls.length > 0
      ? `\n⚠️ ATENÇÃO: Use imagens de catálogo APENAS em grids de produto, comparações ou seções técnicas.
NÃO use imagens de catálogo (fundo branco) como hero ou background — use os criativos gerados acima.

### POLÍTICA DE IMAGEM POR TIPO DE SEÇÃO:
- HERO: Use criativo gerado (prioridade) ou lifestyle. NUNCA catálogo com fundo branco.
- OFERTA / PRICING / KITS: Use OBRIGATORIAMENTE a imagem principal (is_primary) de cada produto do catálogo. Cada card de oferta DEVE mostrar a foto do produto correspondente.
- PROVA SOCIAL / BEFORE-AFTER: Apenas imagens aprovadas de transformação.
- BENEFÍCIOS / FEATURES: Ícones CSS ou imagens secundárias.
- NUNCA misture: before/after em card de oferta, catálogo em hero, lifestyle em pricing.`
      : `\nCOPIE E COLE estas URLs. NUNCA invente URLs.

### POLÍTICA DE IMAGEM POR TIPO DE SEÇÃO:
- OFERTA / PRICING / KITS: Use OBRIGATORIAMENTE a imagem principal (is_primary) de cada produto do catálogo.
- NUNCA use imagens aleatórias em cards de oferta — cada card DEVE mostrar a foto do produto correspondente.`;

    dataSections.push(`## 📷 IMAGENS DO CATÁLOGO (REFERÊNCIA):
${productImages.map((url, i) => `${i + 1}. ${url}`).join('\n')}
${imageUsageNote}`);
  }

  if (reviewsInfo) dataSections.push(`## AVALIAÇÕES REAIS:\n${reviewsInfo}\nUse estes depoimentos reais na prova social.`);
  if (creativesInfo) dataSections.push(`## REFERÊNCIAS DE MARKETING:\n${creativesInfo}\nAlinhe tom de voz com estas referências.`);
  if (referenceUrl) dataSections.push(`## URL DE REFERÊNCIA (APENAS INSPIRAÇÃO):\n${referenceUrl}\n⚠️ COPIE APENAS LAYOUT E ESTILO! USE OS DADOS DOS PRODUTOS ACIMA!`);
  if (currentHtml) dataSections.push(`## HTML ATUAL (para ajustes):\n${currentHtml}`);

  // === CSS UTILITIES NOTE (v4.2: utilities moved to wrapInDocumentShell, only reference here) ===
  sections.push(`## 🎨 CSS — INSTRUÇÕES
O sistema injeta automaticamente CSS utilities (fadeInUp, pulse-cta, glass-card, container, responsividade mobile).
No seu bloco <style>, inclua APENAS os CSS específicos desta landing page: cores, gradientes, layouts de seção, tipografia customizada.
NÃO redefina: .container, .section, @keyframes fadeInUp, ou regras @media mobile genéricas — já estão no sistema.`);

  // Combine system prompt
  return `Você é um diretor criativo e desenvolvedor front-end de elite, especialista em landing pages de altíssima conversão. Siga TODAS as instruções abaixo à risca — elas são decisões do sistema, não sugestões.

${sections.join('\n\n---\n\n')}

---

${dataSections.join('\n\n')}`;
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
    width: 100% !important; text-align: center !important; padding: 16px 24px !important; font-size: 16px !important; display: block !important;
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
          if (primaryImage) productImages.push(primaryImage);
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

    // ===== STEP 3: DRIVE REFERENCES =====
    let driveReferenceBase64s: string[] = [];
    if (productIds && productIds.length > 0 && promptType !== "adjustment") {
      try {
        const searchTerms = productNames.map(n => n.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()).filter(Boolean);
        if (searchTerms.length > 0) {
          const { data: driveFiles } = await supabase
            .from("files")
            .select("id, original_name, storage_path, mime_type, metadata")
            .eq("tenant_id", tenantId)
            .eq("is_folder", false)
            .ilike("mime_type", "image/%")
            .order("created_at", { ascending: false })
            .limit(50);

          if (driveFiles && driveFiles.length > 0) {
            const matchingFiles = driveFiles.filter((f: any) => {
              const name = (f.original_name || '').toLowerCase();
              const meta = f.metadata as Record<string, any> | null;
              if (meta?.product_id && productIds!.includes(meta.product_id)) return true;
              return searchTerms.some(term => {
                const termWords = term.split(/\s+/).filter((w: string) => w.length > 3);
                return termWords.some((word: string) => name.includes(word));
              });
            }).slice(0, 3);

            for (const file of matchingFiles.slice(0, 2)) {
              try {
                const meta = file.metadata as Record<string, any> | null;
                let imageUrl = meta?.url as string | undefined;
                if (!imageUrl) {
                  const bucket = (meta?.bucket as string) || 'tenant-files';
                  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
                  imageUrl = pubData?.publicUrl;
                }
                if (imageUrl) {
                  const b64 = await imageUrlToBase64(imageUrl);
                  if (b64) driveReferenceBase64s.push(b64);
                }
              } catch (dlErr) { console.warn("[AI-LP-Generate] Drive ref error:", dlErr); }
            }
          }
        }
      } catch (driveErr) { console.warn("[AI-LP-Generate] Drive search error:", driveErr); }
    }

    // ===== STEP 4: DRIVE FOLDER =====
    let driveFolderId: string | null = null;
    try {
      driveFolderId = await ensureDriveFolder(supabase, tenantId, userId, "Criativos de página");
    } catch (folderErr) { console.warn("[AI-LP-Generate] Folder error:", folderErr); }

    // ===== STEP 5: LIFESTYLE IMAGE =====
    let lifestyleImageUrls: string[] = [];
    if (productIds && productIds.length > 0 && promptType !== "adjustment" && productImages.length > 0) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        const firstProductName = productNames[0] || "Produto";
        const driveRefNote = driveReferenceBase64s.length > 0
          ? '\n\nREFERÊNCIAS VISUAIS ADICIONAIS: As imagens extras anexadas são referências visuais do Drive. Use como inspiração, mas GERE imagem NOVA.'
          : '';
        const lifestylePrompt = `FOTOGRAFIA DE LIFESTYLE/AMBIENTAÇÃO para landing page de e-commerce.\n\nPRODUTO: "${firstProductName}"\n\nOBJETIVO: Imagem de ambientação/lifestyle premium mostrando o produto em contexto real.\n\nCENÁRIOS POR NICHO:\n- Cosméticos/Saúde: pessoa usando o produto em banheiro moderno\n- Suplementos/Fitness: ambiente de treino ou mesa executiva\n- Tech: home office moderno\n- Alimentos: mesa posta elegante\n- Moda: ambiente urbano sofisticado\n\nREGRAS:\n1. Produto DEVE aparecer de forma natural no cenário\n2. Mostre o produto EM USO real\n3. Aspect ratio: 16:9\n4. Visual dark/premium. Evite backgrounds claros\n5. NÃO altere embalagem do produto\n\nEstilo: Fotografia lifestyle premium. Ultra realista.${driveRefNote}`;
        try {
          const referenceBase64 = await imageUrlToBase64(productImages[0]);
          if (referenceBase64) {
            let lifestyleDataUrl = await callImageModel(lovableApiKey, 'google/gemini-3-pro-image-preview', lifestylePrompt, referenceBase64, driveReferenceBase64s);
            if (!lifestyleDataUrl) lifestyleDataUrl = await callImageModel(lovableApiKey, 'google/gemini-2.5-flash-image', lifestylePrompt, referenceBase64, driveReferenceBase64s);
            if (lifestyleDataUrl) {
              const safeName = firstProductName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40);
              const lifestyleUrl = await uploadCreativeToStorage(supabase, tenantId, lifestyleDataUrl, `lifestyle-${safeName}`, userId, driveFolderId);
              if (lifestyleUrl) lifestyleImageUrls.push(lifestyleUrl);
            }
          }
        } catch (lifestyleErr) { console.warn("[AI-LP-Generate] Lifestyle error:", lifestyleErr); }
      }
    }

    // ===== STEP 6: HERO CREATIVE =====
    let generatedCreativeUrls: string[] = [];
    if (promptType !== "adjustment" && productImages.length > 0) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        const heroUrl = await generateHeroCreative(supabase, lovableApiKey, tenantId, productNames[0] || "Produto", productImages[0], storeSettings?.store_name || "Loja", userId, driveFolderId, driveReferenceBase64s);
        if (heroUrl) generatedCreativeUrls.push(heroUrl);
      }
    }

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

    // ===== STEP 8: BUILD MODULAR PROMPT =====
    let currentHtml = "";
    if (promptType === "adjustment") {
      currentHtml = savedLandingPage?.generated_html || "";
    }

    const systemPrompt = buildModularPrompt({
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
      reviewsInfo,
      creativesInfo,
      generatedCreativeUrls,
      lifestyleImageUrls,
      referenceUrl,
      currentHtml,
      showHeader: savedLandingPage?.show_header,
      showFooter: savedLandingPage?.show_footer,
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
      enrichedPrompt = `${prompt}\n\n---\n\n## DIREÇÃO CRIATIVA COMPLEMENTAR (template: ${bestFallback.name})\n\n${bestFallback.prompt}`;
      console.log(`[AI-LP-Generate] Prompt enriched with fallback "${bestFallback.id}"`);
    }

    const hasUserMedia = prompt.includes("[Imagem:") || prompt.includes("[Vídeo:");
    const userMediaNote = hasUserMedia ? `\n\n## ⚠️ MÍDIA ANEXADA — USE OBRIGATORIAMENTE!\nAs URLs marcadas como [Imagem: URL] ou [Vídeo: URL] DEVEM ser usadas no HTML.` : "";

    const userPrompt = promptType === "adjustment"
      ? `Faça os seguintes ajustes na landing page atual:\n\n${prompt}${userMediaNote}\n\nRetorne o HTML completo atualizado nos dois blocos (json + html).`
      : `Crie uma landing page baseada nas seguintes instruções:\n\n${enrichedPrompt}${userMediaNote}`;

    // ===== STEP 10: CALL AI =====
    console.log(`[AI-LP-Generate] Calling AI for ${promptType}...`);
    resetAIRouterCache();

    const aiResponse = await aiChatCompletion("google/gemini-2.5-pro", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
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
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // ===== STEP 11: PARSE STRUCTURED RESPONSE =====
    const parsed = parseStructuredResponse(rawContent);
    let generatedHtml = parsed.html;

    console.log(`[AI-LP-Generate] Parsed: diagnostic=${parsed.diagnostic ? 'yes' : 'no'}, html=${generatedHtml.length} chars, parseError=${parsed.parseError || 'none'}`);

    // ===== STEP 12: RUN HARD CHECKS (on raw AI output, BEFORE wrapping) =====
    const hardCheckResults: HardCheckOutput = runHardChecks(generatedHtml, enginePlan, productNames, productImages);

    // If parse had errors (including outputContractViolation), reflect in consolidated status
    if (parsed.parseError) {
      hardCheckResults.hardCheckStatus = hardCheckResults.hardCheckStatus === 'fail' ? 'fail' : 'warning';
      hardCheckResults.needsReview = true;
      hardCheckResults.checks.push({
        name: 'parse_error',
        passed: false,
        message: parsed.parseError,
      });
    }

    // V4.2: outputContractViolation must always reflect as warning + needsReview
    if (parsed.parseError?.includes('outputContractViolation')) {
      if (hardCheckResults.hardCheckStatus === 'pass') {
        hardCheckResults.hardCheckStatus = 'warning';
      }
      hardCheckResults.needsReview = true;
    }

    console.log(`[AI-LP-Generate] Hard checks: status=${hardCheckResults.hardCheckStatus}, needsReview=${hardCheckResults.needsReview}, checks=${hardCheckResults.checks.length}`);

    // V4.2 FIX: Do NOT wrap in document shell at save time.
    // Save body-only HTML. The document shell is assembled at RENDER time
    // by the client-side pipeline (aiLandingPageShell.ts → buildDocumentShell).
    // This prevents double-wrapping that caused duplicated scripts and CSS conflicts.

    // ===== STEP 13: PERSIST =====
    const newVersion = (savedLandingPage?.current_version || 0) + 1;

    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_html: generatedHtml,
        current_version: newVersion,
        status: "draft",
        metadata: {
          engineVersion: "v4.2",
          briefingSchemaVersion: "1.0",
          enginePlanInput: enginePlan,
          diagnostic: parsed.diagnostic,
          altHeadline: parsed.diagnostic?.alt_headline || null,
          altCTA: parsed.diagnostic?.alt_cta || null,
          hardCheckResults,
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
        html_content: generatedHtml,
        created_by: userId,
        generation_metadata: {
          engineVersion: "v4.2",
          briefingSchemaVersion: "1.0",
          model: "google/gemini-2.5-pro",
          html_length: generatedHtml.length,
          had_reference: !!referenceUrl,
          product_count: productIds?.length || 0,
          reviews_count: reviewCount,
          drive_references_used: driveReferenceBase64s.length,
          lifestyle_images_generated: lifestyleImageUrls.length,
          fallback_prompt_used: fallbackUsed,
          enginePlanInput: enginePlan,
          diagnostic: parsed.diagnostic,
          hardCheckResults,
          parseError: parsed.parseError || null,
        },
      });

    if (versionError) console.error("[AI-LP-Generate] Version error:", versionError);

    console.log(`[AI-LP-Generate] Success! Version ${newVersion}, hardCheck=${hardCheckResults.hardCheckStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        htmlLength: generatedHtml.length,
        hardCheckStatus: hardCheckResults.hardCheckStatus,
        needsReview: hardCheckResults.needsReview,
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
