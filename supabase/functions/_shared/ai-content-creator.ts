// =============================================
// AI CONTENT CREATOR - Sistema de Criação por Inspiração
// Cria conteúdo ORIGINAL usando blocos nativos do Builder
// =============================================

import type { StrategicPlan, MarketingFunction } from './marketing/types.ts';
import { FRAMEWORKS } from './marketing/frameworks.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// =============================================
// WHITELIST ESTRITA DE BLOCOS VÁLIDOS
// Apenas estes tipos são aceitos - todos são 100% editáveis no Builder
// =============================================
export const VALID_BLOCK_TYPES = [
  // Conteúdo Principal
  'Hero',              // Seção principal com headline, subtitle, CTA, imagem
  'ContentColumns',    // Texto + Imagem lado a lado, features com ícones
  'FeatureList',       // Lista de benefícios com ícones
  'InfoHighlights',    // Destaques horizontais (frete, garantia, etc)
  'Testimonials',      // Depoimentos de clientes
  'FAQ',               // Perguntas frequentes
  'RichText',          // Texto livre formatado (fallback)
  'Button',            // Botão CTA isolado
  'Image',             // Imagem única
  
  // Mídia
  'YouTubeVideo',      // Embed de vídeo YouTube
  'VideoCarousel',     // Carrossel de múltiplos vídeos
  'VideoUpload',       // Vídeo local (mp4/webm)
  'HeroBanner',        // Banner com slides
  'ImageCarousel',     // Carrossel de imagens
  
  // Layout
  'Section',           // Container de seção com background
  'Spacer',            // Espaçamento entre seções
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
// PROMPT DO SISTEMA - FOCADO EM CRIAÇÃO
// =============================================
const CREATION_SYSTEM_PROMPT = `Você é um copywriter especialista em páginas de vendas de alta conversão.

## SUA MISSÃO
Dado a análise estratégica de uma página, você deve CRIAR conteúdo ORIGINAL e PERSUASIVO.
Você NÃO está extraindo conteúdo - você está CRIANDO baseado na inspiração.

## REGRAS CRÍTICAS

### 1. TIPOS DE BLOCOS PERMITIDOS (WHITELIST ESTRITA)
Você pode usar APENAS estes tipos de blocos:
${VALID_BLOCK_TYPES.map(t => `- ${t}`).join('\n')}

❌ NUNCA invente tipos de blocos como: ProductShowcase, PricingTable, BeforeAfter, StatsNumbers, Features, CountdownTimer, Bonus, etc.
❌ Se usar um tipo não listado, o bloco será REJEITADO.

### 2. PROPS OBRIGATÓRIAS POR BLOCO

**Hero** (OBRIGATÓRIO no início):
{
  "title": "Headline impactante focada em benefício",
  "subtitle": "Subheadline que expande a promessa",
  "ctaText": "Texto do botão (verbo de ação + benefício)",
  "ctaUrl": "#comprar",
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE",
  "alignment": "center" | "left" | "right",
  "overlayOpacity": 0.3
}

**ContentColumns**:
{
  "title": "Título da seção",
  "subtitle": "Subtítulo opcional",
  "content": "<p>Texto persuasivo em HTML</p>",
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE",
  "imagePosition": "left" | "right",
  "features": [{ "icon": "Check", "text": "Benefício específico" }],
  "buttonText": "Texto do CTA",
  "buttonUrl": "#acao"
}

**FeatureList**:
{
  "title": "Título da lista",
  "subtitle": "Subtítulo opcional",
  "items": [
    { "icon": "Check" | "Star" | "Shield" | "Zap" | "Heart", "text": "Benefício específico" }
  ],
  "iconColor": "",
  "showButton": true,
  "buttonText": "CTA",
  "buttonUrl": "#"
}

**InfoHighlights**:
{
  "items": [
    { "icon": "Truck" | "Shield" | "Clock" | "CreditCard", "title": "Título curto", "description": "Descrição breve" }
  ],
  "layout": "horizontal" | "grid",
  "iconColor": ""
}

**Testimonials**:
{
  "title": "O Que Nossos Clientes Dizem",
  "items": [
    {
      "name": "Nome Completo Real",
      "text": "Depoimento persuasivo e específico com resultados concretos",
      "rating": 5,
      "avatar": "PLACEHOLDER_IMAGE"
    }
  ]
}

**FAQ**:
{
  "title": "Perguntas Frequentes",
  "items": [
    { "question": "Pergunta comum?", "answer": "Resposta que elimina objeção" }
  ]
}

**YouTubeVideo**:
{
  "youtubeUrl": "URL_REAL_DO_VIDEO ou PLACEHOLDER_VIDEO",
  "title": "Título do vídeo",
  "widthPreset": "full" | "large" | "medium",
  "aspectRatio": "16:9"
}

**VideoCarousel**:
{
  "title": "Título da seção",
  "videos": [
    { "url": "URL_YOUTUBE", "title": "Título" }
  ],
  "aspectRatio": "16:9"
}

**HeroBanner**:
{
  "slides": [
    { "imageDesktop": "PLACEHOLDER_IMAGE", "imageMobile": "PLACEHOLDER_IMAGE", "linkUrl": "#", "altText": "Descrição" }
  ],
  "autoplaySeconds": 5,
  "showArrows": true,
  "showDots": true
}

**Button** (para CTAs isolados):
{
  "text": "Texto do botão",
  "url": "#comprar",
  "variant": "default" | "outline" | "secondary",
  "size": "lg" | "default"
}

**RichText** (apenas como fallback para texto que não se encaixa em outros blocos):
{
  "content": "<h2>Título</h2><p>Texto em HTML...</p>"
}

**Image**:
{
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE",
  "alt": "Descrição da imagem",
  "linkUrl": ""
}

**Spacer**:
{
  "height": "md" | "lg" | "xl"
}

### 3. REGRAS DE COPY

- Headlines: IMPACTANTES, focadas em benefício principal, máximo 10 palavras
- Subtítulos: Expandem a promessa, 15-25 palavras
- Bullets: Benefícios ESPECÍFICOS, não genéricos (ex: "Resultados em 30 dias" não "Resultados rápidos")
- CTAs: Verbo de ação + benefício (ex: "Quero Meu Desconto" não "Clique aqui")
- Depoimentos: Nomes completos, resultados específicos, linguagem natural

### 4. ESTRUTURA RECOMENDADA

1. **Hero** - Headline principal + CTA (SEMPRE PRIMEIRO)
2. **ContentColumns** ou **FeatureList** - Benefícios principais
3. **InfoHighlights** - Diferenciais (frete, garantia, segurança)
4. **YouTubeVideo** ou **VideoCarousel** - Se houver vídeos
5. **Testimonials** - Prova social
6. **FAQ** - Elimina objeções
7. **Hero** ou **Button** - CTA final (SEMPRE TERMINAR COM CTA)

### 5. PLACEHOLDERS

- Para imagens: use exatamente "PLACEHOLDER_IMAGE" (usuário substituirá no editor)
- Para vídeos sem URL real: use exatamente "PLACEHOLDER_VIDEO"
- Para URLs de ação: use "#comprar", "#contato", etc.

## OUTPUT

Use a função create_page_blocks para retornar os blocos criados.`;

// Schema para tool calling
const createPageBlocksSchema = {
  type: 'function' as const,
  function: {
    name: 'create_page_blocks',
    description: 'Cria os blocos da página com conteúdo original e persuasivo',
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
                description: 'Tipo do bloco (apenas os tipos listados são válidos)'
              },
              props: {
                type: 'object',
                description: 'Propriedades do bloco com conteúdo ORIGINAL criado'
              },
              marketingFunction: {
                type: 'string',
                enum: ['attention', 'interest', 'desire', 'action', 'problem', 'agitation', 'solution', 'testimonial', 'offer', 'guarantee', 'urgency', 'benefits', 'features', 'faq'],
                description: 'Função deste bloco no funil de marketing'
              },
              order: {
                type: 'number',
                description: 'Ordem do bloco na página (1 = primeiro)'
              }
            },
            required: ['type', 'props', 'marketingFunction', 'order']
          },
          description: 'Blocos criados em ordem estratégica'
        },
        creationQuality: {
          type: 'number',
          description: 'Qualidade da criação de 0 a 100'
        },
        copyStyle: {
          type: 'string',
          description: 'Estilo do copy utilizado (ex: "urgente", "aspiracional", "técnico")'
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Avisos sobre limitações ou sugestões'
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

  const maxLength = options?.maxHtmlLength || 80000;
  const truncatedHtml = html.length > maxLength 
    ? html.slice(0, maxLength) + '\n\n[HTML TRUNCADO]'
    : html;

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Extrair vídeos YouTube do HTML para reuso
  const youtubeUrls = extractYouTubeUrls(html);
  
  // Construir prompt do usuário com contexto estratégico completo
  const userPrompt = `## CONTEXTO DO PRODUTO (ANÁLISE ESTRATÉGICA)

**Tipo de Produto:** ${strategicPlan.productType}
**Nome do Produto:** ${strategicPlan.productName}
**Público-Alvo:** ${strategicPlan.targetAudience}
**Framework de Marketing:** ${strategicPlan.framework} - ${frameworkDef.fullName}
**Dor Principal:** ${strategicPlan.mainPainPoint}
**Promessa Principal:** ${strategicPlan.mainPromise}
**Diferencial (USP):** ${strategicPlan.uniqueSellingProposition}

### Elementos de Conversão Identificados
${strategicPlan.conversionElements?.map(e => `- ${e.type}: ${e.content} (${e.strength})`).join('\n') || 'Nenhum identificado'}

### Vídeos YouTube Encontrados na Página Original
${youtubeUrls.length > 0 ? youtubeUrls.map(url => `- ${url}`).join('\n') : 'Nenhum vídeo encontrado'}

---

## HTML DA PÁGINA ORIGINAL (PARA INSPIRAÇÃO)

${truncatedHtml}

---

## SUA TAREFA

Baseado na análise estratégica acima, CRIE uma página de vendas persuasiva:

1. Use o framework ${strategicPlan.framework}: ${frameworkDef.stages.join(' → ')}
2. Crie copy ORIGINAL e PERSUASIVO (não copie o texto literal do HTML)
3. Use APENAS blocos da whitelist
4. Preencha TODAS as props obrigatórias de cada bloco
5. Para imagens use "PLACEHOLDER_IMAGE"
6. Para vídeos YouTube, use as URLs reais encontradas ou "PLACEHOLDER_VIDEO"
7. Comece com Hero e termine com CTA

Use a função create_page_blocks para retornar os blocos.`;

  console.log('[Content Creator] Iniciando criação...', { 
    framework: strategicPlan.framework,
    productType: strategicPlan.productType,
    htmlLength: truncatedHtml.length,
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
        temperature: 0.4, // Um pouco mais criativo que extração
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

    // Extrair argumentos da função
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_page_blocks') {
      console.error('[Content Creator] Resposta inválida:', JSON.stringify(data).slice(0, 500));
      throw new Error('IA não retornou blocos válidos');
    }

    let creationArgs: CreationResult;
    try {
      creationArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Content Creator] Erro ao parsear argumentos:', toolCall.function.arguments);
      throw new Error('Erro ao processar resposta da IA');
    }

    // Validar e corrigir blocos
    const validatedBlocks = validateAndFixBlocks(creationArgs.blocks || []);

    const result: CreationResult = {
      blocks: validatedBlocks,
      creationQuality: creationArgs.creationQuality || 70,
      copyStyle: creationArgs.copyStyle || 'persuasivo',
      warnings: creationArgs.warnings || [],
    };

    // Adicionar warnings se blocos foram removidos
    const removedCount = (creationArgs.blocks?.length || 0) - validatedBlocks.length;
    if (removedCount > 0) {
      result.warnings.push(`${removedCount} bloco(s) com tipo inválido foram removidos`);
    }

    console.log('[Content Creator] Criação concluída:', {
      blocksCreated: result.blocks.length,
      blocksRemoved: removedCount,
      quality: result.creationQuality,
      copyStyle: result.copyStyle,
      warningsCount: result.warnings.length
    });

    return { result, rawResponse: data };

  } catch (error) {
    console.error('[Content Creator] Erro:', error);
    throw error;
  }
}

