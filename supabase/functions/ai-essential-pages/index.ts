import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ESSENTIAL_PAGES = [
  { slug: "quem-somos", title: "Quem Somos", key: "about" },
  { slug: "fale-conosco", title: "Fale Conosco", key: "contact" },
  { slug: "faq", title: "Perguntas Frequentes", key: "faq" },
  { slug: "como-comprar", title: "Como Comprar", key: "how_to_buy" },
  { slug: "frete-e-entrega", title: "Política de Frete e Entrega", key: "shipping" },
  { slug: "trocas-e-devolucoes", title: "Política de Troca e Devolução", key: "returns" },
  { slug: "politica-de-privacidade", title: "Política de Privacidade", key: "privacy" },
  { slug: "termos-de-uso", title: "Termos de Uso", key: "terms" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { tenantId } = await req.json();
    if (!tenantId) throw new Error("tenantId é obrigatório");

    // 1. Fetch tenant + store_settings data
    const [tenantRes, settingsRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).single(),
      supabase.from("store_settings").select("*").eq("tenant_id", tenantId).single(),
    ]);

    const tenant = tenantRes.data;
    const settings = settingsRes.data;

    if (!tenant) throw new Error("Tenant não encontrado");

    // 2. Check which pages already exist
    const { data: existingPages } = await supabase
      .from("store_pages")
      .select("slug")
      .eq("tenant_id", tenantId)
      .in("slug", ESSENTIAL_PAGES.map(p => p.slug));

    const existingSlugs = new Set((existingPages || []).map((p: any) => p.slug));
    const pagesToCreate = ESSENTIAL_PAGES.filter(p => !existingSlugs.has(p.slug));

    if (pagesToCreate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        created: 0, 
        skipped: ESSENTIAL_PAGES.length,
        message: "Todas as páginas essenciais já existem" 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Build context for AI
    const storeContext = {
      storeName: settings?.store_name || tenant.name || "[Nome da Loja]",
      storeDescription: settings?.seo_description || settings?.store_description || "",
      contactEmail: settings?.contact_email || "",
      contactPhone: settings?.contact_phone || "",
      whatsapp: settings?.social_whatsapp || "",
      supportHours: settings?.contact_support_hours || "",
      address: settings?.contact_address || "",
      cnpj: settings?.business_cnpj || "",
      legalName: settings?.business_legal_name || "",
      domain: tenant.slug || "",
      logoUrl: settings?.logo_url || tenant.logo_url || "",
      shippingConfig: settings?.shipping_config || null,
      checkoutConfig: settings?.checkout_config || null,
    };

    // 4. Generate content for each page via AI
    const pageKeys = pagesToCreate.map(p => p.key);
    const pageSpecs = pagesToCreate.map(p => `- ${p.key}: "${p.title}"`).join("\n");

    const systemPrompt = `Você é um redator especialista em e-commerce brasileiro. Gere conteúdo institucional para as páginas solicitadas de uma loja online.

REGRAS CRÍTICAS:
1. NUNCA invente dados jurídicos, comerciais ou operacionais. Use APENAS os dados fornecidos.
2. Se um dado estiver vazio ou ausente, use texto neutro como "[informar email]", "[informar endereço]", "[informar prazo]" para que o lojista saiba que precisa preencher.
3. Tom profissional, claro e objetivo. Parágrafos curtos.
4. Cada página deve ter conteúdo realista e pronto para uso, mas SEGURO juridicamente.
5. Retorne APENAS o JSON solicitado, sem markdown, sem explicações.

DADOS DA LOJA:
- Nome: ${storeContext.storeName}
- Descrição: ${storeContext.storeDescription || "[não informada]"}
- Email: ${storeContext.contactEmail || "[não informado]"}
- Telefone: ${storeContext.contactPhone || "[não informado]"}
- WhatsApp: ${storeContext.whatsapp || "[não informado]"}
- Horário de atendimento: ${storeContext.supportHours || "[não informado]"}
- Endereço: ${storeContext.address || "[não informado]"}
- CNPJ: ${storeContext.cnpj || "[não informado]"}
- Razão Social: ${storeContext.legalName || "[não informada]"}
- Domínio: ${storeContext.domain}`;

    const userPrompt = `Gere o conteúdo para estas páginas institucionais:
${pageSpecs}

Para cada página, retorne um objeto com:
- "key": a chave da página
- "html": conteúdo HTML completo da página (apenas o corpo, sem <html>/<body>). Use tags semânticas: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>. Formatação limpa e profissional.

Para a página "faq", gere as perguntas e respostas no formato HTML com <details>/<summary> ou simplesmente H3 + parágrafo.

Retorne um array JSON com os objetos. Exemplo:
[{"key":"about","html":"<h1>Quem Somos</h1><p>...</p>"}]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) throw new Error("Rate limit excedido. Tente novamente em alguns minutos.");
      if (status === 402) throw new Error("Créditos insuficientes. Adicione créditos ao workspace.");
      throw new Error(`Erro na IA: ${status}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown fences
    rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let generatedPages: Array<{ key: string; html: string }>;
    try {
      generatedPages = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      throw new Error("IA retornou formato inválido. Tente novamente.");
    }

    // 5. Create pages in store_pages
    const pagesToInsert = pagesToCreate.map(pageSpec => {
      const generated = generatedPages.find(g => g.key === pageSpec.key);
      const htmlContent = generated?.html || `<h1>${pageSpec.title}</h1><p>Conteúdo pendente de geração.</p>`;

      // Build block content with Header + RichText + Footer
      const pageContent = {
        id: `essential-${pageSpec.slug}-root`,
        type: "Page",
        props: {},
        children: [
          {
            id: `essential-${pageSpec.slug}-header`,
            type: "Header",
            props: { menuId: "", showSearch: true, showCart: true, sticky: true, noticeEnabled: false },
          },
          {
            id: `essential-${pageSpec.slug}-section`,
            type: "Section",
            props: { paddingY: 48, paddingX: 16 },
            children: [
              {
                id: `essential-${pageSpec.slug}-container`,
                type: "Container",
                props: { maxWidth: "md", centered: true },
                children: [
                  {
                    id: `essential-${pageSpec.slug}-content`,
                    type: "RichText",
                    props: { content: htmlContent },
                  },
                ],
              },
            ],
          },
          {
            id: `essential-${pageSpec.slug}-footer`,
            type: "Footer",
            props: { menuId: "", showSocial: true },
          },
        ],
      };

      return {
        tenant_id: tenantId,
        title: pageSpec.title,
        slug: pageSpec.slug,
        content: pageContent,
        status: "draft",
        is_published: false,
        type: "institutional",
        seo_title: pageSpec.title,
        seo_description: `${pageSpec.title} - ${storeContext.storeName}`,
      };
    });

    const { data: insertedPages, error: insertError } = await supabase
      .from("store_pages")
      .insert(pagesToInsert)
      .select("id, title, slug");

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Erro ao salvar páginas: ${insertError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      created: insertedPages?.length || 0,
      skipped: ESSENTIAL_PAGES.length - pagesToCreate.length,
      pages: insertedPages,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-essential-pages error:", e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: e instanceof Error ? e.message : "Erro desconhecido" 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
