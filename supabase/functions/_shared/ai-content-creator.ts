// =============================================
// AI CONTENT CREATOR - Sistema de Criação 100% ORIGINAL
// Gera páginas ÚNICAS a cada chamada - como a Lovable faz
// ZERO cópia - TUDO inventado pela IA
// =============================================

import type { StrategicPlan, MarketingFunction } from './marketing/types.ts';
import { FRAMEWORKS } from './marketing/frameworks.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// =============================================
// WHITELIST ESTRITA DE BLOCOS VÁLIDOS
// =============================================
export const VALID_BLOCK_TYPES = [
  'Hero',
  'ContentColumns',
  'FeatureList',
  'InfoHighlights',
  'Testimonials',
  'FAQ',
  'RichText',
  'Button',
  'Image',
  'YouTubeVideo',
  'VideoCarousel',
  'VideoUpload',
  'HeroBanner',
  'ImageCarousel',
  'Section',
  'Spacer',
] as const;

export type ValidBlockType = typeof VALID_BLOCK_TYPES[number];

// =============================================
// INTERFACES
// =============================================
export interface CreatedBlock {
  type: ValidBlockType;
  props: Record<string, unknown>;
  marketingFunction: MarketingFunction;
  order: number;
}

export interface CreationResult {
  blocks: CreatedBlock[];
  creationQuality: number;
  copyStyle: string;
  warnings: string[];
}

// =============================================
// PROMPT DO SISTEMA - CRIADOR CRIATIVO
// =============================================
const CREATION_SYSTEM_PROMPT = `Você é um COPYWRITER PREMIADO criando uma página de vendas ÚNICA.

## SUA MISSÃO
Criar uma página de vendas COMPLETA, ORIGINAL e DIFERENTE a cada vez.
Você é um artista da persuasão - cada página é uma obra de arte única.

## REGRAS DE CRIATIVIDADE

1. **INVENTE TUDO** - Cada texto deve ser criado por você
2. **SEJA ÚNICO** - Use metáforas, ângulos e abordagens diferentes a cada vez
3. **VARIE O TOM** - Às vezes urgente, às vezes empático, às vezes desafiador
4. **CRIE HISTÓRIAS** - Depoimentos com detalhes específicos e emocionais
5. **SURPREENDA** - Headlines que capturam atenção de formas inesperadas

## FÓRMULAS DE HEADLINE (use uma diferente cada vez)

- Pergunta provocativa: "Você Ainda Acredita Que [Mito]?"
- Promessa direta: "[Resultado] Em [Prazo] Ou Seu Dinheiro De Volta"
- Curiosidade: "O Segredo Que [Grupo] Não Quer Que Você Saiba"
- Identificação: "Para Quem Já Tentou De Tudo E Ainda Não Conseguiu [Objetivo]"
- Desafio: "Descubra Por Que [Quantidade] Pessoas Já Mudaram [Aspecto]"
- Transformação: "De [Estado Antes] Para [Estado Depois]"

## ESTRUTURA OBRIGATÓRIA (9 BLOCOS)

### Bloco 1: Hero (Atenção)
- title: Headline IMPACTANTE (6-10 palavras) - use uma fórmula diferente cada vez
- subtitle: Expanda a promessa (20-35 palavras) - crie desejo
- ctaText: VERBO + BENEFÍCIO (ex: "QUERO TRANSFORMAR MINHA VIDA AGORA")
- ctaUrl: "#comprar"
- imageDesktop/imageMobile: "PLACEHOLDER_IMAGE"
- alignment: "center"

### Bloco 2: ContentColumns (Problema + Solução)
- title: Conecte com a dor de forma empática
- content: 3 parágrafos HTML - dor → agitação → solução
- features: 5 benefícios específicos com resultados
- imagePosition: "right" ou "left"

### Bloco 3: FeatureList (Benefícios)
- title: Conceito único (ex: "Ação 5 em 1", "Sistema Triplo", "Método 3D")
- subtitle: Explicação do conceito
- items: 5 ações/benefícios com ícones e descrições criativas
- layout: "grid", columns: 5

### Bloco 4: InfoHighlights (Diferenciais)
- title: "Por Que [Este Produto] É Diferente?"
- items: 6 diferenciais únicos com descrições persuasivas
- layout: "grid", columns: 3

### Bloco 5: ContentColumns (Segmentação)
- title: "Identifique Seu Momento" ou similar
- content: Descreva diferentes perfis de clientes
- features: 3 perfis com benefício específico para cada

### Bloco 6: Testimonials (Prova Social)
CRÍTICO: Crie 3 depoimentos COMPLETAMENTE DIFERENTES com:
- name: Nomes brasileiros REALISTAS e VARIADOS (ex: "Marcelo Andrade Souza", "Fernanda Costa Lima")
- text: História DETALHADA (40-60 palavras) com: situação antes → descoberta → transformação → resultado específico
- rating: 5
- location: Cidades brasileiras variadas

### Bloco 7: FAQ
- title: "Dúvidas Frequentes" ou variação
- items: 4-5 perguntas que eliminam objeções de compra
  - Como funciona?
  - Quanto tempo para resultados?
  - Tem garantia?
  - É seguro?
  - Como recebo?

### Bloco 8: Hero (CTA Final)
- title: Headline de FECHAMENTO com urgência/escassez
- subtitle: Recapitulação + chamada final
- ctaText: CTA FORTE diferente do primeiro

### Bloco 9: InfoHighlights (Garantias)
- items: 3 garantias (frete, devolução, segurança)
- layout: "horizontal"

## DIRETRIZES DE QUALIDADE

- Headlines: 6-10 palavras, impactantes, focadas em transformação
- Parágrafos: Curtos, empáticos, orientados a resultados
- Depoimentos: Histórias pessoais com detalhes específicos
- CTAs: Verbos de ação + benefício (nunca "clique aqui")
- Benefícios: Específicos e mensuráveis quando possível

## OUTPUT
Use a função create_page_blocks para retornar EXATAMENTE 9 blocos na ordem especificada.
Cada bloco deve ter conteúdo RICO, ORIGINAL e PERSUASIVO.`;

