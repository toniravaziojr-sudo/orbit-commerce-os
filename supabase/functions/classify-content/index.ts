import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// AI-POWERED UNIFIED EXTRACTOR + CLASSIFIER v3
// ============================================================
// Uses Lovable AI (gemini-2.5-flash) to:
// 1. EXTRACT content (title, items, images, videos, buttons)
// 2. CLASSIFY section type and layout
// 
// IMPROVEMENTS v3:
// - Stronger anti-generic rules
// - Real testimonial extraction (names, actual text)
// - Card pattern detection (categories, ingredients, products)
// - Before/After detection
// - YouTube noise filtering
// ============================================================

export interface ExtractedContent {
  title: string | null;
  subtitle: string | null;
  items: Array<{
    title: string;
    description: string;
    suggestedIcon: 'check' | 'shield' | 'zap' | 'star' | 'heart' | 'award' | 'truck' | 'clock' | 'gift' | 'percent' | null;
    imageUrl?: string;
    name?: string; // Real name for testimonials
    avatar?: string; // Avatar URL for testimonials
  }>;
  images: Array<{ src: string; alt: string }>;
  videos: Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }>;
  buttons: Array<{ text: string; url: string }>;
  paragraphs: string[];
}

export interface ClassificationResult {
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'steps' | 'stats' | 'gallery' | 'countdown' | 'logos' | 'before_after' | 'product_cards' | 'category_grid' | 'ingredients' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split' | 'timeline-horizontal' | 'timeline-vertical' | 'carousel';
  confidence: number;
  reasoning: string;
  extractedContent: ExtractedContent;
}

interface ClassifyRequest {
  html: string;
  pageContext?: {
    title?: string;
    url?: string;
    sectionIndex?: number;
    totalSections?: number;
  };
  platformContext?: string; // Platform-specific AI context
}