// =============================================
// VALIDAÇÃO E CORREÇÃO DE BLOCOS
// =============================================
function validateAndFixBlocks(blocks: CreatedBlock[]): CreatedBlock[] {
  const validBlocks: CreatedBlock[] = [];
  
  for (const block of blocks) {
    // Verificar se o tipo é válido
    if (!VALID_BLOCK_TYPES.includes(block.type as ValidBlockType)) {
      console.warn(`[Content Creator] Bloco com tipo inválido removido: ${block.type}`);
      continue;
    }

    // Corrigir props obrigatórias
    const fixedProps = fillRequiredProps(block.type as ValidBlockType, block.props || {});
    
    validBlocks.push({
      type: block.type,
      props: fixedProps,
      marketingFunction: block.marketingFunction || 'interest',
      order: block.order || validBlocks.length + 1,
    });
  }

  // Ordenar por order
  return validBlocks.sort((a, b) => a.order - b.order);
}

// Preenche props obrigatórias com valores padrão se faltantes
function fillRequiredProps(type: ValidBlockType, props: Record<string, unknown>): Record<string, unknown> {
  const filled = { ...props };

  switch (type) {
    case 'Hero':
      filled.title = filled.title || 'Título Principal';
      filled.subtitle = filled.subtitle || '';
      filled.ctaText = filled.ctaText || 'Saiba Mais';
      filled.ctaUrl = filled.ctaUrl || '#';
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.alignment = filled.alignment || 'center';
      break;

    case 'ContentColumns':
      filled.title = filled.title || '';
      filled.content = filled.content || '';
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imagePosition = filled.imagePosition || 'right';
      if (!Array.isArray(filled.features)) {
        filled.features = [];
      }
      break;

    case 'FeatureList':
      filled.title = filled.title || '';
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [{ icon: 'Check', text: 'Benefício principal' }];
      }
      break;

    case 'InfoHighlights':
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [{ icon: 'Shield', title: 'Garantia', description: 'Satisfação garantida' }];
      }
      filled.layout = filled.layout || 'horizontal';
      break;

    case 'Testimonials':
      filled.title = filled.title || 'O Que Nossos Clientes Dizem';
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [{ name: 'Cliente Satisfeito', text: 'Depoimento do cliente...', rating: 5 }];
      }
      break;

    case 'FAQ':
      filled.title = filled.title || 'Perguntas Frequentes';
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [{ question: 'Pergunta comum?', answer: 'Resposta...' }];
      }
      break;

    case 'YouTubeVideo':
      filled.youtubeUrl = filled.youtubeUrl || filled.url || 'PLACEHOLDER_VIDEO';
      filled.title = filled.title || '';
      filled.widthPreset = filled.widthPreset || 'large';
      filled.aspectRatio = filled.aspectRatio || '16:9';
      break;

    case 'VideoCarousel':
      filled.title = filled.title || '';
      if (!Array.isArray(filled.videos) || filled.videos.length === 0) {
        filled.videos = [{ url: 'PLACEHOLDER_VIDEO', title: '' }];
      }
      break;

    case 'HeroBanner':
      if (!Array.isArray(filled.slides) || filled.slides.length === 0) {
        filled.slides = [{ 
          imageDesktop: 'PLACEHOLDER_IMAGE', 
          imageMobile: 'PLACEHOLDER_IMAGE', 
          linkUrl: '#', 
          altText: 'Banner' 
        }];
      }
      filled.autoplaySeconds = filled.autoplaySeconds || 5;
      break;

    case 'Button':
      filled.text = filled.text || 'Clique Aqui';
      filled.url = filled.url || '#';
      filled.variant = filled.variant || 'default';
      filled.size = filled.size || 'lg';
      break;

    case 'RichText':
      filled.content = filled.content || '<p></p>';
      break;

    case 'Image':
      filled.imageDesktop = filled.imageDesktop || filled.src || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.alt = filled.alt || '';
      break;

    case 'ImageCarousel':
      filled.title = filled.title || '';
      if (!Array.isArray(filled.images) || filled.images.length === 0) {
        filled.images = [{ src: 'PLACEHOLDER_IMAGE', alt: '' }];
      }
      break;

    case 'VideoUpload':
      filled.videoDesktop = filled.videoDesktop || 'PLACEHOLDER_VIDEO';
      filled.videoMobile = filled.videoMobile || filled.videoDesktop || 'PLACEHOLDER_VIDEO';
      break;

    case 'Spacer':
      filled.height = filled.height || 'md';
      break;

    case 'Section':
      filled.backgroundColor = filled.backgroundColor || 'transparent';
      break;
  }

  return filled;
}

