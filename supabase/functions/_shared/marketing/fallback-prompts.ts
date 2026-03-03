// =============================================
// FALLBACK PROMPTS — Direções Criativas Completas
// Usados quando o usuário fornece prompt curto ou incompleto
// v1.0.0
// =============================================

export interface FallbackPrompt {
  id: string;
  name: string;
  description: string;
  /** Nichos ideais para este prompt (vazio = universal) */
  idealNiches: string[];
  /** Prompt completo que será injetado como "direção criativa" */
  prompt: string;
}

/**
 * 5 prompts de alta conversão que cobrem os principais estilos de landing page.
 * A IA seleciona o mais adequado baseado no tipo/tags/nicho do produto.
 */
export const FALLBACK_PROMPTS: FallbackPrompt[] = [
  {
    id: "dark-authority",
    name: "Autoridade Premium (Dark Mode)",
    description: "Estilo escuro e sofisticado para produtos premium, saúde masculina, suplementos e cosméticos de alta gama",
    idealNiches: ["saúde", "beleza", "masculino", "suplemento", "cosmético", "premium", "barbear", "skincare", "anti-idade", "capilar"],
    prompt: `Crie uma landing page de ALTA CONVERSÃO com visual DARK PREMIUM e tom de AUTORIDADE.

DIREÇÃO CRIATIVA:
- Estilo visual: Dark premium com fundo #0a0a0a a #111827, acentos dourados/âmbar (#c9a96e, #d4a853)
- Tipografia: Headlines em Sora (peso 800), corpo em Inter — transmitindo confiança e sofisticação
- Tom: Autoridade científica + exclusividade + urgência controlada
- Imagens: produto como protagonista absoluto com iluminação dramática de estúdio (rim light)

ESTRUTURA PERSUASIVA:
1. HERO de impacto (min-height: 90vh) — headline atacando a DOR principal do público-alvo, sub-headline com promessa de transformação, CTA dourado pulsante, trust bar com selos de segurança
2. BARRA DE CREDIBILIDADE — "Dermatologicamente testado", "Fórmula patenteada", "Aprovado pela ANVISA" (ou equivalentes reais do produto)
3. PROBLEMA → SOLUÇÃO (layout split) — lado esquerdo com dores (ícones ❌ vermelhos), lado direito com benefícios (ícones ✅ verdes)
4. PRODUTO EM DESTAQUE — foto grande com efeito 3D sutil + lista de ingredientes/benefícios em cards elegantes + preço com âncora (de/por)
5. PROVA SOCIAL — depoimentos em cards escuros com borda sutil dourada, estrelas visuais, fotos circulares
6. COMPARATIVO — tabela "Nosso produto vs genéricos" com ✅ e ❌ visuais
7. OFERTA IRRESISTÍVEL — card centralizado com gradiente sutil, preço com economia calculada, selos de garantia + pagamento seguro, CTA grande
8. FAQ — objeções transformadas em perguntas (5-7 itens)
9. CTA FINAL — headline de fechamento urgente + garantia de 30 dias + último CTA

REGRAS DE COPY:
- Use números específicos nas headlines (ex: "93% dos homens notaram diferença em 14 dias")
- Power words: Exclusivo, Comprovado, Clinicamente Testado, Fórmula Avançada
- CTAs variados: "Quero Minha Transformação", "Garantir Minha Unidade", "Aproveitar Oferta Exclusiva"
- Micro-copy de urgência: "Estoque limitado", "Últimas unidades com desconto"`,
  },

  {
    id: "editorial-clean",
    name: "Editorial Clean (Moda & Lifestyle)",
    description: "Visual clean e editorial para moda, acessórios, lifestyle e produtos artesanais",
    idealNiches: ["moda", "acessório", "roupa", "joias", "bolsa", "sapato", "lifestyle", "artesanal", "decoração", "casa", "perfume"],
    prompt: `Crie uma landing page de ALTA CONVERSÃO com visual EDITORIAL CLEAN e tom ASPIRACIONAL.

DIREÇÃO CRIATIVA:
- Estilo visual: Branco editorial (#ffffff, #fafafa), tipografia serifa elegante para headlines (Playfair Display 800), Inter para corpo
- Whitespace generoso, grid assimétrico, visual de revista de moda/lifestyle
- Tom: Elegante + aspiracional + storytelling emocional
- Imagens: produto em composição editorial com muito espaço negativo, sombras suaves e luz natural

ESTRUTURA PERSUASIVA:
1. HERO EDITORIAL (min-height: 90vh) — headline serifa curta e impactante que desperta desejo, sub-headline que conta uma micro-história (1 frase), CTA elegante com bordas finas, trust bar minimalista
2. STORYTELLING DA MARCA — seção com texto de conexão emocional: "Criado para quem...", "Para os que valorizam...", fotos de lifestyle integradas
3. TRANSFORMAÇÃO VISUAL — antes/depois sutil (mais focado em estilo de vida do que em "problema"), layout split com imagens grandes
4. PRODUTO EM DESTAQUE — foto grande com whitespace, detalhes técnicos em tipografia fina e elegante, preço com apresentação sofisticada
5. GALERIA CURADA — grid assimétrico (1 grande + 2 pequenas empilhadas) mostrando detalhes e ângulos do produto
6. PROVA SOCIAL — depoimentos em formato de citação editorial com aspas grandes ("), nomes em serif, fundo neutro
7. OFERTA — apresentação clean com preço grande, benefícios em lista minimalista, CTA elegante, selos discretos
8. FAQ MINIMALISTA — estilo clean com toggle +/- sutil
9. CTA FINAL — frase curta e emocional + CTA + "Satisfação garantida"

REGRAS DE COPY:
- Headlines curtas e elegantes (max 8 palavras), tom aspiracional
- Evite urgência agressiva — prefira "Descubra", "Experimente", "Eleve seu estilo"
- CTAs sofisticados: "Descobrir Agora", "Quero o Meu", "Adicionar ao Guarda-Roupa"
- Storytelling emocional em vez de listas de features`,
  },

  {
    id: "tech-futurista",
    name: "Tech Futurista (Gadgets & Eletrônicos)",
    description: "Visual futurista com glassmorphism para gadgets, eletrônicos, SaaS e ferramentas tech",
    idealNiches: ["tech", "tecnologia", "eletrônico", "gadget", "celular", "fone", "smart", "digital", "software", "app", "ferramenta"],
    prompt: `Crie uma landing page de ALTA CONVERSÃO com visual TECH FUTURISTA e tom INOVADOR.

DIREÇÃO CRIATIVA:
- Estilo visual: Dark mode (#0f0f23, #1a1a2e) com gradientes neon (purple→blue, #7c3aed→#3b82f6), glassmorphism nos cards
- Tipografia: Sora para headlines (peso 800), Inter para corpo, mono para specs/dados técnicos
- Tom: Inovação + performance + dados precisos + exclusividade tech
- Imagens: produto com iluminação neon de contorno (glow effect), fundo dark com partículas ou gradientes mesh

ESTRUTURA PERSUASIVA:
1. HERO FUTURISTA (min-height: 90vh) — headline que promete performance/eficiência, sub-headline com spec principal destacada em badge neon, CTA com gradiente vibrante pulsante, trust bar com ícones de specs
2. SPECS EM DESTAQUE — 4 cards glassmorphism com stats grandes (números em 48px, gradient text) + ícones neon: Velocidade, Bateria, Resolução, etc.
3. PROBLEMA → SOLUÇÃO TECH — layout comparativo: "Tecnologia obsoleta" vs "Com [produto]", visual de before/after técnico com specs comparadas
4. PRODUTO EM DESTAQUE — foto com glow effect da cor primária, specs em grid de 2 colunas, preço em badge tech, CTA
5. VÍDEO/DEMO — seção com placeholder para vídeo (se houver) ou animação CSS de unboxing visual
6. PROVA SOCIAL — reviews com foco em performance e specs mencionadas, cards escuros com borda neon sutil
7. COMPARATIVO TÉCNICO — tabela escura com specs lado a lado: "[Produto] vs Concorrente A vs Concorrente B", com destaque visual no vencedor
8. OFERTA TECH — card com glassmorphism forte, preço com gradient text, badges de garantia tech ("2 anos de suporte", "Updates grátis")
9. FAQ técnico — perguntas sobre compatibilidade, specs, suporte
10. CTA FINAL — headline sobre inovação + CTA neon

REGRAS DE COPY:
- Headlines com dados precisos e specs (ex: "3x mais rápido", "bateria de 48h")
- Linguagem técnica acessível — não simplista, mas não alienante
- CTAs tech: "Quero essa Performance", "Garantir o Meu", "Upgrade Agora"
- Micro-copy: "Garantia estendida", "Suporte prioritário"`,
  },

  {
    id: "organico-sensorial",
    name: "Orgânico Sensorial (Alimentos & Naturais)",
    description: "Visual quente e orgânico para alimentos, bebidas, produtos naturais e orgânicos",
    idealNiches: ["alimento", "comida", "bebida", "café", "chá", "orgânico", "natural", "vegano", "fit", "nutrição", "tempero", "mel"],
    prompt: `Crie uma landing page de ALTA CONVERSÃO com visual ORGÂNICO SENSORIAL e tom ACOLHEDOR.

DIREÇÃO CRIATIVA:
- Estilo visual: Tons quentes — terracota (#c4704c), verde oliva (#6b7c4e), creme (#faf5eb), marrom café (#3c2415)
- Texturas orgânicas sutis (linho, madeira, papel craft) como backgrounds
- Tipografia: Playfair Display para headlines (transmite tradição), Inter para corpo
- Tom: Acolhedor + artesanal + saúde + autenticidade + prazer sensorial
- Imagens: fotografia de comida/produto com luz natural quente, close-ups sensoriais, steam/vapor se aplicável

ESTRUTURA PERSUASIVA:
1. HERO SENSORIAL (min-height: 90vh) — headline que desperta DESEJO sensorial ("O sabor que transforma suas manhãs", "Direto do produtor para sua mesa"), imagem grande do produto em contexto de uso, CTA em cor quente, trust bar com selos orgânicos
2. HISTÓRIA DE ORIGEM — seção com storytelling do produto: de onde vem, como é feito, tradição por trás, com fotos de lifestyle/produção
3. BENEFÍCIOS SENSORIAIS — 4 cards com ícones orgânicos: Sabor, Saúde, Origem, Qualidade — descrições que ativam os sentidos
4. PRODUTO EM DESTAQUE — foto grande com fundo texturizado, informações nutricionais em design clean, ingredientes destacados, preço com apresentação artesanal
5. COMO USAR/RECEITAS — seção prática mostrando formas de consumo ou receitas sugeridas (visual Pinterest-worthy)
6. PROVA SOCIAL — depoimentos focados em sabor e experiência, cards com fundo creme e borda sutil
7. COMPARATIVO HONESTO — "Nosso [produto] vs industrializados": ingredientes naturais vs artificiais, origem rastreável vs desconhecida
8. OFERTA — card com visual craft/artesanal, preço com badge de frete grátis, selos de qualidade, CTA
9. FAQ — ingredientes, validade, modo de preparo, alergênicos
10. CTA FINAL — headline sobre experiência sensorial + CTA + garantia

REGRAS DE COPY:
- Copy que ativa os 5 sentidos (sabor, aroma, textura, visual, som do preparo)
- Storytelling de origem e tradição — "Colhido à mão", "Receita de família"
- CTAs acolhedores: "Quero Experimentar", "Provar Agora", "Garantir o Meu"
- Badges: "100% Natural", "Sem conservantes", "Origem rastreável"`,
  },

  {
    id: "urgencia-conversao",
    name: "Máxima Conversão (Urgência & Escassez)",
    description: "Visual agressivo de vendas para promoções, lançamentos e ofertas por tempo limitado — qualquer nicho",
    idealNiches: [], // Universal — usado quando nenhum outro se encaixa ou quando o foco é conversão pura
    prompt: `Crie uma landing page de MÁXIMA CONVERSÃO focada em URGÊNCIA e ESCASSEZ.

DIREÇÃO CRIATIVA:
- Estilo visual: Fundo escuro (#111827) com acentos de PERIGO/URGÊNCIA (vermelho #ef4444, amarelo #f59e0b), cor primária da marca nos CTAs
- Badges e banners de alerta visual espalhados estrategicamente
- Tipografia: Sora Bold para headlines (peso 800), Inter para corpo
- Tom: Urgência + escassez + FOMO + prova social massiva + garantia forte
- Animações de atenção: CTAs pulsando, banners de estoque, timer visual

ESTRUTURA PERSUASIVA:
1. HERO DE IMPACTO MÁXIMO (min-height: 90vh) — headline PAS agressiva ("Chega de [problema]! [Número] pessoas já resolveram com [produto]"), badge de "OFERTA POR TEMPO LIMITADO" em vermelho, sub-headline com benefício principal, CTA grande pulsante com "🔥 Aproveitar Agora", trust bar com ícones + números ("37.000+ vendidos")
2. BARRA DE URGÊNCIA — banner fixo estilizado: "⚡ Oferta válida por tempo limitado — Estoque: XX unidades restantes"
3. PROBLEMA × SOLUÇÃO — impacto visual forte com ícones grandes, dores em vermelho (❌), benefícios em verde (✅), layout dramático
4. PRODUTO EM DESTAQUE — foto grande, badges sobrepostos ("MAIS VENDIDO", "-30% OFF"), lista de benefícios com checkmarks verdes, preço com ÂNCORA VISUAL forte (preço antigo grande e riscado em vermelho, preço novo grande e verde/primário)
5. PROVA SOCIAL MASSIVA — contador "37.000+ clientes satisfeitos", depoimentos em cards com estrelas amarelas, fotos circulares, destaque em frases-chave em negrito
6. COMPARATIVO DE VALOR — "Investimento vs Alternativas": mostrar que o produto é BARATO comparado com alternativas ou com "o custo de NÃO resolver"
7. OFERTA IRRESISTÍVEL — card com borda brilhante, preço com desconto calculado, parcelas, bônus listados, selos de garantia + pagamento seguro, CTA ENORME com animação, micro-copy: "🔒 Compra 100% segura • Satisfação garantida"
8. GARANTIA INCONDICIONAL — seção dedicada com ícone de escudo grande, "30 dias para testar. Se não amar, devolvemos 100% do seu dinheiro."
9. FAQ DE OBJEÇÕES — 7 perguntas que matam cada objeção (preço, funciona?, quanto tempo?, é seguro?)
10. CTA FINAL DUPLO — headline de escassez ("Últimas unidades com este preço") + CTA + reforço de garantia + timer visual

REGRAS DE COPY:
- Headlines com números exatos e urgência: "Últimas 47 unidades", "87% dos clientes recompram"
- Power words em CAPS: EXCLUSIVO, GARANTIDO, LIMITADO, GRÁTIS, COMPROVADO
- CTAs variados e urgentes: "🔥 Garantir Minha Oferta", "Sim, Eu Quero!", "Aproveitar Antes que Acabe"
- Micro-copy em cada CTA: "Entrega em X dias", "Parcelamos em até 12x"`,
  },
];

/**
 * Detecta se o prompt do usuário é "fraco" (curto ou sem direção completa).
 * Se sim, seleciona o fallback mais adequado ao produto.
 */
export function isPromptIncomplete(prompt: string): boolean {
  const stripped = prompt.trim();
  // Se tem menos de 80 chars ou menos de 3 frases, considerar incompleto
  if (stripped.length < 80) return true;
  const sentenceCount = stripped.split(/[.!?\n]/).filter(s => s.trim().length > 5).length;
  if (sentenceCount < 3) return true;
  // Se não menciona nenhuma palavra-chave de direção criativa
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
    if (fp.idealNiches.length === 0) continue; // skip universal
    const score = fp.idealNiches.reduce((acc, niche) => {
      return acc + (searchText.includes(niche) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = fp;
    }
  }

  // If no match found or score too low, use "urgencia-conversao" (universal)
  if (!bestMatch || bestScore === 0) {
    return FALLBACK_PROMPTS.find(fp => fp.id === "urgencia-conversao")!;
  }

  return bestMatch;
}