const SYSTEM_PROMPT = `Você é um especialista em web design e extração de conteúdo de e-commerce brasileiro. Sua tarefa é analisar fragmentos HTML e:

1. EXTRAIR o conteúdo relevante de forma estruturada
2. CLASSIFICAR o tipo de seção e layout apropriado

## REGRA #1: NUNCA CLASSIFIQUE RUÍDO DE INTERFACE

### O que é RUÍDO (IGNORE COMPLETAMENTE):
- "More videos", "Mais vídeos", "Hide more videos", "Ocultar mais vídeos"
- "Watch later", "Assistir mais tarde", "Share", "Compartilhar"
- "You're signed out", "Você não está conectado"
- "Subscribe", "Inscrever-se"
- "Copy link", "Copiar link"
- Contadores de visualização ("1.2k views", "1000 visualizações")
- Controles de player de vídeo
- Textos de cookies/LGPD
- Rodapés com CNPJ/CEP

Se uma seção contiver APENAS esses textos, retorne confidence=0 e sectionType="generic".

## REGRA #2: CLASSIFICAÇÕES ESPECÍFICAS > GENERIC

PRIORIZE SEMPRE uma classificação específica. Use "generic" APENAS quando:
- A seção contém apenas texto sem padrão visual
- Não há estrutura reconhecível
- O conteúdo é puramente informativo sem layout

### Padrões de detecção prioritários:

#### 🎯 TESTIMONIALS (depoimentos de clientes)
- Foto/avatar + nome + texto
- Estrelas de avaliação (★★★★★)
- Citações com aspas
- Vídeos de clientes falando
- Padrões: "Depoimento de X", "Feedback", "O que dizem nossos clientes"
- **CRÍTICO**: Extraia o NOME REAL da pessoa (Milton, Gustavo, etc.)
- **CRÍTICO**: Extraia o TEXTO REAL do depoimento
- **PROIBIDO**: Nunca use "Cliente 1", "Excelente produto!", textos genéricos

#### 📊 BEFORE/AFTER (antes e depois)
- Imagens lado a lado (antes/depois)
- Textos como "X dias de uso", "Resultado em X dias"
- Comparações visuais
- Progressão de tratamento
- Fotos de clientes com resultados

#### 🛍️ PRODUCT_CARDS (cards de produtos/kits)
- Imagem + título + preço + botão comprar
- Badge de desconto ("30% OFF")
- Preço original riscado + preço com desconto
- "Adicionar ao carrinho", "Comprar"

#### 📂 CATEGORY_GRID (grid de categorias)
- Cards com: ícone/imagem + título de categoria + "Ver ofertas"/"Saiba mais"
- Exemplos: "Cabelo", "Barba", "Pomada", "Skin Care"
- Links para páginas de categoria

#### 🧪 INGREDIENTS (ingredientes/ativos)
- Cards com: ícone/imagem + nome do ingrediente + benefícios
- Exemplos: "D-Panthenol: Fortalece os fios", "Biotina: Estimula crescimento"
- Layout grid 3-4 colunas

#### ✅ BENEFITS (benefícios)
- Lista de vantagens com ícones/checkmarks
- 3-6 items com padrão visual repetido
- Frases curtas de benefício

#### 📈 STATS (estatísticas)
- Números grandes destacados: "10k+", "99%", "24h"
- Métricas de sucesso
- Contadores animados

#### ⏰ COUNTDOWN (urgência)
- Timer com dias/horas/minutos/segundos
- "Oferta por tempo limitado"
- "Últimas unidades"

#### 🔢 STEPS (como funciona)
- Passos numerados: 1, 2, 3...
- Timeline visual
- "Como funciona", "Passo a passo"

## REGRAS DE EXTRAÇÃO

### Título e Subtítulo
- Título: O heading mais importante (h1, h2) da seção - NÃO ruído de interface
- Subtítulo: Texto complementar logo após o título
- **IGNORE** títulos que são ruído: "More videos", "Share", "Watch later"

### Items (benefícios, features, testimonials, etc.)
Para TESTIMONIALS especificamente:
- title: NOME REAL da pessoa (ex: "Milton", "Gustavo", "Ivan")
- description: TEXTO REAL do depoimento (a frase que a pessoa disse)
- name: mesmo que title (nome da pessoa)
- avatar: URL da foto se existir

Para INGREDIENTS:
- title: Nome do ingrediente (ex: "D-Panthenol", "Biotina")
- description: Benefício/função do ingrediente

Para BENEFITS/FEATURES:
- title: Frase curta do benefício
- description: Explicação se houver
- suggestedIcon: ícone apropriado

### Imagens
- Extraia src e alt de imagens significativas
- IGNORE: ícones pequenos (<50px), logos de pagamento, decorações, placeholders

### Vídeos
- YouTube: extraia URL mesmo de lazy-load (data-src, data-video-id)
- IGNORE: thumbnails de vídeos não clicáveis

### Botões
- Extraia CTAs principais: "Comprar Agora", "Saiba Mais", "Ver Ofertas"
- IGNORE: botões de interface (Share, Watch later, Subscribe)

## TIPOS DE SEÇÃO (ordem de preferência)

1. hero - Banner principal com título grande e CTA
2. testimonials - Depoimentos com NOMES REAIS
3. before_after - Comparações antes/depois
4. product_cards - Cards de produtos com preço
5. category_grid - Grid de categorias
6. ingredients - Lista de ingredientes/ativos
7. benefits - Lista de vantagens com ícones
8. features - Características técnicas
9. stats - Números/estatísticas destacados
10. steps - Passos/timeline numerados
11. faq - Perguntas e respostas
12. countdown - Timer de urgência
13. cta - Call-to-action
14. about - Sobre a empresa
15. gallery - Grade de imagens
16. logos - Logos de parceiros
17. generic - ÚLTIMO RECURSO (quando nada mais se aplica)

## LAYOUTS

- hero-centered: Hero centralizado
- hero-split: Hero com imagem de um lado e texto do outro
- columns-image-left: Duas colunas, imagem à esquerda
- columns-image-right: Duas colunas, imagem à direita
- grid-2, grid-3, grid-4: Grades de N colunas
- stacked: Empilhado verticalmente
- timeline-horizontal, timeline-vertical: Para steps
- carousel: Para sliders/carrosséis

## PLATAFORMAS BRASILEIRAS

- Tray/Dooca: classes "section-*", "produto-*"
- Nuvemshop: classes "js-*", sections numéricas
- VTEX: classes "vtex-*"
- Shopify BR: shopify-section com nomes em português
- Loja Integrada: classes "li-*"

## EXEMPLOS DE CLASSIFICAÇÃO CORRETA

HTML com foto + nome + texto de cliente:
→ sectionType: "testimonials", extrair name real, text real

HTML com "30 dias de uso" + imagem de resultado:
→ sectionType: "before_after"

HTML com ícone + "D-Panthenol" + "Fortalece os fios":
→ sectionType: "ingredients"

HTML com imagem + preço + botão comprar:
→ sectionType: "product_cards"

HTML com "Cabelo" + "Barba" + "Ver ofertas":
→ sectionType: "category_grid"

HTML com APENAS "More videos" ou controles YouTube:
→ confidence: 0, sectionType: "generic" (será filtrado)`;


