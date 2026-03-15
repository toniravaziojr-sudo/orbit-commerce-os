// =============================================
// VISUAL ENGINE — Shared image generation motor
// v1.0.0: Extracted from creative-image-generate v5.2.0
// Provides: resilient generation cascade, QA scoring,
// prompt building by style+composition, image download
// =============================================

import type {
  VisualGenerationRequest,
  VisualGenerationResult,
  GeneratedAsset,
  QAScores,
  ImageStyle,
  OutputMode,
  CompositionHint,
  VisualSlot,
} from './visual-adapters/types.ts';

// ===== CONSTANTS =====

const LOVABLE_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const OPENAI_CHAT_API = 'https://api.openai.com/v1/chat/completions';

export const LOVABLE_MODELS = {
  primary: 'google/gemini-3-pro-image-preview',
  fallback: 'google/gemini-2.5-flash-image',
} as const;

const QA_PASS_SCORE = 0.70;

// ===== KIT / MULTI-PRODUCT DETECTION =====

export function detectProductType(productName: string): { isKit: boolean; estimatedItems: number; kitType: string } {
  const name = productName.toLowerCase().trim();
  if (/\bkit\b/i.test(name)) {
    const qtyMatch = name.match(/(\d+)\s*(?:x|un|pç|peças|itens|produtos)/i) || name.match(/kit\s+(?:com\s+)?(\d+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 3;
    return { isKit: true, estimatedItems: qty, kitType: 'kit' };
  }
  const multiplierMatch = name.match(/\(?\s*(\d+)\s*x\s*\)?/i) 
    || name.match(/\bpack\s+(\d+)/i)
    || name.match(/(\d+)\s*(?:un|unidade|unidades)\b/i);
  if (multiplierMatch) {
    const qty = parseInt(multiplierMatch[1]);
    if (qty >= 2) return { isKit: true, estimatedItems: qty, kitType: 'pack' };
  }
  if (/\b(combo|conjunto|pack|coleção)\b/i.test(name)) {
    return { isKit: true, estimatedItems: 3, kitType: 'combo' };
  }
  return { isKit: false, estimatedItems: 1, kitType: 'single' };
}

// ===== HAND INSTRUCTIONS (for person_interacting style) =====

export function buildHandInstructions(productName: string): string {
  const { isKit, estimatedItems, kitType } = detectProductType(productName);
  if (!isKit) {
    return `🖐️ REGRA DE MÃOS:\n- A pessoa pode segurar o produto com UMA ou DUAS mãos\n- Segurar pela base/corpo, rótulo frontal VISÍVEL\n- Mãos devem parecer naturais, não forçadas`;
  }
  if (estimatedItems <= 2) {
    return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems} itens):\n- NO MÁXIMO um produto em CADA MÃO (total: 2 nas mãos)\n- Mãos devem segurar com naturalidade\n- Rótulos frontais visíveis em ambos os produtos`;
  }
  return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems}+ itens):\n- SE o kit vier em uma embalagem única (caixa, sacola, pacote) que um humano consiga segurar: a pessoa PODE segurar a embalagem\n- SE forem produtos avulsos: a pessoa segura NO MÁXIMO 1 em cada mão (total: 2)\n- Os produtos restantes devem estar DISPOSTOS em uma superfície próxima (mesa, bancada, prateleira)\n- A composição deve parecer natural e organizada\n- PROIBIDO: empilhar vários produtos nas mãos, parecer desajeitado ou desproporcional\n- Os produtos sobre a mesa devem ter rótulos visíveis`;
}

// ===== PROMPT BUILDING BY STYLE (from creative-image-generate) =====

export function buildPromptForStyle(config: {
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
  }[format] || `formato ${format}`;

  if (style === 'product_natural') {
    const env = (styleConfig?.environment as string) || 'studio';
    const lighting = (styleConfig?.lighting as string) || 'natural';
    const mood = (styleConfig?.mood as string) || 'clean';
    return `FOTOGRAFIA PROFISSIONAL DE PRODUTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nA imagem de referência mostra o produto REAL que deve ser fielmente reproduzido.\n\n🏠 CENÁRIO: ${env}\n💡 ILUMINAÇÃO: ${lighting}\n🎨 MOOD: ${mood}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\nREGRAS OBRIGATÓRIAS:\n- O produto DEVE ser IDÊNTICO à referência (cores, rótulo, formato)\n- Ambiente natural e realista, sem pessoas\n- Iluminação profissional sem sombras duras\n- Foco nítido no produto, fundo levemente desfocado\n- Qualidade editorial de revista\n\nPROIBIDO:\n- Alterar cores, texto ou forma do produto\n- Adicionar elementos não solicitados\n- Distorcer o rótulo`;
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
    return `FOTOGRAFIA PROFISSIONAL — PESSOA COM PRODUTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nA imagem de referência mostra o produto REAL.\n\n👤 PESSOA: ${personProfile || 'pessoa atraente com aparência natural e saudável'}\n🎬 AÇÃO: ${actionDesc}\n🎨 TOM: ${toneDesc}\n\n${handRules}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\nREGRAS CRÍTICAS DE FIDELIDADE:\n- O produto será SUBSTITUÍDO por composição (Label Lock)\n- Foque em criar a CENA perfeita (pessoa, mãos, iluminação)\n- Pessoa com aparência fotorrealista, sem cara de IA\n\nQUALIDADE:\n- Resolução 4K, nitidez profissional\n- Iluminação natural ou de estúdio\n- Expressão natural, não forçada`;
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
    const elementsDesc = elements.length > 0 ? `Elementos visuais: ${elements.join(', ')}` : '';
    return `IMAGEM PROMOCIONAL DE ALTO IMPACTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nCriar imagem publicitária de alto impacto visual.\n\n✨ INTENSIDADE DE EFEITOS: ${intensityDesc}\n${elementsDesc}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\n${overlayText ? `⚠️ TEXTO OPCIONAL: "${overlayText}" — Tente incluir, mas não garante legibilidade` : ''}\n\nREGRAS:\n- Visual impactante para anúncios\n- Produto deve ser o foco central\n- Preservar cores e identidade do produto\n- Efeitos não devem cobrir o rótulo\n\nESTILO:\n- Publicitário profissional\n- Cores vibrantes e contraste alto\n- Composição dinâmica`;
  }

  return `Fotografia profissional do produto "${productName}". ${contextBrief}`;
}

// ===== BANNER-SPECIFIC PROMPT BUILDER =====

/**
 * Builds a prompt for a specific visual slot, combining:
 * - The creative style base prompt
 * - Composition rules per slot (desktop/mobile, editable/complete)
 * - Campaign detection from briefing
 * - Store and product context
 */
export function buildPromptForSlot(
  request: VisualGenerationRequest,
  slot: VisualSlot,
): string {
  const { outputMode, creativeStyle, briefing, product, category, store, styleConfig, slideIndex } = request;
  const isComplete = outputMode === 'complete';

  // Build subject description
  let subjectDescription = 'Produtos variados da loja em composição premium.';
  let productImageNote = '';
  if (product) {
    subjectDescription = `O produto "${product.name}"`;
    if (product.description) subjectDescription += ` — ${product.description.substring(0, 200)}`;
    subjectDescription += '.';
    if (product.mainImageUrl) {
      productImageNote = `REFERÊNCIA VISUAL: Uma foto do produto real foi anexada. Reproduza FIELMENTE a cor, forma, embalagem e textura do produto na composição. O produto deve ser reconhecível como o mesmo da foto.`;
    }
  } else if (category) {
    subjectDescription = `Produtos da categoria "${category.name}" em composição premium.`;
  }

  // Store identity
  let storeIdentity = `Loja: "${store.storeName}".`;
  if (store.storeDescription) storeIdentity += ` ${store.storeDescription.substring(0, 200)}.`;

  const briefingLine = briefing ? `Briefing: "${briefing}".` : '';
  const slideNote = slideIndex !== undefined ? `Slide ${slideIndex + 1} do carrossel — varie cenário/atmosfera.` : '';

  // Campaign detection
  const briefingLower = (briefing || '').toLowerCase();
  const isCampaign = /páscoa|natal|black friday|dia das mães|dia dos pais|dia dos namorados|carnaval|ano novo|verão|inverno|primavera|outono|dia do consumidor|aniversário/.test(briefingLower);
  const hasDiscount = /\d+%|desconto|oferta|promoção|promo|off|frete gr[áa]tis|cupom/.test(briefingLower);

  let campaignTheme = '';
  if (/páscoa/.test(briefingLower)) campaignTheme = 'Páscoa: tons dourados, chocolate, ovos decorativos sutis no cenário, atmosfera acolhedora e festiva.';
  else if (/natal/.test(briefingLower)) campaignTheme = 'Natal: tons vermelho/dourado/verde, luzes bokeh, atmosfera natalina elegante e premium.';
  else if (/black friday/.test(briefingLower)) campaignTheme = 'Black Friday: tons escuros dominantes (preto, dourado), contraste dramático, atmosfera de urgência e exclusividade.';
  else if (/dia das mães/.test(briefingLower)) campaignTheme = 'Dia das Mães: tons suaves e sofisticados, flores sutis no cenário, atmosfera carinhosa e premium.';
  else if (/dia dos pais/.test(briefingLower)) campaignTheme = 'Dia dos Pais: tons sóbrios e elegantes (azul marinho, cinza), atmosfera masculina e sofisticada.';
  else if (/dia dos namorados/.test(briefingLower)) campaignTheme = 'Dia dos Namorados: tons românticos (vermelho, rosa dourado), atmosfera íntima e premium.';
  else if (/verão/.test(briefingLower)) campaignTheme = 'Verão: tons vibrantes e quentes, luz solar, atmosfera fresca e energética.';
  else if (/inverno/.test(briefingLower)) campaignTheme = 'Inverno: tons frios e aconchegantes, atmosfera sofisticada e intimista.';

  let campaignDirective = '';
  if (isCampaign || hasDiscount) {
    campaignDirective = `
DIREÇÃO DE CAMPANHA (PRIORIDADE MÁXIMA):
- Este banner é para uma CAMPANHA COMERCIAL REAL, não uma foto de produto genérica.
- O CENÁRIO INTEIRO deve respirar o tema da campanha.
${campaignTheme ? `- TEMA VISUAL: ${campaignTheme}` : ''}
${isCampaign ? '- Elementos visuais temáticos devem estar INTEGRADOS ao cenário de forma orgânica.' : ''}
${hasDiscount ? '- A atmosfera deve transmitir OPORTUNIDADE e URGÊNCIA: iluminação dramática, contraste forte.' : ''}
- ${isComplete ? 'A peça deve parecer um anúncio publicitário completo e profissional de grande e-commerce.' : 'NÃO adicione texto na imagem — toda informação de oferta/campanha será colocada como overlay HTML.'}
- PENSE como um diretor de arte: qual cenário, iluminação e composição fariam alguém parar e olhar?`;
  }

  // For person_interacting or promotional style, use the style-specific prompt builder
  // This applies to BOTH editable and complete modes
  if (creativeStyle === 'person_interacting' || creativeStyle === 'promotional') {
    const productName = product?.name || category?.name || 'Produto';
    const basePrompt = buildPromptForStyle({
      productName,
      style: creativeStyle,
      styleConfig,
      contextBrief: briefing || '',
      format: `${slot.width}x${slot.height}`,
    });

    const isDesktopSlot = slot.composition.includes('desktop') || slot.composition === 'horizontal';
    const compositionNote = isDesktopSlot
      ? `PROPORÇÃO: ${slot.width}x${slot.height}px (horizontal widescreen). Composição pensada para tela larga.`
      : `PROPORÇÃO: ${slot.width}x${slot.height}px (vertical retrato). Composição pensada para tela de celular.`;

    if (isComplete) {
      return `${basePrompt}\n\n${compositionNote}\n\n${storeIdentity}\n${briefingLine}\n${slideNote}\n${campaignDirective}\n\nMODO CRIATIVO COMPLETO:\n- Esta é uma peça publicitária FINAL. Composição fechada, sem reservar espaço vazio para texto.\n- A imagem deve funcionar como anúncio pronto para e-commerce.\n- Se incluir texto na imagem, deve ser visualmente integrado e legível.`;
    } else {
      // EDITABLE mode with person/promotional: keep style but add safe area rules
      const safeAreaRule = isDesktopSlot
        ? `COMPOSIÇÃO (EDITÁVEL - DESKTOP):\n- Os ~50-60% ESQUERDOS DEVEM ter fundo mais escuro ou gradiente natural para receber texto branco sobreposto.\n- A pessoa/produto pode ocupar o lado DIREITO.\n- Transição suave entre zona escura e zona da cena.`
        : `COMPOSIÇÃO (EDITÁVEL - MOBILE):\n- O TERÇO SUPERIOR (~35% da altura) DEVE ser mais escuro/gradiente para receber texto branco sobreposto.\n- A pessoa/produto pode ocupar o CENTRO e parte inferior.\n- O TERÇO INFERIOR deve ter espaço para um botão CTA.`;

      return `${basePrompt}\n\n${compositionNote}\n\n${storeIdentity}\n${briefingLine}\n${slideNote}\n${campaignDirective}\n\nMODO EDITÁVEL (FUNDO PARA OVERLAY):\n- Textos serão adicionados em HTML POR CIMA da imagem — NÃO inclua texto na imagem.\n${safeAreaRule}\n\nPROIBIÇÕES:\n- ❌ NENHUM texto, letra, número, logo ou badge na imagem\n- ❌ NENHUM elemento gráfico/UI (botões, bordas, molduras)`;
    }
  }

  // Composition rules based on slot composition hint + output mode
  const isDesktop = slot.composition.includes('desktop') || slot.composition === 'horizontal';

  if (isComplete) {
    // COMPLETE MODE: Full composition, no safe areas
    if (isDesktop) {
      return `CRIE UMA PEÇA PUBLICITÁRIA COMPLETA DE E-COMMERCE. Proporção: ${slot.width}x${slot.height}px (widescreen).

${storeIdentity}
ASSUNTO: ${subjectDescription}
${productImageNote}
${briefingLine}
${slideNote}
${campaignDirective}

COMPOSIÇÃO (CRIATIVO COMPLETO - DESKTOP):
- Composição FECHADA como anúncio pronto. Sem reservar espaço vazio para overlay.
- Produto integrado à composição de forma comercial e impactante.
- A peça deve parecer um anúncio profissional de grande e-commerce ou revista.
- Pode incluir texto publicitário integrado se fizer sentido com o briefing.
- Cenário rico e contextual, iluminação dramática ou premium.

DIREÇÃO DE ARTE:
- Qualidade de campanha publicitária profissional.
- Composição dinâmica com hierarquia visual clara.
- Cores vibrantes e harmônicas. Qualidade 4K.
- O resultado deve ser uma peça comercial PRONTA, não um fundo genérico.

PROIBIÇÕES:
- ❌ Fundo branco ou cinza chapado
- ❌ Composição amadora ou sem impacto`;
    } else {
      return `CRIE UMA PEÇA PUBLICITÁRIA COMPLETA PARA MOBILE. Proporção: ${slot.width}x${slot.height}px (vertical).

${storeIdentity}
ASSUNTO: ${subjectDescription}
${productImageNote}
${briefingLine}
${slideNote}
${campaignDirective}

COMPOSIÇÃO (CRIATIVO COMPLETO - MOBILE):
- Composição FECHADA como anúncio pronto para celular.
- Sem reservar espaço vazio. Toda a área da imagem é composição criativa.
- Produto bem enquadrado e proporcionado para tela estreita.
- A peça deve parecer um anúncio de stories/feed profissional.

DIREÇÃO DE ARTE:
- Qualidade de campanha publicitária mobile.
- Enquadramento vertical pensado para celular.
- Cores vibrantes, qualidade 4K.

PROIBIÇÕES:
- ❌ Fundo branco ou cinza chapado
- ❌ Produto desproporcional ao espaço`;
    }
  }

  // EDITABLE MODE: Safe areas for HTML overlay (current behavior, improved)
  if (isDesktop) {
    return `CRIE UM BANNER HORIZONTAL DE E-COMMERCE. Proporção exata: ${slot.width}x${slot.height}px (12:5 widescreen).

${storeIdentity}
ASSUNTO: ${subjectDescription}
${productImageNote}
${briefingLine}
${slideNote}

COMPOSIÇÃO OBRIGATÓRIA (DESKTOP):
- O PRODUTO deve ocupar o TERÇO DIREITO da imagem (~30% da largura MÁXIMO), bem enquadrado, proporcionado ao cenário e em destaque.
- O PRODUTO NÃO pode dominar todo o banner. Ele deve estar integrado à composição, não colado ou gigante.
- Os ~60-70% ESQUERDOS DEVEM ter fundo escuro, gradiente natural ou área de baixo contraste. Esta zona será usada para overlay de texto branco — PRECISA ser escura o suficiente para texto branco ser legível.
- O gradiente deve ser NATURAL e integrado ao cenário (iluminação lateral, sombra ambiente, fundo escurecido), não um retângulo de cor sólida.
- Transição suave entre a zona escura e a zona do produto.
${campaignDirective}

DIREÇÃO DE ARTE:
- Fotografia comercial profissional, iluminação de estúdio com dramática lateral.
- Fundo contextual rico (superfície, textura, ambiente) — NUNCA fundo branco chapado.
- Profundidade de campo com bokeh suave no fundo.
- Cores vibrantes e harmônicas. Qualidade 4K.
- O banner deve parecer uma peça comercial de campanha, não apenas uma foto de produto.

PROIBIÇÕES ABSOLUTAS:
- ❌ NENHUM texto, letra, número, logo ou badge na imagem
- ❌ NENHUMA pessoa, mão ou modelo
- ❌ NENHUM fundo branco ou cinza claro chapado
- ❌ NENHUM elemento gráfico/UI (botões, bordas, molduras)
- ❌ Produto NÃO pode ocupar mais de 30% da largura total`;
  } else {
    return `CRIE UM BANNER VERTICAL PARA MOBILE. Proporção exata: ${slot.width}x${slot.height}px (4:5 retrato).

${storeIdentity}
ASSUNTO: ${subjectDescription}
${productImageNote}
${briefingLine}
${slideNote}

COMPOSIÇÃO OBRIGATÓRIA (MOBILE):
- O TERÇO SUPERIOR (~35-40% da altura) DEVE ser escuro/gradiente natural para receber texto branco sobreposto.
- O PRODUTO deve estar no CENTRO da imagem (~40% da altura MÁXIMO), bem enquadrado e proporcionado — NÃO gigante, NÃO cortado.
- O TERÇO INFERIOR deve ter espaço para um botão CTA (zona mais limpa/escura).
- O gradiente escuro no topo deve ser NATURAL (iluminação de cima, sombra ambiente), integrado ao cenário.
- Transição suave entre as zonas.
${campaignDirective}

DIREÇÃO DE ARTE:
- Fotografia comercial profissional, iluminação de estúdio.
- Fundo contextual (superfície, textura) — NUNCA fundo branco chapado.
- Enquadramento pensado para tela estreita. Produto centralizado e PROPORCIONADO ao espaço.
- Cores vibrantes e harmônicas. Qualidade 4K.
- O banner deve parecer uma peça comercial de campanha, não apenas uma foto de produto.

PROIBIÇÕES ABSOLUTAS:
- ❌ NENHUM texto, letra, número, logo ou badge na imagem
- ❌ NENHUMA pessoa, mão ou modelo
- ❌ NENHUM fundo branco ou cinza claro chapado
- ❌ NENHUM elemento gráfico/UI (botões, bordas, molduras)
- ❌ Produto NÃO pode ocupar mais de 40% da altura total`;
  }
}

// ===== GENERATE WITH LOVABLE GATEWAY (Gemini) =====

export async function generateWithLovableGateway(
  lovableApiKey: string,
  model: string,
  prompt: string,
  referenceImageBase64: string | null,
): Promise<{ imageBase64: string | null; error?: string }> {
  try {
    console.log(`[visual-engine] Generating with ${model}...`);
    
    const content: any[] = [{ type: 'text', text: prompt }];
    if (referenceImageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${referenceImageBase64}` },
      });
    }

    const response = await fetch(LOVABLE_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[visual-engine] ${model} error: ${response.status}`, errorText.substring(0, 300));
      if (response.status === 429) return { imageBase64: null, error: `Rate limit ${model}` };
      if (response.status === 402) return { imageBase64: null, error: 'Créditos insuficientes' };
      return { imageBase64: null, error: `${model} error: ${response.status}` };
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.warn(`[visual-engine] ${model} returned no image`);
      return { imageBase64: null, error: `${model} não retornou imagem` };
    }

    const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      // It may already be just the data URL
      if (imageUrl.startsWith('data:')) {
        const b64 = imageUrl.split(',')[1];
        if (b64) return { imageBase64: b64 };
      }
      return { imageBase64: null, error: `Formato inválido ${model}` };
    }

    console.log(`[visual-engine] ${model} OK (${base64Match[1].length} chars)`);
    return { imageBase64: base64Match[1] };
  } catch (error) {
    console.error(`[visual-engine] ${model} error:`, error);
    return { imageBase64: null, error: String(error) };
  }
}

