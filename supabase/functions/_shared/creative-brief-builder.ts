// =============================================
// CREATIVE BRIEF BUILDER v1.0.0
// Consolidates ALL wizard choices into a single
// narrative creative brief for the AI.
//
// Architecture:
//   1. buildCreativeBrief() → narrative prompt (WHO/WHAT/WHY/HOW)
//   2. buildStructuralRules() → technical constraints (dimensions, safe areas, prohibitions)
//   3. buildFinalPrompt() = brief + rules (called per slot: desktop/mobile)
//
// This module is BLOCK-AGNOSTIC and reusable for any visual block.
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
  /** Creative style chosen by user */
  creativeStyle: ImageStyle;
  /** Per-style config (action, tone, environment, etc.) */
  styleConfig: Record<string, unknown>;
  /** User's free-form briefing */
  briefing: string;
  /** Product context */
  product?: ProductContext | null;
  /** Category context */
  category?: CategoryContext | null;
  /** Store identity */
  store: StoreContext;
  /** Output mode: editable or complete */
  outputMode: OutputMode;
  /** Slide index for carousel variation */
  slideIndex?: number;
}

/**
 * Builds a consolidated creative brief from ALL user choices.
 * This is the NARRATIVE that tells the AI what to create.
 * It does NOT include dimensional/structural rules — those come from buildStructuralRules().
 */
export function buildCreativeBrief(input: CreativeBriefInput): string {
  const { creativeStyle, styleConfig, briefing, product, category, store, outputMode, slideIndex } = input;

  const sections: string[] = [];

  // ── 1. OBJECTIVE ──
  const objectiveByMode = outputMode === 'complete'
    ? 'Criar uma PEÇA PUBLICITÁRIA COMPLETA e FINALIZADA para e-commerce. A imagem é o produto final — composição fechada, pronta para publicação.'
    : 'Criar uma IMAGEM DE FUNDO para banner de e-commerce. Textos serão sobrepostos via HTML — a imagem deve funcionar como base visual.';
  sections.push(`🎯 OBJETIVO:\n${objectiveByMode}`);

  // ── 2. STORE IDENTITY ──
  let storeSection = `🏪 MARCA: "${store.storeName}"`;
  if (store.storeDescription) storeSection += `\nSobre a marca: ${store.storeDescription.substring(0, 250)}`;
  sections.push(storeSection);

  // ── 3. SUBJECT (product/category/institutional) ──
  const subjectSection = buildSubjectSection(product, category);
  sections.push(subjectSection);

  // ── 4. CREATIVE DIRECTION (from style + config) ──
  const creativeDirection = buildCreativeDirection(creativeStyle, styleConfig, product?.name || category?.name || 'Produto');
  sections.push(creativeDirection);

  // ── 5. CAMPAIGN / BRIEFING (user's free-form input — HIGHEST PRIORITY) ──
  if (briefing) {
    const campaignSection = buildCampaignSection(briefing);
    sections.push(campaignSection);
  }

  // ── 6. CAROUSEL VARIATION ──
  if (slideIndex !== undefined) {
    sections.push(`🎠 VARIAÇÃO: Este é o slide ${slideIndex + 1} de um carrossel. Varie cenário, ângulo e atmosfera em relação aos outros slides, mantendo a mesma campanha e identidade visual.`);
  }

  // ── 7. PRODUCT REFERENCE NOTE ──
  if (product?.mainImageUrl) {
    sections.push(`📸 REFERÊNCIA DO PRODUTO: Uma foto do produto REAL foi anexada. O produto na imagem gerada DEVE ser IDÊNTICO à referência — mesma cor, forma, embalagem, rótulo e textura. O produto deve ser imediatamente reconhecível.`);
  }

  return sections.join('\n\n');
}

// ===== SUBJECT SECTION =====

function buildSubjectSection(product?: ProductContext | null, category?: CategoryContext | null): string {
  if (product) {
    let section = `📦 PRODUTO: "${product.name}"`;
    if (product.description) section += `\nDescrição: ${product.description.substring(0, 250)}`;
    if (product.price) {
      const formatted = `R$ ${product.price.toFixed(2).replace('.', ',')}`;
      section += `\nPreço: ${formatted}`;
      if (product.compareAtPrice && product.compareAtPrice > product.price) {
        const oldFormatted = `R$ ${product.compareAtPrice.toFixed(2).replace('.', ',')}`;
        const discount = Math.round((1 - product.price / product.compareAtPrice) * 100);
        section += ` (de ${oldFormatted} — ${discount}% OFF)`;
      }
    }
    return section;
  }
  if (category) {
    return `📂 CATEGORIA: "${category.name}"\nMostre produtos variados desta categoria em composição premium.`;
  }
  return `🏢 INSTITUCIONAL: Banner de identidade da marca, sem produto ou categoria específica. Foque nos valores e atmosfera da loja.`;
}

