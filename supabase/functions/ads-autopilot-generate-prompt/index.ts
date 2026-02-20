import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v1.2.0"; // Use centralized ai-router (Gemini/OpenAI native priority)
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-generate-prompt][${VERSION}] Request received`);

  try {
    const body = await req.json();
    const { tenant_id, channel = "global" } = body;

    if (!tenant_id) return fail("tenant_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Collect tenant context
    const [tenantRes, productsRes, categoriesRes, storeRes] = await Promise.all([
      supabase.from("tenants").select("name, slug, settings").eq("id", tenant_id).single(),
      supabase.from("products").select("name, price, cost_price, short_description, stock_quantity").eq("tenant_id", tenant_id).eq("status", "active").order("price", { ascending: false }).limit(10),
      supabase.from("categories").select("name").eq("tenant_id", tenant_id).limit(20),
      supabase.from("store_settings").select("store_name, store_description, seo_title, seo_description").eq("tenant_id", tenant_id).maybeSingle(),
    ]);

    const tenant = tenantRes.data;
    const products = productsRes.data || [];
    const categories = categoriesRes.data || [];
    const store = storeRes.data;

    const storeName = store?.store_name || tenant?.name || "Minha Loja";
    const storeDescription = store?.store_description || store?.seo_description || "";
    const categoryNames = categories.map((c: any) => c.name).join(", ");
    const productSummary = products.map((p: any) => {
      const margin = p.cost_price ? Math.round(((p.price - p.cost_price) / p.price) * 100) : null;
      return `- ${p.name} (R$${Number(p.price).toFixed(2)}${margin ? `, margem ~${margin}%` : ""}${p.stock_quantity != null ? `, estoque: ${p.stock_quantity}` : ""})`;
    }).join("\n");

    const topProduct = products[0]?.name || "Produto principal";
    const avgPrice = products.length > 0 
      ? (products.reduce((s: number, p: any) => s + p.price, 0) / products.length).toFixed(2)
      : "0";

    const channelLabel = channel === "meta" ? "Meta (Facebook/Instagram)" 
      : channel === "google" ? "Google (Search/PMax/YouTube)" 
      : channel === "tiktok" ? "TikTok Ads" 
      : "Multicanal (Meta/Google/TikTok)";

    // Build the AI generation prompt
    const systemPrompt = `Você é um especialista sênior em tráfego pago para e-commerce brasileiro.
Sua tarefa é gerar um PROMPT ESTRATÉGICO personalizado para o Autopiloto de IA gerenciar campanhas de anúncios.

REGRAS:
- Escreva em português brasileiro
- Seja específico para o negócio (use os dados reais fornecidos)
- Substitua TODOS os placeholders [ENTRE COLCHETES] por informações reais
- Mantenha a estrutura do template de referência
- Adapte os claims permitidos e tom com base nos produtos/nicho
- Inclua hooks realistas baseados nos produtos
- Defina público-alvo baseado nos produtos e categorias
- Mínimo 800 caracteres, máximo 3000 caracteres
- NÃO inclua marcadores de seção numerados longos — seja conciso e direto
- Foco: informações que a IA precisa para tomar DECISÕES de tráfego`;

    const userPrompt = `Gere um prompt estratégico personalizado para a loja "${storeName}" no canal ${channelLabel}.

DADOS DA LOJA:
- Nome: ${storeName}
- Descrição: ${storeDescription || "Não informada"}
- Categorias: ${categoryNames || "Não informadas"}
- Ticket médio: R$${avgPrice}
- Produtos principais:
${productSummary || "Nenhum produto cadastrado"}

TEMPLATE DE REFERÊNCIA (adaptar a estrutura e tom ao negócio real, NÃO copiar literalmente):

1) Objetivo principal (ordem de prioridade)
Vendas diretas (Purchase) com eficiência e escala segura.
Aquisição de novos clientes (prioridade no público frio).
Aumentar LTV via remarketing e ofertas de kits/combos.
Testar hipóteses (criativos/ângulos/produtos) sem desperdiçar verba.

