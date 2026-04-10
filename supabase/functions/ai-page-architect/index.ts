import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Consolidated block catalog — uses current block names (v1.1.0+)
const SYSTEM_PROMPT = `Você é um arquiteto de páginas web para e-commerce. Sua função é montar a estrutura de uma página usando APENAS os blocos nativos disponíveis no sistema.

## BLOCOS DISPONÍVEIS
- Banner (media) — Banner com imagem/carrossel e CTA
- RichText (content) — Bloco de texto rico com formatação
- Image (media) — Imagem com legenda e link
- Button (content) — Botão de CTA com variantes de estilo
- FAQ (content) — Perguntas e respostas em acordeão
- Highlights (content) — Barra de benefícios da loja (frete, troca, etc)
- SocialProof (content) — Depoimentos e avaliações (mode: testimonials | reviews)
- ContentSection (content) — Conteúdo em colunas com imagem e texto
- ProductShowcase (ecommerce) — Vitrine de produtos (mode: grid | carousel | featured | collection)
- CategoryShowcase (ecommerce) — Vitrine de categorias (style: cards | circles)
- BannerProducts (ecommerce) — Banner lateral + grid de produtos
- Video (media) — Player de vídeo (mode: youtube | upload)
- VideoCarousel (media) — Carrossel de vídeos do YouTube
- StepsTimeline (content) — Linha do tempo / passos numerados
- CountdownTimer (content) — Contador regressivo para ofertas
- LogosCarousel (content) — Carrossel de logos de parceiros
- StatsNumbers (content) — Números/estatísticas animadas
- ImageGallery (media) — Galeria de imagens em grid ou carrossel
- NewsletterUnified (content) — Newsletter (mode: inline | form | popup)
- ContactForm (content) — Formulário de contato completo
- Map (content) — Mapa do Google com informações de contato
- SocialFeed (content) — Feed de posts do Instagram/redes sociais
- PersonalizedProducts (content) — Produtos recomendados personalizados
- LivePurchases (content) — Notificações de compras em tempo real
- PricingTable (content) — Tabela de planos/preços
- Divider (layout) — Linha divisória
- Spacer (layout) — Espaçamento vertical
- CustomCode (layout) — Bloco HTML/CSS customizado
- EmbedSocialPost (utilities) — Embed de post de rede social

## REGRAS DE COMPOSIÇÃO
1. Header e Footer são INJETADOS AUTOMATICAMENTE — NÃO inclua na sua resposta
2. Retorne entre 3 e 12 blocos de conteúdo
3. NÃO repita o mesmo tipo de bloco consecutivamente (ex: dois Banner seguidos)
4. Landing pages devem começar com impacto visual (Banner, Image, ou Video)
5. Páginas promocionais devem ter pelo menos 1 CTA claro (Button ou banner com link)
6. Use Divider ou Spacer com moderação (máximo 2 por página)
7. Finalize com um bloco de engajamento quando fizer sentido (NewsletterUnified, ContactForm, SocialFeed)
8. Varie os blocos — páginas monotônicas (só texto) são ruins

## EXEMPLOS DE ESTRUTURAS BEM MONTADAS

### Landing de Produto (venda direta)
Banner, Highlights, ContentSection, SocialProof, FAQ, Button

### Home Institucional (loja de cosméticos)
Banner, CategoryShowcase, ProductShowcase, ContentSection, SocialProof, NewsletterUnified

### Página de Contato
Banner, RichText, ContactForm, Map, FAQ

### Página Promocional (Black Friday)
Banner, CountdownTimer, ProductShowcase, StatsNumbers, SocialProof, NewsletterUnified

### Página Sobre Nós
Banner, RichText, StepsTimeline, LogosCarousel, SocialFeed

## FORMATO DE RESPOSTA
Use APENAS a tool calling fornecida. Retorne um array de blocos na ordem em que devem aparecer na página, com o tipo exato e uma razão curta para cada escolha.`;

// Additional context for home page generation
const HOME_CONTEXT = `

## CONTEXTO: HOME PAGE DA LOJA
Você está montando a HOME PAGE principal de uma loja virtual. Esta é a página mais importante — ela precisa:
- Criar impacto visual imediato (Banner hero)
- Mostrar categorias e produtos rapidamente
- Transmitir confiança (SocialProof, StatsNumbers, LogosCarousel)
- Engajar o visitante (NewsletterUnified)

## ESTRUTURAS DE REFERÊNCIA PARA HOME PAGES

### Loja Geral
Banner, Highlights, ProductShowcase, CategoryShowcase, SocialProof, NewsletterUnified

### Moda / Vestuário
Banner, CategoryShowcase, ProductShowcase, ContentSection, SocialFeed, NewsletterUnified

### Cosméticos / Beleza
Banner, Highlights, ProductShowcase, StepsTimeline, SocialProof, SocialFeed, NewsletterUnified

### Eletrônicos / Tech
Banner, Highlights, ProductShowcase, BannerProducts, FAQ, StatsNumbers, NewsletterUnified

### Alimentos / Bebidas
Banner, Highlights, ProductShowcase, ContentSection, SocialProof, ContactForm

### Serviços / Assinaturas
Banner, PricingTable, Highlights, StepsTimeline, SocialProof, FAQ, ContactForm

### Promocional / Black Friday
Banner, CountdownTimer, ProductShowcase, BannerProducts, StatsNumbers, SocialProof, NewsletterUnified

Use estas estruturas como referência, mas adapte conforme a descrição do usuário.`;

