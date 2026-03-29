import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// System prompt with block catalog, rules, and few-shot examples
// This is a static string to avoid importing from src/ (not available in edge functions)
const SYSTEM_PROMPT = `Você é um arquiteto de páginas web para e-commerce. Sua função é montar a estrutura de uma página usando APENAS os blocos nativos disponíveis no sistema.

## BLOCOS DISPONÍVEIS
- Banner (media) — Banner com imagem/carrossel e CTA
- RichText (content) — Bloco de texto rico com formatação
- Image (media) — Imagem com legenda e link
- Button (content) — Botão de CTA com variantes de estilo
- FAQ (content) — Perguntas e respostas em acordeão
- Testimonials (content) — Depoimentos de clientes
- FeatureList (content) — Lista de features/benefícios com ícones
- ContentColumns (content) — Conteúdo em colunas com imagem e texto
- CategoryList (ecommerce) — Lista/grid de categorias da loja
- ProductGrid (ecommerce) — Vitrine de produtos em grade
- ProductCarousel (ecommerce) — Carrossel horizontal de produtos
- FeaturedProducts (ecommerce) — Produtos selecionados manualmente
- CollectionSection (ecommerce) — Seção de categoria/coleção com produtos
- InfoHighlights (content) — Barra de benefícios da loja (frete, troca, etc)
- BannerProducts (ecommerce) — Banner lateral + grid de produtos
- YouTubeVideo (media) — Player de vídeo do YouTube
- VideoCarousel (media) — Carrossel de vídeos do YouTube
- VideoUpload (media) — Vídeo nativo com upload
- Reviews (content) — Carrossel de avaliações de produtos
- FeaturedCategories (ecommerce) — Categorias em destaque com imagens
- TextBanners (content) — Seção texto + imagens lado a lado com CTA
- StepsTimeline (content) — Linha do tempo / passos numerados
- CountdownTimer (content) — Contador regressivo para ofertas
- LogosCarousel (content) — Carrossel de logos de parceiros
- StatsNumbers (content) — Números/estatísticas animadas
- ImageGallery (media) — Galeria de imagens em grid com lightbox
- AccordionBlock (content) — Acordeão genérico de conteúdo
- ImageCarousel (media) — Carrossel de imagens
- Newsletter (content) — Formulário de newsletter simples
- ContactForm (content) — Formulário de contato completo
- Map (content) — Mapa do Google com informações de contato
- SocialFeed (content) — Feed de posts do Instagram/redes sociais
- PersonalizedProducts (content) — Produtos recomendados personalizados
- LivePurchases (content) — Notificações de compras em tempo real
- PricingTable (content) — Tabela de planos/preços
- PopupModal (content) — Popup/modal de promoção ou newsletter
- NewsletterForm (utilities) — Formulário avançado de newsletter com lista
- Divider (layout) — Linha divisória
- Spacer (layout) — Espaçamento vertical
- HTMLSection (layout) — Bloco HTML/CSS customizado
- EmbedSocialPost (utilities) — Embed de post de rede social

## REGRAS DE COMPOSIÇÃO
1. Header e Footer são INJETADOS AUTOMATICAMENTE — NÃO inclua na sua resposta
2. Retorne entre 3 e 12 blocos de conteúdo
3. NÃO repita o mesmo tipo de bloco consecutivamente (ex: dois Banner seguidos)
4. Landing pages devem começar com impacto visual (Banner, Image, ou VideoUpload)
5. Páginas promocionais devem ter pelo menos 1 CTA claro (Button ou banner com link)
6. Use Divider ou Spacer com moderação (máximo 2 por página)
7. Finalize com um bloco de engajamento quando fizer sentido (Newsletter, ContactForm, SocialFeed)
8. Varie os blocos — páginas monotônicas (só texto) são ruins

## EXEMPLOS DE ESTRUTURAS BEM MONTADAS

### Landing de Produto (venda direta)
Banner, InfoHighlights, ContentColumns, Testimonials, FAQ, Button

### Home Institucional (loja de cosméticos)
Banner, FeaturedCategories, ProductCarousel, TextBanners, Reviews, Newsletter

### Página de Contato
Banner, RichText, ContactForm, Map, FAQ

### Página Promocional (Black Friday)
Banner, CountdownTimer, ProductGrid, StatsNumbers, Testimonials, Newsletter

### Página Sobre Nós
Banner, RichText, StepsTimeline, LogosCarousel, SocialFeed

## FORMATO DE RESPOSTA
Use APENAS a tool calling fornecida. Retorne um array de blocos na ordem em que devem aparecer na página, com o tipo exato e uma razão curta para cada escolha.`;

// Valid block types for validation
const VALID_TYPES = new Set([
  'Banner', 'RichText', 'Image', 'Button', 'FAQ', 'Testimonials', 'FeatureList',
  'ContentColumns', 'CategoryList', 'ProductGrid', 'ProductCarousel', 'FeaturedProducts',
  'CollectionSection', 'InfoHighlights', 'BannerProducts', 'YouTubeVideo', 'VideoCarousel',
  'VideoUpload', 'Reviews', 'FeaturedCategories', 'TextBanners', 'StepsTimeline',
  'CountdownTimer', 'LogosCarousel', 'StatsNumbers', 'ImageGallery', 'AccordionBlock',
  'ImageCarousel', 'Newsletter', 'ContactForm', 'Map', 'SocialFeed', 'PersonalizedProducts',
  'LivePurchases', 'PricingTable', 'PopupModal', 'NewsletterForm', 'Divider', 'Spacer',
  'HTMLSection', 'EmbedSocialPost',
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, pageName } = await req.json();

    if (!prompt || !pageName) {
      return new Response(
        JSON.stringify({ error: "prompt e pageName são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userMessage = `Monte a estrutura de blocos para a seguinte página:

Nome: "${pageName}"
Descrição do usuário: "${prompt}"

Escolha os blocos mais adequados e retorne na ordem correta.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
                          description: "Tipo exato do bloco (ex: Banner, FAQ, ProductGrid)",
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
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao gerar estrutura da página" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "IA não retornou estrutura válida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const blocks: { type: string; reason: string }[] = parsed.blocks || [];

    // Validate: filter out invalid types and enforce rules
    const validBlocks = blocks
      .filter(b => VALID_TYPES.has(b.type))
      .slice(0, 12); // Max 12 blocks

    if (validBlocks.length === 0) {
      return new Response(
        JSON.stringify({ error: "IA não gerou blocos válidos. Tente reformular o prompt." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ blocks: validBlocks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-page-architect error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
