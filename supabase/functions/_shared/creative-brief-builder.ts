// =============================================
// CREATIVE BRIEF BUILDER v2.0.0
// v2.0.0: Simplified Banner prompts — user briefing is king
//
// Architecture:
//   1. buildCreativeBrief() → narrative prompt (contextual, minimal)
//   2. buildStructuralRules() → technical constraints (dimensions only for Banner)
//   3. buildFinalPrompt() = brief + rules (called per slot: desktop/mobile)
//
// BANNER-SPECIFIC CHANGES (v2.0.0):
// - NO automatic price injection
// - NO automatic logo/brand injection  
// - NO rigid safe-zone rules
// - NO forced layout zones (left dark, right product, etc.)
// - User briefing is the PRIMARY creative direction
// - Product context is minimal: name + reference image only
// =============================================

import type {
  VisualGenerationRequest,
  VisualSlot,
  OutputMode,
  ImageStyle,
  ProductContext,
  CategoryContext,
  StoreContext,
} from './visual-adapters/types.ts';

// ===== CREATIVE BRIEF =====

interface CreativeBriefInput {
  creativeStyle: ImageStyle;
  styleConfig: Record<string, unknown>;
  briefing: string;
  product?: ProductContext | null;
  category?: CategoryContext | null;
  store: StoreContext;
  outputMode: OutputMode;
  slideIndex?: number;
  /** v2.0.0: Flag to use simplified Banner prompt */
  isBannerSimplified?: boolean;
}

/**
 * Builds a consolidated creative brief.
 * v2.0.0: If isBannerSimplified is true, uses minimal context approach.
 */
export function buildCreativeBrief(input: CreativeBriefInput): string {
  if (input.isBannerSimplified) {
    return buildBannerSimplifiedBrief(input);
  }
  return buildFullCreativeBrief(input);
}

// ===== BANNER SIMPLIFIED BRIEF (v2.0.0) =====

function buildBannerSimplifiedBrief(input: CreativeBriefInput): string {
  const { briefing, product, category, store, slideIndex, outputMode } = input;
  const isComplete = outputMode === 'complete';
  const sections: string[] = [];

  // 1. User's briefing is THE creative direction
  sections.push(`🎯 CREATIVE DIRECTION (from user):\n"${briefing}"\n\nThis is the PRIMARY instruction. Everything else is context. Follow this direction above all.`);

  // 2. Minimal product context (no price, no brand as visual element)
  if (product) {
    let productSection = `📦 PRODUCT REFERENCE: "${product.name}"`;
    if (product.description) {
      // Short description only if useful
      const shortDesc = product.description.substring(0, 150).trim();
      productSection += `\nBrief description: ${shortDesc}`;
    }
    if (product.mainImageUrl) {
      productSection += `\n📸 A reference photo of the REAL product is attached. The product in the generated image MUST match the reference — same shape, colors, packaging.`;
    }
    sections.push(productSection);
  } else if (category) {
    sections.push(`📂 CATEGORY: "${category.name}" — show varied products from this category.`);
  } else {
    sections.push(`🏢 CONTEXT: "${store.storeName}" — this is a brand/institutional banner. No specific product.`);
  }

  // Complete creative mode guidance
  if (isComplete) {
    sections.push(`🎨 CREATIVE MODE: This is a COMPLETE advertising piece. You are FREE to include text, headlines, slogans, promotional copy, or any typography if it serves the creative concept. Text is ALLOWED but NOT mandatory — use it only if it enhances the piece.`);
  }

  // 3. Carousel variation
  if (slideIndex !== undefined) {
    sections.push(`🎠 VARIATION: This is slide ${slideIndex + 1} of a carousel. Vary the angle, scene, and mood while keeping the same campaign feel.`);
  }

  // 4. Quality standard
  sections.push(`✨ QUALITY: Professional advertising photography. 4K resolution, sharp focus, vibrant colors. The result should look like a high-end e-commerce campaign.`);

  return sections.join('\n\n');
}

// ===== FULL CREATIVE BRIEF (for non-Banner blocks) =====