// Schema para tool calling
const createPageBlocksSchema = {
  type: 'function' as const,
  function: {
    name: 'create_page_blocks',
    description: 'Cria 9 blocos com conteúdo 100% original, criativo e persuasivo',
    parameters: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          description: 'Array com exatamente 9 blocos na ordem especificada',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string',
                enum: VALID_BLOCK_TYPES,
              },
              props: {
                type: 'object',
                description: 'Propriedades do bloco com conteúdo ORIGINAL e CRIATIVO'
              },
              marketingFunction: {
                type: 'string',
                enum: ['attention', 'interest', 'desire', 'action', 'problem', 'agitation', 'solution', 'testimonial', 'offer', 'guarantee', 'urgency', 'benefits', 'features', 'faq'],
              },
              order: {
                type: 'number',
              }
            },
            required: ['type', 'props', 'marketingFunction', 'order']
          },
        },
        creationQuality: {
          type: 'number',
          description: 'Qualidade da criação de 0-100'
        },
        copyStyle: {
          type: 'string',
          description: 'Estilo de copy usado (ex: urgente-emocional, empático-transformador, direto-desafiador)'
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Avisos sobre a criação'
        }
      },
      required: ['blocks', 'creationQuality', 'copyStyle', 'warnings']
    }
  }
};

