// =============================================
// AI CONTENT CREATOR - Sistema de Criação 100% ORIGINAL
// Gera páginas ÚNICAS a cada chamada - como a Lovable faz
// ZERO cópia - TUDO inventado pela IA
// =============================================

import type { StrategicPlan, MarketingFunction } from './marketing/types.ts';
import { FRAMEWORKS } from './marketing/frameworks.ts';
import { aiChatCompletion, resetAIRouterCache } from './ai-router.ts';

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

## REGRA CRÍTICA - LEIA COM ATENÇÃO
CADA BLOCO DEVE TER PROPS COMPLETAMENTE PREENCHIDAS COM CONTEÚDO REAL.
PROPS VAZIAS ({}) NÃO SÃO ACEITAS E SERÃO REJEITADAS.

Exemplo de retorno CORRETO:
{
  "type": "Hero",
  "props": {
    "title": "Descubra o Segredo Para Cabelos Fortes e Volumosos",
    "subtitle": "Milhares de pessoas já transformaram seus cabelos com nosso método exclusivo. Agora é sua vez.",
    "ctaText": "QUERO CABELOS INCRÍVEIS",
    "ctaUrl": "#comprar",
    "imageDesktop": "PLACEHOLDER_IMAGE",
    "imageMobile": "PLACEHOLDER_IMAGE",
    "alignment": "center"
  },
  "marketingFunction": "attention",
  "order": 1
}

Exemplo de retorno INCORRETO (será rejeitado):
{
  "type": "Hero",
  "props": {},
  "marketingFunction": "attention",
  "order": 1
}

## SUA MISSÃO
Criar uma página de vendas COMPLETA, ORIGINAL e DIFERENTE a cada vez.
Você é um artista da persuasão - cada página é uma obra de arte única.
CADA BLOCO DEVE TER TEXTOS REAIS E CRIATIVOS.

## REGRAS DE CRIATIVIDADE

1. **PREENCHA TODAS AS PROPS** - Nunca retorne props vazias
2. **INVENTE TUDO** - Cada texto deve ser criado por você
3. **SEJA ÚNICO** - Use metáforas, ângulos e abordagens diferentes a cada vez
4. **VARIE O TOM** - Às vezes urgente, às vezes empático, às vezes desafiador
5. **CRIE HISTÓRIAS** - Depoimentos com detalhes específicos e emocionais
6. **SURPREENDA** - Headlines que capturam atenção de formas inesperadas

## FÓRMULAS DE HEADLINE (use uma diferente cada vez)

- Pergunta provocativa: "Você Ainda Acredita Que [Mito]?"
- Promessa direta: "[Resultado] Em [Prazo] Ou Seu Dinheiro De Volta"
- Curiosidade: "O Segredo Que [Grupo] Não Quer Que Você Saiba"
- Identificação: "Para Quem Já Tentou De Tudo E Ainda Não Conseguiu [Objetivo]"
- Desafio: "Descubra Por Que [Quantidade] Pessoas Já Mudaram [Aspecto]"
- Transformação: "De [Estado Antes] Para [Estado Depois]"

## ESTRUTURA OBRIGATÓRIA (9 BLOCOS) - CADA UM COM PROPS COMPLETAS

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

