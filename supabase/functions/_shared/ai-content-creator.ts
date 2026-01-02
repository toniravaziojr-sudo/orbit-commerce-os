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
// PROMPT DO SISTEMA - FOCADO EM CRIAÇÃO COM EXEMPLO
// =============================================
const CREATION_SYSTEM_PROMPT = `Você é um copywriter especialista em páginas de vendas de alta conversão.

## SUA MISSÃO
Dado a análise estratégica de uma página, você deve CRIAR conteúdo ORIGINAL e PERSUASIVO.
Você NÃO está extraindo conteúdo - você está CRIANDO baseado na inspiração e dados fornecidos.

## REGRA CRÍTICA: NUNCA USE TEXTOS GENÉRICOS

❌ PROIBIDO usar textos como:
- "Título Principal" / "Headline Aqui"
- "Cliente Satisfeito" / "Nome do Cliente"  
- "Depoimento do cliente..."
- "Benefício principal"
- "Descrição..."
- Qualquer placeholder óbvio

✅ SEMPRE crie textos ESPECÍFICOS baseados no:
- Nome do produto
- Benefícios identificados
- Dor/problema do público
- USP (proposta única de valor)

## TIPOS DE BLOCOS PERMITIDOS (WHITELIST ESTRITA)
${VALID_BLOCK_TYPES.map(t => `- ${t}`).join('\n')}

❌ NUNCA invente tipos de blocos como: ProductShowcase, PricingTable, BeforeAfter, StatsNumbers, Features, CountdownTimer, Bonus, etc.

## PROPS OBRIGATÓRIAS POR BLOCO

**Hero** (OBRIGATÓRIO no início):
{
  "title": "Headline IMPACTANTE focada em benefício (máx 10 palavras)",
  "subtitle": "Subheadline que expande a promessa (15-25 palavras)",
  "ctaText": "VERBO + Benefício (ex: Quero Meu Desconto, Recuperar Meus Cabelos)",
  "ctaUrl": "#comprar",
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE"
}

**ContentColumns**:
{
  "title": "Título persuasivo da seção",
  "content": "<p>Texto persuasivo em HTML com benefícios específicos</p>",
  "imageDesktop": "PLACEHOLDER_IMAGE",
  "imageMobile": "PLACEHOLDER_IMAGE",
  "imagePosition": "left" | "right",
  "features": [{ "icon": "Check", "text": "Benefício ESPECÍFICO com resultado concreto" }]
}

**FeatureList**:
{
  "title": "Título da lista de benefícios",
  "items": [{ "icon": "Check", "text": "Benefício específico com prova ou número" }]
}

**InfoHighlights**:
{
  "items": [
    { "icon": "Truck" | "Shield" | "Clock" | "CreditCard", "title": "Título Curto", "description": "Descrição específica do benefício" }
  ]
}

**Testimonials**:
{
  "title": "O Que Nossos Clientes Dizem",
  "items": [
    {
      "name": "Nome Completo Brasileiro (ex: Carlos Eduardo, Maria Fernanda)",
      "text": "Depoimento DETALHADO com resultado específico, tempo e benefício mensurável",
      "rating": 5
    }
  ]
}

**FAQ**:
{
  "title": "Perguntas Frequentes",
  "items": [
    { "question": "Pergunta real que o cliente faria?", "answer": "Resposta que elimina objeção de compra" }
  ]
}

**YouTubeVideo**:
{
  "youtubeUrl": "URL_REAL_DO_VIDEO",
  "title": "Título descritivo do vídeo"
}

**Button** (para CTAs):
{
  "text": "VERBO + Benefício",
  "url": "#comprar",
  "variant": "default",
  "size": "lg"
}

## EXEMPLO CONCRETO DE OUTPUT ESPERADO

Para um shampoo anti-calvície com framework PAS:

{
  "blocks": [
    {
      "type": "Hero",
      "props": {
        "title": "Recupere Sua Autoconfiança em 30 Dias",
        "subtitle": "O único shampoo 5 em 1 que combate a queda capilar na raiz - sem efeitos colaterais, com resultados visíveis ou seu dinheiro de volta",
        "ctaText": "Quero Meus Cabelos de Volta",
        "ctaUrl": "#comprar",
        "imageDesktop": "PLACEHOLDER_IMAGE",
        "imageMobile": "PLACEHOLDER_IMAGE"
      },
      "marketingFunction": "attention",
      "order": 1
    },
    {
      "type": "ContentColumns",
      "props": {
        "title": "Por Que a Calvície Afeta Sua Vida?",
        "content": "<p>Você já perdeu a conta de quantos tratamentos caros tentou sem resultado? Olhar no espelho e ver os fios cada vez mais ralos afeta sua autoestima todos os dias.</p><p>Nosso shampoo foi desenvolvido por especialistas para atacar as 3 principais causas da queda: DHT, inflamação e falta de nutrientes no folículo.</p>",
        "imageDesktop": "PLACEHOLDER_IMAGE",
        "imageMobile": "PLACEHOLDER_IMAGE",
        "imagePosition": "right",
        "features": [
          { "icon": "Check", "text": "Bloqueia 89% do DHT em 15 dias" },
          { "icon": "Check", "text": "Fórmula sem sulfatos e parabenos" },
          { "icon": "Check", "text": "Resultados comprovados em estudo clínico" }
        ]
      },
      "marketingFunction": "problem",
      "order": 2
    },
    {
      "type": "Testimonials",
      "props": {
        "title": "Homens Que Recuperaram a Confiança",
        "items": [
          {
            "name": "Roberto Mendes",
            "text": "Depois de 2 meses usando, minha esposa notou a diferença antes de mim. As entradas diminuíram visivelmente e os fios estão mais grossos. Finalmente um produto que funciona!",
            "rating": 5
          },
          {
            "name": "Paulo Henrique Silva",
            "text": "Tinha vergonha de tirar o boné. Hoje saio sem ele tranquilamente. Em 45 dias já vi resultado nas fotos antes/depois. Recomendo demais!",
            "rating": 5
          }
        ]
      },
      "marketingFunction": "testimonial",
      "order": 3
    },
    {
      "type": "Button",
      "props": {
        "text": "Quero Acabar Com a Calvície Agora",
        "url": "#comprar",
        "variant": "default",
        "size": "lg"
      },
      "marketingFunction": "action",
      "order": 4
    }
  ],
  "creationQuality": 85,
  "copyStyle": "emocional-aspiracional",
  "warnings": []
}

## ESTRUTURA RECOMENDADA

1. **Hero** - Headline principal + CTA (SEMPRE PRIMEIRO)
2. **ContentColumns** ou **FeatureList** - Problema e solução
3. **InfoHighlights** - Diferenciais (frete, garantia, segurança)
4. **YouTubeVideo** - Se houver URLs de vídeo disponíveis (USE A URL REAL!)
5. **Testimonials** - Prova social com nomes brasileiros e resultados específicos
6. **FAQ** - Elimina objeções de compra
7. **Button** - CTA final (SEMPRE TERMINAR COM CTA)

## OUTPUT

Use a função create_page_blocks para retornar os blocos criados.
Lembre-se: TODOS os textos devem ser ESPECÍFICOS para o produto/serviço analisado.`;

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
                description: 'Propriedades do bloco com conteúdo ORIGINAL criado - NUNCA use placeholders genéricos'
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
          description: 'Blocos criados em ordem estratégica com conteúdo persuasivo ESPECÍFICO'
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

  // REDUZIR HTML - focar nos dados estratégicos
  const maxLength = options?.maxHtmlLength || 15000;
  const truncatedHtml = html.length > maxLength 
    ? html.slice(0, maxLength) + '\n\n[HTML TRUNCADO - USE OS DADOS ESTRATÉGICOS ACIMA]'
    : html;

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Extrair vídeos YouTube do HTML para reuso
  const youtubeUrls = extractYouTubeUrls(html);
  
  // Construir prompt do usuário com ÊNFASE nos dados estratégicos
  const userPrompt = `## ⚠️ DADOS OBRIGATÓRIOS DO PRODUTO (USE ESTES DADOS!)

**Produto:** ${strategicPlan.productName || 'Produto'}
**Tipo:** ${strategicPlan.productType}
**Público-Alvo:** ${strategicPlan.targetAudience}

### PROBLEMA PRINCIPAL QUE RESOLVE:
"${strategicPlan.mainPainPoint}"

### PROMESSA PRINCIPAL (USE NO HERO!):
"${strategicPlan.mainPromise}"

### DIFERENCIAL ÚNICO (USP):
"${strategicPlan.uniqueSellingProposition}"

### FRAMEWORK DE PERSUASÃO: ${strategicPlan.framework}
Etapas: ${frameworkDef.stages.join(' → ')}

---

## 🎥 VÍDEOS YOUTUBE ENCONTRADOS (OBRIGATÓRIO INCLUIR SE HOUVER!)
${youtubeUrls.length > 0 
  ? youtubeUrls.map(url => `✅ ${url} ← USE ESTA URL REAL em um bloco YouTubeVideo`).join('\n')
  : '❌ Nenhum vídeo encontrado - não crie bloco de vídeo'}

---

## ELEMENTOS DE CONVERSÃO IDENTIFICADOS
${strategicPlan.conversionElements?.map(e => `- ${e.type}: "${e.content}" (força: ${e.strength})`).join('\n') || 'Nenhum elemento específico identificado'}

---

## HTML DA PÁGINA ORIGINAL (apenas para contexto/inspiração)

${truncatedHtml}

---

## 📝 SUA TAREFA

Crie uma página de vendas PERSUASIVA seguindo estas regras:

1. **HERO OBRIGATÓRIO**: Use a "Promessa Principal" como base para o título
2. **FRAMEWORK ${strategicPlan.framework}**: Siga as etapas ${frameworkDef.stages.join(' → ')}
3. **VÍDEOS**: Se houver URLs acima, INCLUA em blocos YouTubeVideo com URL REAL
4. **DEPOIMENTOS**: Crie 2-3 depoimentos com nomes brasileiros e resultados específicos
5. **FAQ**: Crie 3-4 perguntas que eliminam objeções de compra
6. **CTA FINAL**: Termine com botão usando verbo + benefício

⚠️ LEMBRE-SE: Nenhum texto genérico como "Título Principal" ou "Cliente Satisfeito"!

Use a função create_page_blocks para retornar os blocos.`;

  console.log('[Content Creator] Iniciando criação...', { 
    framework: strategicPlan.framework,
    productName: strategicPlan.productName,
    productType: strategicPlan.productType,
    mainPromise: strategicPlan.mainPromise?.slice(0, 50),
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
        temperature: 0.7, // Mais criativo para gerar copy original
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

    // Validar e corrigir blocos usando strategicPlan como fallback
    const validatedBlocks = validateAndFixBlocks(creationArgs.blocks || [], strategicPlan, youtubeUrls);

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
      warningsCount: result.warnings.length,
      blockTypes: result.blocks.map(b => b.type)
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
function validateAndFixBlocks(
  blocks: CreatedBlock[], 
  strategicPlan: StrategicPlan,
  youtubeUrls: string[]
): CreatedBlock[] {
  const validBlocks: CreatedBlock[] = [];
  
  for (const block of blocks) {
    // Verificar se o tipo é válido
    if (!VALID_BLOCK_TYPES.includes(block.type as ValidBlockType)) {
      console.warn(`[Content Creator] Bloco com tipo inválido removido: ${block.type}`);
      continue;
    }

    // Corrigir props obrigatórias usando strategicPlan como fallback
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

  // Ordenar por order
  return validBlocks.sort((a, b) => a.order - b.order);
}

// Preenche props obrigatórias com valores do strategicPlan (não genéricos)
function fillRequiredProps(
  type: ValidBlockType, 
  props: Record<string, unknown>,
  strategicPlan: StrategicPlan,
  youtubeUrls: string[]
): Record<string, unknown> {
  const filled = { ...props };
  
  // Helpers para fallback contextual
  const productName = strategicPlan.productName || 'nosso produto';
  const mainPromise = strategicPlan.mainPromise || 'Transforme sua vida hoje';
  const painPoint = strategicPlan.mainPainPoint || 'seus desafios';
  const usp = strategicPlan.uniqueSellingProposition || 'solução única';

  switch (type) {
    case 'Hero':
      // Se título é genérico, usar promessa principal
      if (!filled.title || filled.title === 'Título Principal' || filled.title === 'Headline Aqui') {
        filled.title = mainPromise;
      }
      if (!filled.subtitle) {
        filled.subtitle = usp;
      }
      if (!filled.ctaText || filled.ctaText === 'Saiba Mais' || filled.ctaText === 'Clique Aqui') {
        filled.ctaText = `Quero ${productName}`;
      }
      filled.ctaUrl = filled.ctaUrl || '#comprar';
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.alignment = filled.alignment || 'center';
      break;

    case 'ContentColumns':
      if (!filled.title) {
        filled.title = `Por Que Escolher ${productName}?`;
      }
      if (!filled.content) {
        filled.content = `<p>Se você sofre com ${painPoint}, sabe o quanto isso afeta sua qualidade de vida.</p><p>${usp}</p>`;
      }
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imagePosition = filled.imagePosition || 'right';
      if (!Array.isArray(filled.features) || filled.features.length === 0) {
        filled.features = [
          { icon: 'Check', text: `Resultados comprovados com ${productName}` },
          { icon: 'Check', text: 'Garantia de satisfação' },
          { icon: 'Check', text: 'Atendimento especializado' },
        ];
      }
      break;

    case 'FeatureList':
      if (!filled.title) {
        filled.title = `Benefícios de ${productName}`;
      }
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { icon: 'Check', text: mainPromise },
          { icon: 'Star', text: usp },
        ];
      }
      break;

    case 'InfoHighlights':
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { icon: 'Truck', title: 'Entrega Rápida', description: 'Receba no conforto da sua casa' },
          { icon: 'Shield', title: 'Garantia Total', description: 'Satisfação garantida ou dinheiro de volta' },
          { icon: 'CreditCard', title: 'Pagamento Seguro', description: 'Seus dados 100% protegidos' },
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
            text: `Depois de experimentar ${productName}, minha vida mudou completamente. Os resultados apareceram em poucas semanas!`, 
            rating: 5 
          },
          { 
            name: 'Maria Fernanda', 
            text: `Finalmente encontrei uma solução que realmente funciona. Recomendo para todos que sofrem com ${painPoint}.`, 
            rating: 5 
          },
        ];
      } else {
        // Corrigir nomes genéricos
        const nomesBrasileiros = ['Roberto Mendes', 'Ana Paula', 'Carlos Eduardo', 'Maria Fernanda', 'Paulo Henrique', 'Juliana Santos'];
        filled.items = (filled.items as Array<{name: string; text: string; rating: number}>).map((item, i) => {
          if (item.name === 'Cliente Satisfeito' || item.name === 'Nome do Cliente' || !item.name) {
            return { ...item, name: nomesBrasileiros[i % nomesBrasileiros.length] };
          }
          if (item.text === 'Depoimento do cliente...' || !item.text) {
            return { ...item, text: `${productName} superou todas as minhas expectativas. Resultados incríveis!` };
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
          { question: 'Qual é o prazo de entrega?', answer: 'Enviamos em até 24h úteis após confirmação do pagamento.' },
          { question: 'Tem garantia?', answer: 'Sim! Garantia de 30 dias ou seu dinheiro de volta.' },
        ];
      }
      break;

    case 'YouTubeVideo':
      // Usar URL real se disponível e não for placeholder
      if (!filled.youtubeUrl || filled.youtubeUrl === 'PLACEHOLDER_VIDEO' || filled.youtubeUrl === 'URL_REAL_DO_VIDEO') {
        if (youtubeUrls.length > 0) {
          filled.youtubeUrl = youtubeUrls[0];
        } else {
          filled.youtubeUrl = 'PLACEHOLDER_VIDEO';
        }
      }
      if (!filled.title) {
        filled.title = `Conheça ${productName}`;
      }
      filled.widthPreset = filled.widthPreset || 'large';
      filled.aspectRatio = filled.aspectRatio || '16:9';
      break;

    case 'VideoCarousel':
      if (!filled.title) {
        filled.title = 'Vídeos';
      }
      if (!Array.isArray(filled.videos) || filled.videos.length === 0) {
        if (youtubeUrls.length > 0) {
          filled.videos = youtubeUrls.map((url, i) => ({ url, title: `Vídeo ${i + 1}` }));
        } else {
          filled.videos = [{ url: 'PLACEHOLDER_VIDEO', title: '' }];
        }
      }
      break;

    case 'HeroBanner':
      if (!Array.isArray(filled.slides) || filled.slides.length === 0) {
        filled.slides = [{ 
          imageDesktop: 'PLACEHOLDER_IMAGE', 
          imageMobile: 'PLACEHOLDER_IMAGE', 
          linkUrl: '#', 
          altText: productName 
        }];
      }
      filled.autoplaySeconds = filled.autoplaySeconds || 5;
      break;

    case 'Button':
      if (!filled.text || filled.text === 'Clique Aqui' || filled.text === 'Saiba Mais') {
        filled.text = `Quero ${productName} Agora`;
      }
      filled.url = filled.url || '#comprar';
      filled.variant = filled.variant || 'default';
      filled.size = filled.size || 'lg';
      break;

    case 'RichText':
      filled.content = filled.content || `<p>${usp}</p>`;
      break;

    case 'Image':
      filled.imageDesktop = filled.imageDesktop || filled.src || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.alt = filled.alt || productName;
      break;

    case 'ImageCarousel':
      if (!filled.title) {
        filled.title = '';
      }
      if (!Array.isArray(filled.images) || filled.images.length === 0) {
        filled.images = [{ src: 'PLACEHOLDER_IMAGE', alt: productName }];
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
        content: `<p>Se você sofre com ${painPoint}, sabe o quanto isso afeta sua qualidade de vida.</p><p>${usp}</p>`,
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        imagePosition: 'right',
        features: [
          { icon: 'Check', text: 'Resultados comprovados' },
          { icon: 'Check', text: 'Garantia de satisfação' },
          { icon: 'Check', text: 'Atendimento especializado' },
        ],
      },
      marketingFunction: 'interest',
      order: 2,
    },
    {
      type: 'InfoHighlights',
      props: {
        items: [
          { icon: 'Truck', title: 'Entrega Rápida', description: 'Receba no conforto da sua casa' },
          { icon: 'Shield', title: 'Garantia Total', description: 'Satisfação garantida' },
          { icon: 'CreditCard', title: 'Pagamento Seguro', description: 'Dados protegidos' },
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
