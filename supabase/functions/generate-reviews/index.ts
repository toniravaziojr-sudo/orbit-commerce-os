// =============================================
// GENERATE REVIEWS - AI-powered review generation
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductInfo {
  name: string;
  description?: string;
  price?: number;
  sku?: string;
}

interface GeneratedReview {
  customer_name: string;
  rating: number;
  title: string;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product, quantity, gender = 'both', ratingDistribution = 'mixed' } = await req.json() as { 
      product: ProductInfo; 
      quantity: number;
      gender?: 'both' | 'male' | 'female';
      ratingDistribution?: 'all5' | 'mixed';
    };

    if (!product?.name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome do produto é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validQuantity = Math.min(Math.max(quantity || 10, 5), 50);
    resetAIRouterCache();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Build product context
    const productContext = [
      `Nome: ${product.name}`,
      product.description ? `Descrição: ${product.description}` : null,
      product.price ? `Preço: R$ ${product.price.toFixed(2)}` : null,
    ].filter(Boolean).join('\n');

    // Build gender instruction - VERY STRICT
    const genderInstruction = gender === 'male' 
      ? 'OBRIGATÓRIO: Use EXCLUSIVAMENTE nomes MASCULINOS brasileiros (exemplos: João, Pedro, Carlos, Marcos, Lucas, Rafael, Bruno, André, Felipe, Ricardo, Gustavo, Rodrigo, Fernando, Paulo, Roberto). PROIBIDO usar nomes femininos como Ana, Maria, Patrícia, etc.'
      : gender === 'female'
      ? 'OBRIGATÓRIO: Use EXCLUSIVAMENTE nomes FEMININOS brasileiros (exemplos: Maria, Ana, Juliana, Fernanda, Patrícia, Camila, Bruna, Larissa, Amanda, Carolina, Beatriz, Mariana). PROIBIDO usar nomes masculinos como João, Pedro, Carlos, etc.'
      : 'Use nomes brasileiros variados (masculinos e femininos)';

    // Build rating instruction
    const ratingInstruction = ratingDistribution === 'all5'
      ? 'TODAS as avaliações devem ter nota 5 (cinco estrelas)'
      : 'Distribua as notas entre 4 e 5 estrelas (maioria 5 estrelas, algumas 4 estrelas)';

    const systemPrompt = `Você é um gerador de avaliações de produtos para e-commerce brasileiro. 
Gere avaliações realistas, variadas e autênticas que pareçam escritas por clientes reais.

REGRAS CRÍTICAS E OBRIGATÓRIAS:
1. ${genderInstruction}
2. ${ratingInstruction}

Outras diretrizes:
- Varie o estilo de escrita (formal, informal, curto, detalhado)
- Inclua detalhes específicos do produto nas avaliações
- Evite avaliações genéricas demais
- Alguns podem ter erros leves de digitação ou gramática (para parecer mais real)
- Mencione aspectos como qualidade, entrega, embalagem, custo-benefício
- Varie o tamanho dos textos (alguns curtos, outros mais longos)`;

    const userPrompt = `Gere exatamente ${validQuantity} avaliações para o seguinte produto:

${productContext}

REGRA CRÍTICA DE NOMES: ${genderInstruction}
REGRA CRÍTICA DE NOTAS: ${ratingInstruction}

Retorne as avaliações no seguinte formato JSON (array de objetos):
[
  {
    "customer_name": "Nome do Cliente",
    "rating": 5,
    "title": "Título curto da avaliação",
    "content": "Texto completo da avaliação..."
  }
]

LEMBRETE FINAL: Certifique-se de que TODOS os nomes sigam a regra de gênero especificada. Varie muito o estilo de escrita entre as avaliações. Alguns títulos podem ser simples como "Recomendo!" ou "Ótimo produto".`;

    const response = await aiChatCompletion('google/gemini-2.5-flash', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_reviews',
            description: 'Generate product reviews',
            parameters: {
              type: 'object',
              properties: {
                reviews: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      customer_name: { type: 'string' },
                      rating: { type: 'number', minimum: 1, maximum: 5 },
                      title: { type: 'string' },
                      content: { type: 'string' },
                    },
                    required: ['customer_name', 'rating', 'title', 'content'],
                  },
                },
              },
              required: ['reviews'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'generate_reviews' } },
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: '[generate-reviews]',
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      throw new Error('Erro ao comunicar com a IA');
    }

    const data = await response.json();
    
    // Extract reviews from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('No tool call in response:', data);
      throw new Error('Formato de resposta inválido');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const reviews: GeneratedReview[] = parsed.reviews || [];

    // Validate reviews
    const validReviews = reviews.filter(r => 
      r.customer_name && 
      r.rating >= 1 && r.rating <= 5 && 
      r.title && 
      r.content
    ).slice(0, validQuantity);

    if (validReviews.length === 0) {
      throw new Error('Nenhuma avaliação válida gerada');
    }

    console.log(`Generated ${validReviews.length} reviews for product: ${product.name}`);

    return new Response(
      JSON.stringify({ success: true, reviews: validReviews }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generate-reviews error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