function buildFullCreativeBrief(input: CreativeBriefInput): string {
  const { creativeStyle, styleConfig, briefing, product, category, store, outputMode, slideIndex } = input;

  const sections: string[] = [];

  // 1. OBJECTIVE
  const objectiveByMode = outputMode === 'complete'
    ? 'Criar uma PEÇA PUBLICITÁRIA COMPLETA e FINALIZADA para e-commerce. A imagem é o produto final.'
    : 'Criar uma IMAGEM DE FUNDO para banner de e-commerce. Textos serão sobrepostos via HTML.';
  sections.push(`🎯 OBJETIVO:\n${objectiveByMode}`);

  // 2. STORE IDENTITY
  let storeSection = `🏪 MARCA: "${store.storeName}"`;
  if (store.storeDescription) storeSection += `\nSobre a marca: ${store.storeDescription.substring(0, 250)}`;
  sections.push(storeSection);

  // 3. SUBJECT
  const subjectSection = buildSubjectSection(product, category);
  sections.push(subjectSection);

  // 4. CREATIVE DIRECTION
  const creativeDirection = buildCreativeDirection(creativeStyle, styleConfig, product?.name || category?.name || 'Produto');
  sections.push(creativeDirection);

  // 5. BRIEFING
  if (briefing) {
    const campaignSection = buildCampaignSection(briefing);
    sections.push(campaignSection);
  }

  // 6. CAROUSEL VARIATION
  if (slideIndex !== undefined) {
    sections.push(`🎠 VARIAÇÃO: Este é o slide ${slideIndex + 1} de um carrossel. Varie cenário, ângulo e atmosfera.`);
  }

  // 7. PRODUCT REFERENCE
  if (product?.mainImageUrl) {
    sections.push(`📸 REFERÊNCIA DO PRODUTO: Uma foto do produto REAL foi anexada. O produto na imagem gerada DEVE ser IDÊNTICO à referência.`);
  }

  return sections.join('\n\n');
}

// ===== SUBJECT SECTION (for non-Banner blocks) =====

function buildSubjectSection(product?: ProductContext | null, category?: CategoryContext | null): string {
  if (product) {
    let section = `📦 PRODUTO: "${product.name}"`;
    if (product.description) section += `\nDescrição: ${product.description.substring(0, 250)}`;
    // v2.0.0: Price NO LONGER injected automatically
    return section;
  }
  if (category) {
    return `📂 CATEGORIA: "${category.name}"\nMostre produtos variados desta categoria em composição premium.`;
  }
  return `🏢 INSTITUCIONAL: Banner de identidade da marca. Foque nos valores e atmosfera da loja.`;
}

// ===== CREATIVE DIRECTION (for non-Banner blocks) =====

function buildCreativeDirection(style: ImageStyle, styleConfig: Record<string, unknown>, productName: string): string {
  const lines: string[] = ['🎨 DIREÇÃO CRIATIVA:'];

  if (style === 'product_natural') {
    const env = (styleConfig?.environment as string) || 'studio';
    lines.push(`Estilo: FOTOGRAFIA DE PRODUTO NATURAL`);
    lines.push(`O produto é o protagonista. Cenário: ${env}. Qualidade editorial.`);
  } else if (style === 'person_interacting') {
    const action = (styleConfig?.action as string) || 'holding';
    const tone = (styleConfig?.tone as string) || 'lifestyle';
    const env = (styleConfig?.environment as string) || 'studio';
    lines.push(`Estilo: PESSOA INTERAGINDO COM O PRODUTO`);
    lines.push(`Ação: ${action} | Cenário: ${env} | Tom: ${tone}`);
    lines.push(`Pessoa real e fotorrealista. Mãos naturais, expressão genuína.`);
    lines.push(buildHandInstructions(productName));
  } else if (style === 'promotional') {
    const intensity = (styleConfig?.effectsIntensity as string) || 'medium';
    lines.push(`Estilo: PROMOCIONAL DE ALTO IMPACTO`);
    lines.push(`Intensidade visual: ${intensity}. Composição dinâmica e publicitária.`);
  }

  return lines.join('\n');
}

// ===== CAMPAIGN SECTION =====

function buildCampaignSection(briefing: string): string {
  const lines: string[] = ['📢 BRIEFING DO USUÁRIO (PRIORIDADE MÁXIMA):'];
  lines.push(`"${briefing}"`);
  lines.push(`\n⚠️ O briefing do usuário é a DIREÇÃO CRIATIVA PRIMÁRIA. Todo o cenário, atmosfera e composição devem refletir este briefing.`);
  return lines.join('\n');
}

// ===== STRUCTURAL RULES =====

interface StructuralRulesInput {
  slot: VisualSlot;
  outputMode: OutputMode;
  creativeStyle: ImageStyle;
  /** v2.0.0: Use simplified rules for Banner */
  isBannerSimplified?: boolean;
}

/**
 * Builds technical/structural rules for a specific slot.
 * v2.0.0: Banner uses lightweight rules — no rigid zones.
 */
export function buildStructuralRules(input: StructuralRulesInput): string {
  const { slot, outputMode, creativeStyle, isBannerSimplified } = input;
  const isContentSlot = slot.composition.startsWith('content_');
  const isDesktop = slot.composition.includes('desktop') || slot.composition === 'horizontal' || slot.composition === 'content_landscape';

  if (isContentSlot) {
    const lines: string[] = [];
    lines.push(`📐 DIMENSÕES: ${slot.width}x${slot.height}px`);
    return buildContentSlotRules(lines, slot, creativeStyle, creativeStyle === 'person_interacting');
  }

  if (isBannerSimplified) {
    return buildBannerSimplifiedRules(slot, isDesktop, outputMode);
  }

  return buildFullStructuralRules(slot, outputMode, creativeStyle, isDesktop);
}

