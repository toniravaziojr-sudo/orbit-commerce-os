import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Criação - Edge function especialista em copywriting
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  console.log(`[media-generate-copys][${VERSION}] Request received`);

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

    // Get items that have title but no copy yet
    const { data: items, error: itemsError } = await supabase
      .from("media_calendar_items")
      .select("*")
      .eq("campaign_id", campaign_id)
      .in("status", ["draft", "suggested"])
      .not("title", "is", null)
      .order("scheduled_date", { ascending: true });

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar itens do calendário" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter items that need copy (no copy or empty copy)
    const itemsNeedingCopy = items?.filter(i => !i.copy || i.copy.trim() === "") || [];

    if (itemsNeedingCopy.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os itens já possuem copy", items_updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================
    // BUILD BUSINESS CONTEXT + REAL PRODUCTS
    // ====================================
    let businessContext = campaign.business_context || "";

    if (!businessContext) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, slug")
        .eq("id", tenant_id)
        .single();

      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("store_name, store_description, whatsapp_number")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      businessContext = `Loja: ${storeSettings?.store_name || tenant?.name || "Loja"}`;
      if (storeSettings?.store_description) businessContext += `\nDescrição: ${storeSettings.store_description}`;
      if (storeSettings?.whatsapp_number) businessContext += `\nWhatsApp: ${storeSettings.whatsapp_number}`;
    }

    // ALWAYS fetch real products to prevent hallucination
    const { data: realProducts } = await supabase
      .from("products")
      .select("name, price, slug, image_url")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .order("is_featured", { ascending: false })
      .limit(50);

    const productCatalog = realProducts?.length
      ? realProducts.map(p => `- "${p.name}" (R$ ${p.price?.toFixed(2)})${p.image_url ? ` [tem imagem]` : ""}`).join("\n")
      : "Nenhum produto cadastrado";

    console.log(`[media-generate-copys][${VERSION}] ${realProducts?.length || 0} real products found`);

    // ====================================
    // SPECIALIST COPYWRITING PROMPT
    // ====================================
    const systemPrompt = `Você é um COPYWRITER ESPECIALISTA em redes sociais e marketing digital.
Seu trabalho é criar copys PERSUASIVAS e OTIMIZADAS para cada plataforma.

## SUAS TÉCNICAS:
- AIDA (Atenção, Interesse, Desejo, Ação)
- PAS (Problema, Agitação, Solução)  
- Storytelling emocional
- Gatilhos mentais (escassez, prova social, autoridade, reciprocidade)
- Emojis estratégicos (não excessivos)

## REGRAS POR PLATAFORMA:

### Instagram (limite 2200 caracteres):
- Primeira linha IMPACTANTE (é o que aparece no preview)
- Quebras de linha estratégicas para leitura fácil
- CTAs claros (link na bio, arraste pra cima, comente, salve)
- 15-25 hashtags relevantes ao nicho (misturar populares + nichadas)
- Emojis como separadores visuais

### Facebook (sem limite de caracteres):
- Textos mais longos e narrativos funcionam bem
- Perguntas para gerar comentários
- CTAs diretos (clique no link, comente, compartilhe)
- Menos hashtags que Instagram (3-5 suficiente)
- Tom mais conversacional

### Stories:
- Texto CURTO e direto (será lido em 5 segundos)
- CTA urgente ("arraste pra cima", "toque no link")
- Emojis grandes e impactantes
- Frases de 1-2 linhas no máximo

### Blog:
- Conteúdo COMPLETO em markdown
- H2 e H3 para estruturar
- Tom educativo e autoritativo
- SEO-friendly (palavras-chave naturais)
- CTA no final direcionando para produtos/contato

## REGRAS GERAIS:
1. NUNCA gere texto genérico - cada copy deve ser ÚNICA e específica para o tema/título do item
2. O CTA deve ser ACIONÁVEL e específico
3. Adapte o tom de voz ao nicho da loja
4. Para generation_prompt: descreva a imagem de forma DETALHADA (composição, cores, estilo, elementos, mood)
5. Retorne APENAS JSON puro, sem markdown code blocks

## ⚠️ REGRA CRÍTICA SOBRE PRODUTOS:
- Você SOMENTE pode mencionar produtos que existem no CATÁLOGO REAL abaixo
- NUNCA invente, crie ou mencione produtos que NÃO estão na lista
- Se o tema pede um produto específico que não existe no catálogo, adapte para o produto mais próximo disponível
- No generation_prompt, descreva APENAS os produtos reais da loja com seus nomes EXATOS
- Se a loja tem poucos produtos, foque neles e varie os ângulos/cenários

## FORMATO DE RESPOSTA:
Retorne um array JSON com objetos contendo:
{
  "id": "id-do-item",
  "copy": "legenda/conteúdo completo",
  "cta": "call to action específico",
  "hashtags": ["hashtag1", "hashtag2"],
  "generation_prompt": "prompt detalhado para gerar a imagem ideal para este post"
}`;

    // Build items context for AI
    const itemsContext = itemsNeedingCopy.map(item => ({
      id: item.id,
      title: item.title,
      content_type: item.content_type,
      target_platforms: item.target_platforms || [],
      scheduled_date: item.scheduled_date,
      existing_generation_prompt: item.generation_prompt || null,
    }));

    const userPrompt = `${businessContext}

## 🛍️ CATÁLOGO REAL DE PRODUTOS (USE SOMENTE ESTES):
${productCatalog}

## Direcionamento da campanha:
${campaign.prompt}

## Itens que precisam de copy (${itemsNeedingCopy.length} itens):

${JSON.stringify(itemsContext, null, 2)}

CRÍTICO: Responda APENAS com JSON puro. NÃO use \`\`\`json ou \`\`\`. Comece diretamente com [ e termine com ].
Gere copy, CTA, hashtags e generation_prompt para CADA item listado acima.
⚠️ NO generation_prompt: mencione APENAS produtos que existem no catálogo acima. Use os nomes EXATOS.`;

    console.log(`[media-generate-copys][${VERSION}] Generating copys for ${itemsNeedingCopy.length} items`);

    const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: "[media-generate-copys]",
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar copys com IA" }),
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
    let copySuggestions;
    try {
      let cleanContent = content.trim();
      
      const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        cleanContent = jsonBlockMatch[1];
      } else {
        if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
        else if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
        if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      }
      
      cleanContent = cleanContent.trim();
      
      if (!cleanContent.startsWith("[")) {
        const arrayStart = cleanContent.indexOf("[");
        if (arrayStart !== -1) cleanContent = cleanContent.slice(arrayStart);
      }
      if (!cleanContent.endsWith("]")) {
        const arrayEnd = cleanContent.lastIndexOf("]");
        if (arrayEnd !== -1) cleanContent = cleanContent.slice(0, arrayEnd + 1);
      }
      
      copySuggestions = JSON.parse(cleanContent);
      console.log(`[media-generate-copys][${VERSION}] Parsed ${copySuggestions.length} copy suggestions`);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("First 500 chars:", content.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao processar copys da IA. Tente novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(copySuggestions)) {
      return new Response(
        JSON.stringify({ success: false, error: "Formato de copys inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================
    // UPDATE CALENDAR ITEMS WITH COPYS
    // ====================================
    let updatedCount = 0;
    let errorCount = 0;

    for (const suggestion of copySuggestions) {
      if (!suggestion.id) continue;

      const updateData: Record<string, unknown> = {};
      if (suggestion.copy) updateData.copy = suggestion.copy;
      if (suggestion.cta) updateData.cta = suggestion.cta;
      if (suggestion.hashtags && Array.isArray(suggestion.hashtags)) {
        updateData.hashtags = suggestion.hashtags;
      }
      if (suggestion.generation_prompt) {
        updateData.generation_prompt = suggestion.generation_prompt;
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error: updateError } = await supabase
        .from("media_calendar_items")
        .update(updateData)
        .eq("id", suggestion.id)
        .eq("campaign_id", campaign_id);

      if (updateError) {
        console.error(`Error updating item ${suggestion.id}:`, updateError);
        errorCount++;
      } else {
        updatedCount++;
      }
    }

    console.log(`[media-generate-copys][${VERSION}] Updated ${updatedCount} items, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        items_updated: updatedCount,
        errors: errorCount,
        message: `${updatedCount} copy(s) gerada(s) com sucesso!${errorCount > 0 ? ` (${errorCount} erro(s))` : ""}`,
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
