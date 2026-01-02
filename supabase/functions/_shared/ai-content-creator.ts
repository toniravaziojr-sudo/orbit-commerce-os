// =============================================
// AI CONTENT CREATOR - Sistema de Criação ORIGINAL
// NÃO extrai conteúdo - CRIA conteúdo novo baseado em análise
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
// PROMPT DO SISTEMA - CRIAÇÃO 100% ORIGINAL
// =============================================
const CREATION_SYSTEM_PROMPT = `Você é um copywriter especialista em páginas de vendas de alta conversão.

## SUA MISSÃO
Você recebe uma ANÁLISE ESTRATÉGICA de um negócio e deve CRIAR uma página de vendas completa.
Você NÃO está copiando ou extraindo nada - você está CRIANDO conteúdo 100% ORIGINAL.

## ⚠️ REGRA CRÍTICA: TUDO DEVE SER ORIGINAL

Você deve criar textos NOVOS baseados apenas em:
- Tipo de produto
- Público-alvo
- Dor principal
- Promessa principal
- USP (diferencial único)
- Framework de marketing

## PROIBIÇÕES ABSOLUTAS

❌ NUNCA use textos genéricos como:
- "Título Principal", "Headline Aqui"
- "Cliente Satisfeito", "Nome do Cliente"
- "Depoimento do cliente..."
- "Descrição...", "Texto aqui"

## TIPOS DE BLOCOS (APENAS ESTES)

${VALID_BLOCK_TYPES.map(t => `- ${t}`).join('\n')}

## PROPS POR BLOCO

**Hero**:
{
  "title": "Headline persuasiva focada em benefício (máx 10 palavras)",
  "subtitle": "Subheadline expandindo a promessa (15-25 palavras)",
  "ctaText": "VERBO + Benefício (ex: Quero Meu Desconto)",
  "ctaUrl": "#comprar",
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE",
  "alignment": "center"
}

**ContentColumns**:
{
  "title": "Título da seção",
  "content": "<p>Texto persuasivo em HTML</p>",
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE",
  "imagePosition": "left" | "right",
  "features": [{ "icon": "Check", "text": "Benefício específico" }]
}

**FeatureList**:
{
  "title": "Título da lista",
  "items": [{ "icon": "Check", "text": "Benefício com resultado concreto" }]
}

**InfoHighlights**:
{
  "items": [
    { "icon": "Truck" | "Shield" | "Clock" | "CreditCard", "title": "Título Curto", "description": "Descrição do benefício" }
  ],
  "layout": "horizontal"
}

**Testimonials**:
{
  "title": "Título da seção",
  "items": [
    {
      "name": "Nome Completo Brasileiro",
      "text": "Depoimento DETALHADO com resultado específico",
      "rating": 5
    }
  ]
}

**FAQ**:
{
  "title": "Perguntas Frequentes",
  "items": [
    { "question": "Pergunta real?", "answer": "Resposta que elimina objeção" }
  ]
}

**YouTubeVideo**:
{
  "youtubeUrl": "URL_DO_VIDEO",
  "title": "Título do vídeo"
}

**Button**:
{
  "text": "VERBO + Benefício",
  "url": "#comprar",
  "variant": "default",
  "size": "lg"
}

## ESTRUTURA RECOMENDADA

1. **Hero** - SEMPRE PRIMEIRO
2. **ContentColumns** - Problema e solução
3. **InfoHighlights** - Diferenciais (frete, garantia)
4. **YouTubeVideo** - SE houver URL real disponível
5. **Testimonials** - Prova social (nomes brasileiros)
6. **FAQ** - Elimina objeções
7. **Button** - CTA final (SEMPRE TERMINAR COM CTA)

## OUTPUT

Use a função create_page_blocks para retornar os blocos criados.`;

