import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.1.0"; // Fix: use Lovable AI Gateway directly
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
      return `- ${p.name} (R$${(p.price / 100).toFixed(2)}${margin ? `, margem ~${margin}%` : ""}${p.stock_quantity != null ? `, estoque: ${p.stock_quantity}` : ""})`;
    }).join("\n");

    const topProduct = products[0]?.name || "Produto principal";
    const avgPrice = products.length > 0 
      ? (products.reduce((s: number, p: any) => s + p.price, 0) / products.length / 100).toFixed(2)
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

TEMPLATE DE REFERÊNCIA (adaptar, não copiar):
Use a estrutura de um prompt estratégico sênior com as seções:
1) Missão (vender com lucro)
2) Contexto do negócio (produto de entrada, público, objeções, tom)
3) Compliance (claims permitidos/proibidos baseados no nicho)
4) Fonte de verdade (usar dados do sistema)
5) Destinos/funil
6) Criativos (estilo baseado no nicho)
7) Formato de saída

Gere o prompt COMPLETO e PERSONALIZADO, sem placeholders.`;

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error(`[ads-autopilot-generate-prompt][${VERSION}] LOVABLE_API_KEY not configured`);
      return fail("Chave de IA não configurada");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_completion_tokens: 2000,
      }),
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