// ===== CREATIVE DIRECTION =====

function buildCreativeDirection(style: ImageStyle, styleConfig: Record<string, unknown>, productName: string): string {
  const lines: string[] = ['🎨 DIREÇÃO CRIATIVA:'];

  if (style === 'product_natural') {
    const env = (styleConfig?.environment as string) || 'studio';
    const lighting = (styleConfig?.lighting as string) || 'natural';
    const mood = (styleConfig?.mood as string) || 'clean';
    lines.push(`Estilo: FOTOGRAFIA DE PRODUTO NATURAL`);
    lines.push(`O produto é o protagonista absoluto. Sem pessoas.`);
    lines.push(`Cenário: ${env} | Iluminação: ${lighting} | Mood: ${mood}`);
    lines.push(`Qualidade editorial de revista. Foco nítido no produto, fundo com leve desfoque (bokeh).`);
    lines.push(`O produto deve parecer fotografado por um profissional — cores fiéis, sombras suaves, textura real.`);
  } else if (style === 'person_interacting') {
    const action = (styleConfig?.action as string) || 'holding';
    const personProfile = (styleConfig?.personProfile as string) || 'pessoa atraente com aparência natural e saudável';
    const tone = (styleConfig?.tone as string) || 'lifestyle';
    const env = (styleConfig?.environment as string) || 'studio';
    const actionDesc: Record<string, string> = {
      holding: 'segurando o produto pela base/corpo, com rótulo frontal visível',
      using: 'usando/aplicando o produto de forma natural',
      showing: 'mostrando o produto para câmera com expressão confiante',
    };
    const toneDesc: Record<string, string> = {
      ugc: 'Estilo UGC autêntico — como se fosse criado pelo próprio consumidor, caseiro mas atraente',
      demo: 'Demonstração profissional do produto em uso, informativa e clara',
      review: 'Pessoa avaliando o produto, expressão de satisfação genuína',
      lifestyle: 'Fotografia lifestyle editorial premium — a pessoa vive o momento com o produto',
    };
    lines.push(`Estilo: PESSOA INTERAGINDO COM O PRODUTO`);
    lines.push(`Pessoa: ${personProfile}`);
    lines.push(`Ação: ${actionDesc[action] || action}`);
    lines.push(`Cenário/Ambiente: ${env}`);
    lines.push(`Tom visual: ${toneDesc[tone] || tone}`);
    lines.push(`A pessoa deve parecer REAL e fotorrealista — sem aparência de IA.`);
    lines.push(`Mãos naturais, expressão genuína, iluminação profissional.`);
    lines.push(buildHandInstructions(productName));
  } else if (style === 'promotional') {
    const intensity = (styleConfig?.effectsIntensity as string) || 'medium';
    const elements = (styleConfig?.visualElements as string[]) || [];
    const intensityDesc: Record<string, string> = {
      low: 'Efeitos sutis e elegantes — sofisticação acima de tudo',
      medium: 'Efeitos moderados com impacto visual — equilíbrio entre elegância e energia',
      high: 'Efeitos intensos e dramáticos — máxima atenção e urgência',
    };
    lines.push(`Estilo: PROMOCIONAL DE ALTO IMPACTO`);
    lines.push(`Intensidade visual: ${intensityDesc[intensity] || intensity}`);
    if (elements.length > 0) lines.push(`Elementos visuais solicitados: ${elements.join(', ')}`);
    lines.push(`Composição dinâmica e publicitária. Cores vibrantes, contraste alto.`);
    lines.push(`O produto deve ser o foco central — efeitos não podem cobrir o rótulo.`);
    lines.push(`A peça deve parecer um anúncio de grande e-commerce ou revista.`);
  }

  return lines.join('\n');
}

// ===== CAMPAIGN SECTION =====

