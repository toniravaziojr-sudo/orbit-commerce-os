import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT_SHORT = `Você é um copywriter profissional especializado em e-commerce brasileiro.
Crie uma DESCRIÇÃO CURTA para o produto a partir da descrição completa fornecida.

REGRAS ABSOLUTAS:
- Máximo 2-3 frases (até 300 caracteres)
- Capture a essência e principal benefício do produto
- Linguagem persuasiva e direta
- NÃO use markdown, apenas texto simples
- NÃO repita o nome do produto no início
- NÃO inclua saudações, introduções ou explicações sobre o que você fez
- Retorne APENAS o texto da descrição curta, nada mais
- Escreva em português brasileiro`;

const SYSTEM_PROMPT_KIT = `Você é um copywriter profissional especializado em e-commerce brasileiro.

Você receberá as descrições de cada produto que compõe este kit/combo.
Sua tarefa: criar UMA descrição unificada do kit que:

1. Mantenha TODAS as informações importantes de cada produto componente
2. Destaque o DIFERENCIAL e a VANTAGEM de comprar o kit completo (economia, praticidade, resultado potencializado)
3. NÃO repita informações redundantes entre os produtos
4. Organize de forma lógica: primeiro o kit como um todo, depois cada produto

REGRAS ABSOLUTAS — SIGA RIGOROSAMENTE:
1. Retorne APENAS o HTML da descrição. NADA MAIS.
2. NÃO inclua saudações, introduções, explicações ou qualquer texto fora do HTML.
3. A primeira linha da sua resposta DEVE ser uma tag HTML (ex: <h2>).
4. A última linha DEVE ser uma tag HTML de fechamento.

CONTEÚDO OBRIGATÓRIO — NUNCA OMITA:
- Registros ANVISA de cada produto componente (ex: "ANVISA: 25351.316634/2024-16") — SEMPRE inclua na seção de cada produto ou em seção dedicada
- COMPOSIÇÃO completa de cada produto (ingredientes, ativos especiais, ativos exclusivos)
- MODO DE USO de cada produto
- BENEFÍCIOS detalhados de cada produto
- Informações nutricionais quando houver (ex: suplementos)
- Links de referência quando presentes nas descrições originais
- Observações importantes (como consulta de grau de calvície)

ESTRUTURA HTML OBRIGATÓRIA — EXEMPLO:

<h2>NOME DO KIT</h2>
<p><em>Frase de impacto sobre o kit completo</em></p>
<p>Parágrafo apresentando o kit e por que comprar junto é melhor.</p>
<br>
<h2>O QUE VEM NO KIT:</h2>
<ul>
<li><strong>Produto 1:</strong> Breve descrição</li>
<li><strong>Produto 2:</strong> Breve descrição</li>
</ul>
<br>
<h2>BENEFÍCIOS DO KIT:</h2>
<ul>
<li><strong>Benefício:</strong> Explicação de por que juntos são melhores.</li>
</ul>
<br>
<h2>PRODUTO X — DETALHES:</h2>
<p>Informações específicas deste produto incluindo composição, modo de uso, etc.</p>
<br>
<h2>COMPOSIÇÃO DO PRODUTO X:</h2>
<p>Lista completa de ingredientes/ativos.</p>
<br>
<h2>REGISTROS ANVISA:</h2>
<ul>
<li><strong>Produto 1:</strong> Número do registro</li>
<li><strong>Produto 2:</strong> Número do registro</li>
</ul>
<br>
<h2>ESPECIFICAÇÕES:</h2>
<ul>
<li><strong>Item:</strong> Valor</li>
</ul>

REGRAS DE FORMATAÇÃO CRÍTICAS:
- Títulos de seção SEMPRE em <h2> com texto em MAIÚSCULO seguido de dois pontos (ex: <h2>BENEFÍCIOS DO KIT:</h2>)
- NUNCA use <h3> — use SEMPRE <h2> para títulos de seção
- Use <br> (tag de quebra de linha) ENTRE CADA seção para dar espaçamento visual
- Cada parágrafo em sua PRÓPRIA tag <p> — NUNCA junte múltiplos parágrafos em um único <p>
- Quando há lista de itens, SEMPRE use <ul> com <li> — NUNCA coloque como parágrafos <p> separados
- <strong> para labels/nomes de funcionalidades
- <em> para taglines/frases de destaque
- NUNCA use markdown
- A descrição deve ser COMPLETA e DETALHADA — NÃO resuma ou omita informações dos componentes
- Escreva em português brasileiro`;

