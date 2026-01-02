import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// AI-POWERED UNIFIED EXTRACTOR + CLASSIFIER
// ============================================================
// Uses Lovable AI (gemini-2.5-flash) to:
// 1. EXTRACT content (title, items, images, videos, buttons)
// 2. CLASSIFY section type and layout
// 
// This is the SINGLE source of truth for content extraction.
// No regex, no DOM parsing - the AI does everything.
// ============================================================

export interface ExtractedContent {
  title: string | null;
  subtitle: string | null;
  items: Array<{
    title: string;
    description: string;
    suggestedIcon: 'check' | 'shield' | 'zap' | 'star' | 'heart' | 'award' | 'truck' | 'clock' | 'gift' | 'percent' | null;
  }>;
  images: Array<{ src: string; alt: string }>;
  videos: Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }>;
  buttons: Array<{ text: string; url: string }>;
  paragraphs: string[];
}

export interface ClassificationResult {
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'steps' | 'stats' | 'gallery' | 'countdown' | 'logos' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split' | 'timeline-horizontal' | 'timeline-vertical';
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
}

const SYSTEM_PROMPT = `Você é um especialista em web design e extração de conteúdo de e-commerce. Sua tarefa é analisar fragmentos HTML e:

1. EXTRAIR o conteúdo relevante de forma estruturada
2. CLASSIFICAR o tipo de seção e layout apropriado

## REGRAS CRÍTICAS - EVITE "GENERIC"

PRIORIZE SEMPRE uma classificação específica. Use "generic" APENAS como último recurso quando realmente não houver padrão reconhecível.

### Padrões para detectar (NÃO classifique como generic):
- Lista de itens com padrão visual repetido → "benefits" ou "features"
- Imagem + texto lado a lado → "about" ou use layout "columns-image-*"
- Números grandes destacados (10k+, 99%, 24h, R$ X) → "stats"
- Timer/contagem regressiva → "countdown"
- "Comprar agora", "Adicionar ao carrinho", botões proeminentes → "cta"
- Avaliações ★★★★★ ou depoimentos → "testimonials"
- Perguntas e respostas, accordions → "faq"
- Passos numerados (1, 2, 3...) ou timeline → "steps"
- Grid de logos ou marcas → "logos"
- Grid de imagens clicáveis → "gallery"
- Banner grande com título e CTA no topo → "hero"

### QUANDO EM DÚVIDA:
- Prefira classificação específica com confidence 0.5-0.7 do que "generic" com 0.8
- Se parece um benefício mas não tem certeza → classifique como "benefits" com confidence 0.6

## REGRAS DE EXTRAÇÃO

### Título e Subtítulo
- Título: O heading mais importante (h1, h2) da seção
- Subtítulo: Texto complementar logo após o título

### Items (para benefícios, features, etc.)
- SEPARE título e descrição de cada item
- Título: Texto curto e destacado (geralmente em negrito ou heading menor)
- Descrição: Texto explicativo do item
- Sugira um ícone baseado no conteúdo:
  - check: confirmação, verificação, aprovação
  - shield: proteção, segurança, garantia
  - zap: rapidez, energia, velocidade
  - star: qualidade, destaque, premium
  - heart: amor, cuidado, saúde
  - award: prêmio, reconhecimento, certificação
  - truck: entrega, frete, logística
  - clock: tempo, prazo, horário
  - gift: presente, bônus, oferta
  - percent: desconto, economia, promoção

### Imagens
- Extraia src e alt de imagens significativas
- IGNORE: ícones pequenos (<50px), logos de pagamento, decorações

### Vídeos
- YouTube: extraia URL do embed ou watch (mesmo se lazy-loaded)
- Vimeo: extraia URL do embed
- MP4: extraia src de <video>

### Botões
- Extraia texto e URL de links/botões de ação
- Foque em CTAs principais (Comprar, Ver mais, Saiba mais)

## O QUE IGNORAR
- Menus de navegação
- Footers e rodapés
- Banners de cookies
- Breadcrumbs
- Widgets de chat
- Ícones decorativos (SVG inline)
- Classes CSS e estilos

## TIPOS DE SEÇÃO (em ordem de preferência sobre generic)
- hero: Banner principal, introdução, primeira seção com título grande
- benefits: Lista de vantagens/benefícios com ícones ou checkmarks
- features: Características técnicas do produto/serviço
- testimonials: Depoimentos, avaliações, reviews de clientes
- faq: Perguntas e respostas, accordions
- cta: Chamada para ação, botão de conversão proeminente
- about: Sobre a empresa, quem somos, história
- contact: Informações de contato, formulários
- steps: Passos numerados, timeline, "como funciona"
- stats: Números grandes, estatísticas, métricas destacadas
- gallery: Grade de imagens, galeria de fotos
- countdown: Timer, oferta limitada, contagem regressiva
- logos: Marcas parceiras, "visto em", clientes
- generic: ÚLTIMO RECURSO - apenas quando não se encaixa em NENHUMA categoria acima

## LAYOUTS
- hero-centered: Hero centralizado
- hero-split: Hero com imagem de um lado e texto do outro
- columns-image-left: Duas colunas, imagem à esquerda
- columns-image-right: Duas colunas, imagem à direita
- grid-2: Grade de 2 colunas
- grid-3: Grade de 3 colunas (comum para benefícios)
- grid-4: Grade de 4 colunas
- stacked: Empilhado verticalmente
- timeline-horizontal: Timeline/passos horizontal
- timeline-vertical: Timeline/passos vertical

## PLATAFORMAS BRASILEIRAS (padrões comuns)
- Tray/Dooca: classes "section-*", "produto-*", divs com data-section
- Nuvemshop: classes "js-*", sections com IDs numéricos
- VTEX: classes "vtex-*", data-vtex-*
- Shopify BR: shopify-section com nomes em português
- WooCommerce: classes "wp-block-*", "woocommerce-*"

## DICAS FINAIS
- Benefícios geralmente têm 3-6 items com padrão visual repetido
- Hero é geralmente a primeira seção com heading grande e imagem de fundo
- CTA sections são curtas com botões proeminentes
- Steps/Timeline tem números ou passos sequenciais (1, 2, 3...)
- Stats tem números grandes e destacados (10k+, 99%, 24h)
- Countdown tem timer com dias/horas/minutos/segundos`;


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
          enum: ["hero", "benefits", "features", "testimonials", "faq", "cta", "about", "contact", "steps", "stats", "gallery", "countdown", "logos", "generic"],
          description: "Tipo semântico da seção"
        },
        layout: {
          type: "string",
          enum: ["columns-image-left", "columns-image-right", "grid-2", "grid-3", "grid-4", "stacked", "hero-centered", "hero-split", "timeline-horizontal", "timeline-vertical"],
          description: "Layout recomendado"
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confiança na classificação (0-1)"
        },
        reasoning: {
          type: "string",
          description: "Breve explicação do raciocínio"
        },
        extractedContent: {
          type: "object",
          properties: {
            title: { type: ["string", "null"], description: "Título principal da seção" },
            subtitle: { type: ["string", "null"], description: "Subtítulo ou texto complementar" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do item (texto curto e destacado)" },
                  description: { type: "string", description: "Descrição do item (texto explicativo)" },
                  suggestedIcon: { 
                    type: ["string", "null"], 
                    enum: ["check", "shield", "zap", "star", "heart", "award", "truck", "clock", "gift", "percent", null],
                    description: "Ícone sugerido baseado no conteúdo"
                  }
                },
                required: ["title", "description"]
              },
              description: "Lista de items (benefícios, features, etc.)"
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

function stripHtmlForAnalysis(html: string): string {
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
    .replace(/\s*data-[a-z-]+="[^"]*"/gi, '');
  
  // Truncate if too long - INCREASED to 20000 chars for better context
  if (cleaned.length > 20000) {
    cleaned = cleaned.substring(0, 20000) + '... [truncado]';
  }
  
  return cleaned;
}

function createUserPrompt(html: string, context?: ClassifyRequest['pageContext']): string {
  let prompt = 'Analise este HTML e extraia o conteúdo + classifique:\n\n';
  
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
  
  prompt += '```html\n' + html + '\n```\n\n';
  prompt += 'Use a função extract_and_classify para extrair o conteúdo e classificar esta seção.';
  
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, pageContext } = await req.json() as ClassifyRequest;
    
    if (!html || html.length < 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'HTML é obrigatório e deve ter pelo menos 50 caracteres' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[CLASSIFY] LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({
          success: true,
          classification: createFallbackResult(),
          fallback: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLASSIFY] Processando seção: ${html.length} chars`);
    
    const cleanedHtml = stripHtmlForAnalysis(html);
    const userPrompt = createUserPrompt(cleanedHtml, pageContext);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [EXTRACTION_FUNCTION],
        tool_choice: { type: 'function', function: { name: 'extract_and_classify' } },
      }),
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
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