// =============================================
// FUNÇÃO PRINCIPAL DE CRIAÇÃO
// =============================================
export async function createPageFromInspiration(
  html: string,
  strategicPlan: StrategicPlan,
  options?: {
    maxHtmlLength?: number;
    forceUnique?: boolean;
  }
): Promise<{ result: CreationResult; rawResponse?: unknown }> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Extrair APENAS URLs de vídeo do HTML (estrutural, não conteúdo)
  const youtubeUrls = extractYouTubeUrls(html);
  
  // Seed aleatório para garantir unicidade
  const creativeSeed = Math.random().toString(36).substring(2, 10);
  const styleVariation = ['urgente', 'empático', 'desafiador', 'inspirador', 'direto'][Math.floor(Math.random() * 5)];
  
  // Prompt APENAS com categorias - ZERO textos prontos
  const userPrompt = `[SEED CRIATIVO: ${creativeSeed}]
[ESTILO SUGERIDO: ${styleVariation}]

## BRIEFING CRIATIVO (NÃO COPIE - USE COMO INSPIRAÇÃO)

**Categoria do Produto:** ${strategicPlan.productName}
**Tipo:** ${strategicPlan.productType}
**Público-Alvo:** ${strategicPlan.targetAudience}
**Categoria do Problema:** ${strategicPlan.mainPainPoint}
**Categoria da Solução:** ${strategicPlan.mainPromise}

### FRAMEWORK: ${strategicPlan.framework}
Etapas: ${frameworkDef.stages.join(' → ')}

---

## RECURSOS DISPONÍVEIS
${youtubeUrls.length > 0 
  ? `Vídeo YouTube: ${youtubeUrls[0]}`
  : 'Nenhum vídeo disponível'}

---

## SUA MISSÃO CRIATIVA

Crie uma página de vendas COMPLETA e ÚNICA para um produto de "${strategicPlan.productName}".

REGRAS ABSOLUTAS:
1. INVENTE todas as headlines - use sua criatividade
2. CRIE depoimentos com histórias REAIS e EMOCIONAIS
3. Use nomes brasileiros VARIADOS e REALISTAS
4. Cada texto deve ser ORIGINAL - nada genérico
5. Esta página deve ser DIFERENTE de qualquer outra

LEMBRE-SE: Você é um copywriter premiado. Surpreenda-me com sua criatividade!

Use a função create_page_blocks para retornar os 9 blocos.`;

  console.log('[Content Creator] Criando página original...', { 
    framework: strategicPlan.framework,
    productCategory: strategicPlan.productName,
    productType: strategicPlan.productType,
    creativeSeed,
    styleVariation,
    youtubeUrlsFound: youtubeUrls.length
  });

  const startTime = Date.now();

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Flash é mais criativo
        messages: [
          { role: 'system', content: CREATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [createPageBlocksSchema],
        tool_choice: { type: 'function', function: { name: 'create_page_blocks' } },
        temperature: 1.0, // MÁXIMA criatividade
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Content Creator] Erro na API:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit excedido. Tente novamente em alguns segundos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos ao workspace.');
      }
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const elapsedMs = Date.now() - startTime;
    
    console.log('[Content Creator] Resposta recebida em', elapsedMs, 'ms');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_page_blocks') {
      console.error('[Content Creator] Resposta inválida:', JSON.stringify(data).slice(0, 500));
      throw new Error('IA não retornou blocos válidos');
    }

    let creationArgs: CreationResult;
    try {
      creationArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Content Creator] Erro ao parsear:', toolCall.function.arguments);
      throw new Error('Erro ao processar resposta da IA');
    }

    // Validar blocos (apenas tipos, não preencher com fallbacks)
    const validatedBlocks = validateBlocks(creationArgs.blocks || [], youtubeUrls);

    const result: CreationResult = {
      blocks: validatedBlocks,
      creationQuality: creationArgs.creationQuality || 85,
      copyStyle: creationArgs.copyStyle || styleVariation,
      warnings: creationArgs.warnings || [],
    };

    const removedCount = (creationArgs.blocks?.length || 0) - validatedBlocks.length;
    if (removedCount > 0) {
      result.warnings.push(`${removedCount} bloco(s) com tipo inválido foram removidos`);
    }

    // Verificar qualidade do conteúdo
    const qualityCheck = checkContentQuality(validatedBlocks);
    if (!qualityCheck.isGood) {
      result.warnings.push(...qualityCheck.issues);
    }

    console.log('[Content Creator] Criação concluída:', {
      blocksCreated: result.blocks.length,
      quality: result.creationQuality,
      copyStyle: result.copyStyle,
      blockTypes: result.blocks.map(b => b.type),
      creativeSeed
    });

    return { result, rawResponse: data };

  } catch (error) {
    console.error('[Content Creator] Erro:', error);
    throw error;
  }
}

// =============================================
// VALIDAÇÃO DE BLOCOS (SEM FALLBACKS LITERAIS)
// =============================================
function validateBlocks(
  blocks: CreatedBlock[], 
  youtubeUrls: string[]
): CreatedBlock[] {
  const validBlocks: CreatedBlock[] = [];
  
  for (const block of blocks) {
    if (!VALID_BLOCK_TYPES.includes(block.type as ValidBlockType)) {
      console.warn(`[Content Creator] Bloco inválido removido: ${block.type}`);
      continue;
    }

    // Apenas limpar props problemáticas, não preencher com fallbacks
    const cleanedProps = cleanProps(block.props, youtubeUrls);
    
    validBlocks.push({
      type: block.type,
      props: cleanedProps,
      marketingFunction: block.marketingFunction || 'interest',
      order: block.order || validBlocks.length + 1,
    });
  }

  return validBlocks.sort((a, b) => a.order - b.order);
}

// Limpar props problemáticas
function cleanProps(props: Record<string, unknown>, youtubeUrls: string[]): Record<string, unknown> {
  const cleaned = { ...props };
  
  // Garantir placeholders de imagem
  if (cleaned.imageDesktop === undefined) cleaned.imageDesktop = 'PLACEHOLDER_IMAGE';
  if (cleaned.imageMobile === undefined) cleaned.imageMobile = 'PLACEHOLDER_IMAGE';
  
  // Garantir URLs de CTA
  if (cleaned.ctaUrl === undefined || cleaned.ctaUrl === '') cleaned.ctaUrl = '#comprar';
  if (cleaned.url === undefined || cleaned.url === '') cleaned.url = '#comprar';
  
  // Preencher YouTube URL se disponível
  if (cleaned.youtubeUrl === 'URL_DO_VIDEO' || cleaned.youtubeUrl === 'PLACEHOLDER_VIDEO') {
    cleaned.youtubeUrl = youtubeUrls.length > 0 ? youtubeUrls[0] : 'PLACEHOLDER_VIDEO';
  }
  
  return cleaned;
}