// ===== BANNER SIMPLIFIED RULES (v2.0.0) =====

function buildBannerSimplifiedRules(slot: VisualSlot, isDesktop: boolean, outputMode: OutputMode): string {
  const isComplete = outputMode === 'complete';
  const lines: string[] = [];

  lines.push(`📐 DIMENSIONS: ${slot.width}x${slot.height}px (${isDesktop ? 'horizontal/desktop' : 'vertical/mobile'})`);
  
  if (isComplete) {
    // Complete creative mode — no text restrictions
    lines.push(`\n🎨 COMPLETE CREATIVE MODE:`);
    lines.push(`- This is a FINISHED advertising piece — the final image IS the banner.`);
    lines.push(`- You MAY include text, headlines, slogans, promotional copy, CTAs, or any typography if it enhances the creative concept.`);
    lines.push(`- Text is ALLOWED but NOT mandatory — only include it if it serves the design.`);
    lines.push(`- Think of this as a professional ad creative for Instagram, Google Ads, or a store homepage.`);
  } else {
    // Editable mode — strict no-text rules
    lines.push(`\n🖼️ IMAGE TYPE: Background image for e-commerce banner.`);
    lines.push(`- This image will have HTML text overlaid on top of it.`);
    lines.push(`- The image should work as a PHOTOGRAPHIC BACKGROUND.`);
    
    lines.push(`\n🚫 NO TEXT IN IMAGE:`);
    lines.push(`- Do NOT include any text, letters, numbers, logos, watermarks, price tags, or typography of any kind.`);
    lines.push(`- Product labels are OK if they're a natural part of the product, but should NOT be the focal point.`);
  }

  // Lightweight composition guidance
  if (isDesktop) {
    lines.push(`\n📏 COMPOSITION TIPS (desktop):`);
    lines.push(`- Widescreen format — use the horizontal space creatively.`);
    if (!isComplete) {
      lines.push(`- Consider leaving some area with lower visual density for text legibility (the system will overlay text).`);
    }
    lines.push(`- Product should be well-framed and visible.`);
  } else {
    lines.push(`\n📏 COMPOSITION TIPS (mobile):`);
    lines.push(`- Portrait format — vertical composition.`);
    lines.push(`- Product should be well-centered and proportioned for a narrow screen.`);
    lines.push(`- Avoid cutting important elements at the edges.`);
    if (!isComplete) {
      lines.push(`- Consider leaving some breathing room at top and bottom for text overlay.`);
    }
  }

  // Quality
  lines.push(`\n✨ QUALITY:`);
  lines.push(`- 4K resolution, professional sharpness`);
  lines.push(`- Vibrant, harmonious colors`);
  lines.push(`- Professional lighting`);
  lines.push(`- No white or light gray flat backgrounds`);

  return lines.join('\n');
}

// ===== FULL STRUCTURAL RULES (for non-Banner blocks) =====

function buildFullStructuralRules(slot: VisualSlot, outputMode: OutputMode, creativeStyle: ImageStyle, isDesktop: boolean): string {
  const isComplete = outputMode === 'complete';
  const hasPerson = creativeStyle === 'person_interacting';
  const lines: string[] = [];

  lines.push(`📐 DIMENSÕES: ${slot.width}x${slot.height}px (${isDesktop ? 'horizontal' : 'vertical'})`);

  if (isComplete) {
    lines.push(`\n🖼️ MODO CRIATIVO COMPLETO:`);
    lines.push(`- Composição FECHADA — toda a área é composição criativa.`);
    lines.push(`- MARGEM DE SEGURANÇA: 5% das bordas.`);
    lines.push(`- Estilo publicitário profissional.`);
  } else {
    lines.push(`\n🖼️ MODO EDITÁVEL (FUNDO PARA TEXTO HTML):`);
    lines.push(`- Esta imagem será usada como FUNDO. Textos via HTML.`);
    lines.push(`\n🚨 ZERO TEXTO NA IMAGEM:`);
    lines.push(`- NÃO inclua NENHUM texto, tipografia, logo, badge, etiqueta ou escrita.`);
    lines.push(`- A imagem é EXCLUSIVAMENTE fotografia/cenário.`);
  }

  // Prohibitions
  lines.push(`\n🚫 PROIBIÇÕES:`);
  lines.push(`- ❌ Fundo branco ou cinza claro chapado`);
  if (!isComplete) {
    lines.push(`- ❌ ZERO texto, letra, número, palavra, slogan, logo, badge`);
  }
  if (!hasPerson && creativeStyle !== 'promotional') {
    lines.push(`- ❌ NENHUMA pessoa, mão ou modelo`);
  }

  // Quality
  lines.push(`\n✨ QUALIDADE:`);
  lines.push(`- Resolução 4K, nitidez profissional`);
  lines.push(`- Cores vibrantes e harmônicas`);
  lines.push(`- Iluminação profissional`);

  return lines.join('\n');
}

