import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ESSENTIAL_PAGES = [
  { slug: "quem-somos", title: "Quem Somos", key: "about", mode: "institutional" },
  { slug: "fale-conosco", title: "Fale Conosco", key: "contact", mode: "institutional" },
  { slug: "faq", title: "Perguntas Frequentes", key: "faq", mode: "faq" },
  { slug: "como-comprar", title: "Como Comprar", key: "how_to_buy", mode: "institutional" },
  { slug: "frete-e-entrega", title: "Política de Frete e Entrega", key: "shipping", mode: "legal" },
  { slug: "trocas-e-devolucoes", title: "Política de Troca e Devolução", key: "returns", mode: "legal" },
  { slug: "politica-de-privacidade", title: "Política de Privacidade", key: "privacy", mode: "legal" },
  { slug: "termos-de-uso", title: "Termos de Uso", key: "terms", mode: "legal" },
] as const;

// =============================================
// HELPERS
// =============================================

function toPlainText(value: unknown): string {
  const raw = typeof value === 'string' ? value : `${value ?? ''}`;

  return raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

interface StoreContext {
  storeName: string;
  storeDescription: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  supportHours: string;
  address: string;
  cnpj: string;
  legalName: string;
  domain: string;
}

function buildCompanyInfoBlock(ctx: StoreContext): string {
  const lines: string[] = [];
  lines.push(`<strong>Nome Fantasia:</strong> ${ctx.storeName}`);
  if (ctx.legalName) lines.push(`<strong>Razão Social:</strong> ${ctx.legalName}`);
  else lines.push(`<strong>Razão Social:</strong> [informar razão social]`);
  if (ctx.cnpj) lines.push(`<strong>CNPJ:</strong> ${ctx.cnpj}`);
  else lines.push(`<strong>CNPJ:</strong> [informar CNPJ]`);
  if (ctx.address) lines.push(`<strong>Endereço:</strong> ${ctx.address}`);
  else lines.push(`<strong>Endereço:</strong> [informar endereço]`);
  if (ctx.contactEmail) lines.push(`<strong>E-mail:</strong> ${ctx.contactEmail}`);
  else lines.push(`<strong>E-mail:</strong> [informar e-mail de contato]`);
  if (ctx.contactPhone) lines.push(`<strong>Telefone:</strong> ${ctx.contactPhone}`);
  if (ctx.whatsapp) lines.push(`<strong>WhatsApp:</strong> ${ctx.whatsapp}`);
  return lines.map(l => `<li>${l}</li>`).join('\n');
}

function buildContactBlock(ctx: StoreContext): string {
  const parts: string[] = [];
  if (ctx.contactEmail) parts.push(`<li><strong>E-mail:</strong> <a href="mailto:${ctx.contactEmail}">${ctx.contactEmail}</a></li>`);
  else parts.push(`<li><strong>E-mail:</strong> [informar e-mail]</li>`);
  if (ctx.whatsapp) parts.push(`<li><strong>WhatsApp:</strong> ${ctx.whatsapp}</li>`);
  if (ctx.contactPhone) parts.push(`<li><strong>Telefone:</strong> ${ctx.contactPhone}</li>`);
  if (ctx.supportHours) parts.push(`<li><strong>Horário de atendimento:</strong> ${ctx.supportHours}</li>`);
  return `<ul>${parts.join('\n')}</ul>`;
}

// =============================================
// LEGAL PAGE STRUCTURED GENERATION
// =============================================

interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface LegalPageStructure {
  key: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  highlight_notes?: string[];
}

function renderLegalPageToHtml(page: LegalPageStructure, ctx: StoreContext): string {
  const parts: string[] = [];

  // Title
  parts.push(`<h1 style="font-size:1.75rem;font-weight:700;margin-bottom:0.5rem;text-align:center;">${page.title}</h1>`);
  
  // Intro
  parts.push(`<p style="text-align:center;color:#666;margin-bottom:2rem;font-size:0.95rem;">${page.intro}</p>`);

  // Company info block at top for legal pages
  parts.push(`<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;margin-bottom:2rem;">`);
  parts.push(`<h2 style="font-size:1.1rem;font-weight:600;margin-bottom:0.75rem;">Identificação da Empresa</h2>`);
  parts.push(`<ul style="list-style:none;padding:0;margin:0;line-height:1.8;">${buildCompanyInfoBlock(ctx)}</ul>`);
  parts.push(`</div>`);

  // Sections
  for (const section of page.sections) {
    parts.push(`<h2 style="font-size:1.25rem;font-weight:600;margin-top:2rem;margin-bottom:0.75rem;padding-bottom:0.5rem;border-bottom:1px solid #e5e7eb;">${section.heading}</h2>`);
    
    for (const p of section.paragraphs) {
      parts.push(`<p style="margin-bottom:0.75rem;line-height:1.7;">${p}</p>`);
    }
    
    if (section.bullets && section.bullets.length > 0) {
      parts.push(`<ul style="margin:0.5rem 0 1rem 1.25rem;line-height:1.8;">`);
      for (const b of section.bullets) {
        parts.push(`<li style="margin-bottom:0.25rem;">${b}</li>`);
      }
      parts.push(`</ul>`);
    }
  }

  // Highlight notes
  if (page.highlight_notes && page.highlight_notes.length > 0) {
    for (const note of page.highlight_notes) {
      parts.push(`<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:1rem;margin:1.5rem 0;border-radius:4px;"><strong>⚠️ Importante:</strong> ${note}</div>`);
    }
  }

  // Contact footer
  parts.push(`<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:1.25rem;margin-top:2rem;">`);
  parts.push(`<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">Dúvidas ou solicitações?</h3>`);
  parts.push(`<p style="margin-bottom:0.5rem;">Entre em contato conosco:</p>`);
  parts.push(buildContactBlock(ctx));
  parts.push(`</div>`);

  // Last updated
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
  parts.push(`<p style="text-align:center;color:#999;font-size:0.8rem;margin-top:2rem;"><em>Última atualização: ${dateStr}</em></p>`);

  return parts.join('\n');
}

// =============================================
// MAIN
// =============================================

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
    const storeCtx: StoreContext = {
      storeName: settings?.store_name || tenant.name || "[Nome da Loja]",
      storeDescription: settings?.seo_description || settings?.store_description || "",
      contactEmail: settings?.contact_email || "",
      contactPhone: settings?.contact_phone || "",
      whatsapp: settings?.social_whatsapp || "",
      supportHours: settings?.contact_support_hours || "",
      address: settings?.contact_address || "",
      cnpj: settings?.business_cnpj || "",
      legalName: settings?.business_legal_name || "",
      domain: tenant.custom_domain || tenant.slug || "",
    };

    const legalPages = pagesToCreate.filter(p => p.mode === "legal");
    const institutionalPages = pagesToCreate.filter(p => p.mode === "institutional");
    const hasFaq = pagesToCreate.some(p => p.mode === "faq");

    // Common store data string for prompts
    const storeDataBlock = `DADOS DA LOJA (use EXATAMENTE quando disponíveis, NÃO invente):
- Nome Fantasia: ${storeCtx.storeName}
- Razão Social: ${storeCtx.legalName || "[não informada]"}
- CNPJ: ${storeCtx.cnpj || "[não informado]"}
- Endereço: ${storeCtx.address || "[não informado]"}
- E-mail: ${storeCtx.contactEmail || "[não informado]"}
- Telefone: ${storeCtx.contactPhone || "[não informado]"}
- WhatsApp: ${storeCtx.whatsapp || "[não informado]"}
- Horário de atendimento: ${storeCtx.supportHours || "[não informado]"}
- Domínio: ${storeCtx.domain}
- Descrição: ${storeCtx.storeDescription || "[não informada]"}`;

    // =============================================
    // A. LEGAL PAGES — Structured JSON generation
    // =============================================
    let legalResults: LegalPageStructure[] = [];

    if (legalPages.length > 0) {
      const legalSpecs = legalPages.map(p => `- ${p.key}: "${p.title}"`).join("\n");

      const legalSystemPrompt = `Você é um redator jurídico especializado em e-commerce brasileiro.
Gere conteúdo para páginas legais/políticas de lojas online.

REGRAS:
1. NUNCA invente dados jurídicos, comerciais ou operacionais.
2. Se um dado estiver vazio ou "[não informado]", use placeholder: "[informar ...]".
3. Tom profissional, claro e direto.
4. Retorne APENAS o JSON solicitado via tool calling.
5. Texto puro nos campos — sem HTML, sem markdown. Apenas texto limpo.
6. Use <strong> APENAS para destacar termos críticos dentro dos textos de parágrafo.

CONHECIMENTO JURÍDICO BRASILEIRO (use como base):
- CDC (Lei 8.078/90): direito de arrependimento em 7 dias corridos para compras online (Art. 49), garantia legal de 30 dias (não-duráveis) e 90 dias (duráveis) para produtos com defeito.
- LGPD (Lei 13.709/18): obrigações sobre coleta, uso, armazenamento e proteção de dados pessoais, direitos do titular (acesso, correção, exclusão, portabilidade), necessidade de base legal para tratamento.
- Marco Civil da Internet (Lei 12.965/14): responsabilidades sobre dados, privacidade e conteúdo online.
- Decreto 7.962/2013: regras para e-commerce (informações claras sobre preço/frete, atendimento facilitado, confirmação de compra, direito de arrependimento).
- Nota Fiscal é obrigatória para vendas ao consumidor.
- Obrigação legal de informar CNPJ, razão social, endereço e canais de contato no site.
- O frete de devolução por arrependimento (Art. 49 CDC) é por conta do fornecedor.
- O frete de devolução por defeito é por conta do fornecedor.
- Estorno via cartão de crédito pode levar até 2 faturas para aparecer.
- Reembolso via PIX/boleto em até 10 dias úteis após aprovação.

${storeDataBlock}

Gere conteúdo completo, profissional e juridicamente embasado.
Cada seção deve ter entre 2-4 parágrafos substanciais.
Use bullets para listar direitos, obrigações, condições e procedimentos.`;

      const legalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: legalSystemPrompt },
            { role: "user", content: `Gere o conteúdo estruturado para estas páginas legais:\n${legalSpecs}\n\nPara cada página, retorne os dados via tool calling.` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_legal_pages",
                description: "Create structured legal page content",
                parameters: {
                  type: "object",
                  properties: {
                    pages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string", description: "Page key (shipping, returns, privacy, terms, refund)" },
                          title: { type: "string" },
                          intro: { type: "string", description: "Short intro paragraph (1-2 sentences)" },
                          sections: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                heading: { type: "string", description: "Section heading e.g. '1. Coleta de Dados'" },
                                paragraphs: { type: "array", items: { type: "string" }, description: "2-4 paragraphs per section. May use <strong> for key terms." },
                                bullets: { type: "array", items: { type: "string" }, description: "List items if applicable" },
                              },
                              required: ["heading", "paragraphs"],
                              additionalProperties: false,
                            },
                          },
                          highlight_notes: { type: "array", items: { type: "string" }, description: "Important warnings/notes to highlight" },
                        },
                        required: ["key", "title", "intro", "sections"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["pages"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_legal_pages" } },
          temperature: 0.5,
        }),
      });

      if (!legalResponse.ok) {
        const status = legalResponse.status;
        if (status === 429) throw new Error("Rate limit excedido. Tente novamente em alguns minutos.");
        if (status === 402) throw new Error("Créditos insuficientes. Adicione créditos ao workspace.");
        throw new Error(`Erro na IA (legal): ${status}`);
      }

      const legalData = await legalResponse.json();
      const toolCall = legalData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          legalResults = parsed.pages || [];
        } catch (e) {
          console.error("Failed to parse legal pages:", e);
        }
      }
    }

    // =============================================
    // B. INSTITUTIONAL PAGES — Rich HTML generation
    // =============================================
    let institutionalResults: Array<{ key: string; html: string }> = [];

    if (institutionalPages.length > 0) {
      const instSpecs = institutionalPages.map(p => `- ${p.key}: "${p.title}"`).join("\n");

      const instSystemPrompt = `Você é um redator de conteúdo institucional para e-commerce.
Gere conteúdo profissional, caloroso e personalizado.

REGRAS DE FORMATAÇÃO HTML (OBRIGATÓRIO):
1. Use <h1> para título principal (centralizado, apenas 1 por página)
2. Use <h2> para subtítulos de seção — com style="font-size:1.25rem;font-weight:600;margin-top:2rem;margin-bottom:0.75rem;"
3. Use <h3> para sub-subtítulos quando necessário
4. Use <strong> para destacar termos importantes
5. CADA parágrafo DEVE estar em sua própria tag <p> com style="margin-bottom:0.75rem;line-height:1.7;"
6. Use <ul>/<li> para listas
7. NUNCA junte texto sem tags — cada bloco de texto precisa de tag própria
8. Separe seções visualmente
9. Use <em> para observações secundárias

REGRA CRÍTICA PARA "QUEM SOMOS":
- NÃO seja genérico. Use o contexto do negócio fornecido pelo lojista como base principal.
- Destaque: proposta da marca, público atendido, diferenciais reais, prova social (números, tempo de mercado).
- Tom: confiante, humano e profissional. Evite clichês vazios.

REGRA PARA "FALE CONOSCO":
- Destaque canais de contato de forma clara e visual
- Informe horário de atendimento e prazo médio de resposta

REGRA PARA "COMO COMPRAR":
- Estruture como passo a passo numerado (1, 2, 3...)
- Mencione formas de pagamento disponíveis
- Inclua informação sobre acompanhamento de pedido

${storeDataBlock}

${businessContext ? `CONTEXTO DO NEGÓCIO (fornecido pelo lojista — use FORTEMENTE para personalizar):
${businessContext}` : ""}

Retorne APENAS o JSON solicitado, sem markdown, sem explicações extras.`;

      const instUserPrompt = `Gere o conteúdo HTML para estas páginas institucionais:
${instSpecs}

Retorne um array JSON: [{"key":"about","html":"<h1 style=\\"...\\">..."}]

IMPORTANTE:
- Para "Quem Somos": use o contexto do negócio para criar algo único e personalizado, NÃO genérico.
- Para "Fale Conosco": organize canais de contato com visual claro.
- Para "Como Comprar": faça um passo a passo numerado e fácil.
- Cada parágrafo em tag <p> separada com espaçamento.
- Cada seção com <h2> bem definido.
- Use inline styles para garantir espaçamento entre elementos.`;

      const instResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: instSystemPrompt },
            { role: "user", content: instUserPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!instResponse.ok) {
        const status = instResponse.status;
        if (status === 429) throw new Error("Rate limit excedido. Tente novamente em alguns minutos.");
        if (status === 402) throw new Error("Créditos insuficientes. Adicione créditos ao workspace.");
        throw new Error(`Erro na IA (institucional): ${status}`);
      }

      const instData = await instResponse.json();
      let rawContent = instData.choices?.[0]?.message?.content || "";
      rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      try {
        institutionalResults = JSON.parse(rawContent);
      } catch {
        console.error("Failed to parse institutional pages:", rawContent.substring(0, 500));
      }
    }

    // =============================================
    // C. FAQ — Structured tool calling, plain text
    // =============================================
    let faqItems: Array<{ question: string; answer: string }> = [];

    if (hasFaq) {
      const faqSystemPrompt = `Você é um especialista em FAQ para e-commerce brasileiro.
Gere perguntas frequentes profissionais e úteis.

REGRAS CRÍTICAS:
1. Retorne perguntas e respostas em TEXTO PURO — SEM HTML, SEM tags, SEM markdown.
2. Respostas claras, diretas e informativas (2-4 frases cada).
3. Use os dados da loja quando disponíveis.
4. Se faltar dado, use linguagem neutra sem inventar.
5. NUNCA use <p>, <strong>, <ul>, <br> ou qualquer tag HTML nas respostas.

${storeDataBlock}`;

      const faqUserPrompt = `Gere perguntas frequentes para a loja "${storeCtx.storeName}".

${businessContext ? `O lojista informou este contexto sobre o negócio e as dúvidas dos clientes:
${businessContext}

INSTRUÇÃO: Use as perguntas e dores informadas pelo lojista como BASE PRINCIPAL.
Transforme cada dor/dúvida mencionada em uma pergunta clara e resposta personalizada.
Complemente com perguntas padrão de e-commerce se necessário para cobrir: pagamento, frete, trocas, segurança.` : `Gere perguntas frequentes relevantes para e-commerce brasileiro cobrindo:
- Pedidos e prazos
- Frete e entrega
- Formas de pagamento
- Trocas e devoluções
- Segurança e confiabilidade`}

Gere entre 8 e 12 perguntas. Respostas em TEXTO PURO sem HTML.`;

      const faqResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: faqSystemPrompt },
            { role: "user", content: faqUserPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_faq",
                description: "Create FAQ items with plain text questions and answers (NO HTML)",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string", description: "Plain text question, no HTML" },
                          answer: { type: "string", description: "Plain text answer, no HTML tags whatsoever" },
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
            // SAFETY: Convert any leaked HTML/markdown to plain text
            faqItems = (parsed.items || [])
              .map((item: any) => ({
                question: toPlainText(item?.question),
                answer: toPlainText(item?.answer),
              }))
              .filter((item: { question: string; answer: string }) => item.question.length > 0 && item.answer.length > 0);
          } catch {
            console.error("Failed to parse FAQ tool call");
          }
        }
      }

      // Fallback
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

    // =============================================
    // 7. BUILD AND INSERT PAGES
    // =============================================
    const pagesToInsert = pagesToCreate.map(pageSpec => {
      let pageContent: any;

      if (pageSpec.mode === "faq") {
        // FAQ page — native FAQ block
        pageContent = {
          id: `essential-${pageSpec.slug}-root`,
          type: "Page",
          props: {},
          children: [
            { id: `essential-${pageSpec.slug}-header`, type: "Header", props: { menuId: "", showSearch: true, showCart: true, sticky: true, noticeEnabled: false } },
            {
              id: `essential-${pageSpec.slug}-section`,
              type: "Section",
              props: { paddingY: 0, paddingX: 0, fullWidth: true },
              children: [
                {
                  id: `essential-${pageSpec.slug}-container`,
                  type: "Container",
                  props: { maxWidth: "md", centered: true },
                  children: [
                    { id: `essential-${pageSpec.slug}-faq`, type: "FAQ", props: { title: "Perguntas Frequentes", items: faqItems } },
                  ],
                },
              ],
            },
            { id: `essential-${pageSpec.slug}-footer`, type: "Footer", props: { menuId: "", showSocial: true } },
          ],
        };
      } else if (pageSpec.mode === "legal") {
        // Legal page — structured JSON rendered to formatted HTML
        const legalData = legalResults.find(l => l.key === pageSpec.key);
        let htmlContent: string;

        if (legalData) {
          htmlContent = renderLegalPageToHtml(legalData, storeCtx);
        } else {
          // Fallback: basic placeholder
          htmlContent = `<h1 style="font-size:1.75rem;font-weight:700;text-align:center;margin-bottom:1rem;">${pageSpec.title}</h1>
<p style="text-align:center;color:#666;">Conteúdo pendente de geração. Por favor, tente novamente.</p>`;
        }

        pageContent = {
          id: `essential-${pageSpec.slug}-root`,
          type: "Page",
          props: {},
          children: [
            { id: `essential-${pageSpec.slug}-header`, type: "Header", props: { menuId: "", showSearch: true, showCart: true, sticky: true, noticeEnabled: false } },
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
                    { id: `essential-${pageSpec.slug}-content`, type: "RichText", props: { content: htmlContent } },
                  ],
                },
              ],
            },
            { id: `essential-${pageSpec.slug}-footer`, type: "Footer", props: { menuId: "", showSocial: true } },
          ],
        };
      } else {
        // Institutional page — AI-generated HTML with better formatting
        const generated = institutionalResults.find(g => g.key === pageSpec.key);
        let htmlContent = generated?.html || `<h1 style="font-size:1.75rem;font-weight:700;text-align:center;margin-bottom:1rem;">${pageSpec.title}</h1><p>Conteúdo pendente de geração.</p>`;

        // Post-process: inject contact block at the end for "Fale Conosco"
        if (pageSpec.key === "contact") {
          htmlContent += `\n<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:1.25rem;margin-top:2rem;">
<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">Nossos canais de atendimento</h3>
${buildContactBlock(storeCtx)}
${storeCtx.supportHours ? `<p style="margin-top:0.5rem;font-size:0.9rem;"><strong>Horário:</strong> ${storeCtx.supportHours}</p>` : ''}
</div>`;
        }

        pageContent = {
          id: `essential-${pageSpec.slug}-root`,
          type: "Page",
          props: {},
          children: [
            { id: `essential-${pageSpec.slug}-header`, type: "Header", props: { menuId: "", showSearch: true, showCart: true, sticky: true, noticeEnabled: false } },
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
                    { id: `essential-${pageSpec.slug}-content`, type: "RichText", props: { content: htmlContent } },
                  ],
                },
              ],
            },
            { id: `essential-${pageSpec.slug}-footer`, type: "Footer", props: { menuId: "", showSocial: true } },
          ],
        };
      }

      return {
        tenant_id: tenantId,
        title: pageSpec.title,
        slug: pageSpec.slug,
        content: pageContent,
        draft_content: pageContent,
        status: "draft",
        is_published: false,
        type: "institutional",
        seo_title: pageSpec.title,
        seo_description: `${pageSpec.title} - ${storeCtx.storeName}`,
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