// ===== GENERATE WITH REAL OPENAI =====

export async function generateWithRealOpenAI(
  openaiApiKey: string,
  prompt: string,
  referenceImageBase64: string | null,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  const model = 'gpt-image-1';
  try {
    console.log(`[visual-engine] Generating with real OpenAI ${model}...`);
    const userContent: any[] = [{ type: 'text', text: prompt }];
    if (referenceImageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${referenceImageBase64}` },
      });
    }

    const response = await fetch(OPENAI_CHAT_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[visual-engine] OpenAI ${model} error: ${response.status}`, errorText.substring(0, 300));
      return { imageBase64: null, model, error: `OpenAI error: ${response.status}` };
    }

    const data = await response.json();
    let b64: string | null = null;

    // Try output_images first
    const outputImages = data.choices?.[0]?.message?.output_images;
    if (outputImages?.length > 0) {
      const imgUrl = outputImages[0]?.url || outputImages[0];
      if (typeof imgUrl === 'string') {
        b64 = imgUrl.startsWith('data:') ? imgUrl.split(',')[1] : imgUrl;
      }
    }

    // Fallback: content parts
    if (!b64) {
      const content = data.choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            b64 = part.image_url.url.startsWith('data:') ? part.image_url.url.split(',')[1] : part.image_url.url;
            break;
          }
        }
      }
    }

    // Fallback: images array (Lovable format)
    if (!b64) {
      const images = data.choices?.[0]?.message?.images;
      if (images?.length > 0) {
        const url = images[0]?.image_url?.url;
        if (url) b64 = url.startsWith('data:') ? url.split(',')[1] : url;
      }
    }

    if (!b64) {
      return { imageBase64: null, model, error: 'OpenAI não retornou imagem' };
    }
    console.log(`[visual-engine] OpenAI OK (${b64.length} chars)`);
    return { imageBase64: b64, model };
  } catch (error) {
    console.error(`[visual-engine] OpenAI error:`, error);
    return { imageBase64: null, model, error: String(error) };
  }
}