const EXTRACTION_FUNCTION = {
  type: "function",
  function: {
    name: "extract_and_classify",
    description: "Extrair conteúdo e classificar uma seção HTML",
    parameters: {
      type: "object",
      properties: {
        sectionType: {
          type: "string",
          enum: ["hero", "benefits", "features", "testimonials", "faq", "cta", "about", "contact", "steps", "stats", "gallery", "countdown", "logos", "before_after", "product_cards", "category_grid", "ingredients", "generic"],
          description: "Tipo semântico da seção"
        },
        layout: {
          type: "string",
          enum: ["columns-image-left", "columns-image-right", "grid-2", "grid-3", "grid-4", "stacked", "hero-centered", "hero-split", "timeline-horizontal", "timeline-vertical", "carousel"],
          description: "Layout recomendado"
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confiança na classificação (0-1). Use 0 para ruído de interface."
        },
        reasoning: {
          type: "string",
          description: "Breve explicação do raciocínio"
        },
        extractedContent: {
          type: "object",
          properties: {
            title: { type: ["string", "null"], description: "Título principal da seção (NÃO ruído como 'More videos')" },
            subtitle: { type: ["string", "null"], description: "Subtítulo ou texto complementar" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título/nome do item. Para testimonials, use o NOME REAL da pessoa." },
                  description: { type: "string", description: "Descrição. Para testimonials, use o TEXTO REAL do depoimento." },
                  suggestedIcon: { 
                    type: ["string", "null"], 
                    enum: ["check", "shield", "zap", "star", "heart", "award", "truck", "clock", "gift", "percent", null],
                    description: "Ícone sugerido"
                  },
                  imageUrl: { type: ["string", "null"], description: "URL da imagem do item se houver" },
                  name: { type: ["string", "null"], description: "Nome real para testimonials" },
                  avatar: { type: ["string", "null"], description: "URL do avatar para testimonials" }
                },
                required: ["title", "description"]
              },
              description: "Lista de items extraídos"
            },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  src: { type: "string" },
                  alt: { type: "string" }
                },
                required: ["src", "alt"]
              }
            },
            videos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  type: { type: "string", enum: ["youtube", "vimeo", "mp4"] }
                },
                required: ["url", "type"]
              }
            },
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  url: { type: "string" }
                },
                required: ["text", "url"]
              }
            },
            paragraphs: {
              type: "array",
              items: { type: "string" },
              description: "Parágrafos de texto corrido"
            }
          },
          required: ["title", "subtitle", "items", "images", "videos", "buttons", "paragraphs"]
        }
      },
      required: ["sectionType", "layout", "confidence", "reasoning", "extractedContent"],
      additionalProperties: false
    }
  }
};

// Noise patterns to detect and warn about
const NOISE_INDICATORS = [
  'more videos',
  'mais vídeos',
  'watch later',
  'assistir mais tarde',
  'you\'re signed out',
  'você não está conectado',
  'share',
  'compartilhar',
  'subscribe',
  'inscrever',
  'copy link',
  'copiar link',
  'hide more videos',
  'ocultar mais vídeos',
];

function containsOnlyNoise(html: string): boolean {
  const text = html.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 50) return true;
  
  // Count noise indicators
  let noiseCount = 0;
  for (const pattern of NOISE_INDICATORS) {
    if (text.includes(pattern)) noiseCount++;
  }
  
  // If more than 2 noise indicators and less than 200 chars of real content, it's noise
  const cleanText = text.replace(new RegExp(NOISE_INDICATORS.join('|'), 'gi'), '');
  return noiseCount >= 2 && cleanText.trim().length < 100;
}

function stripHtmlForAnalysis(html: string): string {
  // First check if it's mostly noise
  if (containsOnlyNoise(html)) {
    console.log('[CLASSIFY] Section appears to be mostly noise, marking for low confidence');
  }
  
  // Remove scripts, styles, comments
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove SVGs (decorative noise)
    .replace(/<svg[\s\S]*?<\/svg>/gi, '[SVG]')
    // Remove inline styles (reduce noise)
    .replace(/\s*style="[^"]*"/gi, '')
    // Remove data attributes
    .replace(/\s*data-[a-z-]+="[^"]*"/gi, '')
    // Remove YouTube player controls classes
    .replace(/class="[^"]*ytp-[^"]*"/gi, '')
    // Remove aria attributes
    .replace(/\s*aria-[a-z-]+="[^"]*"/gi, '');
  
  // Truncate if too long - 18000 chars for good context
  if (cleaned.length > 18000) {
    cleaned = cleaned.substring(0, 18000) + '... [truncado]';
  }
  
  return cleaned;
}