// Valid block types (consolidated names)
const VALID_TYPES = new Set([
  'Banner', 'RichText', 'Image', 'Button', 'FAQ', 'Highlights',
  'SocialProof', 'ContentSection', 'ProductShowcase', 'CategoryShowcase',
  'BannerProducts', 'Video', 'VideoCarousel', 'StepsTimeline',
  'CountdownTimer', 'LogosCarousel', 'StatsNumbers', 'ImageGallery',
  'NewsletterUnified', 'ContactForm', 'Map', 'SocialFeed',
  'PersonalizedProducts', 'LivePurchases', 'PricingTable',
  'Divider', 'Spacer', 'CustomCode', 'EmbedSocialPost',
]);

// Legacy → consolidated mappings for backwards compatibility
const LEGACY_MAP: Record<string, string> = {
  'Testimonials': 'SocialProof',
  'Reviews': 'SocialProof',
  'FeatureList': 'Highlights',
  'InfoHighlights': 'Highlights',
  'ContentColumns': 'ContentSection',
  'TextBanners': 'ContentSection',
  'ProductGrid': 'ProductShowcase',
  'ProductCarousel': 'ProductShowcase',
  'FeaturedProducts': 'ProductShowcase',
  'CollectionSection': 'ProductShowcase',
  'CategoryList': 'CategoryShowcase',
  'FeaturedCategories': 'CategoryShowcase',
  'YouTubeVideo': 'Video',
  'VideoUpload': 'Video',
  'Newsletter': 'NewsletterUnified',
  'NewsletterForm': 'NewsletterUnified',
  'PopupModal': 'NewsletterUnified',
  'AccordionBlock': 'FAQ',
  'ImageCarousel': 'ImageGallery',
  'HTMLSection': 'CustomCode',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, pageName, context } = await req.json();

    if (!prompt || !pageName) {
      return new Response(
        JSON.stringify({ success: false, code: 'INVALID_PARAMS', message: "prompt e pageName são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt — add home context if applicable
    const systemPrompt = context === 'home'
      ? SYSTEM_PROMPT + HOME_CONTEXT
      : SYSTEM_PROMPT;

    const userMessage = context === 'home'
      ? `Monte a estrutura de blocos para a HOME PAGE de uma loja virtual.\n\nNome da loja: "${pageName}"\nDescrição/segmento: "${prompt}"\n\nEscolha os blocos mais adequados para uma home page impactante.`
      : `Monte a estrutura de blocos para a seguinte página:\n\nNome: "${pageName}"\nDescrição do usuário: "${prompt}"\n\nEscolha os blocos mais adequados e retorne na ordem correta.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "define_page_structure",
              description: "Define a estrutura de blocos da página na ordem em que devem aparecer.",
              parameters: {
                type: "object",
                properties: {
                  blocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          description: "Tipo exato do bloco (ex: Banner, FAQ, ProductShowcase)",
                        },
                        reason: {
                          type: "string",
                          description: "Razão curta para incluir este bloco",
                        },
                      },
                      required: ["type", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["blocks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "define_page_structure" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, code: 'RATE_LIMITED', message: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, code: 'CREDITS_EXHAUSTED', message: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, code: 'AI_ERROR', message: "Erro ao gerar estrutura da página" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, code: 'NO_RESULT', message: "IA não retornou estrutura válida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const blocks: { type: string; reason: string }[] = parsed.blocks || [];

    // Map legacy names to consolidated names, then validate
    const validBlocks = blocks
      .map(b => ({
        ...b,
        type: LEGACY_MAP[b.type] || b.type,
      }))
      .filter(b => VALID_TYPES.has(b.type))
      .slice(0, 12);

    if (validBlocks.length === 0) {
      return new Response(
        JSON.stringify({ success: false, code: 'NO_VALID_BLOCKS', message: "IA não gerou blocos válidos. Tente reformular o prompt." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, blocks: validBlocks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-page-architect error:", error);
    return new Response(
      JSON.stringify({ success: false, code: 'INTERNAL_ERROR', message: "Erro interno. Se o problema persistir, entre em contato com o suporte." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