// ===== RESILIENT GENERATE (OpenAI → Gemini Pro → Gemini Flash) =====

export async function resilientGenerate(
  lovableApiKey: string,
  openaiApiKey: string | null,
  prompt: string,
  referenceImageBase64: string | null,
  preferOpenAI: boolean = false,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  if (preferOpenAI && openaiApiKey) {
    const attempt1 = await generateWithRealOpenAI(openaiApiKey, prompt, referenceImageBase64);
    if (attempt1.imageBase64) return attempt1;
    console.warn(`[visual-engine] OpenAI failed: ${attempt1.error}. Falling back to Gemini...`);
  }

  // Gemini Pro
  const attempt2 = await generateWithLovableGateway(lovableApiKey, LOVABLE_MODELS.primary, prompt, referenceImageBase64);
  if (attempt2.imageBase64) return { imageBase64: attempt2.imageBase64, model: LOVABLE_MODELS.primary };

  console.warn(`[visual-engine] Gemini Pro failed: ${attempt2.error}. Trying Flash...`);

  // Gemini Flash
  const attempt3 = await generateWithLovableGateway(lovableApiKey, LOVABLE_MODELS.fallback, prompt, referenceImageBase64);
  if (attempt3.imageBase64) return { imageBase64: attempt3.imageBase64, model: LOVABLE_MODELS.fallback };

  console.warn(`[visual-engine] Flash failed: ${attempt3.error}. Trying simplified prompt...`);

  // Simplified fallback
  const productName = prompt.match(/"([^"]+)"/)?.[1] || 'produto';
  const simplifiedPrompt = `Crie uma fotografia profissional do produto "${productName}" em fundo escuro elegante. O produto deve ser IDÊNTICO à imagem de referência. Qualidade editorial.`;
  const attempt4 = await generateWithLovableGateway(lovableApiKey, LOVABLE_MODELS.primary, simplifiedPrompt, referenceImageBase64);
  if (attempt4.imageBase64) return { imageBase64: attempt4.imageBase64, model: `${LOVABLE_MODELS.primary} (simplified)` };

  return { imageBase64: null, model: LOVABLE_MODELS.primary, error: 'All generation attempts failed' };
}

