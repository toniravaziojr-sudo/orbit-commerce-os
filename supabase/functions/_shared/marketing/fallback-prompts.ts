// =============================================
// FALLBACK PROMPTS — Enrichment Only (V4.0)
// Provides tone/language/visual enrichment for short prompts
// NO structural rules (sections, ordering) — handled by engine-plan.ts
// v2.0.0
// =============================================

export interface FallbackPrompt {
  id: string;
  name: string;
  description: string;
  /** Nichos ideais para este prompt (vazio = universal) */
  idealNiches: string[];
  /** Prompt de enriquecimento (tom, linguagem, estilo visual — SEM estrutura de seções) */
  prompt: string;
}

/**
 * 5 prompts de enriquecimento que cobrem os principais estilos visuais e tons.
 * NÃO definem estrutura de seções — isso é responsabilidade do engine-plan.ts.
 * A IA seleciona o mais adequado baseado no tipo/tags/nicho do produto.
 */
export const FALLBACK_PROMPTS: FallbackPrompt[] = [
  {
    id: "dark-authority",
    name: "Autoridade Premium (Dark Mode)",
    description: "Estilo escuro e sofisticado para produtos premium, saúde masculina, suplementos e cosméticos de alta gama",
    idealNiches: ["saúde", "beleza", "masculino", "suplemento", "cosmético", "premium", "barbear", "skincare", "anti-idade", "capilar"],
    prompt: `DIREÇÃO CRIATIVA:
- Estilo visual: Dark premium com fundo #0a0a0a a #111827, acentos dourados/âmbar (#c9a96e, #d4a853)
- Tipografia: Headlines em Sora (peso 800), corpo em Inter — transmitindo confiança e sofisticação
- Tom: Autoridade científica + exclusividade + urgência controlada
- Imagens: produto como protagonista absoluto com iluminação dramática de estúdio (rim light)
- Power words: Exclusivo, Comprovado, Clinicamente Testado, Fórmula Avançada
- CTAs variados: "Quero Minha Transformação", "Garantir Minha Unidade", "Aproveitar Oferta Exclusiva"
- Micro-copy de urgência: "Estoque limitado", "Últimas unidades com desconto"`,
  },

  {
    id: "editorial-clean",
    name: "Editorial Clean (Moda & Lifestyle)",
    description: "Visual clean e editorial para moda, acessórios, lifestyle e produtos artesanais",
    idealNiches: ["moda", "acessório", "roupa", "joias", "bolsa", "sapato", "lifestyle", "artesanal", "decoração", "casa", "perfume"],
    prompt: `DIREÇÃO CRIATIVA:
- Estilo visual: Branco editorial (#ffffff, #fafafa), tipografia serifa elegante para headlines (Playfair Display 800), Inter para corpo
- Whitespace generoso, grid assimétrico, visual de revista de moda/lifestyle
- Tom: Elegante + aspiracional + storytelling emocional
- Imagens: produto em composição editorial com muito espaço negativo, sombras suaves e luz natural
- Headlines curtas e elegantes (max 8 palavras), tom aspiracional
- Evite urgência agressiva — prefira "Descubra", "Experimente", "Eleve seu estilo"
- CTAs sofisticados: "Descobrir Agora", "Quero o Meu", "Adicionar ao Guarda-Roupa"`,
  },

  {
    id: "tech-futurista",
    name: "Tech Futurista (Gadgets & Eletrônicos)",
    description: "Visual futurista com glassmorphism para gadgets, eletrônicos, SaaS e ferramentas tech",
    idealNiches: ["tech", "tecnologia", "eletrônico", "gadget", "celular", "fone", "smart", "digital", "software", "app", "ferramenta"],
    prompt: `DIREÇÃO CRIATIVA:
- Estilo visual: Dark mode (#0f0f23, #1a1a2e) com gradientes neon (purple→blue, #7c3aed→#3b82f6), glassmorphism nos cards
- Tipografia: Sora para headlines (peso 800), Inter para corpo, mono para specs/dados técnicos
- Tom: Inovação + performance + dados precisos + exclusividade tech
- Imagens: produto com iluminação neon de contorno (glow effect), fundo dark com partículas ou gradientes mesh
- Headlines com dados precisos e specs (ex: "3x mais rápido", "bateria de 48h")
- Linguagem técnica acessível — não simplista, mas não alienante
- CTAs tech: "Quero essa Performance", "Garantir o Meu", "Upgrade Agora"`,
  },

  {
    id: "organico-sensorial",
    name: "Orgânico Sensorial (Alimentos & Naturais)",
    description: "Visual quente e orgânico para alimentos, bebidas, produtos naturais e orgânicos",
    idealNiches: ["alimento", "comida", "bebida", "café", "chá", "orgânico", "natural", "vegano", "fit", "nutrição", "tempero", "mel"],
    prompt: `DIREÇÃO CRIATIVA:
- Estilo visual: Tons quentes — terracota (#c4704c), verde oliva (#6b7c4e), creme (#faf5eb), marrom café (#3c2415)
- Texturas orgânicas sutis (linho, madeira, papel craft) como backgrounds
- Tipografia: Playfair Display para headlines (tradição), Inter para corpo
- Tom: Acolhedor + artesanal + saúde + autenticidade + prazer sensorial
- Copy que ativa os 5 sentidos (sabor, aroma, textura, visual, som do preparo)
- Storytelling de origem e tradição — "Colhido à mão", "Receita de família"
- CTAs acolhedores: "Quero Experimentar", "Provar Agora", "Garantir o Meu"
- Badges: "100% Natural", "Sem conservantes", "Origem rastreável"`,
  },

  {
    id: "urgencia-conversao",
    name: "Máxima Conversão (Urgência & Escassez)",
    description: "Visual agressivo de vendas para promoções, lançamentos e ofertas por tempo limitado — qualquer nicho",
    idealNiches: [], // Universal
    prompt: `DIREÇÃO CRIATIVA:
- Estilo visual: Fundo escuro (#111827) com acentos de urgência (vermelho #ef4444, amarelo #f59e0b), cor primária nos CTAs
- Badges e banners de alerta visual espalhados estrategicamente
- Tipografia: Sora Bold para headlines (peso 800), Inter para corpo
- Tom: Urgência + escassez + FOMO + prova social massiva + garantia forte
- Headlines com números exatos e urgência: "Últimas 47 unidades", "87% dos clientes recompram"
- Power words em destaque: EXCLUSIVO, GARANTIDO, LIMITADO, GRÁTIS, COMPROVADO
- CTAs urgentes: "🔥 Garantir Minha Oferta", "Sim, Eu Quero!", "Aproveitar Antes que Acabe"
- Micro-copy em cada CTA: "Entrega em X dias", "Parcelamos em até 12x"`,
  },
];