function createUserPrompt(html: string, context?: ClassifyRequest['pageContext'], platformContext?: string): string {
  let prompt = 'Analise este HTML e extraia o conteúdo + classifique:\n\n';
  
  // Add platform context if available
  if (platformContext) {
    prompt += `## CONTEXTO DA PLATAFORMA\n${platformContext}\n\n`;
  }
  
  if (context) {
    if (context.title) prompt += `Título da Página: ${context.title}\n`;
    if (context.sectionIndex !== undefined && context.totalSections) {
      prompt += `Seção: ${context.sectionIndex + 1} de ${context.totalSections}\n`;
      if (context.sectionIndex === 0) {
        prompt += `(Esta é a PRIMEIRA seção - provavelmente hero ou intro principal)\n`;
      }
    }
    prompt += '\n';
  }
  
  // Check for noise and add warning
  if (containsOnlyNoise(html)) {
    prompt += '⚠️ AVISO: Esta seção parece conter apenas ruído de interface (YouTube controls, etc.). Se confirmado, retorne confidence=0.\n\n';
  }
  
  prompt += '```html\n' + html + '\n```\n\n';
  prompt += 'Use a função extract_and_classify para extrair o conteúdo e classificar esta seção.\n';
  prompt += 'LEMBRE-SE: Para testimonials, extraia NOMES REAIS e TEXTOS REAIS, nunca use "Cliente 1" ou "Excelente produto!".';
  
  return prompt;
}

function createFallbackResult(): ClassificationResult {
  return {
    sectionType: 'generic',
    layout: 'stacked',
    confidence: 0.1,
    reasoning: 'Fallback - IA não disponível ou erro',
    extractedContent: {
      title: null,
      subtitle: null,
      items: [],
      images: [],
      videos: [],
      buttons: [],
      paragraphs: [],
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, pageContext, platformContext } = await req.json() as ClassifyRequest;
    
    if (!html || html.length < 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'HTML é obrigatório e deve ter pelo menos 50 caracteres' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[CLASSIFY] Processando seção: ${html.length} chars`);
    
    // Check for noise early
    const isLikelyNoise = containsOnlyNoise(html);
    if (isLikelyNoise) {
      console.log('[CLASSIFY] Section detected as interface noise, returning low confidence');
    }
    
    const cleanedHtml = stripHtmlForAnalysis(html);
    const userPrompt = createUserPrompt(cleanedHtml, pageContext, platformContext);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    resetAIRouterCache();

    const response = await aiChatCompletion('google/gemini-2.5-flash', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      tools: [EXTRACTION_FUNCTION],
      tool_choice: { type: 'function', function: { name: 'extract_and_classify' } },
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: '[CLASSIFY]',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CLASSIFY] Erro da API:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit excedido, tente novamente mais tarde' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos de IA esgotados' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      
      throw new Error(`Erro da API: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Extract function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_and_classify') {
      console.error('[CLASSIFY] Formato de resposta inesperado:', JSON.stringify(aiResponse));
      throw new Error('IA não retornou a função esperada');
    }

    let classification: ClassificationResult;
    try {
      classification = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[CLASSIFY] Falha ao parsear resposta:', toolCall.function.arguments);
      throw new Error('Falha ao parsear classificação da IA');
    }

    // Post-process: validate testimonials have real content
    if (classification.sectionType === 'testimonials') {
      const items = classification.extractedContent.items || [];
      const hasGenericNames = items.some(item => 
        /^cliente\s*\d*$/i.test(item.title) ||
        /^cliente\s*\d*$/i.test(item.name || '') ||
        item.title === 'Cliente' ||
        item.description === 'Excelente produto!' ||
        item.description === 'Recomendo a todos.'
      );
      
      if (hasGenericNames) {
        console.log('[CLASSIFY] Warning: Testimonials have generic content, reducing confidence');
        classification.confidence = Math.min(classification.confidence, 0.4);
      }
    }

    // Log summary
    const content = classification.extractedContent;
    console.log(`[CLASSIFY] Resultado: tipo=${classification.sectionType}, layout=${classification.layout}, conf=${classification.confidence}`);
    console.log(`[CLASSIFY] Conteúdo: título="${content.title?.substring(0, 50) || 'null'}", items=${content.items.length}, imgs=${content.images.length}, vids=${content.videos.length}, btns=${content.buttons.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        classification,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLASSIFY] Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: true,
        classification: createFallbackResult(),
        fallback: true,
        error: error instanceof Error ? "Erro interno" : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