// ===== QA SCORER =====

export async function scoreImageForRealism(
  lovableApiKey: string,
  imageBase64: string,
  originalProductBase64: string,
  productName: string,
): Promise<QAScores> {
  console.log(`[visual-engine] Scoring image for realism...`);
  try {
    const response = await fetch(LOVABLE_GATEWAY_URL, {
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
              text: `Você é um juiz especialista em avaliar REALISMO de imagens geradas por IA.\n\nTAREFA: Avaliar se a IMAGEM GERADA parece uma FOTO REAL.\nPRODUTO ESPERADO: "${productName}"\n\nAvalie de 0 a 10:\n1. REALISM\n2. QUALITY\n3. COMPOSITION\n4. LABEL\n\nResponda APENAS em JSON:\n{"realism":<0-10>,"quality":<0-10>,"composition":<0-10>,"label":<0-10>,"reasoning":"<breve>"}`
            },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${originalProductBase64}` } },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };

    const scores = JSON.parse(jsonMatch[0]);
    const realism = Math.min(10, Math.max(0, Number(scores.realism) || 5));
    const quality = Math.min(10, Math.max(0, Number(scores.quality) || 5));
    const composition = Math.min(10, Math.max(0, Number(scores.composition) || 5));
    const label = Math.min(10, Math.max(0, Number(scores.label) || 5));
    const overall = (realism / 10) * 0.40 + (quality / 10) * 0.20 + (composition / 10) * 0.15 + (label / 10) * 0.25;

    console.log(`[visual-engine] Scores: r=${realism}, q=${quality}, c=${composition}, l=${label}, o=${overall.toFixed(2)}`);
    return { realism, quality, composition, label, overall };
  } catch (error) {
    console.error(`[visual-engine] Scorer error:`, error);
    return { realism: 5, quality: 5, composition: 5, label: 5, overall: 0.5 };
  }
}

// ===== IMAGE DOWNLOAD (robust with retries) =====

export async function downloadImageAsBase64(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[visual-engine] Downloading (attempt ${attempt}/3): ${url.substring(0, 100)}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VisualEngine/1.0)' },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 100) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
        return null;
      }
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
      return btoa(binary);
    } catch (error: any) {
      console.error(`[visual-engine] Download error (attempt ${attempt}):`, error?.message);
      if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
      return null;
    }
  }
  return null;
}

// ===== UPLOAD TO STORAGE =====

export async function uploadToStorage(
  supabase: any,
  tenantId: string,
  imageData: string, // base64 or data URL
  label: string,
  bucket: string = 'store-assets',
  subfolder: string = 'block-creatives',
): Promise<string | null> {
  try {
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const timestamp = Date.now();
    const safeName = label.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    const filename = `${safeName}-${timestamp}.png`;
    const filePath = `${tenantId}/${subfolder}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('[visual-engine] Upload error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.error('[visual-engine] Upload error:', error);
    return null;
  }
}

// ===== HIGH-LEVEL: GENERATE FOR A SINGLE REQUEST =====

/**
 * Generates all slots for a single VisualGenerationRequest.
 * Uses resilient cascade, downloads product reference, uploads results.
 */
export async function generateForRequest(
  request: VisualGenerationRequest,
  supabase: any,
  tenantId: string,
  lovableApiKey: string,
  openaiApiKey: string | null,
): Promise<VisualGenerationResult> {
  const startTime = Date.now();
  const assets: GeneratedAsset[] = [];

  // Download product reference image if available
  let referenceBase64: string | null = null;
  if (request.product?.mainImageUrl) {
    referenceBase64 = await downloadImageAsBase64(request.product.mainImageUrl);
  }

  // Determine if we should try OpenAI first
  const preferOpenAI = !!openaiApiKey && request.outputMode === 'complete';

  // Generate all slots in parallel
  const slotPromises = request.slots.map(async (slot) => {
    const prompt = buildPromptForSlot(request, slot);

    const result = await resilientGenerate(
      lovableApiKey,
      openaiApiKey,
      prompt,
      referenceBase64,
      preferOpenAI,
    );

    if (!result.imageBase64) {
      console.error(`[visual-engine] Failed to generate slot: ${slot.key}`);
      return null;
    }

    // Upload to storage
    const publicUrl = await uploadToStorage(supabase, tenantId, result.imageBase64, slot.key);
    if (!publicUrl) {
      console.error(`[visual-engine] Failed to upload slot: ${slot.key}`);
      return null;
    }

    const asset: GeneratedAsset = {
      slotKey: slot.key,
      publicUrl,
      model: result.model,
    };

    // Optional QA scoring
    if (request.enableQA && referenceBase64 && request.product) {
      asset.score = await scoreImageForRealism(
        lovableApiKey,
        result.imageBase64,
        referenceBase64,
        request.product.name,
      );
    }

    return asset;
  });

  const results = await Promise.all(slotPromises);
  for (const r of results) {
    if (r) assets.push(r);
  }

  const elapsed = Date.now() - startTime;
  const renderMode = request.outputMode === 'complete' ? 'baked' : 'overlay';

  return {
    assets,
    renderMode,
    metadata: {
      model: assets[0]?.model || LOVABLE_MODELS.primary,
      elapsed,
      qaEnabled: !!request.enableQA,
      outputMode: request.outputMode,
      creativeStyle: request.creativeStyle,
    },
  };
}