2) Contexto do negócio (como a IA deve "pensar")
Definir: nicho, público principal (idade, gênero, localização, dores), objeções típicas (medo de golpe, não funcionar, como comprar/usar), tom de comunicação (direto, explicativo, confiável, sem hype/milagre).

3) Regras de compliance (não negociar)
Definir claims permitidos e proibidos com base no nicho. Evitar linguagem médica/terapêutica. Pode falar em: rotina, fortalecimento, resultados com consistência, depoimentos reais.

4) Fonte de verdade e tracking
Priorizar dados do próprio canal (compras, custo por compra, CTR, CPM, frequência, CPC, ATC, checkout). Se tracking estiver degradado, focar em testes controlados e estrutura limpa sem escalar agressivo.

5) Produtos: prioridade real do lojista
Definir Prioridade A (público frio/aquisição), Prioridade B (teste controlado), Prioridade C (complementares/remarketing/upsell). Regra: TOF = Prioridade A, Testes = B com orçamento pequeno, Remarketing = kits/bundles como upsell/cross-sell.

6) Estrutura de funil (3 frentes simultâneas)
TOF (aquisição): Purchase/Conversions, produto de entrada, broad/interesses/lookalike.
BOF (remarketing): Públicos quentes reais (visitantes, engajamento, ATC/IC/Checkout), DPA quando disponível.
TEST (15% do esforço): 1 variável por vez (ângulo, criativo, produto ou público).

7) Copy: padrão mínimo de qualidade
Para cada anúncio: 1 Primary Text (3–6 linhas), 1 Headline, 1 Description curta, 1 CTA coerente. Evitar copy genérica. Linguagem simples. Sempre atacar 1–2 objeções + 1 benefício claro.

8) Criativos: o que funciona
Produto em contexto, prova social, ganchos realistas. Mostrar embalagem e rotina. Preferir criativos que "parecem reais", não peça publicitária genérica.

9) Orçamento
Respeitar orçamento diário configurado. Preencher com bom senso (TOF/BOF/TEST). Se tracking ruim, evitar escalar agressivo mas não deixar verba ociosa.

10) Aprovação do usuário
Preview completo: criativo visível, copy, produto, orçamento/dia, público (resumo claro), objetivo e posição no funil. Linguagem humana e curta.

11) Regras de decisão
Não criar remarketing broad se existirem públicos quentes. Não ignorar prioridades de produto. Não criar campanha sem copy decente. Não criar propostas redundantes.

12) Formato de insights
Português simples. Resumo: até 4 frases. Recomendações: até 3 itens, 1 frase cada. Valores em R$. Sem jargões e sem IDs técnicos.

Gere o prompt COMPLETO e PERSONALIZADO para "${storeName}", substituindo todas as seções genéricas por dados reais do catálogo e contexto da loja. Sem placeholders.`;

    // Call AI via centralized router (Gemini/OpenAI native → Lovable fallback)
    resetAIRouterCache();

    const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }, {
      supabaseUrl,
      supabaseServiceKey: supabaseKey,
      logPrefix: `[ads-autopilot-generate-prompt][${VERSION}]`,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[ads-autopilot-generate-prompt][${VERSION}] AI gateway error ${aiResponse.status}:`, errText.substring(0, 500));
      if (aiResponse.status === 429) return fail("Limite de requisições excedido. Aguarde alguns segundos.");
      if (aiResponse.status === 402) return fail("Créditos de IA esgotados.");
      return fail("Erro ao chamar IA");
    }

    const aiResult = await aiResponse.json();
    const generatedPrompt = aiResult.choices?.[0]?.message?.content || "";

    if (!generatedPrompt) {
      return fail("IA não retornou conteúdo");
    }

    console.log(`[ads-autopilot-generate-prompt][${VERSION}] Generated prompt (${generatedPrompt.length} chars) for ${storeName}/${channel}`);

    return ok({
      prompt: generatedPrompt,
      store_name: storeName,
      channel,
      products_count: products.length,
      categories_count: categories.length,
    });
  } catch (err: any) {
    console.error(`[ads-autopilot-generate-prompt][${VERSION}] Error:`, err);
    return fail(err.message || "Erro interno");
  }
});
