import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TargetChannel = "all" | "blog" | "facebook" | "instagram";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, tenant_id, target_dates } = await req.json();

    if (!campaign_id || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id e tenant_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // target_dates é opcional - array de strings "YYYY-MM-DD"
    const selectedDates: string[] | undefined = target_dates;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("media_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campanha não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetChannel: TargetChannel = campaign.target_channel || "all";

    // ====================================
    // BUILD TENANT BUSINESS CONTEXT
    // ====================================
    let businessContext = "";
    
    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .single();

    // Get store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const storeName = storeSettings?.store_name || tenant?.name || "Loja";
    businessContext += `## Informações do negócio:\n`;
    businessContext += `- Nome: ${storeName}\n`;
    if (storeSettings?.store_description) {
      businessContext += `- Descrição: ${storeSettings.store_description}\n`;
    }
    if (storeSettings?.contact_phone) {
      businessContext += `- Telefone: ${storeSettings.contact_phone}\n`;
    }
    if (storeSettings?.whatsapp_number) {
      businessContext += `- WhatsApp: ${storeSettings.whatsapp_number}\n`;
    }

    // Get custom domain for links
    const { data: customDomain } = await supabase
      .from("custom_domains")
      .select("domain")
      .eq("tenant_id", tenant_id)
      .eq("status", "verified")
      .maybeSingle();

    let storeUrl = customDomain?.domain 
      ? `https://${customDomain.domain}`
      : tenant?.slug ? `https://${tenant.slug}.shops.comandocentral.com.br` : "";

    if (storeUrl) {
      businessContext += `- Site: ${storeUrl}\n`;
    }

    // Get products
    const { data: products } = await supabase
      .from("products")
      .select("name, price, description, slug, is_featured")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .order("is_featured", { ascending: false })
      .limit(50);

    if (products?.length) {
      businessContext += `\n## Produtos disponíveis:\n`;
      businessContext += products.map(p => {
        let info = `- ${p.name}: R$ ${p.price?.toFixed(2)}`;
        if (p.is_featured) info += " ⭐";
        if (p.description) info += ` - ${p.description.slice(0, 100)}`;
        return info;
      }).join("\n");
    }

    // Get categories
    const { data: categories } = await supabase
      .from("categories")
      .select("name, description")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .limit(20);

    if (categories?.length) {
      businessContext += `\n\n## Categorias:\n`;
      businessContext += categories.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
    }

    // Get active discounts
    const { data: discounts } = await supabase
      .from("discounts")
      .select("name, code, type, value")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .limit(10);

    if (discounts?.length) {
      businessContext += `\n\n## Promoções ativas:\n`;
      businessContext += discounts.map(d => {
        const val = d.type === 'percentage' ? `${d.value}%` : `R$ ${d.value}`;
        return `- ${d.name}${d.code ? ` (código: ${d.code})` : ""}: ${val} de desconto`;
      }).join("\n");
    }

    // Store the business context
    await supabase
      .from("media_campaigns")
      .update({ 
        business_context: businessContext,
        ai_generated_context: { generated_at: new Date().toISOString(), store_name: storeName }
      })
      .eq("id", campaign_id);

    // ====================================
    // BRAZILIAN HOLIDAYS (inline for edge function)
    // ====================================
    const BRAZILIAN_HOLIDAYS: Record<string, { name: string; emoji: string; type: string }> = {
      "01-01": { name: "Ano Novo", emoji: "🎆", type: "national" },
      "03-08": { name: "Dia da Mulher", emoji: "💜", type: "commemorative" },
      "03-15": { name: "Dia do Consumidor", emoji: "🛒", type: "commercial" },
      "04-21": { name: "Tiradentes", emoji: "🇧🇷", type: "national" },
      "05-01": { name: "Dia do Trabalho", emoji: "👷", type: "national" },
      "06-12": { name: "Dia dos Namorados", emoji: "❤️", type: "commercial" },
      "07-26": { name: "Dia dos Avós", emoji: "👴👵", type: "commemorative" },
      "09-07": { name: "Independência do Brasil", emoji: "🇧🇷", type: "national" },
      "10-12": { name: "Dia das Crianças", emoji: "🧒", type: "national" },
      "10-15": { name: "Dia do Professor", emoji: "📖", type: "commemorative" },
      "10-31": { name: "Halloween", emoji: "🎃", type: "commercial" },
      "11-02": { name: "Finados", emoji: "🕯️", type: "national" },
      "11-15": { name: "Proclamação da República", emoji: "🇧🇷", type: "national" },
      "11-20": { name: "Consciência Negra", emoji: "✊🏿", type: "commemorative" },
      "12-24": { name: "Véspera de Natal", emoji: "🎄", type: "commemorative" },
      "12-25": { name: "Natal", emoji: "🎅", type: "national" },
      "12-31": { name: "Véspera de Ano Novo", emoji: "🎊", type: "commemorative" },
    };

    // Calculate Easter and movable holidays
    function calculateEaster(year: number): Date {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }

    function getNthSunday(year: number, month: number, n: number): Date {
      const firstDay = new Date(year, month, 1);
      const firstSunday = new Date(year, month, 1 + (7 - firstDay.getDay()) % 7);
      return new Date(year, month, firstSunday.getDate() + (n - 1) * 7);
    }

    function getNthFriday(year: number, month: number, n: number): Date {
      const firstDay = new Date(year, month, 1);
      let firstFriday = 1 + (5 - firstDay.getDay() + 7) % 7;
      if (firstFriday > 7) firstFriday -= 7;
      return new Date(year, month, firstFriday + (n - 1) * 7);
    }

    function getMovableHolidays(year: number): Record<string, { name: string; emoji: string; type: string }> {
      const result: Record<string, { name: string; emoji: string; type: string }> = {};
      const easter = calculateEaster(year);
      
      // Carnaval (47 dias antes da Páscoa)
      const carnival = new Date(easter);
      carnival.setDate(easter.getDate() - 47);
      const carnivalKey = `${String(carnival.getMonth() + 1).padStart(2, "0")}-${String(carnival.getDate()).padStart(2, "0")}`;
      result[carnivalKey] = { name: "Carnaval", emoji: "🎭", type: "national" };
      
      // Páscoa
      const easterKey = `${String(easter.getMonth() + 1).padStart(2, "0")}-${String(easter.getDate()).padStart(2, "0")}`;
      result[easterKey] = { name: "Páscoa", emoji: "🐰", type: "national" };
      
      // Dia das Mães (2º domingo de maio)
      const mothersDay = getNthSunday(year, 4, 2);
      const mothersDayKey = `${String(mothersDay.getMonth() + 1).padStart(2, "0")}-${String(mothersDay.getDate()).padStart(2, "0")}`;
      result[mothersDayKey] = { name: "Dia das Mães", emoji: "💐", type: "commercial" };
      
      // Dia dos Pais (2º domingo de agosto)
      const fathersDay = getNthSunday(year, 7, 2);
      const fathersDayKey = `${String(fathersDay.getMonth() + 1).padStart(2, "0")}-${String(fathersDay.getDate()).padStart(2, "0")}`;
      result[fathersDayKey] = { name: "Dia dos Pais", emoji: "👔", type: "commercial" };
      
      // Black Friday (4ª sexta de novembro)
      const blackFriday = getNthFriday(year, 10, 4);
      const blackFridayKey = `${String(blackFriday.getMonth() + 1).padStart(2, "0")}-${String(blackFriday.getDate()).padStart(2, "0")}`;
      result[blackFridayKey] = { name: "Black Friday", emoji: "🏷️", type: "commercial" };
      
      return result;
    }

    // ====================================
    // CALCULATE DATES FOR CALENDAR
    // ====================================
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);
    const daysOfWeek = campaign.days_of_week || [0, 1, 2, 3, 4, 5, 6];
    const excludedDates = campaign.excluded_dates || [];
    const defaultTime = campaign.default_time || "10:00:00";

    let validDates: string[] = [];
    const datesWithHolidays: Array<{ date: string; holiday?: { name: string; emoji: string; type: string } }> = [];
    
    // Get movable holidays for all years in the campaign period
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const allMovableHolidays: Record<string, { name: string; emoji: string; type: string }> = {};
    for (let year = startYear; year <= endYear; year++) {
      Object.assign(allMovableHolidays, getMovableHolidays(year));
    }
    
    // Se target_dates foi especificado, usar essas datas (seleção manual do usuário)
    if (selectedDates && selectedDates.length > 0) {
      // Usar as datas selecionadas manualmente, filtrando apenas as que estão no período da campanha
      for (const dateStr of selectedDates) {
        const date = new Date(dateStr);
        if (date >= startDate && date <= endDate && !excludedDates.includes(dateStr)) {
          validDates.push(dateStr);
          
          // Check for holidays
          const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const fixedHoliday = BRAZILIAN_HOLIDAYS[monthDay];
          const movableHoliday = allMovableHolidays[monthDay];
          const holiday = fixedHoliday || movableHoliday;
          
          datesWithHolidays.push({ date: dateStr, holiday });
        }
      }
      // Ordenar as datas
      validDates.sort();
    } else {
      // Comportamento padrão: gerar para todos os dias ativos
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dateStr = currentDate.toISOString().split("T")[0];
        const monthDay = `${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
        
        if (daysOfWeek.includes(dayOfWeek) && !excludedDates.includes(dateStr)) {
          validDates.push(dateStr);
          
          // Check for holidays
          const fixedHoliday = BRAZILIAN_HOLIDAYS[monthDay];
          const movableHoliday = allMovableHolidays[monthDay];
          const holiday = fixedHoliday || movableHoliday;
          
          datesWithHolidays.push({ date: dateStr, holiday });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (validDates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma data válida selecionada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build special dates context for AI
    const specialDatesContext = datesWithHolidays
      .filter(d => d.holiday)
      .map(d => `- ${d.date}: ${d.holiday!.emoji} ${d.holiday!.name} (${d.holiday!.type})`)
      .join("\n");

    // ====================================
    // BUILD SYSTEM PROMPT BASED ON CHANNEL
    // ====================================
    let systemPrompt = "";
    let contentTypes = "";
    let targetPlatformsDefault: string[] = [];

    if (targetChannel === "blog") {
      systemPrompt = `Você é um especialista em marketing de conteúdo e SEO para blogs.
Sua tarefa é criar um calendário editorial de artigos para blog baseado no direcionamento do cliente.

Regras importantes:
1. Cada artigo deve ser educativo, informativo e bem estruturado
2. Os títulos devem ser atrativos e otimizados para SEO
3. O copy deve ser o CONTEÚDO COMPLETO do artigo em formato markdown
4. Inclua H2 e H3 para estruturar o conteúdo
5. O generation_prompt deve descrever a imagem de capa do artigo (sem produtos, apenas cenário/conceito)
6. Use hashtags como tags/categorias do artigo
7. O CTA deve direcionar para produtos ou contato da loja`;
      contentTypes = '"image" (artigo de blog com imagem de capa)';
      targetPlatformsDefault = ["blog"];
    } else if (targetChannel === "facebook") {
      systemPrompt = `Você é um especialista em marketing para Facebook.
Sua tarefa é criar um calendário de posts para Facebook baseado no direcionamento do cliente.

Regras importantes:
1. Posts engajadores com tom adequado para Facebook
2. Copies mais longas são bem-vindas (Facebook aceita textos maiores)
3. CTAs claros para vendas ou WhatsApp
4. Use imagens atraentes (descreva no generation_prompt)
5. Varie entre posts informativos, promocionais e de engajamento
6. Inclua perguntas para gerar comentários`;
      contentTypes = '"image" (post com imagem) ou "carousel" (carrossel de imagens)';
      targetPlatformsDefault = ["facebook"];
    } else if (targetChannel === "instagram") {
      systemPrompt = `Você é um especialista em marketing para Instagram.
Sua tarefa é criar um calendário de posts para Instagram baseado no direcionamento do cliente.

Regras importantes:
1. Copies curtas e impactantes (limite de 2200 caracteres)
2. Hashtags relevantes para o nicho (máximo 30)
3. CTAs claros (link na bio, DM, etc.)
4. O generation_prompt deve ser detalhado para gerar imagens atraentes
5. Varie entre posts de produto, estilo de vida e educativos
6. Use emojis com moderação`;
      contentTypes = '"image" (post 1:1) ou "carousel" (carrossel)';
      targetPlatformsDefault = ["instagram"];
    } else {
      // "all" - Generate for all channels
      systemPrompt = `Você é um especialista em marketing digital multiplataforma.
Sua tarefa é criar um calendário editorial para Blog, Facebook e Instagram baseado no direcionamento do cliente.

Regras importantes:
1. Distribua os conteúdos entre os 3 canais de forma equilibrada
2. Para Blog: conteúdo educativo e informativo, copy em markdown, generation_prompt para imagem de capa (sem produto)
3. Para Facebook: posts mais longos e engajadores, com perguntas
4. Para Instagram: posts curtos e impactantes, com hashtags
5. O generation_prompt deve ser detalhado para gerar imagens
6. Varie os tipos de conteúdo dentro de cada plataforma
7. Mantenha consistência de marca entre as plataformas`;
      contentTypes = '"image" ou "carousel" para redes sociais, "image" para blog';
      targetPlatformsDefault = ["instagram", "facebook", "blog"];
    }

    // ====================================
    // GENERATE SUGGESTIONS WITH AI
    // ====================================
    const holidaysSection = specialDatesContext 
      ? `\n## Datas comemorativas no período (APROVEITE-AS!):\n${specialDatesContext}\n` 
      : "";

    const userPrompt = `${businessContext}
${holidaysSection}
## Direcionamento da campanha:
${campaign.prompt}

## Canal alvo: ${targetChannel === "all" ? "Blog, Facebook e Instagram" : targetChannel}

## Período: ${campaign.start_date} até ${campaign.end_date}

Gere exatamente ${validDates.length} sugestões de conteúdo para as seguintes datas:
${validDates.join(", ")}

Responda APENAS com um array JSON válido (sem markdown, sem \`\`\`), onde cada item tem:
{
  "scheduled_date": "YYYY-MM-DD",
  "content_type": ${contentTypes},
  "target_channel": "${targetChannel === "all" ? "blog" : targetChannel}" | "facebook" | "instagram" | "blog",
  "title": "Título/tema do post ou artigo",
  "copy": "Legenda/conteúdo completo (para blog, use markdown)",
  "cta": "Call to action principal",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "generation_prompt": "Prompt detalhado para gerar a imagem${targetChannel === "blog" ? " de capa (NÃO inclua produtos na imagem, apenas cenário/conceito)" : " do post"}",
  "target_platforms": ${JSON.stringify(targetPlatformsDefault)},
  "needs_product_image": true/false
}

IMPORTANTE sobre needs_product_image:
- true = o post precisa mostrar um produto da loja (ex: promoção de produto, destaque de produto)
- false = o post NÃO precisa de produto (ex: dica, artigo educativo, lifestyle, etc.)`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar sugestões com IA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: "Resposta vazia da IA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON from AI response
    let suggestions;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      suggestions = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao processar sugestões da IA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(suggestions)) {
      return new Response(
        JSON.stringify({ success: false, error: "Formato de sugestões inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================
    // DELETE EXISTING DRAFT/SUGGESTED ITEMS
    // ====================================
    await supabase
      .from("media_calendar_items")
      .delete()
      .eq("campaign_id", campaign_id)
      .in("status", ["draft", "suggested"]);

    // ====================================
    // INSERT NEW CALENDAR ITEMS
    // ====================================
    const itemsToInsert = suggestions.map((s: any) => ({
      tenant_id,
      campaign_id,
      scheduled_date: s.scheduled_date,
      scheduled_time: defaultTime,
      content_type: s.content_type || "image",
      target_channel: s.target_channel || targetChannel,
      title: s.title,
      copy: s.copy,
      cta: s.cta,
      hashtags: s.hashtags || [],
      generation_prompt: s.generation_prompt,
      target_platforms: s.target_platforms || targetPlatformsDefault,
      status: "suggested",
      version: 1,
      metadata: {
        needs_product_image: s.needs_product_image ?? false,
      },
    }));

    const { data: insertedItems, error: insertError } = await supabase
      .from("media_calendar_items")
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar sugestões" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign status
    await supabase
      .from("media_campaigns")
      .update({ 
        status: "planning",
        items_count: insertedItems?.length || 0
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items_created: insertedItems?.length || 0,
        message: `${insertedItems?.length || 0} sugestões de conteúdo geradas com sucesso!`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