// Schema para tool calling
const createPageBlocksSchema = {
  type: 'function' as const,
  function: {
    name: 'create_page_blocks',
    description: 'Cria os blocos da página com conteúdo 100% original',
    parameters: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string',
                enum: VALID_BLOCK_TYPES,
              },
              props: {
                type: 'object',
                description: 'Propriedades do bloco com conteúdo ORIGINAL criado'
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
        },
        copyStyle: {
          type: 'string',
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
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
  }
): Promise<{ result: CreationResult; rawResponse?: unknown }> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Extrair APENAS URLs de vídeo do HTML (não conteúdo textual)
  const youtubeUrls = extractYouTubeUrls(html);
  
  // Prompt APENAS com dados estratégicos - SEM HTML
  const userPrompt = `## DADOS DO NEGÓCIO (CRIE CONTEÚDO BASEADO NISTO)

**Produto:** ${strategicPlan.productName || 'Produto'}
**Tipo:** ${strategicPlan.productType}
**Público-Alvo:** ${strategicPlan.targetAudience}

### DOR PRINCIPAL:
"${strategicPlan.mainPainPoint}"

### PROMESSA PRINCIPAL:
"${strategicPlan.mainPromise}"

### DIFERENCIAL ÚNICO (USP):
"${strategicPlan.uniqueSellingProposition}"

### FRAMEWORK: ${strategicPlan.framework}
Etapas: ${frameworkDef.stages.join(' → ')}

---

## RECURSOS DISPONÍVEIS

### Vídeos YouTube (use se houver):
${youtubeUrls.length > 0 
  ? youtubeUrls.map(url => `- ${url}`).join('\n')
  : '❌ Nenhum vídeo disponível - não crie bloco YouTubeVideo'}

---

## SUA TAREFA

Crie uma página de vendas ORIGINAL e PERSUASIVA:

1. **Hero**: Headline impactante baseada na PROMESSA PRINCIPAL
2. **ContentColumns**: Desenvolva o PROBLEMA e a SOLUÇÃO
3. **InfoHighlights**: Diferenciais (frete grátis, garantia, segurança)
4. **Testimonials**: Crie 2-3 depoimentos FICTÍCIOS mas REALISTAS com nomes brasileiros
5. **FAQ**: Crie 3-4 perguntas que eliminam objeções de compra
6. **Button**: CTA final com verbo + benefício

⚠️ TODO O CONTEÚDO DEVE SER CRIADO POR VOCÊ - NÃO COPIE NADA!

Use a função create_page_blocks.`;

  console.log('[Content Creator] Criando página original...', { 
    framework: strategicPlan.framework,
    productName: strategicPlan.productName,
    productType: strategicPlan.productType,
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
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: CREATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [createPageBlocksSchema],
        tool_choice: { type: 'function', function: { name: 'create_page_blocks' } },
        temperature: 0.8, // Alta temperatura para criatividade
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

    // Validar e corrigir blocos
    const validatedBlocks = validateAndFixBlocks(creationArgs.blocks || [], strategicPlan, youtubeUrls);

    const result: CreationResult = {
      blocks: validatedBlocks,
      creationQuality: creationArgs.creationQuality || 70,
      copyStyle: creationArgs.copyStyle || 'persuasivo',
      warnings: creationArgs.warnings || [],
    };

    const removedCount = (creationArgs.blocks?.length || 0) - validatedBlocks.length;
    if (removedCount > 0) {
      result.warnings.push(`${removedCount} bloco(s) com tipo inválido foram removidos`);
    }

    console.log('[Content Creator] Criação concluída:', {
      blocksCreated: result.blocks.length,
      quality: result.creationQuality,
      copyStyle: result.copyStyle,
      blockTypes: result.blocks.map(b => b.type)
    });

    return { result, rawResponse: data };

  } catch (error) {
    console.error('[Content Creator] Erro:', error);
    throw error;
  }
}

// =============================================
// VALIDAÇÃO DE BLOCOS
// =============================================
function validateAndFixBlocks(
  blocks: CreatedBlock[], 
  strategicPlan: StrategicPlan,
  youtubeUrls: string[]
): CreatedBlock[] {
  const validBlocks: CreatedBlock[] = [];
  
  for (const block of blocks) {
    if (!VALID_BLOCK_TYPES.includes(block.type as ValidBlockType)) {
      console.warn(`[Content Creator] Bloco inválido removido: ${block.type}`);
      continue;
    }

    const fixedProps = fillRequiredProps(
      block.type as ValidBlockType, 
      block.props || {},
      strategicPlan,
      youtubeUrls
    );
    
    validBlocks.push({
      type: block.type,
      props: fixedProps,
      marketingFunction: block.marketingFunction || 'interest',
      order: block.order || validBlocks.length + 1,
    });
  }

  return validBlocks.sort((a, b) => a.order - b.order);
}

