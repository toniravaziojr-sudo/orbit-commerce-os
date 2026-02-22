import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletionJSON } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Versão inicial - geração de ofertas com IA
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OFFER_TYPE_LABELS: Record<string, string> = {
  cross_sell: 'Cross-sell (exibido no carrinho)',
  order_bump: 'Order Bump (exibido no checkout, 1 clique)',
  upsell: 'Upsell (exibido na página de obrigado, pós-compra)',
  buy_together: 'Compre Junto (exibido na página do produto)',
};

function buildSystemPrompt(type: string, discountType: string, discountValue: number): string {
  const discountDesc = discountType === 'none'
    ? 'Sem desconto aplicado.'
    : discountType === 'percent'
      ? `Desconto de ${discountValue}% sobre o preço do produto sugerido.`
      : `Desconto fixo de R$ ${discountValue} sobre o preço do produto sugerido.`;

  return `Você é um especialista em e-commerce e estratégias de aumento de ticket médio.

Sua tarefa é gerar regras de ofertas do tipo "${OFFER_TYPE_LABELS[type] || type}" para uma loja online.

## Estratégia Principal: Lógica de Composição de Kits

A fonte principal de dados são os KITS (produtos compostos). Analise quais produtos individuais formam cada kit e use essa lógica:

### Para Cross-sell e Compre Junto:
- Se um produto individual faz parte de um kit, ao comprá-lo isoladamente, sugira os OUTROS componentes do kit para "completar o kit".
- Exemplo: Kit Banho = Shampoo + Balm + Loção. Se o cliente compra Shampoo, sugira Balm e Loção.
- Priorize produtos que compartilham o mesmo kit.

### Para Order Bump:
- Sugira produtos complementares de MENOR valor no checkout.
- Produtos acessórios, menores ou de uso rápido são ideais.
- Evite sugerir kits completos como bump (são caros demais para impulso).

### Para Upsell:
- Sugira upgrade para kit maior ou versão com mais unidades.
- Se o cliente comprou 1 unidade, sugira pack com 2x ou 3x.
- Se comprou um produto individual, sugira o kit completo que o contém.

## Desconto
${discountDesc}

## Regras Importantes:
1. NÃO crie regras duplicadas (verifique as regras existentes).
2. NÃO sugira o mesmo produto como gatilho e como sugestão.
3. Cada sugestão deve ter um nome descritivo, título para o cliente e descrição curta.
4. O "reasoning" deve explicar a lógica por trás da sugestão.
5. Gere entre 3 e 10 sugestões relevantes, sem exagerar.
6. Use nomes comerciais amigáveis nos títulos (não IDs ou SKUs).
7. Kits NÃO devem ser usados como produto gatilho para cross-sell/compre junto (quem compra kit já tem tudo).
8. Produtos individuais que fazem parte de kits são os melhores gatilhos.`;
}

