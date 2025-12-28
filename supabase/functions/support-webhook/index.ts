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

  // Handle GET for webhook verification (some platforms require this)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) {
      console.log("Webhook verification challenge received");
      return new Response(challenge, { status: 200 });
    }
  }

  try {
    const body = await req.json();
    const url = new URL(req.url);
    const channelType = url.searchParams.get("channel") || "whatsapp";
    const tenantId = url.searchParams.get("tenant");

    console.log(`Support webhook received for channel: ${channelType}`, { tenantId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine tenant from webhook data or query param
    let resolvedTenantId = tenantId;
    
    if (!resolvedTenantId) {
      // Try to resolve from phone number or other identifiers
      console.warn("No tenant_id provided in webhook");
      return new Response(
        JSON.stringify({ error: "tenant_id required" }),
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

    switch (channelType) {
      case "whatsapp": {
        // Z-API webhook format
        if (body.phone) {
          customerPhone = body.phone.replace(/\D/g, "");
          customerName = body.senderName || body.pushName || null;
          messageContent = body.text?.message || body.caption || body.body || null;
          externalMessageId = body.messageId || body.id?._serialized || null;
          externalConversationId = body.chatId || body.from || null;
        }
        // Meta API webhook format
        else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
          const msg = body.entry[0].changes[0].value.messages[0];
          customerPhone = msg.from;
          messageContent = msg.text?.body || msg.caption || null;
          externalMessageId = msg.id;
          
          const contact = body.entry[0].changes[0].value.contacts?.[0];
          customerName = contact?.profile?.name || null;
        }
        break;
      }
      
      case "email": {
        customerEmail = body.from || body.sender || null;
        customerName = body.from_name || null;
        messageContent = body.text || body.body || body.html || null;
        externalMessageId = body.message_id || body.id || null;
        break;
      }

      case "instagram_dm":
      case "facebook_messenger": {
        if (body.entry?.[0]?.messaging?.[0]) {
          const event = body.entry[0].messaging[0];
          externalConversationId = event.sender?.id;
          messageContent = event.message?.text || null;
          externalMessageId = event.message?.mid || null;
        }
        break;
      }

      default:
        console.log(`Unhandled channel type: ${channelType}`);
    }

    if (!messageContent) {
      console.log("No message content found in webhook", body);
      return new Response(
        JSON.stringify({ success: true, message: "No content to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Parsed webhook:", { customerPhone, customerName, messageContent: messageContent?.slice(0, 50) });

    // Find or create conversation
    let conversationId: string | null = null;

    // Try to find existing conversation
    const conversationQuery = supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", resolvedTenantId)
      .eq("channel_type", channelType)
      .neq("status", "resolved")
      .order("last_message_at", { ascending: false })
      .limit(1);

    if (externalConversationId) {
      conversationQuery.eq("external_conversation_id", externalConversationId);
    } else if (customerPhone) {
      conversationQuery.eq("customer_phone", customerPhone);
    } else if (customerEmail) {
      conversationQuery.eq("customer_email", customerEmail);
    }

    const { data: existingConv } = await conversationQuery.single();

    if (existingConv) {
      conversationId = existingConv.id;
      console.log(`Found existing conversation: ${conversationId}`);
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          tenant_id: resolvedTenantId,
          channel_type: channelType,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_name: customerName,
          external_conversation_id: externalConversationId,
          status: "new",
          priority: 0,
        })
        .select("id")
        .single();

      if (convError) {
        console.error("Error creating conversation:", convError);
        throw convError;
      }

      conversationId = newConv.id;
      console.log(`Created new conversation: ${conversationId}`);

      // Log conversation created event
      await supabase.from("conversation_events").insert({
        conversation_id: conversationId,
        tenant_id: resolvedTenantId,
        event_type: "conversation_created",
        description: `Nova conversa iniciada via ${channelType}`,
        metadata: { channel: channelType },
      });
    }

    // Check for duplicate message
    if (externalMessageId) {
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("external_message_id", externalMessageId)
        .single();

      if (existingMsg) {
        console.log(`Duplicate message ignored: ${externalMessageId}`);
        return new Response(
          JSON.stringify({ success: true, message: "Duplicate message" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create message
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        tenant_id: resolvedTenantId,
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
      console.error("Error creating message:", msgError);
      throw msgError;
    }

    console.log(`Message created: ${newMessage.id}`);

    // Check if AI auto-response is enabled
    const { data: aiConfig } = await supabase
      .from("ai_support_config")
      .select("is_enabled")
      .eq("tenant_id", resolvedTenantId)
      .single();

    // Get conversation to check status
    const { data: conversation } = await supabase
      .from("conversations")
      .select("status, assigned_to")
      .eq("id", conversationId)
      .single();

    // Trigger AI response if:
    // - AI is enabled
    // - Conversation is not assigned to human agent
    // - Conversation status is new or bot
    if (
      aiConfig?.is_enabled &&
      !conversation?.assigned_to &&
      ["new", "bot"].includes(conversation?.status || "new")
    ) {
      console.log("Triggering AI response...");
      
      // Call AI chat function asynchronously
      supabase.functions.invoke("ai-support-chat", {
        body: {
          conversation_id: conversationId,
          tenant_id: resolvedTenantId,
        },
      }).then(({ data, error }) => {
        if (error) {
          console.error("AI response error:", error);
        } else {
          console.log("AI response triggered:", data);
        }
      });
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
    console.error("Support webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