function buildCampaignSection(briefing: string): string {
  const lines: string[] = ['📢 CAMPANHA / BRIEFING DO USUÁRIO (PRIORIDADE MÁXIMA):'];
  lines.push(`"${briefing}"`);

  const briefingLower = briefing.toLowerCase();

  // Campaign theme detection
  const themes: Record<string, string> = {
    'páscoa': 'Páscoa: tons dourados e chocolate, ovos decorativos sutis, atmosfera acolhedora e festiva',
    'natal': 'Natal: vermelho/dourado/verde, luzes bokeh, atmosfera natalina elegante e premium',
    'black friday': 'Black Friday: tons escuros (preto, dourado), contraste dramático, urgência e exclusividade',
    'dia das mães': 'Dia das Mães: tons suaves e sofisticados, flores sutis, atmosfera carinhosa e premium',
    'dia dos pais': 'Dia dos Pais: tons sóbrios (azul marinho, cinza), atmosfera masculina e sofisticada',
    'dia dos namorados': 'Dia dos Namorados: tons românticos (vermelho, rosa dourado), atmosfera íntima e premium',
    'verão': 'Verão: tons vibrantes e quentes, luz solar, atmosfera fresca e energética',
    'inverno': 'Inverno: tons frios e aconchegantes, atmosfera sofisticada e intimista',
    'carnaval': 'Carnaval: cores vibrantes e festivas, energia alta, atmosfera de celebração',
    'dia do consumidor': 'Dia do Consumidor: atmosfera de oportunidade, tons modernos e atraentes',
  };

  for (const [keyword, description] of Object.entries(themes)) {
    if (briefingLower.includes(keyword)) {
      lines.push(`🎪 TEMA VISUAL DETECTADO: ${description}`);
      lines.push(`O cenário INTEIRO deve respirar este tema — não apenas detalhes sutis. O cliente deve reconhecer a campanha instantaneamente.`);
      break;
    }
  }

  // Discount/offer detection
  const hasDiscount = /\d+%|desconto|oferta|promoção|promo|off|frete gr[áa]tis|cupom/.test(briefingLower);
  if (hasDiscount) {
    lines.push(`💰 OFERTA DETECTADA: A atmosfera deve transmitir OPORTUNIDADE e URGÊNCIA — iluminação dramática, contraste forte, energia comercial.`);
  }

  lines.push(`\n⚠️ REGRA: O briefing do usuário é a DIREÇÃO CRIATIVA PRIMÁRIA. Todo o cenário, atmosfera e composição devem refletir este briefing. Não ignore nenhum detalhe mencionado.`);

  return lines.join('\n');
}

// ===== STRUCTURAL RULES (dimensions, safe areas, prohibitions) =====

interface StructuralRulesInput {
  slot: VisualSlot;
  outputMode: OutputMode;
  creativeStyle: ImageStyle;
}

/**
 * Builds technical/structural rules for a specific slot.
 * These are INDEPENDENT from the creative brief.
 */
