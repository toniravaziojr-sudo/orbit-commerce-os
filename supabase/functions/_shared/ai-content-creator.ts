// =============================================
// AI CONTENT CREATOR - Sistema de Criação ORIGINAL
// Gera páginas de vendas completas e persuasivas
// NENHUM conteúdo é extraído - TUDO é criado
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
const CREATION_SYSTEM_PROMPT = `Você é um copywriter expert em páginas de vendas de alta conversão.

## SUA MISSÃO ÚNICA

Criar uma página de vendas COMPLETA, PERSUASIVA e ORIGINAL baseada APENAS em:
- Tipo de produto
- Público-alvo  
- Dor principal
- Promessa principal
- USP (diferencial único)

## ⚠️ REGRAS ABSOLUTAS

1. TODO conteúdo deve ser INVENTADO por você - textos ricos e persuasivos
2. NUNCA use placeholders ou textos genéricos
3. NUNCA copie nomes, depoimentos ou textos de qualquer fonte
4. CRIE headlines impactantes, descrições detalhadas, benefícios específicos

## ESTRUTURA OBRIGATÓRIA (EXATAMENTE ESTA ORDEM)

### BLOCO 1: Hero
{
  "type": "Hero",
  "props": {
    "title": "HEADLINE IMPACTANTE COM BENEFÍCIO PRINCIPAL (máx 8 palavras)",
    "subtitle": "Subheadline que expande a promessa e gera desejo (20-30 palavras)",
    "ctaText": "VERBO + BENEFÍCIO (ex: QUERO RESULTADOS AGORA)",
    "ctaUrl": "#comprar",
    "imageDesktop": "PLACEHOLDER_IMAGE",
    "imageMobile": "PLACEHOLDER_IMAGE",
    "alignment": "center"
  },
  "marketingFunction": "attention",
  "order": 1
}

### BLOCO 2: ContentColumns (Problema + Solução)
{
  "type": "ContentColumns",
  "props": {
    "title": "Título que conecta com a dor",
    "content": "<p>Parágrafo 1: Descreva a DOR em detalhes - faça o leitor se identificar</p><p>Parágrafo 2: Apresente a SOLUÇÃO - como o produto resolve</p><p>Parágrafo 3: Diferencial único - por que este é melhor</p>",
    "imageDesktop": "PLACEHOLDER_IMAGE",
    "imageMobile": "PLACEHOLDER_IMAGE",
    "imagePosition": "right",
    "features": [
      { "icon": "Check", "text": "Benefício específico 1 com resultado" },
      { "icon": "Check", "text": "Benefício específico 2 com resultado" },
      { "icon": "Check", "text": "Benefício específico 3 com resultado" },
      { "icon": "Check", "text": "Benefício específico 4 com resultado" },
      { "icon": "Check", "text": "Benefício específico 5 com resultado" }
    ]
  },
  "marketingFunction": "interest",
  "order": 2
}

### BLOCO 3: FeatureList (Ação Múltipla)
{
  "type": "FeatureList",
  "props": {
    "title": "Ação X em 1 (ou título de múltiplos benefícios)",
    "subtitle": "Explicação curta do conceito",
    "items": [
      { "icon": "Zap", "title": "Ação 1", "text": "Descrição do benefício" },
      { "icon": "Shield", "title": "Ação 2", "text": "Descrição do benefício" },
      { "icon": "Droplets", "title": "Ação 3", "text": "Descrição do benefício" },
      { "icon": "Clock", "title": "Ação 4", "text": "Descrição do benefício" },
      { "icon": "Leaf", "title": "Ação 5", "text": "Descrição do benefício" }
    ],
    "layout": "grid",
    "columns": 5
  },
  "marketingFunction": "benefits",
  "order": 3
}

### BLOCO 4: InfoHighlights (Diferenciais)
{
  "type": "InfoHighlights",
  "props": {
    "title": "Por que escolher [Produto]?",
    "items": [
      { "icon": "Zap", "title": "Super Prático", "description": "Descrição do diferencial" },
      { "icon": "Target", "title": "Resultados Rápidos", "description": "Descrição do diferencial" },
      { "icon": "Leaf", "title": "100% Natural", "description": "Descrição do diferencial" },
      { "icon": "BadgeDollarSign", "title": "Custo-Benefício", "description": "Descrição do diferencial" },
      { "icon": "Beaker", "title": "Comprovado", "description": "Descrição do diferencial" },
      { "icon": "Package", "title": "Entrega Discreta", "description": "Descrição do diferencial" }
    ],
    "layout": "grid",
    "columns": 3
  },
  "marketingFunction": "desire",
  "order": 4
}

### BLOCO 5: ContentColumns (Segmentação/Níveis)
{
  "type": "ContentColumns",
  "props": {
    "title": "Identifique seu [NÍVEL/PERFIL]",
    "content": "<p>Explicação sobre os diferentes perfis/níveis de clientes</p><p>Por que o produto serve para todos</p>",
    "imageDesktop": "PLACEHOLDER_IMAGE",
    "imageMobile": "PLACEHOLDER_IMAGE",
    "imagePosition": "left",
    "features": [
      { "icon": "Check", "text": "Perfil 1: Benefício específico" },
      { "icon": "Check", "text": "Perfil 2: Benefício específico" },
      { "icon": "Check", "text": "Perfil 3: Benefício específico" }
    ]
  },
  "marketingFunction": "interest",
  "order": 5
}

### BLOCO 6: Testimonials
{
  "type": "Testimonials",
  "props": {
    "title": "O Que Nossos Clientes Dizem",
    "items": [
      {
        "name": "Nome Completo Brasileiro Real",
        "text": "Depoimento DETALHADO com situação antes, ação tomada e resultado específico (mínimo 30 palavras)",
        "rating": 5,
        "location": "Cidade, Estado"
      },
      {
        "name": "Outro Nome Brasileiro Real",
        "text": "Outro depoimento detalhado e convincente (mínimo 30 palavras)",
        "rating": 5,
        "location": "Cidade, Estado"
      },
      {
        "name": "Terceiro Nome Brasileiro",
        "text": "Terceiro depoimento com história pessoal (mínimo 30 palavras)",
        "rating": 5,
        "location": "Cidade, Estado"
      }
    ]
  },
  "marketingFunction": "testimonial",
  "order": 6
}

### BLOCO 7: FAQ
{
  "type": "FAQ",
  "props": {
    "title": "Perguntas Frequentes",
    "items": [
      { "question": "Pergunta que elimina objeção de compra?", "answer": "Resposta completa e convincente" },
      { "question": "Pergunta sobre prazo/entrega?", "answer": "Resposta que tranquiliza" },
      { "question": "Pergunta sobre garantia?", "answer": "Resposta que gera confiança" },
      { "question": "Pergunta sobre resultados?", "answer": "Resposta com expectativa realista" }
    ]
  },
  "marketingFunction": "faq",
  "order": 7
}

### BLOCO 8: Hero (CTA Final)
{
  "type": "Hero",
  "props": {
    "title": "Headline de fechamento com urgência/escassez",
    "subtitle": "Recapitulação da promessa e chamada final",
    "ctaText": "CTA FORTE COM BENEFÍCIO",
    "ctaUrl": "#comprar",
    "imageDesktop": "PLACEHOLDER_IMAGE",
    "imageMobile": "PLACEHOLDER_IMAGE",
    "alignment": "center"
  },
  "marketingFunction": "action",
  "order": 8
}

### BLOCO 9: InfoHighlights (Garantias)
{
  "type": "InfoHighlights",
  "props": {
    "items": [
      { "icon": "Truck", "title": "Frete Grátis", "description": "Entrega para todo Brasil" },
      { "icon": "Shield", "title": "Garantia 30 Dias", "description": "Ou seu dinheiro de volta" },
      { "icon": "CreditCard", "title": "Pagamento Seguro", "description": "Dados 100% protegidos" }
    ],
    "layout": "horizontal"
  },
  "marketingFunction": "guarantee",
  "order": 9
}

## DIRETRIZES DE COPY

1. **Headlines**: Curtas, impactantes, focadas em benefício
2. **Subtítulos**: Expandem a promessa, geram curiosidade
3. **Corpo**: Empático, específico, orientado a resultados
4. **CTAs**: Verbos de ação + benefício (nunca "clique aqui")
5. **Depoimentos**: Histórias pessoais, resultados específicos, emoção
6. **FAQ**: Objeções reais respondidas de forma convincente

## OUTPUT

Use a função create_page_blocks para retornar EXATAMENTE 9 blocos na ordem especificada.`;