serve(async (req) => {
  console.log(`[ai-generate-offers][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { type, discount_type, discount_value, custom_prompt, tenant_id } = await req.json();

    if (!type || !tenant_id) {
      return new Response(JSON.stringify({ success: false, error: 'type e tenant_id são obrigatórios' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar produtos ativos
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, compare_at_price, sku, product_type, status, product_format')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    if (prodError) throw prodError;
    console.log(`[ai-generate-offers] ${products?.length || 0} produtos ativos`);

    // 2. Buscar composição de kits
    const { data: components, error: compError } = await supabase
      .from('product_components')
      .select('parent_product_id, component_product_id, quantity')
      .eq('tenant_id', tenant_id);

    if (compError) throw compError;
    console.log(`[ai-generate-offers] ${components?.length || 0} componentes de kits`);

    // 3. Buscar regras existentes para evitar duplicatas
    let existingRules: any[] = [];
    if (type === 'buy_together') {
      const { data } = await supabase
        .from('buy_together_rules')
        .select('trigger_product_id, suggested_product_id')
        .eq('tenant_id', tenant_id);
      existingRules = data || [];
    } else {
      const { data } = await supabase
        .from('offer_rules')
        .select('trigger_product_ids, suggested_product_ids, type')
        .eq('tenant_id', tenant_id)
        .eq('type', type);
      existingRules = data || [];
    }
    console.log(`[ai-generate-offers] ${existingRules.length} regras existentes do tipo ${type}`);

    // 4. Montar contexto para a IA
    const productMap = (products || []).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      compare_at_price: p.compare_at_price,
      sku: p.sku,
      is_kit: p.product_format === 'with_composition',
      product_type: p.product_type,
    }));

    const kitCompositions = (components || []).map(c => {
      const parent = products?.find(p => p.id === c.parent_product_id);
      const component = products?.find(p => p.id === c.component_product_id);
      return {
        kit_id: c.parent_product_id,
        kit_name: parent?.name || 'Kit desconhecido',
        component_id: c.component_product_id,
        component_name: component?.name || 'Produto desconhecido',
        quantity: c.quantity,
      };
    });

    // Agrupar por kit
    const kitsGrouped: Record<string, { kit_name: string; components: { id: string; name: string; qty: number }[] }> = {};
    for (const kc of kitCompositions) {
      if (!kitsGrouped[kc.kit_id]) {
        kitsGrouped[kc.kit_id] = { kit_name: kc.kit_name, components: [] };
      }
      kitsGrouped[kc.kit_id].components.push({
        id: kc.component_id,
        name: kc.component_name,
        qty: kc.quantity,
      });
    }

    const userPrompt = `## Catálogo de Produtos
${JSON.stringify(productMap, null, 2)}

## Composição dos Kits
${JSON.stringify(kitsGrouped, null, 2)}

## Regras Existentes (evitar duplicatas)
${JSON.stringify(existingRules, null, 2)}

${custom_prompt ? `## Instruções Adicionais do Lojista\n${custom_prompt}` : ''}

Gere sugestões de ofertas do tipo "${type}" usando a ferramenta generate_offer_suggestions.`;

    const systemPrompt = buildSystemPrompt(type, discount_type || 'none', discount_value || 0);

    // 5. Chamar IA com tool calling
    const toolDef = {
      type: "function" as const,
      function: {
        name: "generate_offer_suggestions",
        description: "Retorna sugestões de ofertas baseadas na análise do catálogo e kits.",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nome interno da regra (ex: Cross-sell Shampoo → Balm + Loção)" },
                  trigger_product_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "IDs dos produtos gatilho (UUIDs do catálogo)"
                  },
                  suggested_product_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "IDs dos produtos sugeridos (UUIDs do catálogo)"
                  },
                  title: { type: "string", description: "Título exibido ao cliente (ex: Complete seu kit!)" },
                  description: { type: "string", description: "Descrição curta da oferta para o cliente" },
                  reasoning: { type: "string", description: "Explicação da lógica por trás desta sugestão" },
                },
                required: ["name", "trigger_product_ids", "suggested_product_ids", "title", "description", "reasoning"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    };

    const { data: aiData, provider, model } = await aiChatCompletionJSON(
      "google/gemini-3-flash-preview",
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: "generate_offer_suggestions" } },
      },
      { supabaseUrl, supabaseServiceKey, logPrefix: '[ai-generate-offers]' }
    );

    console.log(`[ai-generate-offers] IA respondeu via ${provider}/${model}`);

    // 6. Extrair sugestões do tool call
    let suggestions: any[] = [];
    const toolCalls = aiData?.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const args = JSON.parse(toolCalls[0].function.arguments);
      suggestions = args.suggestions || [];
    }

    // Enriquecer sugestões com nomes dos produtos
    const enriched = suggestions.map((s: any) => ({
      ...s,
      trigger_products: s.trigger_product_ids.map((id: string) => {
        const p = products?.find(pr => pr.id === id);
        return p ? { id: p.id, name: p.name, price: p.price } : { id, name: 'Desconhecido', price: 0 };
      }),
      suggested_products: s.suggested_product_ids.map((id: string) => {
        const p = products?.find(pr => pr.id === id);
        return p ? { id: p.id, name: p.name, price: p.price } : { id, name: 'Desconhecido', price: 0 };
      }),
    }));

    console.log(`[ai-generate-offers] ${enriched.length} sugestões geradas`);

    return new Response(
      JSON.stringify({ success: true, suggestions: enriched, provider, model }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[ai-generate-offers] Erro:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