// Extrai URLs do YouTube do HTML
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
// FALLBACK DE CRIAÇÃO
// =============================================
export function createFallbackPage(strategicPlan: StrategicPlan): CreationResult {
  const blocks: CreatedBlock[] = [
    {
      type: 'Hero',
      props: {
        title: strategicPlan.mainPromise || 'Bem-vindo',
        subtitle: strategicPlan.uniqueSellingProposition || 'Descubra o que temos para você',
        ctaText: 'Saiba Mais',
        ctaUrl: '#',
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
        title: 'Por Que Escolher-nos?',
        content: `<p>${strategicPlan.mainPainPoint ? `Sabemos que ${strategicPlan.mainPainPoint}.` : ''} Nossa solução foi criada pensando em você.</p>`,
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        imagePosition: 'right',
        features: [
          { icon: 'Check', text: 'Qualidade garantida' },
          { icon: 'Check', text: 'Atendimento personalizado' },
          { icon: 'Check', text: 'Resultados comprovados' },
        ],
      },
      marketingFunction: 'interest',
      order: 2,
    },
    {
      type: 'InfoHighlights',
      props: {
        items: [
          { icon: 'Truck', title: 'Entrega Rápida', description: 'Receba em poucos dias' },
          { icon: 'Shield', title: 'Garantia', description: 'Satisfação garantida' },
          { icon: 'CreditCard', title: 'Pagamento Seguro', description: 'Seus dados protegidos' },
        ],
        layout: 'horizontal',
      },
      marketingFunction: 'benefits',
      order: 3,
    },
    {
      type: 'Button',
      props: {
        text: 'Quero Saber Mais',
        url: '#',
        variant: 'default',
        size: 'lg',
      },
      marketingFunction: 'action',
      order: 4,
    },
  ];

  return {
    blocks,
    creationQuality: 40,
    copyStyle: 'genérico',
    warnings: ['Página de fallback criada - conteúdo genérico'],
  };
}
