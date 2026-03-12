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

// Pages that use FAQ block instead of RichText
const FAQ_PAGE_KEY = "faq";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { tenantId, businessContext } = await req.json();
    if (!tenantId) throw new Error("tenantId é obrigatório");

    // 1. Fetch tenant + store_settings
    const [tenantRes, settingsRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).single(),
      supabase.from("store_settings").select("*").eq("tenant_id", tenantId).single(),
    ]);

    const tenant = tenantRes.data;
    const settings = settingsRes.data;
    if (!tenant) throw new Error("Tenant não encontrado");

    // 2. Check existing pages
    const { data: existingPages } = await supabase
      .from("store_pages")
      .select("slug")
      .eq("tenant_id", tenantId)
      .in("slug", ESSENTIAL_PAGES.map(p => p.slug));

    const existingSlugs = new Set((existingPages || []).map((p: any) => p.slug));
    const pagesToCreate = ESSENTIAL_PAGES.filter(p => !existingSlugs.has(p.slug));

    if (pagesToCreate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, created: 0, skipped: ESSENTIAL_PAGES.length,
        message: "Todas as páginas essenciais já existem" 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Build store context
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
    };

    const pageKeys = pagesToCreate.map(p => p.key);
    const pageSpecs = pagesToCreate.map(p => `- ${p.key}: "${p.title}"`).join("\n");

    // Separate FAQ from other pages
    const hasFaq = pageKeys.includes(FAQ_PAGE_KEY);
    const nonFaqPages = pagesToCreate.filter(p => p.key !== FAQ_PAGE_KEY);

    // 4. System prompt with legal knowledge
    const systemPrompt = `Você é um redator jurídico-comercial especializado em e-commerce brasileiro. 
Gere conteúdo institucional profissional e bem formatado para lojas online.

REGRAS CRÍTICAS:
1. NUNCA invente dados jurídicos, comerciais ou operacionais. Use APENAS os dados fornecidos.
2. Se um dado estiver vazio ou ausente, use placeholder claro como "[informar email de contato]", "[informar endereço]", "[informar prazo]".
3. Tom profissional, claro e direto. Parágrafos curtos e bem espaçados.
4. Retorne APENAS o JSON solicitado, sem markdown, sem explicações extras.

FORMATAÇÃO HTML OBRIGATÓRIA:
- Use <h1> para o título principal (apenas 1 por página)
- Use <h2> para subtítulos de seção
- Use <h3> para sub-subtítulos quando necessário
- Use <strong> para destacar termos, prazos, valores e informações importantes
- Use <ul>/<li> para listas de itens, direitos, obrigações e condições
- Use <p> para parágrafos — NUNCA use texto corrido sem tags de parágrafo
- Separe seções visualmente com espaçamento adequado
- Use <hr> entre grandes seções quando fizer sentido
- Use <em> para observações e notas secundárias
- Estruture em formato editorial: título → intro → seções com subtítulos → fechamento

CONHECIMENTO JURÍDICO-COMERCIAL BRASILEIRO (use como base):
- CDC (Código de Defesa do Consumidor): direito de arrependimento em 7 dias para compras online (Art. 49)
- LGPD (Lei Geral de Proteção de Dados): obrigações sobre coleta, uso e proteção de dados pessoais
- Marco Civil da Internet: responsabilidades sobre dados e conteúdo online
- Decreto 7.962/2013: regras para comércio eletrônico (informações claras, atendimento facilitado, direito de arrependimento)
- Prazo legal de troca por defeito: 30 dias (não-duráveis) e 90 dias (duráveis)
- Nota Fiscal obrigatória para vendas ao consumidor
- Obrigação de informar CNPJ, endereço e canais de contato no site

Quando dados da loja estiverem ausentes, use linguagem neutra e segura juridicamente.
Por exemplo: "A [Nome da Loja] se compromete a..." em vez de afirmar algo específico.

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
- Domínio: ${storeContext.domain}

${businessContext ? `CONTEXTO ADICIONAL DO NEGÓCIO (fornecido pelo lojista):
${businessContext}