// Schema para tool calling
const createPageBlocksSchema = {
  type: 'function' as const,
  function: {
    name: 'create_page_blocks',
    description: 'Cria os 9 blocos da página com conteúdo 100% original e persuasivo',
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
                description: 'Propriedades do bloco com conteúdo ORIGINAL e PERSUASIVO'
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
          description: 'Estilo de copy usado (ex: persuasivo, emocional, direto)'
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
  }
): Promise<{ result: CreationResult; rawResponse?: unknown }> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Extrair APENAS URLs de vídeo do HTML (estrutural, não conteúdo)
  const youtubeUrls = extractYouTubeUrls(html);
  
  // Prompt APENAS com dados estratégicos - ZERO HTML
  const userPrompt = `## BRIEFING DO PRODUTO

**Nome do Produto:** ${strategicPlan.productName || 'Produto'}
**Tipo:** ${strategicPlan.productType}
**Público-Alvo:** ${strategicPlan.targetAudience}

### DOR PRINCIPAL DO CLIENTE:
"${strategicPlan.mainPainPoint}"

### PROMESSA PRINCIPAL:
"${strategicPlan.mainPromise}"

### DIFERENCIAL ÚNICO (USP):
"${strategicPlan.uniqueSellingProposition}"

### FRAMEWORK DE MARKETING: ${strategicPlan.framework}
Etapas: ${frameworkDef.stages.join(' → ')}

---

## RECURSOS EXTRAS

${youtubeUrls.length > 0 
  ? `Vídeo YouTube disponível: ${youtubeUrls[0]} (pode adicionar bloco YouTubeVideo após o Hero se apropriado)`
  : 'Nenhum vídeo disponível'}

---

## SUA TAREFA

Crie uma página de vendas COMPLETA com 9 blocos obrigatórios:

1. **Hero** - Headline impactante baseada na PROMESSA
2. **ContentColumns** - Problema detalhado + Solução
3. **FeatureList** - 5 benefícios/ações do produto
4. **InfoHighlights** - 6 diferenciais competitivos
5. **ContentColumns** - Segmentação por perfil de cliente
6. **Testimonials** - 3 depoimentos FICTÍCIOS mas REALISTAS
7. **FAQ** - 4 perguntas que eliminam objeções
8. **Hero** - CTA final com urgência
9. **InfoHighlights** - Garantias (frete, devolução, segurança)

⚠️ REGRAS CRÍTICAS:
- TODO texto deve ser ORIGINAL - crie você mesmo
- Depoimentos com nomes brasileiros reais e histórias detalhadas
- Headlines curtas e impactantes (máx 8 palavras)
- Sem textos genéricos como "Título Principal" ou "Cliente Satisfeito"
- Foco total em CONVERSÃO

Use a função create_page_blocks para retornar os 9 blocos.`;

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
        model: 'google/gemini-2.5-pro', // Usando Pro para melhor qualidade
        messages: [
          { role: 'system', content: CREATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [createPageBlocksSchema],
        tool_choice: { type: 'function', function: { name: 'create_page_blocks' } },
        temperature: 0.9, // Alta criatividade
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
      creationQuality: creationArgs.creationQuality || 85,
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

    // Limpar qualquer HTML/content extraído acidentalmente
    const cleanedProps = cleanProps(block.props);

    const fixedProps = fillRequiredProps(
      block.type as ValidBlockType, 
      cleanedProps,
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

// Limpar props de conteúdo extraído
function cleanProps(props: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...props };
  
  // Se content tem tags HTML quebradas (sinal de extração), limpar
  if (typeof cleaned.content === 'string') {
    const content = cleaned.content as string;
    // Detectar HTML extraído (múltiplos </div> consecutivos)
    if (content.includes('</div> </div>') || content.includes('</div></div></div>')) {
      cleaned.content = null; // Forçar fallback
    }
  }
  
  return cleaned;
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
  const usp = strategicPlan.uniqueSellingProposition || 'A solução que você procurava';

  switch (type) {
    case 'Hero':
      if (!filled.title || isGenericOrEmpty(filled.title as string)) {
        filled.title = mainPromise.length > 50 ? mainPromise.slice(0, 50) : mainPromise;
      }
      if (!filled.subtitle || isGenericOrEmpty(filled.subtitle as string)) {
        filled.subtitle = usp;
      }
      if (!filled.ctaText || isGenericOrEmpty(filled.ctaText as string)) {
        filled.ctaText = `QUERO ${productName.toUpperCase()} AGORA`;
      }
      filled.ctaUrl = filled.ctaUrl || '#comprar';
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || 'PLACEHOLDER_IMAGE';
      filled.alignment = filled.alignment || 'center';
      break;

    case 'ContentColumns':
      if (!filled.title || isGenericOrEmpty(filled.title as string)) {
        filled.title = `Por Que Escolher ${productName}?`;
      }
      if (!filled.content || isGenericOrEmpty(filled.content as string)) {
        filled.content = `<p>Se você enfrenta ${painPoint}, sabe exatamente como isso afeta sua qualidade de vida. A frustração, a insegurança, a busca por uma solução que realmente funcione.</p><p>${usp}. Nossa fórmula foi desenvolvida para resolver exatamente esse problema, de forma eficaz e segura.</p><p>Milhares de clientes já transformaram suas vidas com ${productName}. Agora é sua vez de experimentar essa mudança.</p>`;
      }
      filled.imageDesktop = filled.imageDesktop || 'PLACEHOLDER_IMAGE';
      filled.imageMobile = filled.imageMobile || 'PLACEHOLDER_IMAGE';
      filled.imagePosition = filled.imagePosition || 'right';
      if (!Array.isArray(filled.features) || filled.features.length === 0) {
        filled.features = [
          { icon: 'Check', text: 'Resultados visíveis desde as primeiras semanas' },
          { icon: 'Check', text: 'Fórmula segura e testada' },
          { icon: 'Check', text: 'Prático de usar no dia a dia' },
          { icon: 'Check', text: 'Garantia de satisfação' },
          { icon: 'Check', text: 'Milhares de clientes satisfeitos' },
        ];
      }
      break;

    case 'FeatureList':
      if (!filled.title || isGenericOrEmpty(filled.title as string)) {
        filled.title = 'Ação Completa';
      }
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { icon: 'Zap', title: 'Energiza', text: 'Ativa e potencializa' },
          { icon: 'Shield', title: 'Protege', text: 'Contra danos e agressões' },
          { icon: 'Droplets', title: 'Hidrata', text: 'Nutrição profunda' },
          { icon: 'Clock', title: 'Acelera', text: 'Resultados mais rápidos' },
          { icon: 'Leaf', title: 'Fortalece', text: 'Resistência duradoura' },
        ];
      }
      filled.layout = filled.layout || 'grid';
      filled.columns = filled.columns || 5;
      break;

    case 'InfoHighlights':
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { icon: 'Truck', title: 'Entrega Rápida', description: 'Receba no conforto da sua casa' },
          { icon: 'Shield', title: 'Garantia Total', description: '30 dias ou seu dinheiro de volta' },
          { icon: 'CreditCard', title: 'Pagamento Seguro', description: 'Seus dados 100% protegidos' },
        ];
      }
      filled.layout = filled.layout || 'horizontal';
      break;

    case 'Testimonials':
      if (!filled.title || isGenericOrEmpty(filled.title as string)) {
        filled.title = 'O Que Nossos Clientes Dizem';
      }
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { 
            name: 'Carlos Eduardo Mendes', 
            text: `Depois de anos tentando várias soluções sem sucesso, finalmente encontrei ${productName}. Em poucas semanas já comecei a notar diferença. Minha confiança voltou e não pretendo mais parar de usar. Recomendo demais!`, 
            rating: 5,
            location: 'São Paulo, SP'
          },
          { 
            name: 'Roberto Silva Junior', 
            text: `Confesso que estava cético no início, mas resolvi dar uma chance. E que surpresa! Os resultados são reais e vieram mais rápido do que eu esperava. Minha esposa também notou a diferença. Vale cada centavo investido.`, 
            rating: 5,
            location: 'Rio de Janeiro, RJ'
          },
          { 
            name: 'Fernando Oliveira', 
            text: `Já tinha perdido a esperança de encontrar algo que funcionasse. ${productName} mudou minha perspectiva completamente. Produto de altíssima qualidade, entrega rápida e resultados comprovados. Muito satisfeito!`, 
            rating: 5,
            location: 'Belo Horizonte, MG'
          },
        ];
      } else {
        // Corrigir nomes genéricos nos depoimentos existentes
        const nomesBrasileiros = [
          'Carlos Eduardo Mendes', 'Roberto Silva Junior', 'Fernando Oliveira', 
          'Paulo Henrique Santos', 'Marcos Vinícius Costa', 'André Luiz Pereira'
        ];
        filled.items = (filled.items as Array<{name: string; text: string; rating: number; location?: string}>).map((item, i) => {
          const fixed = { ...item };
          if (isGenericOrEmpty(item.name)) {
            fixed.name = nomesBrasileiros[i % nomesBrasileiros.length];
          }
          if (isGenericOrEmpty(item.text)) {
            fixed.text = `${productName} superou todas as minhas expectativas! Resultados incríveis em poucas semanas de uso. Recomendo para todos que buscam qualidade.`;
          }
          if (!item.location) {
            fixed.location = ['São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG'][i % 3];
          }
          return fixed;
        });
      }
      break;

    case 'FAQ':
      if (!filled.title || isGenericOrEmpty(filled.title as string)) {
        filled.title = 'Perguntas Frequentes';
      }
      if (!Array.isArray(filled.items) || filled.items.length === 0) {
        filled.items = [
          { 
            question: `Como funciona ${productName}?`, 
            answer: `${productName} foi desenvolvido com tecnologia avançada para oferecer resultados eficazes. ${usp}. O uso é simples e prático, podendo ser incorporado facilmente na sua rotina.`
          },
          { 
            question: 'Qual é o prazo de entrega?', 
            answer: 'Trabalhamos com as melhores transportadoras do Brasil. O prazo varia de 5 a 15 dias úteis dependendo da sua região. Você recebe o código de rastreio assim que o pedido é despachado.'
          },
          { 
            question: 'Tem garantia de satisfação?', 
            answer: 'Sim! Oferecemos 30 dias de garantia incondicional. Se por qualquer motivo você não ficar satisfeito, devolvemos 100% do seu dinheiro. Sem burocracia.'
          },
          { 
            question: 'Em quanto tempo verei resultados?', 
            answer: 'Os resultados variam de pessoa para pessoa, mas a maioria dos clientes começa a notar diferença nas primeiras semanas de uso contínuo. Para melhores resultados, recomendamos uso regular conforme as instruções.'
          },
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
      if (!filled.title || isGenericOrEmpty(filled.title as string)) {
        filled.title = `Conheça ${productName}`;
      }
      break;

    case 'Button':
      if (!filled.text || isGenericOrEmpty(filled.text as string)) {
        filled.text = `QUERO ${productName.toUpperCase()} AGORA`;
      }
      filled.url = filled.url || '#comprar';
      filled.variant = filled.variant || 'default';
      filled.size = filled.size || 'lg';
      break;
  }

  return filled;
}