// Schema detalhado para props de cada tipo de bloco
const BLOCK_PROPS_SCHEMAS = {
  Hero: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Headline IMPACTANTE (6-10 palavras)' },
      subtitle: { type: 'string', description: 'Subtítulo persuasivo (20-35 palavras)' },
      ctaText: { type: 'string', description: 'Texto do botão CTA (ex: "QUERO AGORA")' },
      ctaUrl: { type: 'string', description: 'URL do CTA, use "#comprar"' },
      imageDesktop: { type: 'string', description: 'Use "PLACEHOLDER_IMAGE"' },
      imageMobile: { type: 'string', description: 'Use "PLACEHOLDER_IMAGE"' },
      alignment: { type: 'string', enum: ['left', 'center', 'right'] }
    },
    required: ['title', 'subtitle', 'ctaText', 'ctaUrl']
  },
  ContentColumns: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título da seção' },
      content: { type: 'string', description: 'Conteúdo HTML com parágrafos' },
      features: { 
        type: 'array',
        items: { 
          type: 'object',
          properties: {
            icon: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['title', 'description']
        },
        description: '3-5 features com título e descrição'
      },
      imagePosition: { type: 'string', enum: ['left', 'right'] },
      imageDesktop: { type: 'string' },
      imageMobile: { type: 'string' }
    },
    required: ['title', 'content']
  },
  FeatureList: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título único (ex: "Sistema Triplo")' },
      subtitle: { type: 'string', description: 'Explicação do conceito' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            icon: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['title', 'description']
        },
        description: '5 itens com ícone, título e descrição'
      },
      layout: { type: 'string', enum: ['grid', 'list'] },
      columns: { type: 'number' }
    },
    required: ['title', 'items']
  },
  InfoHighlights: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título da seção' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            icon: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['title', 'description']
        },
        description: '3-6 destaques'
      },
      layout: { type: 'string', enum: ['grid', 'horizontal'] },
      columns: { type: 'number' }
    },
    required: ['items']
  },
  Testimonials: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título como "O Que Nossos Clientes Dizem"' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome completo brasileiro' },
            text: { type: 'string', description: 'Depoimento de 40-60 palavras' },
            rating: { type: 'number' },
            location: { type: 'string', description: 'Cidade brasileira' }
          },
          required: ['name', 'text', 'rating']
        },
        description: '3 depoimentos ÚNICOS e DETALHADOS'
      }
    },
    required: ['items']
  },
  FAQ: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título como "Dúvidas Frequentes"' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' }
          },
          required: ['question', 'answer']
        },
        description: '4-5 perguntas e respostas'
      }
    },
    required: ['items']
  }
};

