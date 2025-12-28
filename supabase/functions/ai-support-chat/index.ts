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
    const { conversation_id, tenant_id } = await req.json();

    if (!conversation_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id and tenant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get AI config for tenant
    const { data: aiConfig } = await supabase
      .from("ai_support_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (!aiConfig?.is_enabled) {
      return new Response(
        JSON.stringify({ error: "AI support is disabled for this tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      console.error("Conversation not found:", convError);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent messages for context
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Get tenant/store information
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .single();

    // Get custom domain if exists
    const { data: customDomain } = await supabase
      .from("custom_domains")
      .select("domain, status, ssl_active")
      .eq("tenant_id", tenant_id)
      .eq("status", "verified")
      .eq("ssl_active", true)
      .maybeSingle();

    // Get store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, contact_email, contact_phone, address, return_policy, shipping_policy, privacy_policy")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Build store URL
    let storeUrl = "";
    if (customDomain?.domain) {
      storeUrl = `https://${customDomain.domain}`;
    } else if (tenant?.slug) {
      storeUrl = `https://${tenant.slug}.shops.comandocentral.com.br`;
    }

    // Build context from store data
    let storeContext = "";

    // Add store basic info
    const storeName = storeSettings?.store_name || tenant?.name || "Nossa Loja";
    storeContext += `\n\n### Informações da loja:\n`;
    storeContext += `- Nome da loja: ${storeName}\n`;
    if (storeUrl) {
      storeContext += `- Site: ${storeUrl}\n`;
    }
    if (storeSettings?.contact_email) {
      storeContext += `- Email de contato: ${storeSettings.contact_email}\n`;
    }
    if (storeSettings?.contact_phone) {
      storeContext += `- Telefone de contato: ${storeSettings.contact_phone}\n`;
    }
    if (storeSettings?.address) {
      storeContext += `- Endereço: ${storeSettings.address}\n`;
    }

    // Add policies if available
    if (storeSettings?.return_policy) {
      storeContext += `\n### Política de Trocas e Devoluções:\n${storeSettings.return_policy.slice(0, 500)}`;
    }
    if (storeSettings?.shipping_policy) {
      storeContext += `\n### Política de Frete:\n${storeSettings.shipping_policy.slice(0, 500)}`;
    }

    // Get products if auto-import is enabled
    if (aiConfig.auto_import_products) {
      const { data: products } = await supabase
        .from("products")
        .select("name, price, description, slug")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .limit(50);

      if (products?.length) {
        storeContext += "\n\n### Produtos disponíveis:\n";
        storeContext += products
          .map(p => `- ${p.name}: R$ ${p.price?.toFixed(2)} - ${p.description?.slice(0, 100) || "Sem descrição"}${storeUrl ? ` (${storeUrl}/produto/${p.slug})` : ""}`)
          .join("\n");
      }
    }

    // Get categories if enabled
    if (aiConfig.auto_import_categories) {
      const { data: categories } = await supabase
        .from("categories")
        .select("name, description")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true);

      if (categories?.length) {
        storeContext += "\n\n### Categorias da loja:\n";
        storeContext += categories.map(c => `- ${c.name}: ${c.description || ""}`).join("\n");
      }
    }

    // Build system prompt
    const personalityTone = aiConfig.personality_tone || "profissional e amigável";
    const personalityName = aiConfig.personality_name || "Assistente";
    const maxLength = aiConfig.max_response_length || 500;

    let systemPrompt = aiConfig.system_prompt || `Você é ${personalityName}, assistente virtual de atendimento ao cliente.

Seu tom de comunicação é: ${personalityTone}.

Diretrizes:
- Seja sempre educado e prestativo
- Responda de forma clara e objetiva
- Limite suas respostas a ${maxLength} caracteres quando possível
- Se não souber a resposta, diga que vai verificar e retornar
- Não invente informações sobre produtos ou políticas
- Sempre tente ajudar o cliente a encontrar o que precisa`;

    // Add custom knowledge
    if (aiConfig.custom_knowledge) {
      systemPrompt += `\n\n### Conhecimento adicional:\n${aiConfig.custom_knowledge}`;
    }

    // Add store context
    if (storeContext) {
      systemPrompt += `\n\n### Informações da loja:${storeContext}`;
    }

    // Add forbidden topics
    if (aiConfig.forbidden_topics?.length) {
      systemPrompt += `\n\n### Tópicos que você NÃO deve abordar:\n${aiConfig.forbidden_topics.join(", ")}`;
    }

    // Add handoff keywords
    if (aiConfig.handoff_keywords?.length) {
      systemPrompt += `\n\n### Quando o cliente mencionar estas palavras, sugira falar com um atendente humano:\n${aiConfig.handoff_keywords.join(", ")}`;
    }

    // Add emoji preference
    if (aiConfig.use_emojis) {
      systemPrompt += "\n\nVocê pode usar emojis moderadamente para tornar a conversa mais amigável.";
    } else {
      systemPrompt += "\n\nNão use emojis nas suas respostas.";
    }

    // Build conversation history for AI
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation context
    if (conversation.customer_name) {
      aiMessages.push({
        role: "system",
        content: `Contexto: O cliente se chama ${conversation.customer_name}. ${conversation.summary ? `Resumo: ${conversation.summary}` : ""}`,
      });
    }

    // Add message history
    if (messages?.length) {
      for (const msg of messages) {
        if (msg.is_internal || msg.is_note) continue;
        
        aiMessages.push({
          role: msg.sender_type === "customer" ? "user" : "assistant",
          content: msg.content || "",
        });
      }
    }

    // Call Lovable AI Gateway
    const aiModel = aiConfig.ai_model || "google/gemini-2.5-flash";
    
    console.log(`Calling AI with model: ${aiModel}, messages: ${aiMessages.length}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: aiMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao gerar resposta da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in AI response:", aiData);
      return new Response(
        JSON.stringify({ error: "IA não retornou resposta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for handoff keywords in customer's last message
    let shouldHandoff = false;
    const lastCustomerMessage = messages?.filter(m => m.sender_type === "customer").pop();
    
    if (lastCustomerMessage?.content && aiConfig.handoff_keywords?.length) {
      const lowerContent = lastCustomerMessage.content.toLowerCase();
      shouldHandoff = aiConfig.handoff_keywords.some(
        (kw: string) => lowerContent.includes(kw.toLowerCase())
      );
    }

    // Save AI response as message
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        tenant_id,
        direction: "outbound",
        sender_type: "bot",
        sender_name: personalityName,
        content: aiContent,
        content_type: "text",
        delivery_status: "queued",
        is_ai_generated: true,
        is_internal: false,
        is_note: false,
        ai_model_used: aiModel,
        ai_confidence: 0.9,
        ai_context_used: { products: aiConfig.auto_import_products, categories: aiConfig.auto_import_categories },
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error saving AI message:", msgError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar resposta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update conversation status
    const newStatus = shouldHandoff ? "waiting_agent" : "bot";
    await supabase
      .from("conversations")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation_id);

    // Log event
    await supabase.from("conversation_events").insert({
      conversation_id,
      tenant_id,
      event_type: "ai_response",
      actor_type: "bot",
      actor_name: personalityName,
      description: shouldHandoff ? "IA respondeu e sugeriu handoff para humano" : "IA respondeu automaticamente",
      metadata: { model: aiModel, handoff: shouldHandoff },
    });

    // Send response back via the original channel
    let sendResult: { success: boolean; error?: string; message_id?: string } = { success: false, error: "Canal não suportado" };

    if (conversation.channel_type === "whatsapp" && conversation.customer_phone) {
      console.log(`Sending WhatsApp response to ${conversation.customer_phone}...`);
      
      try {
        const sendResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              tenant_id,
              phone: conversation.customer_phone,
              message: aiContent,
            }),
          }
        );

        sendResult = await sendResponse.json();
        console.log("WhatsApp send result:", sendResult);

        // Update message delivery status
        const deliveryStatus = sendResult.success ? "sent" : "failed";
        await supabase
          .from("messages")
          .update({ 
            delivery_status: deliveryStatus,
            external_message_id: sendResult.message_id || null,
            failure_reason: sendResult.success ? null : sendResult.error,
          })
          .eq("id", newMessage.id);

      } catch (sendError) {
        console.error("Error sending WhatsApp message:", sendError);
        sendResult = { success: false, error: sendError instanceof Error ? sendError.message : "Erro ao enviar" };
        
        await supabase
          .from("messages")
          .update({ 
            delivery_status: "failed",
            failure_reason: sendResult.error,
          })
          .eq("id", newMessage.id);
      }
    } else if (conversation.channel_type === "email" && conversation.customer_email) {
      // Email sending would go through support-send-message or a dedicated email function
      console.log(`Email response to ${conversation.customer_email} - not implemented yet`);
      sendResult = { success: false, error: "Email outbound não implementado" };
    } else if (conversation.channel_type === "chat") {
      // Chat widget - message is already saved, client will receive via realtime
      sendResult = { success: true, error: undefined };
      await supabase
        .from("messages")
        .update({ delivery_status: "delivered" })
        .eq("id", newMessage.id);
    }

    console.log(`AI response saved and ${sendResult.success ? "sent" : "failed to send"} for conversation ${conversation_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: newMessage,
        handoff: shouldHandoff,
        sent: sendResult.success,
        send_error: sendResult.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI support chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