export function buildStructuralRules(input: StructuralRulesInput): string {
  const { slot, outputMode, creativeStyle } = input;
  const isDesktop = slot.composition.includes('desktop') || slot.composition === 'horizontal';
  const isComplete = outputMode === 'complete';
  const hasPerson = creativeStyle === 'person_interacting';

  const lines: string[] = [];

  // Dimensions
  lines.push(`📐 DIMENSÕES: ${slot.width}x${slot.height}px (${isDesktop ? 'horizontal widescreen' : 'vertical retrato/mobile'})`);

  if (isComplete) {
    // Complete mode: full composition with strict safe-area rules
    lines.push(`\n🖼️ MODO CRIATIVO COMPLETO:`);
    lines.push(`- Composição FECHADA — toda a área é composição criativa.`);
    lines.push(`- A peça deve funcionar como anúncio PRONTO para publicação.`);
    lines.push(`- MARGEM DE SEGURANÇA: Nenhum elemento visual importante (texto, produto, logotipo) pode estar a menos de 5% das bordas.`);
    if (isDesktop) {
      lines.push(`- Composição horizontal pensada para tela larga (widescreen ${slot.width}x${slot.height}).`);
      lines.push(`- Se houver copy/texto na imagem, ele DEVE estar centralizado ou alinhado à esquerda, com contraste garantido (fundo escurecido ou badge atrás do texto).`);
      lines.push(`- O texto deve ocupar no máximo 40% da largura, fonte grande e legível.`);
    } else {
      lines.push(`- Composição vertical pensada para tela de celular (portrait ${slot.width}x${slot.height}).`);
      lines.push(`- Enquadramento vertical com produto bem proporcionado ao espaço estreito.`);
      lines.push(`- Se houver copy/texto na imagem, ele DEVE estar dentro dos 80% CENTRAIS da altura (não nos extremos superior/inferior de 10%).`);
      lines.push(`- Textos devem ter tamanho legível em tela mobile (mínimo equivalente a 24pt).`);
      lines.push(`- O produto não pode ser cortado pelas bordas.`);
    }
    lines.push(`- Estilo publicitário profissional com composição balanceada e foco visual claro.`);
  } else {
    // Editable mode: safe areas for HTML overlay — STRICT RULES
    lines.push(`\n🖼️ MODO EDITÁVEL (FUNDO PARA TEXTO HTML — REGRAS RÍGIDAS):`);
    lines.push(`- Esta imagem será usada como FUNDO. Textos e botões serão sobrepostos via HTML.`);
    lines.push(`\n🚨🚨🚨 REGRA #1 ABSOLUTA — ZERO TEXTO NA IMAGEM 🚨🚨🚨`);
    lines.push(`- NÃO inclua NENHUM texto, tipografia, lettering, palavra, número, slogan, logo, badge, etiqueta de preço, watermark ou qualquer forma de escrita na imagem.`);
    lines.push(`- NENHUMA letra do alfabeto pode aparecer na imagem gerada — nem estilizada, nem como parte do cenário, nem como decoração.`);
    lines.push(`- Se o rótulo do produto contiver texto, o produto deve estar posicionado de forma que o rótulo NÃO seja o foco principal.`);
    lines.push(`- A imagem é EXCLUSIVAMENTE fotografia/cenário. Todo texto será adicionado depois via HTML.`);
    lines.push(`- Qualquer texto renderizado na imagem será considerado um DEFEITO GRAVE.`);
    lines.push(`- A imagem deve parecer FOTOGRAFIA PUBLICITÁRIA DE FUNDO — como um backdrop de campanha.`);

    if (isDesktop) {
      // Desktop editable: left half is text zone, right half is product zone
      lines.push(`\n📏 LAYOUT DESKTOP — DIVISÃO OBRIGATÓRIA:`);
      lines.push(`- METADE ESQUERDA (0% a 50% da largura): ZONA DE TEXTO.`);
      lines.push(`  → Esta área DEVE ser SIGNIFICATIVAMENTE MAIS ESCURA que o restante.`);
      lines.push(`  → Use gradiente escuro natural (iluminação lateral, sombra dramática, vinheta).`);
      lines.push(`  → Nenhum produto, objeto em destaque ou elemento visual pode invadir esta zona.`);
      lines.push(`  → Imagine que texto branco será escrito aqui — o fundo precisa garantir legibilidade.`);
      if (hasPerson) {
        lines.push(`- METADE DIREITA (50% a 100%): Pessoa interagindo com o produto.`);
        lines.push(`  → Pessoa e produto confinados aos 45% direitos da imagem.`);
      } else {
        lines.push(`- METADE DIREITA (50% a 100%): Produto em destaque.`);
        lines.push(`  → Produto confinado aos 40% direitos da imagem, bem enquadrado.`);
      }
      lines.push(`- TRANSIÇÃO: Gradiente suave entre zona escura (esquerda) e zona do produto (direita).`);
      lines.push(`- O resultado deve parecer uma foto publicitária com iluminação lateral — lado esquerdo escuro, lado direito iluminado com o produto.`);
      lines.push(`- O produto DEVE estar completamente visível, sem cortes nas bordas.`);
    } else {
      // Mobile editable: top third is text zone, center is product, bottom is CTA zone
      lines.push(`\n📏 LAYOUT MOBILE — DIVISÃO VERTICAL OBRIGATÓRIA:`);
      lines.push(`- TERÇO SUPERIOR (0% a 35% da altura): ZONA DE TEXTO.`);
      lines.push(`  → Esta área DEVE ser CONSIDERAVELMENTE MAIS ESCURA — aplique gradiente de preto/escuro no topo.`);
      lines.push(`  → O escurecimento deve ser forte e inequívoco, não apenas "levemente mais escuro".`);
      lines.push(`  → Texto branco será escrito aqui — legibilidade é obrigatória.`);
      lines.push(`  → NENHUM produto, pessoa ou elemento visual pode invadir esta zona.`);
      lines.push(`- CENTRO (35% a 70% da altura): Zona do produto.`);
      if (hasPerson) {
        lines.push(`  → Pessoa com produto, centralizada, bem enquadrada.`);
      } else {
        lines.push(`  → Produto centralizado, proporcionado e nítido.`);
      }
      lines.push(`- TERÇO INFERIOR (70% a 100% da altura): ZONA DO BOTÃO CTA.`);
      lines.push(`  → Deve ter fundo mais escuro ou limpo para receber um botão HTML.`);
      lines.push(`  → O produto NÃO pode invadir o terço inferior.`);
      lines.push(`- Enquadramento pensado para tela estreita (portrait). Produto centralizado horizontalmente.`);
      lines.push(`- O produto NÃO pode ser cortado pelas bordas. Deve estar integralmente visível.`);
    }

    lines.push(`\n⚠️ REGRA CRÍTICA DE CONTRASTE:`);
    lines.push(`- A zona de texto DEVE ter luminosidade baixa o suficiente para texto branco (#FFFFFF) ser PERFEITAMENTE legível.`);
    lines.push(`- Use técnicas de fotografia real: iluminação lateral, vinheta, gradiente de sombra, scrim natural.`);
    lines.push(`- NÃO gere imagem uniformemente iluminada — o contraste entre zona de texto e zona de produto é OBRIGATÓRIO.`);
  }

  // Prohibitions
  lines.push(`\n🚫 PROIBIÇÕES ABSOLUTAS:`);
  lines.push(`- ❌ Fundo branco ou cinza claro chapado`);
  if (!isComplete) {
    lines.push(`- ❌ ZERO texto, letra, número, palavra, slogan, logo, badge, etiqueta ou qualquer escrita — DEFEITO GRAVE`);
    lines.push(`- ❌ NENHUM elemento gráfico/UI (botões, bordas, molduras, watermarks)`);
    lines.push(`- ❌ A imagem deve conter APENAS fotografia/cenário — sem qualquer forma de tipografia`);
  }
  if (!hasPerson && creativeStyle !== 'promotional') {
    lines.push(`- ❌ NENHUMA pessoa, mão ou modelo`);
  }
  if (!isComplete) {
    const maxSize = isDesktop ? '30% da largura total' : '40% da altura total';
    lines.push(`- ❌ Produto NÃO pode ocupar mais de ${maxSize}`);
  }

  // Quality
  lines.push(`\n✨ QUALIDADE:`);
  lines.push(`- Resolução 4K, nitidez profissional`);
  lines.push(`- Cores vibrantes e harmônicas`);
  lines.push(`- Iluminação profissional (estúdio ou natural conforme direção criativa)`);
  lines.push(`- O resultado deve parecer uma peça comercial de campanha profissional`);

  return lines.join('\n');
}