Use estas informações para personalizar especialmente as páginas "Quem Somos" e "FAQ".` : ""}`;

    // 5. Generate non-FAQ pages
    let generatedPages: Array<{ key: string; html: string }> = [];

    if (nonFaqPages.length > 0) {
      const nonFaqSpecs = nonFaqPages.map(p => `- ${p.key}: "${p.title}"`).join("\n");

      const userPrompt = `Gere o conteúdo para estas páginas institucionais:
${nonFaqSpecs}

Para cada página, retorne um objeto com:
- "key": a chave da página
- "html": conteúdo HTML bem formatado (apenas o corpo). 

EXEMPLOS DE BOA FORMATAÇÃO:

Para "Política de Privacidade":
<h1>Política de Privacidade</h1>
<p>A <strong>[Nome da Loja]</strong>, inscrita sob o CNPJ <strong>[CNPJ]</strong>...</p>
<h2>1. Coleta de Dados</h2>
<p>Coletamos as seguintes informações...</p>
<ul><li><strong>Dados de cadastro:</strong> nome, e-mail, telefone...</li></ul>
<h2>2. Uso dos Dados</h2>
...

Para "Quem Somos":
<h1>Quem Somos</h1>
<p>Bem-vindo à <strong>[Nome]</strong>...</p>
<h2>Nossa História</h2>
<p>...</p>
<h2>Nosso Compromisso</h2>
...

Retorne um array JSON: [{"key":"about","html":"<h1>..."}]`;

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
      rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      try {
        generatedPages = JSON.parse(rawContent);
      } catch {
        console.error("Failed to parse AI response:", rawContent.substring(0, 500));
        throw new Error("IA retornou formato inválido. Tente novamente.");
      }
    }

    // 6. Generate FAQ separately using tool calling for structured output
    let faqItems: Array<{ question: string; answer: string }> = [];

    if (hasFaq) {
      const faqPrompt = `Gere perguntas frequentes para a loja "${storeContext.storeName}".

${businessContext ? `O lojista informou este contexto sobre o negócio e perguntas frequentes:
${businessContext}

Use as perguntas informadas pelo lojista como BASE PRINCIPAL. Complemente com perguntas comuns de e-commerce se necessário.` : `Gere perguntas frequentes genéricas mas relevantes para e-commerce brasileiro, cobrindo:
- Pedidos e prazos
- Frete e entrega
- Formas de pagamento
- Trocas e devoluções
- Segurança e dados`}

Gere entre 8 e 12 perguntas com respostas claras e profissionais.
Use os dados da loja quando disponíveis. Se faltar dado, use linguagem neutra.`;

      const faqResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: faqPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_faq",
                description: "Create FAQ items with questions and answers",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string", description: "The FAQ question" },
                          answer: { type: "string", description: "The FAQ answer, clear and professional" },
                        },
                        required: ["question", "answer"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["items"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_faq" } },
          temperature: 0.7,
        }),
      });

      if (faqResponse.ok) {
        const faqData = await faqResponse.json();
        const toolCall = faqData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            faqItems = parsed.items || [];
          } catch {
            console.error("Failed to parse FAQ tool call");
          }
        }
      }

      // Fallback if no items
      if (faqItems.length === 0) {
        faqItems = [
          { question: "Qual o prazo de entrega?", answer: "O prazo de entrega varia conforme a sua região e a modalidade de frete escolhida. Você pode consultar o prazo estimado na página do produto ou no carrinho de compras." },
          { question: "Quais formas de pagamento são aceitas?", answer: "Aceitamos as principais formas de pagamento: cartão de crédito, boleto bancário e PIX." },
          { question: "Posso trocar ou devolver um produto?", answer: "Sim. Você tem até 7 dias após o recebimento para solicitar a troca ou devolução, conforme o Código de Defesa do Consumidor." },
          { question: "Como acompanho meu pedido?", answer: "Após a confirmação do pagamento e envio, você receberá um e-mail com o código de rastreamento para acompanhar a entrega." },
          { question: "É seguro comprar neste site?", answer: "Sim. Utilizamos tecnologia de criptografia SSL para proteger seus dados durante toda a navegação e pagamento." },
        ];
      }
    }

    // 7. Build and insert pages
    const pagesToInsert = pagesToCreate.map(pageSpec => {
      // FAQ page uses the FAQ block
      if (pageSpec.key === FAQ_PAGE_KEY) {
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
                      id: `essential-${pageSpec.slug}-faq`,
                      type: "FAQ",
                      props: {
                        title: "Perguntas Frequentes",
                        items: faqItems,
                      },
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
      }

      // All other pages use RichText
      const generated = generatedPages.find(g => g.key === pageSpec.key);
      const htmlContent = generated?.html || `<h1>${pageSpec.title}</h1><p>Conteúdo pendente de geração.</p>`;

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