// Verificar qualidade do conteúdo gerado
function checkContentQuality(blocks: CreatedBlock[]): { isGood: boolean; issues: string[] } {
  const issues: string[] = [];
  const allTexts: string[] = [];
  
  for (const block of blocks) {
    // Coletar todos os textos para verificar duplicação
    const texts = extractTextsFromProps(block.props);
    for (const text of texts) {
      if (allTexts.includes(text) && text.length > 20) {
        issues.push(`Texto duplicado detectado: "${text.slice(0, 30)}..."`);
      }
      allTexts.push(text);
    }
    
    // Verificar textos genéricos
    for (const text of texts) {
      if (isGenericText(text)) {
        issues.push(`Texto genérico detectado: "${text.slice(0, 30)}..."`);
      }
    }
  }
  
  return {
    isGood: issues.length === 0,
    issues
  };
}

// Extrair todos os textos de um objeto de props
function extractTextsFromProps(props: Record<string, unknown>): string[] {
  const texts: string[] = [];
  
  function extract(obj: unknown): void {
    if (typeof obj === 'string' && obj.length > 10) {
      texts.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(extract);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(extract);
    }
  }
  
  extract(props);
  return texts;
}

// Verificar se texto é genérico
function isGenericText(text: string): boolean {
  if (!text || text.trim().length < 5) return false;
  const lower = text.toLowerCase().trim();
  const generics = [
    'título principal', 'headline aqui', 'cliente satisfeito', 
    'nome do cliente', 'depoimento do cliente', 'descrição aqui',
    'texto aqui', 'clique aqui', 'cliente 1', 'cliente 2',
    'joão s.', 'maria s.', 'placeholder', 'lorem ipsum',
    'texto de exemplo', 'benefício 1', 'benefício 2'
  ];
  return generics.some(g => lower.includes(g));
}

// Extrai URLs do YouTube
function extractYouTubeUrls(html: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g,
    /https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/g,
    /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/g,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const normalizedUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      if (!urls.includes(normalizedUrl)) {
        urls.push(normalizedUrl);
      }
    }
  }

  return urls;
}

// =============================================
// FALLBACK - Apenas estrutura básica (sem textos fixos)
// Usado apenas em caso de erro total da IA
// =============================================
export function createFallbackPage(strategicPlan: StrategicPlan): CreationResult {
  // Em vez de textos fixos, criar estrutura mínima que obriga edição
  const productCategory = strategicPlan.productName || 'produto';

  const blocks: CreatedBlock[] = [
    {
      type: 'Hero',
      props: {
        title: `Descubra ${productCategory}`,
        subtitle: `Uma solução completa para suas necessidades`,
        ctaText: 'QUERO SABER MAIS',
        ctaUrl: '#comprar',
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        alignment: 'center',
      },
      marketingFunction: 'attention',
      order: 1,
    },
    {
      type: 'ContentColumns',
      props: {
        title: 'Por Que Escolher Esta Solução?',
        content: '<p>Conteúdo a ser personalizado pelo lojista.</p><p>Descreva os benefícios e diferenciais aqui.</p>',
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        imagePosition: 'right',
        features: [
          { icon: 'Check', text: 'Benefício a personalizar' },
          { icon: 'Check', text: 'Benefício a personalizar' },
          { icon: 'Check', text: 'Benefício a personalizar' },
        ],
      },
      marketingFunction: 'interest',
      order: 2,
    },
    {
      type: 'Testimonials',
      props: {
        title: 'Depoimentos',
        items: [
          { name: 'Cliente', text: 'Adicione depoimentos reais aqui.', rating: 5, location: 'Brasil' },
        ],
      },
      marketingFunction: 'testimonial',
      order: 3,
    },
    {
      type: 'FAQ',
      props: {
        title: 'Perguntas Frequentes',
        items: [
          { question: 'Pergunta comum?', answer: 'Resposta a personalizar.' },
        ],
      },
      marketingFunction: 'faq',
      order: 4,
    },
    {
      type: 'Hero',
      props: {
        title: 'Pronto Para Começar?',
        subtitle: 'Não perca esta oportunidade.',
        ctaText: 'COMPRAR AGORA',
        ctaUrl: '#comprar',
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        alignment: 'center',
      },
      marketingFunction: 'action',
      order: 5,
    },
  ];

  return {
    blocks,
    creationQuality: 30, // Qualidade baixa indica que precisa edição
    copyStyle: 'template-basico',
    warnings: ['Página de fallback criada - edição manual necessária para conteúdo persuasivo'],
  };
}