// ===== FINAL PROMPT BUILDER =====

/**
 * Builds the FINAL prompt for a specific slot by combining:
 * 1. Creative Brief (narrative from user choices)
 * 2. Structural Rules (technical constraints for this slot)
 *
 * This is the single prompt sent to the AI for image generation.
 */
export function buildFinalPrompt(request: VisualGenerationRequest, slot: VisualSlot): string {
  const brief = buildCreativeBrief({
    creativeStyle: request.creativeStyle,
    styleConfig: request.styleConfig,
    briefing: request.briefing,
    product: request.product,
    category: request.category,
    store: request.store,
    outputMode: request.outputMode,
    slideIndex: request.slideIndex,
  });

  const rules = buildStructuralRules({
    slot,
    outputMode: request.outputMode,
    creativeStyle: request.creativeStyle,
  });

  const isDesktop = slot.composition.includes('desktop') || slot.composition === 'horizontal';
  const deviceLabel = isDesktop ? 'DESKTOP' : 'MOBILE';

  return `═══════════════════════════════════════
CREATIVE BRIEF — BANNER ${deviceLabel}
═══════════════════════════════════════

${brief}

═══════════════════════════════════════
REGRAS ESTRUTURAIS — ${deviceLabel}
═══════════════════════════════════════

${rules}`;
}

// ===== HAND INSTRUCTIONS (reexported for person_interacting) =====

function buildHandInstructions(productName: string): string {
  const name = productName.toLowerCase().trim();
  const isKit = /\b(kit|combo|conjunto|pack|coleção)\b/i.test(name);
  const qtyMatch = name.match(/(\d+)\s*(?:x|un|pç|peças|itens|produtos)/i) || name.match(/kit\s+(?:com\s+)?(\d+)/i);
  const estimatedItems = qtyMatch ? parseInt(qtyMatch[1]) : (isKit ? 3 : 1);

  if (!isKit && estimatedItems <= 1) {
    return `🖐️ Regra de mãos: Pode segurar com uma ou duas mãos, rótulo frontal visível, postura natural.`;
  }
  if (estimatedItems <= 2) {
    return `🖐️ Regra de mãos (kit ${estimatedItems} itens): No máximo 1 produto em cada mão. Rótulos frontais visíveis.`;
  }
  return `🖐️ Regra de mãos (kit ${estimatedItems}+ itens): Segura no máximo 1 em cada mão (total: 2). Os demais dispostos em superfície próxima. Composição natural e organizada.`;
}
