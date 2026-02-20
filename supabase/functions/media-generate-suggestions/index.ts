import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TargetChannel = "all" | "facebook" | "instagram";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    resetAIRouterCache();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // ====================================
    // STRATEGY-FOCUSED PROMPTS (sem copy completa)
    // ====================================

    if (targetChannel === "facebook") {
      systemPrompt = `Você é um ESTRATEGISTA DE CONTEÚDO especialista em planejamento para Facebook.
Sua tarefa é criar um calendário editorial ESTRATÉGICO para Facebook.

## SEU FOCO É ESTRATÉGIA — DEFINA APENAS TIPOS, QUANTIDADES E TEMAS:
1. Defina TÍTULOS/TEMAS claros para cada post
2. NÃO escreva copys, legendas, CTAs, hashtags ou prompts de criativos — um copywriter fará isso depois
3. Deixe os campos copy, cta, hashtags e generation_prompt VAZIOS
4. Varie entre posts informativos, promocionais e de engajamento
5. Considere datas comemorativas`;
      contentTypes = '"image" (post com imagem) ou "carousel" (carrossel de imagens)';
      targetPlatformsDefault = ["facebook"];
    } else if (targetChannel === "instagram") {
      systemPrompt = `Você é um ESTRATEGISTA DE CONTEÚDO especialista em planejamento para Instagram.
Sua tarefa é criar um calendário editorial ESTRATÉGICO para Instagram.

## SEU FOCO É ESTRATÉGIA — DEFINA APENAS TIPOS, QUANTIDADES E TEMAS:
1. Defina TÍTULOS/TEMAS claros para cada post
2. NÃO escreva copys, legendas, CTAs, hashtags ou prompts de criativos — um copywriter fará isso depois
3. Deixe os campos copy, cta, hashtags e generation_prompt VAZIOS
4. Varie tipos de conteúdo (produto, lifestyle, educativo)
5. Considere datas comemorativas`;
      contentTypes = '"image" (post 1:1) ou "carousel" (carrossel)';
      targetPlatformsDefault = ["instagram"];
    } else {
      // "all" - multiplataforma (redes sociais apenas, SEM blog)
      systemPrompt = `Você é um ESTRATEGISTA DE CONTEÚDO DIGITAL multiplataforma.
Sua tarefa é criar um calendário editorial ESTRATÉGICO para Facebook, Instagram e Stories.

## SEU FOCO É ESTRATÉGIA — DEFINA APENAS TIPOS, QUANTIDADES E TEMAS:
1. Defina TÍTULOS/TEMAS claros para cada post
2. NÃO escreva copys, legendas, CTAs, hashtags ou prompts de criativos — um copywriter fará isso depois
3. Deixe os campos copy, cta, hashtags e generation_prompt VAZIOS
4. Foque em PLANEJAMENTO: distribuição de conteúdo, equilíbrio entre canais, sazonalidade

## REGRAS DE FREQUÊNCIA (SEMPRE APLICAR, exceto se o cliente especificar diferente):

### STORIES - OBRIGATÓRIO TODOS OS DIAS:
- 2 a 6 stories POR DIA (content_type: "story")
- target_platforms: ["instagram"] ou ["facebook"] ou ambos
- **PROIBIDO**: NÃO gere stories com enquetes, quiz, contagem regressiva ou stickers interativos
- Foque em stories estáticos: imagens com texto, dicas rápidas, produtos em destaque

### FEED (Instagram + Facebook SIMULTANEAMENTE):
- Posts de feed a cada 2-3 dias OU 3 vezes por semana
- target_platforms SEMPRE deve ser ["instagram", "facebook"] para posts de feed
- content_type: "image" ou "carousel"

## REGRAS GERAIS:
1. Use APENAS redes sociais: Instagram, Facebook e Stories. NÃO gere posts de Blog.
2. NÃO gere generation_prompt — o copywriter criará os prompts de imagem depois
3. Varie os tipos de conteúdo dentro de cada plataforma
4. Mantenha consistência de marca entre as plataformas
5. Se o cliente especificar quantidades diferentes no prompt, use as dele`;
      contentTypes = '"image" ou "carousel" para feed, "story" para stories';
      targetPlatformsDefault = ["instagram", "facebook"];
    }

    // ====================================
    // GENERATE SUGGESTIONS WITH AI
    // ====================================
    const holidaysSection = specialDatesContext 
      ? `\n## Datas comemorativas no período (APROVEITE-AS!):\n${specialDatesContext}\n` 
      : "";

    const frequencyInstructions = targetChannel === "all" ? `
## QUANTIDADE OBRIGATÓRIA POR DIA - SIGA RIGOROSAMENTE:
Para CADA dia listado, você DEVE gerar:
- 1 a 3 STORIES por dia (content_type: "story", target_platforms: ["instagram"] ou ["facebook"] ou ambos)
- 1 POST DE FEED a cada 2 dias (content_type: "image" ou "carousel", target_platforms: ["instagram", "facebook"] - AMBOS SEMPRE)

Para ${validDates.length} dias, gere EXATAMENTE:
- ${Math.max(1, Math.ceil(validDates.length / 2))} a ${Math.ceil(validDates.length / 2) + 2} posts de FEED (Instagram + Facebook juntos)
- ${validDates.length * 2} a ${validDates.length * 3} stories (média de 2-3 por dia)

⚠️ IMPORTANTE: NÃO gere posts de Blog! Este módulo é EXCLUSIVO para redes sociais.
⚠️ IMPORTANTE: NÃO esqueça os posts de FEED! Eles são obrigatórios e devem ir para ["instagram", "facebook"] simultaneamente.
` : "";


    const userPrompt = `${businessContext}
${holidaysSection}
## Direcionamento da campanha:
${campaign.prompt}

## Canal alvo: ${targetChannel === "all" ? "Facebook, Instagram e Stories" : targetChannel}

## Período: ${campaign.start_date} até ${campaign.end_date}

## Datas disponíveis:
${validDates.join(", ")}
${frequencyInstructions}
CRÍTICO: Responda APENAS com JSON puro. NÃO use \`\`\`json ou \`\`\`. Comece diretamente com [ e termine com ].

REGRA ABSOLUTA: Você é um ESTRATEGISTA. Você define APENAS tipos, quantidades e temas. NÃO escreva copys, legendas, CTAs, hashtags ou prompts de criativos. Tudo isso será feito depois por um COPYWRITER especialista.

Estrutura de cada item:
{
  "scheduled_date": "YYYY-MM-DD",
  "content_type": ${contentTypes},
  "target_channel": "instagram" | "facebook",
  "title": "Título/tema do post ou artigo",
  "copy": "",
  "cta": "",
  "hashtags": [],
  "generation_prompt": "",
  "target_platforms": ["instagram", "facebook"] para feed, ["instagram"] ou ["facebook"] para stories,
  "needs_product_image": true/false
}

IMPORTANTE:
- Os campos "copy", "cta", "hashtags" e "generation_prompt" DEVEM ser VAZIOS ("" ou []).
- NÃO escreva legendas, CTAs, hashtags ou prompts de imagem.
- Foque APENAS em: scheduled_date, content_type, target_channel, title, target_platforms, needs_product_image
- needs_product_image = true quando o post precisa mostrar um produto da loja
- needs_product_image = false para dicas, artigos educativos, lifestyle, etc.
- Para posts de FEED: target_platforms SEMPRE deve incluir ["instagram", "facebook"] (os mesmos posts vão para ambas redes)
- Para STORIES: podem ser separados por plataforma ou ambos`;

    const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: "[media-generate-suggestions]",
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", errorText);
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
      
      // Remove markdown code blocks more robustly
      // Handle ```json\n...\n``` pattern
      const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        cleanContent = jsonBlockMatch[1];
      } else {
        // Fallback: simple cleanup
        if (cleanContent.startsWith("```json")) {
          cleanContent = cleanContent.slice(7);
        } else if (cleanContent.startsWith("```")) {
          cleanContent = cleanContent.slice(3);
        }
        if (cleanContent.endsWith("```")) {
          cleanContent = cleanContent.slice(0, -3);
        }
      }
      
      cleanContent = cleanContent.trim();
      
      // Try to find array boundaries if JSON starts/ends are malformed
      if (!cleanContent.startsWith("[")) {
        const arrayStart = cleanContent.indexOf("[");
        if (arrayStart !== -1) {
          cleanContent = cleanContent.slice(arrayStart);
        }
      }
      if (!cleanContent.endsWith("]")) {
        const arrayEnd = cleanContent.lastIndexOf("]");
        if (arrayEnd !== -1) {
          cleanContent = cleanContent.slice(0, arrayEnd + 1);
        }
      }
      
      suggestions = JSON.parse(cleanContent);
      console.log(`[media-generate-suggestions] Successfully parsed ${suggestions.length} suggestions`);
    } catch (parseError) {
      console.error("Failed to parse AI response. First 500 chars:", content.substring(0, 500));
      console.error("Last 500 chars:", content.substring(content.length - 500));
      console.error("Parse error:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao processar sugestões da IA. Tente gerar novamente." }),
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
    // Filter out any blog items the AI might have generated despite instructions
    const filteredSuggestions = suggestions.filter((s: any) => {
      if (s.target_channel === "blog" || (s.target_platforms && s.target_platforms.includes("blog"))) {
        console.log(`[media-generate-suggestions] Filtering out blog item: ${s.title}`);
        return false;
      }
      return true;
    });

    console.log(`[media-generate-suggestions] ${suggestions.length} total, ${filteredSuggestions.length} after filtering blog items`);

    const itemsToInsert = filteredSuggestions.map((s: any) => ({
      tenant_id,
      campaign_id,
      scheduled_date: s.scheduled_date,
      scheduled_time: defaultTime,
      content_type: s.content_type || "image",
      target_channel: s.target_channel || targetChannel,
      title: s.title,
      copy: null,
      cta: null,
      hashtags: [],
      generation_prompt: null,
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