// ===== CONTENT SLOT RULES =====

function buildContentSlotRules(
  lines: string[],
  slot: VisualSlot,
  creativeStyle: ImageStyle,
  hasPerson: boolean,
): string {
  lines.push(`\n🖼️ IMAGEM DE CONTEÚDO (SEM OVERLAY DE TEXTO):`);
  lines.push(`- Composição EQUILIBRADA — pode ocupar toda a área.`);
  lines.push(`- NÃO precisa de zonas escuras ou safe areas.`);

  if (slot.composition === 'content_square') {
    lines.push(`- Proporção 1:1 (quadrada).`);
  } else if (slot.composition === 'content_portrait') {
    lines.push(`- Proporção retrato/vertical.`);
  } else {
    lines.push(`- Proporção paisagem/horizontal.`);
  }

  lines.push(`\n🚨 REGRA DE TEXTO:`);
  lines.push(`- NÃO inclua texto, tipografia, watermarks ou badges.`);

  if (!hasPerson && creativeStyle !== 'promotional') {
    lines.push(`- ❌ NENHUMA pessoa, mão ou modelo`);
  }

  lines.push(`\n✨ QUALIDADE: Resolução 4K, nitidez profissional, cores vibrantes.`);

  return lines.join('\n');
}

// ===== FINAL PROMPT BUILDER =====

export function buildFinalPrompt(request: VisualGenerationRequest, slot: VisualSlot): string {
  const isBannerSimplified = (request as any)._isBannerSimplified === true;

  const brief = buildCreativeBrief({
    creativeStyle: request.creativeStyle,
    styleConfig: request.styleConfig,
    briefing: request.briefing,
    product: request.product,
    category: request.category,
    store: request.store,
    outputMode: request.outputMode,
    slideIndex: request.slideIndex,
    isBannerSimplified,
  });

  const rules = buildStructuralRules({
    slot,
    outputMode: request.outputMode,
    creativeStyle: request.creativeStyle,
    isBannerSimplified,
  });

  const isDesktop = slot.composition.includes('desktop') || slot.composition === 'horizontal' || slot.composition === 'content_landscape';
  const deviceLabel = slot.composition === 'content_square' ? 'SQUARE' : (isDesktop ? 'DESKTOP' : 'MOBILE');

  // For Banner simplified: lightweight no-text preamble
  const noTextPreamble = isBannerSimplified
    ? `⛔ IMPORTANT: This image must contain ZERO text, letters, numbers, logos, or typography. Photography only.\n\n`
    : (request.outputMode !== 'complete' && !slot.composition.startsWith('content_'))
      ? `⛔ MANDATORY RULE — ZERO TEXT ⛔\nTHIS IMAGE MUST CONTAIN ZERO TEXT. NO letters, words, numbers, logos, labels, watermarks, slogans, prices, badges, or ANY form of typography/writing.\nGenerate ONLY photography/scenery.\n\n`
      : '';

  return `${noTextPreamble}═══════════════════════════════════════
CREATIVE BRIEF — BANNER ${deviceLabel}
═══════════════════════════════════════

${brief}

═══════════════════════════════════════
STRUCTURAL RULES — ${deviceLabel}
═══════════════════════════════════════

${rules}`;
}

// ===== HAND INSTRUCTIONS =====

function buildHandInstructions(productName: string): string {
  const name = productName.toLowerCase().trim();
  const isKit = /\b(kit|combo|conjunto|pack|coleção)\b/i.test(name);
  const qtyMatch = name.match(/(\d+)\s*(?:x|un|pç|peças|itens|produtos)/i) || name.match(/kit\s+(?:com\s+)?(\d+)/i);
  const estimatedItems = qtyMatch ? parseInt(qtyMatch[1]) : (isKit ? 3 : 1);

  if (!isKit && estimatedItems <= 1) {
    return `🖐️ Regra de mãos: Pode segurar com uma ou duas mãos, rótulo frontal visível.`;
  }
  if (estimatedItems <= 2) {
    return `🖐️ Regra de mãos (kit ${estimatedItems} itens): No máximo 1 produto em cada mão.`;
  }
  return `🖐️ Regra de mãos (kit ${estimatedItems}+ itens): Segura no máximo 1 em cada mão. Demais em superfície.`;
}
