import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, tenant_id } = await req.json();

    if (!campaign_id || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id e tenant_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      .eq("is_active", true)
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
    // CALCULATE DATES FOR CALENDAR
    // ====================================
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);
    const daysOfWeek = campaign.days_of_week || [0, 1, 2, 3, 4, 5, 6];
    const excludedDates = campaign.excluded_dates || [];
    const defaultTime = campaign.default_time || "10:00:00";

    const validDates: string[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split("T")[0];
      
      if (daysOfWeek.includes(dayOfWeek) && !excludedDates.includes(dateStr)) {
        validDates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (validDates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma data válida no período da campanha" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================
    // GENERATE SUGGESTIONS WITH AI
    // ====================================
    const systemPrompt = `Você é um especialista em marketing digital e criação de conteúdo para redes sociais.
Sua tarefa é criar um calendário editorial completo baseado no direcionamento do cliente e no contexto do negócio.

Regras importantes:
1. Cada sugestão deve ser prática e executável
2. Varie os tipos de conteúdo (imagem, vídeo, carousel, reel, story)
3. As copies devem ser engajadoras e com CTAs claros
4. Use hashtags relevantes para o nicho
5. O generation_prompt deve ser detalhado para gerar imagens/vídeos
6. Considere datas comemorativas e tendências quando relevante
7. Mantenha consistência com a marca e tom do negócio`;

    const userPrompt = `${businessContext}

## Direcionamento da campanha:
${campaign.prompt}

## Período: ${campaign.start_date} até ${campaign.end_date}

Gere exatamente ${validDates.length} sugestões de conteúdo para as seguintes datas:
${validDates.join(", ")}

Responda APENAS com um array JSON válido (sem markdown, sem \`\`\`), onde cada item tem:
{
  "scheduled_date": "YYYY-MM-DD",
  "content_type": "image" | "video" | "carousel" | "reel" | "story",
  "title": "Título/tema do post",
  "copy": "Legenda completa com emojis e CTAs",
  "cta": "Call to action principal",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "generation_prompt": "Prompt detalhado para gerar o visual do conteúdo",
  "target_platforms": ["instagram", "facebook"]
}`;

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
      // Clean the response if it has markdown code blocks
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
      title: s.title,
      copy: s.copy,
      cta: s.cta,
      hashtags: s.hashtags || [],
      generation_prompt: s.generation_prompt,
      target_platforms: s.target_platforms || ["instagram"],
      status: "suggested",
      version: 1,
      metadata: {},
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