function cleanGeneratedHtml(text: string): string {
  const firstTagIndex = text.indexOf('<');
  if (firstTagIndex > 0) {
    text = text.substring(firstTagIndex);
  }
  text = text.replace(/```html\s*/gi, "").replace(/```\s*/gi, "").trim();
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse body
    let offset = 0;
    let limit = 10;
    let mode = "full"; // "full" | "short" | "both"
    try {
      const body = await req.json();
      offset = body.offset ?? 0;
      limit = body.limit ?? 10;
      mode = body.mode ?? "full";
    } catch { /* defaults */ }

    // Get all kit products
    const { data: allKits, error: kitsError } = await supabase
      .from("products")
      .select("id, name, sku, description")
      .eq("product_format", "with_composition")
      .is("deleted_at", null)
      .order("sku");

    if (kitsError) throw kitsError;

    const kits = allKits.slice(offset, offset + limit);
    console.log(`[batch-${mode}] Processing kits ${offset} to ${offset + limit} (${kits.length} of ${allKits.length} total)`);

    const results: any[] = [];

    for (const kit of kits) {
      try {
        console.log(`[batch-${mode}] Processing: ${kit.sku} - ${kit.name}`);

        if (mode === "short") {
          // Generate short description from existing full description
          if (!kit.description || kit.description.length < 50) {
            results.push({ sku: kit.sku, name: kit.name, status: "skipped", reason: "no full description" });
            continue;
          }

          const aiRawResponse = await aiChatCompletion(
            "google/gemini-2.5-flash",
            {
              messages: [
                { role: "system", content: SYSTEM_PROMPT_SHORT },
                { role: "user", content: `Produto: ${kit.name}\n\nDescrição completa:\n${kit.description}` },
              ],
              temperature: 0.7,
              max_tokens: 500,
            },
            {
              supabaseUrl,
              supabaseServiceKey: supabaseKey,
              logPrefix: `[batch-short][${kit.sku}]`,
            }
          );

          const aiResponse = await aiRawResponse.json();
          let shortDesc = aiResponse?.choices?.[0]?.message?.content?.trim() || "";

          if (!shortDesc || shortDesc.length < 10) {
            results.push({ sku: kit.sku, name: kit.name, status: "error", reason: "Empty short description" });
            continue;
          }

          const { error: updateError } = await supabase
            .from("products")
            .update({ short_description: shortDesc })
            .eq("id", kit.id);

          if (updateError) {
            results.push({ sku: kit.sku, name: kit.name, status: "error", reason: updateError.message });
          } else {
            results.push({ sku: kit.sku, name: kit.name, status: "success" });
            console.log(`[batch-short] ✅ ${kit.sku} - ${kit.name} updated`);
          }

        } else {
          // mode === "full" — generate full description from components
          const { data: components, error: compError } = await supabase
            .from("product_components")
            .select(`quantity, component:products!component_product_id(name, description)`)
            .eq("parent_product_id", kit.id)
            .order("sort_order");

          if (compError) throw compError;

          const componentData = (components || [])
            .filter((c: any) => c.component?.description)
            .map((c: any) => ({
              name: c.component.name,
              quantity: c.quantity,
              description: c.component.description,
            }));

          if (componentData.length === 0) {
            results.push({ sku: kit.sku, name: kit.name, status: "skipped", reason: "no components with descriptions" });
            continue;
          }

          const componentsText = componentData.map((c: any) =>
            `### ${c.name} (${c.quantity}x no kit)\n${c.description}`
          ).join("\n\n---\n\n");

          const userPrompt = `Nome do Kit: ${kit.name}\n\nDescrições dos produtos componentes:\n\n${componentsText}\n\nGere a descrição HTML unificada do kit.`;

          const aiRawResponse = await aiChatCompletion(
            "google/gemini-2.5-flash",
            {
              messages: [
                { role: "system", content: SYSTEM_PROMPT_KIT },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: 8192,
            },
            {
              supabaseUrl,
              supabaseServiceKey: supabaseKey,
              logPrefix: `[batch][${kit.sku}]`,
            }
          );

          const aiResponse = await aiRawResponse.json();
          let generatedHtml = aiResponse?.choices?.[0]?.message?.content || "";
          generatedHtml = cleanGeneratedHtml(generatedHtml);

          if (!generatedHtml || generatedHtml.length < 50) {
            results.push({ sku: kit.sku, name: kit.name, status: "error", reason: "Empty AI response" });
            continue;
          }

          const { error: updateError } = await supabase
            .from("products")
            .update({ description: generatedHtml })
            .eq("id", kit.id);

          if (updateError) {
            results.push({ sku: kit.sku, name: kit.name, status: "error", reason: updateError.message });
          } else {
            results.push({ sku: kit.sku, name: kit.name, status: "success" });
            console.log(`[batch] ✅ ${kit.sku} - ${kit.name} updated`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err: any) {
        results.push({ sku: kit.sku, name: kit.name, status: "error", reason: err.message });
        console.error(`[batch] ❌ ${kit.sku}: ${err.message}`);
      }
    }

    const summary = {
      mode,
      total: kits.length,
      success: results.filter(r => r.status === "success").length,
      errors: results.filter(r => r.status === "error").length,
      skipped: results.filter(r => r.status === "skipped").length,
      details: results,
    };

    console.log(`[batch-${mode}] Done: ${summary.success} success, ${summary.errors} errors, ${summary.skipped} skipped`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[batch] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