// Verifica se texto é genérico ou vazio
function isGenericOrEmpty(text: string): boolean {
  if (!text || text.trim().length < 3) return true;
  const lower = text.toLowerCase().trim();
  const generics = [
    'título principal', 'headline aqui', 'cliente satisfeito', 
    'nome do cliente', 'depoimento do cliente', 'descrição',
    'texto aqui', 'clique aqui', 'saiba mais', 'cliente 1',
    'cliente 2', 'joão s.', 'maria s.', 'título', 'subtítulo',
    'placeholder', 'lorem ipsum', 'texto de exemplo'
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
// FALLBACK - Página completa de qualidade
// =============================================
export function createFallbackPage(strategicPlan: StrategicPlan): CreationResult {
  const productName = strategicPlan.productName || 'nosso produto';
  const mainPromise = strategicPlan.mainPromise || 'Transforme sua vida hoje';
  const painPoint = strategicPlan.mainPainPoint || 'seus desafios';
  const usp = strategicPlan.uniqueSellingProposition || 'A solução que você procurava';

  const blocks: CreatedBlock[] = [
    // BLOCO 1: Hero Principal
    {
      type: 'Hero',
      props: {
        title: mainPromise,
        subtitle: usp,
        ctaText: `QUERO ${productName.toUpperCase()} AGORA`,
        ctaUrl: '#comprar',
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        alignment: 'center',
      },
      marketingFunction: 'attention',
      order: 1,
    },
    // BLOCO 2: Problema + Solução
    {
      type: 'ContentColumns',
      props: {
        title: `Por Que Escolher ${productName}?`,
        content: `<p>Se você enfrenta ${painPoint}, sabe exatamente como isso afeta sua qualidade de vida. A frustração, a insegurança, a busca constante por uma solução que realmente funcione.</p><p>${usp}. Nossa fórmula exclusiva foi desenvolvida para resolver exatamente esse problema, de forma eficaz, segura e comprovada.</p><p>Milhares de clientes já transformaram suas vidas com ${productName}. Agora chegou a sua vez.</p>`,
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        imagePosition: 'right',
        features: [
          { icon: 'Check', text: 'Resultados visíveis desde as primeiras semanas' },
          { icon: 'Check', text: 'Fórmula segura e clinicamente testada' },
          { icon: 'Check', text: 'Super prático de usar no dia a dia' },
          { icon: 'Check', text: 'Garantia incondicional de satisfação' },
          { icon: 'Check', text: 'Mais de 10.000 clientes satisfeitos' },
        ],
      },
      marketingFunction: 'interest',
      order: 2,
    },
    // BLOCO 3: Ação Múltipla
    {
      type: 'FeatureList',
      props: {
        title: 'Ação 5 em 1',
        subtitle: 'Uma fórmula completa que atua em múltiplas frentes',
        items: [
          { icon: 'Zap', title: 'Energiza', text: 'Ativa e potencializa' },
          { icon: 'Shield', title: 'Protege', text: 'Contra danos externos' },
          { icon: 'Droplets', title: 'Hidrata', text: 'Nutrição profunda' },
          { icon: 'Clock', title: 'Acelera', text: 'Resultados rápidos' },
          { icon: 'Leaf', title: 'Fortalece', text: 'Resistência duradoura' },
        ],
        layout: 'grid',
        columns: 5,
      },
      marketingFunction: 'benefits',
      order: 3,
    },
    // BLOCO 4: Diferenciais
    {
      type: 'InfoHighlights',
      props: {
        title: `Por que escolher ${productName}?`,
        items: [
          { icon: 'Zap', title: 'Super Prático', description: 'Use como parte da sua rotina. Sem complicações.' },
          { icon: 'Target', title: 'Resultados Rápidos', description: 'Veja a diferença em poucas semanas.' },
          { icon: 'Leaf', title: '100% Seguro', description: 'Ingredientes de qualidade sem efeitos colaterais.' },
          { icon: 'BadgeDollarSign', title: 'Custo-Benefício', description: 'Muito mais acessível que alternativas.' },
          { icon: 'Beaker', title: 'Comprovado', description: 'Testado e aprovado por especialistas.' },
          { icon: 'Package', title: 'Entrega Discreta', description: 'Embalagem sem identificação do conteúdo.' },
        ],
        layout: 'grid',
        columns: 3,
      },
      marketingFunction: 'desire',
      order: 4,
    },
    // BLOCO 5: Depoimentos
    {
      type: 'Testimonials',
      props: {
        title: 'O Que Nossos Clientes Dizem',
        items: [
          { 
            name: 'Carlos Eduardo Mendes', 
            text: `Depois de anos tentando várias soluções sem sucesso, finalmente encontrei ${productName}. Em poucas semanas já comecei a notar diferença. Minha confiança voltou!`, 
            rating: 5,
            location: 'São Paulo, SP'
          },
          { 
            name: 'Roberto Silva Junior', 
            text: `Confesso que estava cético, mas resolvi dar uma chance. E que surpresa! Os resultados são reais e vieram mais rápido do que esperava. Vale cada centavo!`, 
            rating: 5,
            location: 'Rio de Janeiro, RJ'
          },
          { 
            name: 'Fernando Oliveira', 
            text: `Já tinha perdido a esperança de encontrar algo que funcionasse. ${productName} mudou minha perspectiva. Produto de altíssima qualidade!`, 
            rating: 5,
            location: 'Belo Horizonte, MG'
          },
        ],
      },
      marketingFunction: 'testimonial',
      order: 5,
    },
    // BLOCO 6: FAQ
    {
      type: 'FAQ',
      props: {
        title: 'Perguntas Frequentes',
        items: [
          { question: `Como funciona ${productName}?`, answer: usp },
          { question: 'Qual é o prazo de entrega?', answer: 'Enviamos em até 24h úteis. Prazo de 5 a 15 dias dependendo da região.' },
          { question: 'Tem garantia?', answer: 'Sim! 30 dias de garantia incondicional ou seu dinheiro de volta.' },
          { question: 'Em quanto tempo vejo resultados?', answer: 'A maioria dos clientes nota diferença nas primeiras semanas de uso contínuo.' },
        ],
      },
      marketingFunction: 'faq',
      order: 6,
    },
    // BLOCO 7: CTA Final
    {
      type: 'Hero',
      props: {
        title: 'Pronto Para Transformar Sua Vida?',
        subtitle: `${mainPromise}. Milhares já escolheram ${productName}. Faça parte desse grupo.`,
        ctaText: `QUERO ${productName.toUpperCase()} AGORA`,
        ctaUrl: '#comprar',
        imageDesktop: 'PLACEHOLDER_IMAGE',
        imageMobile: 'PLACEHOLDER_IMAGE',
        alignment: 'center',
      },
      marketingFunction: 'action',
      order: 7,
    },
    // BLOCO 8: Garantias
    {
      type: 'InfoHighlights',
      props: {
        items: [
          { icon: 'Truck', title: 'Frete Grátis', description: 'Entrega para todo Brasil' },
          { icon: 'Shield', title: 'Garantia 30 Dias', description: 'Ou seu dinheiro de volta' },
          { icon: 'CreditCard', title: 'Pagamento Seguro', description: 'Dados 100% protegidos' },
        ],
        layout: 'horizontal',
      },
      marketingFunction: 'guarantee',
      order: 8,
    },
  ];

  return {
    blocks,
    creationQuality: 70,
    copyStyle: 'persuasivo-contextual',
    warnings: ['Página de fallback criada - edite para personalizar ainda mais'],
  };
}
