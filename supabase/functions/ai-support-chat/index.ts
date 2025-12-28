import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIRule {
  id: string;
  condition: string;
  action: 'respond' | 'transfer' | 'escalate' | 'suggest';
  response?: string;
  priority: number;
  is_active: boolean;
  category: string;
}

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
      .maybeSingle();

    // If no config exists, create default and use it
    const effectiveConfig = aiConfig || {
      is_enabled: true,
      personality_name: "Assistente",
      personality_tone: "friendly",
      use_emojis: true,
      auto_import_products: true,
      auto_import_categories: true,
      auto_import_policies: true,
      max_response_length: 500,
      rules: [],
    };

    if (effectiveConfig.is_enabled === false) {
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
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Build store URL
    let storeUrl = "";
    if (customDomain?.domain) {
      storeUrl = `https://${customDomain.domain}`;
    } else if (tenant?.slug) {
      storeUrl = `https://${tenant.slug}.shops.comandocentral.com.br`;
    }

    // ============================================
    // BUILD COMPREHENSIVE STORE CONTEXT
    // ============================================
    let storeContext = "";
    const storeName = storeSettings?.store_name || tenant?.name || "Nossa Loja";

    // Basic store info
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
    if (storeSettings?.whatsapp_number) {
      storeContext += `- WhatsApp: ${storeSettings.whatsapp_number}\n`;
    }
    if (storeSettings?.address) {
      storeContext += `- Endereço: ${storeSettings.address}\n`;
    }

    // Store policies
    if (effectiveConfig.auto_import_policies) {
      if (storeSettings?.return_policy) {
        storeContext += `\n### Política de Trocas e Devoluções:\n${storeSettings.return_policy.slice(0, 1000)}\n`;
      }
      if (storeSettings?.shipping_policy) {
        storeContext += `\n### Política de Frete:\n${storeSettings.shipping_policy.slice(0, 1000)}\n`;
      }
      if (storeSettings?.privacy_policy) {
        storeContext += `\n### Política de Privacidade (resumo):\n${storeSettings.privacy_policy.slice(0, 500)}\n`;
      }
    }

    // Products
    if (effectiveConfig.auto_import_products) {
      const { data: products } = await supabase
        .from("products")
        .select("name, price, compare_at_price, description, slug, sku")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .limit(100);

      if (products?.length) {
        storeContext += "\n### Catálogo de Produtos:\n";
        storeContext += products
          .map(p => {
            let productInfo = `- ${p.name}`;
            if (p.sku) productInfo += ` (SKU: ${p.sku})`;
            productInfo += `: R$ ${p.price?.toFixed(2)}`;
            if (p.compare_at_price && p.compare_at_price > p.price) {
              productInfo += ` (antes R$ ${p.compare_at_price.toFixed(2)})`;
            }
            if (p.description) {
              productInfo += ` - ${p.description.slice(0, 100)}`;
            }
            if (storeUrl && p.slug) {
              productInfo += ` | Link: ${storeUrl}/produto/${p.slug}`;
            }
            return productInfo;
          })
          .join("\n");
      }
    }

    // Categories
    if (effectiveConfig.auto_import_categories) {
      const { data: categories } = await supabase
        .from("categories")
        .select("name, description, slug")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true);

      if (categories?.length) {
        storeContext += "\n\n### Categorias da loja:\n";
        storeContext += categories.map(c => {
          let catInfo = `- ${c.name}`;
          if (c.description) catInfo += `: ${c.description}`;
          if (storeUrl && c.slug) catInfo += ` | Link: ${storeUrl}/categoria/${c.slug}`;
          return catInfo;
        }).join("\n");
      }
    }

    // Landing Pages
    const { data: landingPages } = await supabase
      .from("landing_pages")
      .select("title, slug, description")
      .eq("tenant_id", tenant_id)
      .eq("is_published", true)
      .limit(20);

    if (landingPages?.length) {
      storeContext += "\n\n### Páginas especiais/promoções:\n";
      storeContext += landingPages.map(lp => {
        let pageInfo = `- ${lp.title}`;
        if (lp.description) pageInfo += `: ${lp.description.slice(0, 100)}`;
        if (storeUrl && lp.slug) pageInfo += ` | Link: ${storeUrl}/lp/${lp.slug}`;
        return pageInfo;
      }).join("\n");
    }

    // Store Pages
    const { data: storePages } = await supabase
      .from("store_pages")
      .select("title, slug")
      .eq("tenant_id", tenant_id)
      .eq("is_published", true)
      .limit(20);

    if (storePages?.length) {
      storeContext += "\n\n### Páginas institucionais:\n";
      storeContext += storePages.map(sp => {
        let pageInfo = `- ${sp.title}`;
        if (storeUrl && sp.slug) pageInfo += ` | Link: ${storeUrl}/pagina/${sp.slug}`;
        return pageInfo;
      }).join("\n");
    }

    // ============================================
    // CUSTOMER CONTEXT (if identified)
    // ============================================
    let customerContext = "";
    let customerId: string | null = null;

    // Try to find customer by phone or email
    if (conversation.customer_phone || conversation.customer_email) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, total_orders, total_spent, first_order_at, last_order_at, loyalty_tier")
        .eq("tenant_id", tenant_id)
        .or(`phone.eq.${conversation.customer_phone},email.eq.${conversation.customer_email}`)
        .maybeSingle();

      if (customer) {
        customerId = customer.id;
        customerContext += `\n\n### Dados do cliente:\n`;
        customerContext += `- Nome: ${customer.full_name}\n`;
        if (customer.email) customerContext += `- Email: ${customer.email}\n`;
        if (customer.phone) customerContext += `- Telefone: ${customer.phone}\n`;
        if (customer.total_orders) customerContext += `- Total de pedidos: ${customer.total_orders}\n`;
        if (customer.total_spent) customerContext += `- Total gasto: R$ ${customer.total_spent.toFixed(2)}\n`;
        if (customer.first_order_at) customerContext += `- Cliente desde: ${new Date(customer.first_order_at).toLocaleDateString('pt-BR')}\n`;
        if (customer.loyalty_tier) customerContext += `- Nível de fidelidade: ${customer.loyalty_tier}\n`;

        // Get recent orders for this customer
        const { data: recentOrders } = await supabase
          .from("orders")
          .select("order_number, status, payment_status, shipping_status, total, created_at, tracking_code")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentOrders?.length) {
          customerContext += `\n### Últimos pedidos do cliente:\n`;
          customerContext += recentOrders.map(o => {
            let orderInfo = `- Pedido #${o.order_number}`;
            orderInfo += ` | Status: ${o.status}`;
            orderInfo += ` | Pagamento: ${o.payment_status}`;
            if (o.shipping_status) orderInfo += ` | Envio: ${o.shipping_status}`;
            orderInfo += ` | Total: R$ ${o.total?.toFixed(2)}`;
            orderInfo += ` | Data: ${new Date(o.created_at).toLocaleDateString('pt-BR')}`;
            if (o.tracking_code) orderInfo += ` | Rastreio: ${o.tracking_code}`;
            return orderInfo;
          }).join("\n");
        }
      }
    }

    // ============================================
    // CHECK AI RULES
    // ============================================
    const lastCustomerMessage = messages?.filter(m => m.sender_type === "customer").pop();
    const lastMessageContent = lastCustomerMessage?.content?.toLowerCase() || "";
    
    let matchedRule: AIRule | null = null;
    let shouldHandoff = false;
    let forceResponse: string | null = null;

    // Process rules
    const rules: AIRule[] = Array.isArray(effectiveConfig.rules) ? effectiveConfig.rules : [];
    const activeRules = rules.filter(r => r.is_active).sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      // Check if rule condition matches (simple keyword matching)
      const conditionKeywords = rule.condition.toLowerCase().split(/[,;]/).map(k => k.trim()).filter(Boolean);
      const matches = conditionKeywords.some(kw => lastMessageContent.includes(kw));
      
      if (matches) {
        matchedRule = rule;
        console.log(`Rule matched: ${rule.id} - ${rule.condition} -> ${rule.action}`);
        
        if (rule.action === 'transfer' || rule.action === 'escalate') {
          shouldHandoff = true;
        }
        if ((rule.action === 'respond' || rule.action === 'suggest') && rule.response) {
          forceResponse = rule.response;
        }
        break; // First matching rule wins (by priority)
      }
    }

    // Also check handoff keywords
    if (!shouldHandoff && effectiveConfig.handoff_keywords?.length && lastMessageContent) {
      shouldHandoff = effectiveConfig.handoff_keywords.some(
        (kw: string) => lastMessageContent.includes(kw.toLowerCase())
      );
    }

    // ============================================
    // BUILD SYSTEM PROMPT
    // ============================================
    const personalityTone = effectiveConfig.personality_tone || "amigável e profissional";
    const personalityName = effectiveConfig.personality_name || "Assistente";
    const maxLength = effectiveConfig.max_response_length || 500;

    let systemPrompt = effectiveConfig.system_prompt || `Você é ${personalityName}, assistente virtual de atendimento ao cliente da loja ${storeName}.

Seu tom de comunicação é: ${personalityTone}.

DIRETRIZES IMPORTANTES:
- Seja sempre educado, prestativo e objetivo
- Use as informações da loja fornecidas para responder com precisão
- Limite suas respostas a aproximadamente ${maxLength} caracteres
- Se não souber a resposta com certeza, diga que vai verificar com a equipe
- NUNCA invente informações sobre produtos, preços, prazos ou políticas
- Se o cliente perguntar sobre um pedido, use os dados fornecidos
- Sempre forneça links quando relevante (produtos, categorias, páginas)
- Personalize o atendimento usando o nome do cliente quando disponível`;

    // Add custom knowledge
    if (effectiveConfig.custom_knowledge) {
      systemPrompt += `\n\n### Conhecimento adicional da loja:\n${effectiveConfig.custom_knowledge}`;
    }

    // Add store context
    systemPrompt += storeContext;

    // Add customer context
    if (customerContext) {
      systemPrompt += customerContext;
    }

    // Add rules context for AI
    if (activeRules.length > 0) {
      systemPrompt += `\n\n### Regras de atendimento:\n`;
      systemPrompt += activeRules.map(r => {
        let ruleText = `- Quando: "${r.condition}"`;
        if (r.action === 'transfer') ruleText += ' → Sugira falar com um atendente humano';
        if (r.action === 'escalate') ruleText += ' → Trate com urgência e transfira para humano';
        if (r.action === 'respond' && r.response) ruleText += ` → Responda: "${r.response}"`;
        return ruleText;
      }).join("\n");
    }

    // Add forbidden topics
    if (effectiveConfig.forbidden_topics?.length) {
      systemPrompt += `\n\n### Tópicos que você NÃO deve abordar:\n${effectiveConfig.forbidden_topics.join(", ")}`;
    }

    // Add emoji preference
    if (effectiveConfig.use_emojis) {
      systemPrompt += "\n\nVocê pode usar emojis moderadamente para tornar a conversa mais amigável.";
    } else {
      systemPrompt += "\n\nNão use emojis nas suas respostas.";
    }

    // ============================================
    // BUILD CONVERSATION HISTORY
    // ============================================
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation context
    if (conversation.customer_name) {
      aiMessages.push({
        role: "system",
        content: `O cliente nesta conversa se chama ${conversation.customer_name}. ${conversation.summary ? `Resumo da conversa: ${conversation.summary}` : ""} Canal: ${conversation.channel_type}.`,
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

    // ============================================
    // CALL AI OR USE FORCED RESPONSE
    // ============================================
    let aiContent: string;
    const aiModel = effectiveConfig.ai_model || "google/gemini-2.5-flash";

    if (forceResponse && matchedRule?.action === 'respond') {
      // Use the rule's predefined response
      aiContent = forceResponse;
      console.log(`Using rule-based response for rule: ${matchedRule.id}`);
    } else {
      // Call Lovable AI Gateway
      console.log(`Calling AI with model: ${aiModel}, messages: ${aiMessages.length}, context length: ${systemPrompt.length}`);

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
      aiContent = aiData.choices?.[0]?.message?.content;

      if (!aiContent) {
        console.error("No content in AI response:", aiData);
        return new Response(
          JSON.stringify({ error: "IA não retornou resposta" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============================================
    // SAVE AND SEND RESPONSE
    // ============================================
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
        ai_model_used: forceResponse ? "rule-based" : aiModel,
        ai_confidence: forceResponse ? 1.0 : 0.9,
        ai_context_used: { 
          products: effectiveConfig.auto_import_products, 
          categories: effectiveConfig.auto_import_categories,
          customer_id: customerId,
          matched_rule: matchedRule?.id,
        },
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
        customer_id: customerId || conversation.customer_id,
      })
      .eq("id", conversation_id);

    // Log event
    await supabase.from("conversation_events").insert({
      conversation_id,
      tenant_id,
      event_type: "ai_response",
      actor_type: "bot",
      actor_name: personalityName,
      description: shouldHandoff 
        ? "IA respondeu e sugeriu handoff para humano" 
        : matchedRule 
          ? `IA respondeu usando regra: ${matchedRule.condition}` 
          : "IA respondeu automaticamente",
      metadata: { 
        model: forceResponse ? "rule-based" : aiModel, 
        handoff: shouldHandoff,
        matched_rule: matchedRule?.id,
      },
    });

    // Send response via original channel
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
      console.log(`Email response to ${conversation.customer_email} - not implemented yet`);
      sendResult = { success: false, error: "Email outbound não implementado" };
    } else if (conversation.channel_type === "chat") {
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
        matched_rule: matchedRule?.id,
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