// Preenche props obrigatórias
function fillRequiredProps(
  type: ValidBlockType, 
  props: Record<string, unknown>,
  strategicPlan: StrategicPlan,
  youtubeUrls: string[]
): Record<string, unknown> {
  const filled = { ...props };
  
  const productName = strategicPlan.productName || 'nosso produto';
  const mainPromise = strategicPlan.mainPromise || 'Transforme sua vida hoje';
  const painPoint = strategicPlan.mainPainPoint || 'seus desafios';
  const usp = strategicPlan.uniqueSellingProposition || 'solução única';

  switch (type) {
    case 'Hero':
      if (!filled.title || isGenericText(filled.title as string)) {
        filled.title = mainPromise;
      }
      if (!filled.subtitle) {
        filled.subtitle = usp;
      }
      if (!filled.ctaText || isGenericText(filled.ctaText as string)) {
        filled.ctaText = `Quero ${productName}`;
      }
      filled.ctaUrl = filled.ctaUrl || '#comprar';
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || 'PLACEHOLDER_IMAGE';
      filled.alignment = filled.alignment || 'center';
      break;

    case 'ContentColumns':
      if (!filled.title) {
        filled.title = `Por Que Escolher ${productName}?`;
      }
      if (!filled.content) {
        filled.content = `<p>Se você sofre com ${painPoint}, sabe o quanto isso afeta sua vida.</p><p>${usp}</p>`;
      }
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || 'PLACEHOLDER_IMAGE';
      filled.imagePosition = filled.imagePosition || 'right';
      if (!Array.isArray(filled.features) || filled.features.length === 0) {
        filled.features = [
          { icon: 'Check', text: `Resultados comprovados com ${productName}` },
          { icon: 'Check', text: 'Garantia de satisfação' },
        ];
      }
      break;

    case 'InfoHighlights':
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { icon: 'Truck', title: 'Entrega Rápida', description: 'Receba no conforto da sua casa' },
          { icon: 'Shield', title: 'Garantia Total', description: 'Satisfação garantida' },
          { icon: 'CreditCard', title: 'Pagamento Seguro', description: 'Dados protegidos' },
        ];
      }
      filled.layout = filled.layout || 'horizontal';
      break;

    case 'Testimonials':
      if (!filled.title) {
        filled.title = 'O Que Nossos Clientes Dizem';
      }
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { 
            name: 'Carlos Eduardo', 
            text: `Depois de experimentar ${productName}, minha vida mudou. Resultados em poucas semanas!`, 
            rating: 5 
          },
          { 
            name: 'Maria Fernanda', 
            text: `Finalmente encontrei uma solução que funciona. Recomendo para todos!`, 
            rating: 5 
          },
        ];
      } else {
        // Corrigir nomes genéricos
        const nomesBrasileiros = ['Roberto Mendes', 'Ana Paula', 'Carlos Eduardo', 'Maria Fernanda', 'Paulo Henrique', 'Juliana Santos'];
        filled.items = (filled.items as Array<{name: string; text: string; rating: number}>).map((item, i) => {
          if (isGenericText(item.name)) {
            return { ...item, name: nomesBrasileiros[i % nomesBrasileiros.length] };
          }
          if (isGenericText(item.text)) {
            return { ...item, text: `${productName} superou todas as minhas expectativas!` };
          }
          return item;
        });
      }
      break;

    case 'FAQ':
      if (!filled.title) {
        filled.title = 'Perguntas Frequentes';
      }
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { question: `Como funciona ${productName}?`, answer: usp },
          { question: 'Qual é o prazo de entrega?', answer: 'Enviamos em até 24h úteis.' },
          { question: 'Tem garantia?', answer: 'Sim! 30 dias ou seu dinheiro de volta.' },
        ];
      }
      break;

    case 'YouTubeVideo':
      if (!filled.youtubeUrl || filled.youtubeUrl === 'URL_DO_VIDEO') {
        if (youtubeUrls.length > 0) {
          filled.youtubeUrl = youtubeUrls[0];
        } else {
          filled.youtubeUrl = 'PLACEHOLDER_VIDEO';
        }
      }
      if (!filled.title) {
        filled.title = `Conheça ${productName}`;
      }
      break;

    case 'Button':
      if (!filled.text || isGenericText(filled.text as string)) {
        filled.text = `Quero ${productName} Agora`;
      }
      filled.url = filled.url || '#comprar';
      filled.variant = filled.variant || 'default';
      filled.size = filled.size || 'lg';
      break;
  }

  return filled;
}

// Verifica se texto é genérico
function isGenericText(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  const generics = [
    'título principal', 'headline aqui', 'cliente satisfeito', 
    'nome do cliente', 'depoimento do cliente', 'descrição',
    'texto aqui', 'clique aqui', 'saiba mais', 'cliente 1',
    'cliente 2', 'joão s.', 'maria s.'
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
// FALLBACK
// =============================================
export function createFallbackPage(strategicPlan: StrategicPlan): CreationResult {
  const productName = strategicPlan.productName || 'nosso produto';
  const mainPromise = strategicPlan.mainPromise || 'Transforme sua vida hoje';
  const painPoint = strategicPlan.mainPainPoint || 'seus desafios';
  const usp = strategicPlan.uniqueSellingProposition || 'A solução que você procurava';

  const blocks: CreatedBlock[] = [
    {
      type: 'Hero',
      props: {
        title: mainPromise,
        subtitle: usp,
        ctaText: `Quero ${productName}`,
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
        title: `Por Que Escolher ${productName}?`,
        content: `<p>Se você sofre com ${painPoint}, sabe o quanto isso afeta sua vida.</p><p>${usp}</p>`,
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        imagePosition: 'right',
        features: [
          { icon: 'Check', text: 'Resultados comprovados' },
          { icon: 'Check', text: 'Garantia de satisfação' },
        ],
      },
      marketingFunction: 'interest',
      order: 2,
    },
    {
      type: 'InfoHighlights',
      props: {
        items: [
          { icon: 'Truck', title: 'Entrega Rápida', description: 'Receba em casa' },
          { icon: 'Shield', title: 'Garantia', description: '30 dias' },
          { icon: 'CreditCard', title: 'Seguro', description: 'Dados protegidos' },
        ],
        layout: 'horizontal',
      },
      marketingFunction: 'benefits',
      order: 3,
    },
    {
      type: 'Button',
      props: {
        text: `Quero ${productName} Agora`,
        url: '#comprar',
        variant: 'default',
        size: 'lg',
      },
      marketingFunction: 'action',
      order: 4,
    },
  ];

  return {
    blocks,
    creationQuality: 50,
    copyStyle: 'contextual',
    warnings: ['Página de fallback criada - edite para melhorar'],
  };
}
