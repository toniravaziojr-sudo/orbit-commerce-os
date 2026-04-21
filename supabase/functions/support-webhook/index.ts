import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { errorResponse } from "../_shared/error-response.ts";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET for webhook verification (some platforms require this)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) {
      console.log("Webhook verification challenge received");
      return new Response(challenge, { status: 200 });
    }
    return new Response("OK", { status: 200 });
  }

  try {
    const bodyText = await req.text();
    console.log("[support-webhook] Raw body received:", bodyText.substring(0, 500));
    
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error("[support-webhook] Failed to parse body as JSON");
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const channelType = url.searchParams.get("channel") || "whatsapp";
    let tenantId = url.searchParams.get("tenant");

    console.log(`[support-webhook] Received for channel: ${channelType}, tenant param: ${tenantId}`);
    console.log("[support-webhook] Body keys:", Object.keys(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If no tenant_id in URL, try to resolve from instanceId or phone
    if (!tenantId && channelType === "whatsapp") {
      const instanceId = body.instanceId as string || body.instance_id as string;
      console.log("[support-webhook] Trying to resolve tenant from instanceId:", instanceId);
      
      if (instanceId) {
        const { data: whatsappConfig } = await supabase
          .from("whatsapp_configs")
          .select("tenant_id")
          .eq("instance_id", instanceId)
          .single();
        
        if (whatsappConfig) {
          tenantId = whatsappConfig.tenant_id;
          console.log("[support-webhook] Resolved tenant from instanceId:", tenantId);
        }
      }
      
      // Also try to resolve from phone number if still no tenant
      if (!tenantId) {
        const toPhone = (body.to as string || body.chatId as string)?.replace(/\D/g, "");
        console.log("[support-webhook] Trying to resolve tenant from phone:", toPhone);
        
        if (toPhone) {
          const { data: whatsappConfig } = await supabase
            .from("whatsapp_configs")
            .select("tenant_id")
            .eq("phone_number", toPhone)
            .single();
          
          if (whatsappConfig) {
            tenantId = whatsappConfig.tenant_id;
            console.log("[support-webhook] Resolved tenant from phone:", tenantId);
          }
        }
      }
    }
    
    if (!tenantId) {
      console.error("[support-webhook] Could not resolve tenant_id from any source");
      console.error("[support-webhook] Body for debugging:", JSON.stringify(body).substring(0, 1000));
      return new Response(
        JSON.stringify({ error: "tenant_id required", debug: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse webhook based on channel type
    let customerPhone: string | null = null;
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    let messageContent: string | null = null;
    let externalConversationId: string | null = null;
    let externalMessageId: string | null = null;
    let isFromMe = false;

    switch (channelType) {
      case "whatsapp": {
        // Check if message is from us (outgoing)
        isFromMe = body.fromMe === true || body.isFromMe === true;
        
        // Webhook format (phone field)
        if (body.phone) {
          customerPhone = (body.phone as string).replace(/\D/g, "");
          customerName = (body.senderName || body.pushName || body.contactName) as string || null;
          messageContent = (body.text as Record<string, unknown>)?.message as string || body.caption as string || body.body as string || null;
          externalMessageId = body.messageId as string || (body.id as Record<string, unknown>)?._serialized as string || null;
          externalConversationId = body.chatId as string || body.from as string || null;
        }
        // Also check for 'from' field
        else if (body.from) {
          customerPhone = (body.from as string).replace(/\D/g, "");
          customerName = (body.senderName || body.pushName || body.contactName) as string || null;
          messageContent = (body.text as Record<string, unknown>)?.message as string || body.message as string || body.body as string || null;
          externalMessageId = body.messageId as string || body.id as string || null;
          externalConversationId = body.chatId as string || null;
        }
        // Meta API webhook format
        else if ((body.entry as unknown[])?.[0]) {
          const entry = body.entry as Record<string, unknown>[];
          const changes = entry[0]?.changes as Record<string, unknown>[];
          const value = changes?.[0]?.value as Record<string, unknown>;
          const messages = value?.messages as Record<string, unknown>[];
          
          if (messages?.[0]) {
            const msg = messages[0];
            customerPhone = msg.from as string;
            messageContent = (msg.text as Record<string, unknown>)?.body as string || msg.caption as string || null;
            externalMessageId = msg.id as string;
            
            const contacts = value?.contacts as Record<string, unknown>[];
            const contact = contacts?.[0];
            customerName = (contact?.profile as Record<string, unknown>)?.name as string || null;
          }
        }
        break;
      }
      
      case "email": {
        customerEmail = body.from as string || body.sender as string || null;
        customerName = body.from_name as string || null;
        messageContent = body.text as string || body.body as string || body.html as string || null;
        externalMessageId = body.message_id as string || body.id as string || null;
        break;
      }

      case "instagram_dm":
      case "facebook_messenger": {
        const entry = body.entry as Record<string, unknown>[];
        const messaging = entry?.[0]?.messaging as Record<string, unknown>[];
        
        if (messaging?.[0]) {
          const event = messaging[0];
          const sender = event.sender as Record<string, unknown>;
          const message = event.message as Record<string, unknown>;
          
          externalConversationId = sender?.id as string;
          messageContent = message?.text as string || null;
          externalMessageId = message?.mid as string || null;
        }
        break;
      }

      case "chat": {
        // Widget chat
        customerName = body.customer_name as string || null;
        customerEmail = body.customer_email as string || null;
        messageContent = body.message as string || body.content as string || null;
        externalConversationId = body.session_id as string || null;
        break;
      }

      default:
        console.log(`[support-webhook] Unhandled channel type: ${channelType}`);
    }

    // Ignore messages sent by us
    if (isFromMe) {
      console.log("[support-webhook] Ignoring outgoing message (fromMe=true)");
      return new Response(
        JSON.stringify({ success: true, message: "Outgoing message ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messageContent) {
      console.log("[support-webhook] No message content found in webhook", JSON.stringify(body).substring(0, 500));
      return new Response(
        JSON.stringify({ success: true, message: "No content to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[support-webhook] Parsed:", { 
      customerPhone, 
      customerName, 
      messageContent: messageContent?.slice(0, 50),
      externalConversationId,
      externalMessageId
    });

    // Phase 1 — inbound desacoplado da decisão de IA.
    // Ordem: localizar/criar conversa SEM forçar status -> persistir mensagem
    // -> atualizar timestamps -> só então decidir IA via shared gate.
    let conversationId: string | null = null;
    let conversationStatus: string | null = null;
    let assignedTo: string | null = null;

    let conversationQuery = supabase
      .from("conversations")
      .select("id, status, assigned_to")
      .eq("tenant_id", tenantId)
      .eq("channel_type", channelType)
      .not("status", "in", "(resolved,spam)");

    if (externalConversationId) {
      conversationQuery = conversationQuery.eq("external_conversation_id", externalConversationId);
    } else if (customerPhone) {
      conversationQuery = conversationQuery.eq("customer_phone", customerPhone);
    } else if (customerEmail) {
      conversationQuery = conversationQuery.eq("customer_email", customerEmail);
    }

    const { data: existingConv } = await conversationQuery
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
      conversationStatus = existingConv.status;
      assignedTo = existingConv.assigned_to;
      console.log(`[support-webhook] Found existing conversation: ${conversationId}, status: ${conversationStatus}, assigned: ${!!assignedTo}`);
    } else {
      // NEW conversation: decide initial status using shared gate
      const initialDecision = await shouldAiRespond({
        supabase,
        tenant_id: tenantId,
        channel_type: channelType,
      });

      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          tenant_id: tenantId,
          channel_type: channelType,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_name: customerName,
          external_conversation_id: externalConversationId,
          status: initialDecision.initial_status_for_new_conversation,
          priority: 0,
        })
        .select("id, status")
        .single();

      if (convError) {
        console.error("[support-webhook] Error creating conversation:", convError);
        throw convError;
      }

      conversationId = newConv.id;
      conversationStatus = newConv.status;
      console.log(`[support-webhook] Created new conversation: ${conversationId} status=${conversationStatus}`);

      await supabase.from("conversation_events").insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        event_type: "conversation_created",
        description: `Nova conversa iniciada via ${channelType}`,
        metadata: { channel: channelType, customer_phone: customerPhone },
      });
    }

    // Idempotência por external_message_id
    if (externalMessageId) {
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("external_message_id", externalMessageId)
        .maybeSingle();

      if (existingMsg) {
        console.log(`[support-webhook] Duplicate message ignored: ${externalMessageId}`);
        return new Response(
          JSON.stringify({ success: true, message: "Duplicate message" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Persistir mensagem inbound (sempre — não depende de IA)
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction: "inbound",
        sender_type: "customer",
        sender_name: customerName,
        content: messageContent,
        content_type: "text",
        delivery_status: "delivered",
        external_message_id: externalMessageId,
        is_internal: false,
        is_note: false,
      })
      .select("id")
      .single();

    if (msgError) {
      console.error("[support-webhook] Error creating message:", msgError);
      throw msgError;
    }

    console.log(`[support-webhook] Message created: ${newMessage.id}`);

    // CRITICAL (Phase 1): NEVER reset status here. Only update timestamps.
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_customer_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    // === Decisão de IA via shared gate ===
    const decision = await shouldAiRespond({
      supabase,
      tenant_id: tenantId,
      channel_type: channelType,
      conversation: {
        id: conversationId,
        status: conversationStatus,
        assigned_to: assignedTo,
      },
    });

    if (decision.should_respond) {
      console.log("[support-webhook] AI gate=GREEN, invoking ai-support-chat...");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const aiRes = await invokeAiSupportChat(supabaseUrl, serviceRoleKey, {
        conversation_id: conversationId,
        tenant_id: tenantId,
      });
      console.log(`[support-webhook] AI response (${aiRes.status}):`, aiRes.bodyText);
    } else {
      console.log(`[support-webhook] AI gate=BLOCKED reason=${decision.reason}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversationId,
        message_id: newMessage.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[support-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
