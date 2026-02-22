import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletionJSON } from "../_shared/ai-router.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildSystemPrompt(totalProducts: number): string {
  return `Você é um especialista em e-commerce e estratégias de vendas.

Sua tarefa é definir produtos relacionados para cada produto de uma loja online.

## REGRA CRÍTICA
Para CADA produto fornecido, você DEVE sugerir de 3 a 6 produtos relacionados.
Existem ${totalProducts} produtos para processar. Gere EXATAMENTE ${totalProducts} itens no array.

## Lógica de Seleção de Produtos Relacionados

### Produto SIMPLES que faz parte de um kit:
- Sugerir os OUTROS componentes do mesmo kit (complementam o produto).
- Sugerir outros produtos simples da mesma categoria/tipo.

### Produto SIMPLES que NÃO faz parte de nenhum kit:
- Sugerir produtos da mesma faixa de preço ou categoria.
- Sugerir produtos complementares por tipo de uso.

### Produto KIT (composto):
- Sugerir outros kits similares ou maiores.
- Sugerir produtos avulsos que NÃO fazem parte deste kit.
- Sugerir versões maiores/menores do mesmo conceito.

## Regras:
1. NÃO sugira o próprio produto como relacionado.
2. Priorize produtos que fazem sentido comprar juntos ou como alternativa.
3. Use APENAS IDs válidos do catálogo fornecido.
4. Cada produto DEVE ter ao menos 3 produtos relacionados (máximo 6).`;
}

serve(async (req) => {
  console.log(`[ai-generate-related][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch active products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, compare_at_price, sku, product_type, product_format')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    if (prodError) throw prodError;
    if (!products?.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: 'Nenhum produto ativo encontrado' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ai-generate-related] ${products.length} produtos ativos`);

    // 2. Fetch kit compositions
    const productIds = products.map((p: any) => p.id);
    const { data: components } = await supabase
      .from('product_components')
      .select('parent_product_id, component_product_id, quantity')
      .in('parent_product_id', productIds);

    // 3. Fetch existing related products
    const { data: existingRelated } = await supabase
      .from('related_products')
      .select('product_id, related_product_id')
      .in('product_id', productIds);

    // Find products that already have related products
    const productsWithRelated = new Set((existingRelated || []).map(r => r.product_id));
    const productsToProcess = products.filter(p => !productsWithRelated.has(p.id));

    if (productsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, processed: 0, 
        message: 'Todos os produtos já possuem produtos relacionados' 
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ai-generate-related] ${productsToProcess.length} produtos sem relacionados (de ${products.length} total)`);

    // 4. Build context
    const productMap = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      sku: p.sku,
      is_kit: p.product_format === 'with_composition',
      product_type: p.product_type,
    }));

    const kitCompositions: Record<string, { kit_name: string; components: { id: string; name: string; qty: number }[] }> = {};
    for (const c of (components || [])) {
      const parent = products.find(p => p.id === c.parent_product_id);
      const component = products.find(p => p.id === c.component_product_id);
      if (!kitCompositions[c.parent_product_id]) {
        kitCompositions[c.parent_product_id] = { kit_name: parent?.name || '', components: [] };
      }
      kitCompositions[c.parent_product_id].components.push({
        id: c.component_product_id,
        name: component?.name || '',
        qty: c.quantity,
      });
    }

    // Process in chunks to avoid token limits
    const CHUNK_SIZE = 10;
    let totalInserted = 0;

    for (let i = 0; i < productsToProcess.length; i += CHUNK_SIZE) {
      const chunk = productsToProcess.slice(i, i + CHUNK_SIZE);
      const chunkIds = chunk.map(p => p.id);

      const userPrompt = `## Catálogo Completo de Produtos (usar IDs daqui)
${JSON.stringify(productMap, null, 2)}

## Composição dos Kits
${JSON.stringify(kitCompositions, null, 2)}

## Produtos para Gerar Relacionados (gere APENAS para estes ${chunk.length} produtos)
${JSON.stringify(chunkIds)}

Gere os produtos relacionados usando a ferramenta set_related_products.`;

      const toolDef = {
        type: "function" as const,
        function: {
          name: "set_related_products",
          description: "Define produtos relacionados para cada produto.",
          parameters: {
            type: "object",
            properties: {
              relations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_id: { type: "string", description: "ID do produto principal" },
                    related_product_ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "IDs dos produtos relacionados (3-6 produtos)"
                    },
                  },
                  required: ["product_id", "related_product_ids"],
                  additionalProperties: false,
                },
              },
            },
            required: ["relations"],
            additionalProperties: false,
          },
        },
      };

      const { data: aiData } = await aiChatCompletionJSON(
        "google/gemini-3-flash-preview",
        {
          messages: [
            { role: "system", content: buildSystemPrompt(chunk.length) },
            { role: "user", content: userPrompt },
          ],
          tools: [toolDef],
          tool_choice: { type: "function", function: { name: "set_related_products" } },
        },
        { supabaseUrl, supabaseServiceKey, logPrefix: '[ai-generate-related]' }
      );

      // Extract relations from tool call
      let relations: any[] = [];
      const toolCalls = aiData?.choices?.[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const args = JSON.parse(toolCalls[0].function.arguments);
        relations = args.relations || [];
      }

      // Validate and insert
      const validProductIds = new Set(productIds);
      const rows: { product_id: string; related_product_id: string; position: number }[] = [];

      for (const rel of relations) {
        if (!validProductIds.has(rel.product_id)) continue;
        const validRelated = (rel.related_product_ids || [])
          .filter((id: string) => validProductIds.has(id) && id !== rel.product_id);

        for (let idx = 0; idx < validRelated.length; idx++) {
          rows.push({
            product_id: rel.product_id,
            related_product_id: validRelated[idx],
            position: idx,
          });
        }
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('related_products')
          .upsert(rows, { onConflict: 'product_id,related_product_id' });

        if (insertError) {
          console.error(`[ai-generate-related] Insert error:`, insertError);
        } else {
          totalInserted += rows.length;
        }
      }

      console.log(`[ai-generate-related] Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${relations.length} produtos processados, ${rows.length} relações inseridas`);
    }

    console.log(`[ai-generate-related] Total: ${totalInserted} relações inseridas para ${productsToProcess.length} produtos`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: productsToProcess.length,
        relations_created: totalInserted,
        message: `${productsToProcess.length} produtos processados, ${totalInserted} relações criadas`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[ai-generate-related] Erro:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