/**
 * Detecta se o prompt do usuário é "fraco" (curto ou sem direção completa).
 * Se sim, seleciona o fallback mais adequado ao produto.
 */
export function isPromptIncomplete(prompt: string): boolean {
  const stripped = prompt.trim();
  if (stripped.length < 80) return true;
  const sentenceCount = stripped.split(/[.!?\n]/).filter(s => s.trim().length > 5).length;
  if (sentenceCount < 3) return true;
  const directionKeywords = ["hero", "seção", "cor", "estilo", "visual", "tom", "headline", "cta", "conversão", "depoimento", "faq", "oferta", "prova social", "urgência"];
  const hasDirection = directionKeywords.some(kw => stripped.toLowerCase().includes(kw));
  if (!hasDirection) return true;
  return false;
}

/**
 * Seleciona o fallback prompt mais adequado baseado no produto.
 * Analisa product_type, tags e description para encontrar o melhor match.
 */
export function selectBestFallback(
  productType?: string | null,
  tags?: string[] | null,
  description?: string | null,
  productName?: string | null,
): FallbackPrompt {
  const searchText = [
    productType || "",
    ...(tags || []),
    description?.substring(0, 300) || "",
    productName || "",
  ].join(" ").toLowerCase();

  let bestMatch: FallbackPrompt | null = null;
  let bestScore = 0;

  for (const fp of FALLBACK_PROMPTS) {
    if (fp.idealNiches.length === 0) continue;
    const score = fp.idealNiches.reduce((acc, niche) => {
      return acc + (searchText.includes(niche) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = fp;
    }
  }

  if (!bestMatch || bestScore === 0) {
    return FALLBACK_PROMPTS.find(fp => fp.id === "urgencia-conversao")!;
  }

  return bestMatch;
}