// Schema para tool calling com props DETALHADAS
const createPageBlocksSchema = {
  type: 'function' as const,
  function: {
    name: 'create_page_blocks',
    description: 'Cria 9 blocos de página de vendas com conteúdo COMPLETO. CADA BLOCO DEVE TER PROPS PREENCHIDAS - NÃO RETORNE PROPS VAZIAS.',
    parameters: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          minItems: 9,
          maxItems: 9,
          description: 'Array com EXATAMENTE 9 blocos. CADA BLOCO DEVE TER PROPS COMPLETAS.',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string',
                enum: VALID_BLOCK_TYPES,
                description: 'Tipo do bloco'
              },
              props: {
                type: 'object',
                description: `OBRIGATÓRIO: Propriedades do bloco com conteúdo COMPLETO. PROPS VAZIAS NÃO SÃO ACEITAS.
                
Para Hero: { title: string, subtitle: string, ctaText: string, ctaUrl: "#comprar", imageDesktop: "PLACEHOLDER_IMAGE", imageMobile: "PLACEHOLDER_IMAGE", alignment: "center" }

Para ContentColumns: { title: string, content: string (HTML), features: [{icon: string, title: string, description: string}], imagePosition: "left"|"right" }

Para FeatureList: { title: string, subtitle: string, items: [{icon: string, title: string, description: string}], layout: "grid", columns: 5 }

Para InfoHighlights: { title: string, items: [{icon: string, title: string, description: string}], layout: "grid", columns: 3 }

Para Testimonials: { title: string, items: [{name: string, text: string (40-60 palavras), rating: 5, location: string}] }

Para FAQ: { title: string, items: [{question: string, answer: string}] }`,
                additionalProperties: true
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
          description: 'Qualidade da criação de 0-100 (deve ser 90+ se todas as props estiverem preenchidas)'
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  resetAIRouterCache();

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Extrair URLs de vídeo do HTML
  const youtubeUrls = extractYouTubeUrls(html);
  
  // Extrair CONTEÚDO REAL da página para inspiração
  const extractedContent = extractPageContent(html, options?.maxHtmlLength || 15000);
  
  // Seed aleatório para garantir unicidade
  const creativeSeed = Math.random().toString(36).substring(2, 10);
  const styleVariation = ['urgente', 'empático', 'desafiador', 'inspirador', 'direto'][Math.floor(Math.random() * 5)];
  
  // Prompt com CONTEÚDO REAL da página como inspiração
  const userPrompt = `[SEED CRIATIVO: ${creativeSeed}]
[ESTILO SUGERIDO: ${styleVariation}]

## BRIEFING CRIATIVO

**Produto:** ${strategicPlan.productName}
**Tipo:** ${strategicPlan.productType}
**Público-Alvo:** ${strategicPlan.targetAudience}
**Problema Principal:** ${strategicPlan.mainPainPoint}
**Promessa Principal:** ${strategicPlan.mainPromise}

### FRAMEWORK: ${strategicPlan.framework}
Etapas: ${frameworkDef.stages.join(' → ')}

---

## CONTEÚDO DA PÁGINA ORIGINAL (USE COMO INSPIRAÇÃO, NÃO COPIE)

### Headlines e Títulos Encontrados:
${extractedContent.headlines.slice(0, 8).map(h => `- "${h}"`).join('\n') || '(nenhum encontrado)'}

### Benefícios/Features Mencionados:
${extractedContent.benefits.slice(0, 10).map(b => `- ${b}`).join('\n') || '(nenhum encontrado)'}

### Trechos de Depoimentos:
${extractedContent.testimonials.slice(0, 3).map(t => `"${t.slice(0, 100)}..."`).join('\n') || '(nenhum encontrado)'}

### Perguntas FAQ Encontradas:
${extractedContent.faqs.slice(0, 5).map(f => `- ${f}`).join('\n') || '(nenhum encontrado)'}

### Diferenciais/USPs:
${extractedContent.usps.slice(0, 5).map(u => `- ${u}`).join('\n') || '(nenhum encontrado)'}

---

## RECURSOS DISPONÍVEIS
${youtubeUrls.length > 0 
  ? `Vídeo YouTube: ${youtubeUrls[0]}`
  : 'Nenhum vídeo disponível'}

---

## SUA MISSÃO CRIATIVA

Crie uma página de vendas INSPIRADA no conteúdo acima, mas com textos ÚNICOS e ORIGINAIS.

REGRAS ABSOLUTAS:
1. USE os benefícios e USPs como INSPIRAÇÃO, mas REESCREVA com suas palavras
2. CRIE depoimentos NOVOS inspirados no tom dos originais, mas com nomes e histórias DIFERENTES
3. ADAPTE as headlines para serem mais impactantes e persuasivas
4. Use nomes brasileiros VARIADOS e REALISTAS
5. Cada texto deve ser uma VERSÃO MELHORADA, não uma cópia

LEMBRE-SE: Você é um copywriter premiado. Transforme esse material bruto em OURO!

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
    const response = await aiChatCompletion('google/gemini-2.5-flash', {
      messages: [
        { role: 'system', content: CREATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      tools: [createPageBlocksSchema],
      tool_choice: { type: 'function', function: { name: 'create_page_blocks' } },
      temperature: 1.0, // MÁXIMA criatividade
      top_p: 0.95,
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: '[Content Creator]',
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

    // LOG DETALHADO para debug
    console.log('[Content Creator] Blocos recebidos da IA:', JSON.stringify(creationArgs.blocks?.slice(0, 2), null, 2));
    
    // Verificar se blocos têm conteúdo
    const firstBlock = creationArgs.blocks?.[0];
    if (firstBlock) {
      console.log('[Content Creator] Primeiro bloco - tipo:', firstBlock.type);
      console.log('[Content Creator] Primeiro bloco - props:', JSON.stringify(firstBlock.props, null, 2));
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
// VALIDAÇÃO DE BLOCOS - REJEITA PROPS VAZIAS
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

    // CRÍTICO: Rejeitar blocos com props vazias
    if (!block.props || Object.keys(block.props).length === 0) {
      console.warn(`[Content Creator] Bloco ${block.type} com props VAZIAS - REJEITADO`);
      continue;
    }

    // Verificar se tem pelo menos uma propriedade com conteúdo real
    const hasRealContent = Object.values(block.props).some(value => {
      if (typeof value === 'string') return value.length > 3;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
      return false;
    });

    if (!hasRealContent) {
      console.warn(`[Content Creator] Bloco ${block.type} sem conteúdo real - REJEITADO`);
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
// EXTRATOR DE CONTEÚDO DA PÁGINA
// Extrai headlines, benefícios, depoimentos, FAQs, etc.
// =============================================
interface ExtractedContent {
  headlines: string[];
  benefits: string[];
  testimonials: string[];
  faqs: string[];
  usps: string[];
}

function extractPageContent(html: string, maxLength: number = 15000): ExtractedContent {
  // Limpar HTML para extração
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .slice(0, maxLength);

  const result: ExtractedContent = {
    headlines: [],
    benefits: [],
    testimonials: [],
    faqs: [],
    usps: []
  };

  // Extrair headlines (h1, h2, h3)
  const headlinePattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match;
  while ((match = headlinePattern.exec(cleanHtml)) !== null) {
    const text = cleanText(match[1]);
    if (text.length > 5 && text.length < 200 && !result.headlines.includes(text)) {
      result.headlines.push(text);
    }
  }

  // Extrair benefícios (li dentro de ul/ol, ou elementos com classes comuns)
  const benefitPatterns = [
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    /class="[^"]*(?:benefit|feature|advantage)[^"]*"[^>]*>([\s\S]*?)</gi,
  ];
  for (const pattern of benefitPatterns) {
    while ((match = pattern.exec(cleanHtml)) !== null) {
      const text = cleanText(match[1]);
      if (text.length > 10 && text.length < 300 && !result.benefits.includes(text)) {
        result.benefits.push(text);
      }
    }
  }

  // Extrair depoimentos (procurar por padrões comuns)
  const testimonialPatterns = [
    /class="[^"]*(?:testimonial|review|depoimento)[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    /(?:"[^"]{50,300}")/g, // Textos entre aspas longos
  ];
  for (const pattern of testimonialPatterns) {
    while ((match = pattern.exec(cleanHtml)) !== null) {
      const text = cleanText(match[1] || match[0]);
      if (text.length > 30 && text.length < 500 && !result.testimonials.includes(text)) {
        result.testimonials.push(text);
      }
    }
  }

  // Extrair FAQs (procurar por patterns de pergunta)
  const faqPatterns = [
    /class="[^"]*(?:faq|question|pergunta)[^"]*"[^>]*>([\s\S]*?)</gi,
    /<(?:dt|summary)[^>]*>([\s\S]*?)<\/(?:dt|summary)>/gi,
    /(?:^|\?[^a-z])([^?]{20,150}\?)/gim,
  ];
  for (const pattern of faqPatterns) {
    while ((match = pattern.exec(cleanHtml)) !== null) {
      const text = cleanText(match[1] || match[0]);
      if (text.length > 10 && text.length < 200 && text.includes('?') && !result.faqs.includes(text)) {
        result.faqs.push(text);
      }
    }
  }

  // Extrair USPs/Diferenciais
  const uspPatterns = [
    /class="[^"]*(?:usp|diferencial|highlight|destaque)[^"]*"[^>]*>([\s\S]*?)</gi,
    /<strong[^>]*>([\s\S]*?)<\/strong>/gi,
    /<b[^>]*>([\s\S]*?)<\/b>/gi,
  ];
  for (const pattern of uspPatterns) {
    while ((match = pattern.exec(cleanHtml)) !== null) {
      const text = cleanText(match[1]);
      if (text.length > 5 && text.length < 150 && !result.usps.includes(text)) {
        result.usps.push(text);
      }
    }
  }

  // Limitar quantidade
  result.headlines = result.headlines.slice(0, 10);
  result.benefits = result.benefits.slice(0, 15);
  result.testimonials = result.testimonials.slice(0, 5);
  result.faqs = result.faqs.slice(0, 8);
  result.usps = result.usps.slice(0, 10);

  return result;
}

// Limpar texto extraído do HTML
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
