import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256: string; caption?: string };
        audio?: { id: string; mime_type: string };
        video?: { id: string; mime_type: string };
        document?: { id: string; filename: string; mime_type: string };
        location?: { latitude: number; longitude: number; name?: string; address?: string };
        button?: { text: string; payload: string };
        interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-webhook][${traceId}] Request received: ${req.method}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET request: Webhook verification (Meta challenge)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      console.log(`[meta-whatsapp-webhook][${traceId}] Verification request - mode: ${mode}, token: ${token?.substring(0, 8)}...`);

      // Get verify token from platform credentials
      const { data: credential } = await supabase
        .from("platform_credentials")
        .select("credential_value")
        .eq("credential_key", "META_WEBHOOK_VERIFY_TOKEN")
        .eq("is_active", true)
        .single();

      const verifyToken = credential?.credential_value;

      if (mode === "subscribe" && token === verifyToken) {
        console.log(`[meta-whatsapp-webhook][${traceId}] Verification successful`);
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      } else {
        console.error(`[meta-whatsapp-webhook][${traceId}] Verification failed - token mismatch`);
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
    }

    // POST request: Receive messages and events
    if (req.method === "POST") {
      const payload: WhatsAppWebhookPayload = await req.json();
      console.log(`[meta-whatsapp-webhook][${traceId}] Webhook payload received:`, JSON.stringify(payload).substring(0, 500));

      if (payload.object !== "whatsapp_business_account") {
        console.log(`[meta-whatsapp-webhook][${traceId}] Ignoring non-WhatsApp event`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const phoneNumberId = value.metadata?.phone_number_id;

          if (!phoneNumberId) {
            console.error(`[meta-whatsapp-webhook][${traceId}] No phone_number_id in payload`);
            continue;
          }

          // Route to tenant by phone_number_id
          let tenantId: string | null = null;

          // First try: whatsapp_configs (production connections)
          const { data: config } = await supabase
            .from("whatsapp_configs")
            .select("tenant_id")
            .eq("phone_number_id", phoneNumberId)
            .eq("provider", "meta")
            .single();

          if (config) {
            tenantId = config.tenant_id;
            console.log(`[meta-whatsapp-webhook][${traceId}] Routed via whatsapp_configs to tenant: ${tenantId}`);
          }

          // Second try: test mode - check platform_credentials for test tenant
          if (!tenantId) {
            const { data: testConfig } = await supabase
              .from("platform_credentials")
              .select("credential_value")
              .eq("credential_key", "META_WHATSAPP_TEST_TENANT_ID")
              .eq("is_active", true)
              .single();

            const { data: testPhoneConfig } = await supabase
              .from("platform_credentials")
              .select("credential_value")
              .eq("credential_key", "META_WHATSAPP_TEST_PHONE_NUMBER_ID")
              .eq("is_active", true)
              .single();

            // If this phone_number_id matches the test config, route to test tenant
            if (testConfig && testPhoneConfig && testPhoneConfig.credential_value === phoneNumberId) {
              tenantId = testConfig.credential_value;
              console.log(`[meta-whatsapp-webhook][${traceId}] Routed via TEST MODE to tenant: ${tenantId}`);
            }
          }

          if (!tenantId) {
            console.error(`[meta-whatsapp-webhook][${traceId}] No tenant found for phone_number_id: ${phoneNumberId}`);
            continue;
          }

          console.log(`[meta-whatsapp-webhook][${traceId}] Processing messages for tenant: ${tenantId}`);

          // Process messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const contact = value.contacts?.[0];
              const customerPhone = message.from;
              const customerName = contact?.profile?.name || customerPhone;
              
              let messageContent = "";
              let messageType = message.type;
              let mediaUrl = null;

              if (message.type === "text" && message.text) {
                messageContent = message.text.body;
              } else if (message.type === "button" && message.button) {
                messageContent = message.button.text;
              } else if (message.type === "interactive" && message.interactive) {
                messageContent = message.interactive.button_reply?.title || 
                                message.interactive.list_reply?.title || "";
              } else if (message.type === "image" && message.image) {
                messageContent = message.image.caption || "[Imagem]";
                // TODO: Fetch media URL from Meta API
              } else if (message.type === "audio") {
                messageContent = "[Áudio]";
              } else if (message.type === "video") {
                messageContent = "[Vídeo]";
              } else if (message.type === "document" && message.document) {
                messageContent = `[Documento: ${message.document.filename}]`;
              } else if (message.type === "location" && message.location) {
                messageContent = `[Localização: ${message.location.latitude}, ${message.location.longitude}]`;
              }

              // Save inbound message (for audit/logs)
              const { error: insertError } = await supabase
                .from("whatsapp_inbound_messages")
                .insert({
                  tenant_id: tenantId,
                  provider: "meta",
                  external_message_id: message.id,
                  from_phone: customerPhone,
                  to_phone: value.metadata.display_phone_number,
                  message_type: messageType,
                  message_content: messageContent,
                  media_url: mediaUrl,
                  timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                  raw_payload: message,
                });

              if (insertError) {
                console.error(`[meta-whatsapp-webhook][${traceId}] Failed to save inbound message:`, insertError);
              }

              // === INTEGRATION WITH SUPPORT MODULE ===
              // Find or create conversation for this customer
              let conversationId: string | null = null;

              // Try to find existing open conversation for this phone
              const { data: existingConv } = await supabase
                .from("conversations")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("customer_phone", customerPhone)
                .eq("channel_type", "whatsapp")
                .in("status", ["new", "open", "waiting_customer", "waiting_agent", "bot"])
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (existingConv) {
                conversationId = existingConv.id;
                console.log(`[meta-whatsapp-webhook][${traceId}] Found existing conversation: ${conversationId}`);
              } else {
                // Create new conversation
                const { data: newConv, error: convError } = await supabase
                  .from("conversations")
                  .insert({
                    tenant_id: tenantId,
                    channel_type: "whatsapp",
                    customer_phone: customerPhone,
                    customer_name: customerName,
                    external_conversation_id: `meta_${customerPhone}`,
                    status: "new",
                    priority: 1,
                    subject: `WhatsApp - ${customerName}`,
                    last_message_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (convError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] Failed to create conversation:`, convError);
                } else {
                  conversationId = newConv.id;
                  console.log(`[meta-whatsapp-webhook][${traceId}] Created new conversation: ${conversationId}`);
                }
              }

              // Insert message into conversations module
              if (conversationId) {
                const { error: msgError } = await supabase
                  .from("messages")
                  .insert({
                    conversation_id: conversationId,
                    tenant_id: tenantId,
                    direction: "inbound",
                    sender_type: "customer",
                    sender_id: null,
                    sender_name: customerName,
                    content: messageContent,
                    content_type: messageType === "text" ? "text" : messageType,
                    delivery_status: "delivered",
                    is_ai_generated: false,
                    is_internal: false,
                    is_note: false,
                  });

                if (msgError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] Failed to create message:`, msgError);
                } else {
                  console.log(`[meta-whatsapp-webhook][${traceId}] Message created in support module`);
                  
                  // Update conversation last_message_at
                  await supabase
                    .from("conversations")
                    .update({ 
                      last_message_at: new Date().toISOString(),
                      status: "new" // Reset to new when customer sends message
                    })
                    .eq("id", conversationId);

                  // === TRIGGER AI RESPONSE ===
                  // Check if AI is enabled for this tenant's WhatsApp channel
                  const { data: aiConfig } = await supabase
                    .from("ai_support_config")
                    .select("is_enabled")
                    .eq("tenant_id", tenantId)
                    .single();

                  const { data: channelAiConfig } = await supabase
                    .from("ai_channel_config")
                    .select("is_enabled")
                    .eq("tenant_id", tenantId)
                    .eq("channel_type", "whatsapp")
                    .single();

                  // AI is enabled if global config is on AND (no channel config OR channel config is on)
                  const aiEnabled = aiConfig?.is_enabled && (channelAiConfig?.is_enabled !== false);

                  if (aiEnabled) {
                    console.log(`[meta-whatsapp-webhook][${traceId}] AI enabled, invoking ai-support-chat...`);
                    try {
                      const aiResponse = await fetch(
                        `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-support-chat`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                          },
                          body: JSON.stringify({
                            conversation_id: conversationId,
                            tenant_id: tenantId,
                          }),
                        }
                      );
                      const aiResult = await aiResponse.text();
                      console.log(`[meta-whatsapp-webhook][${traceId}] AI response (${aiResponse.status}):`, aiResult.substring(0, 300));
                    } catch (aiError) {
                      console.error(`[meta-whatsapp-webhook][${traceId}] AI invocation error:`, aiError);
                    }
                  } else {
                    console.log(`[meta-whatsapp-webhook][${traceId}] AI not enabled for this tenant/channel`);
                  }
                }
              }
            }
          }

          // Process status updates (delivery receipts)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log(`[meta-whatsapp-webhook][${traceId}] Status update - id: ${status.id}, status: ${status.status}`);
              
              // Update message status in whatsapp_messages table if exists
              await supabase
                .from("whatsapp_messages")
                .update({ 
                  status: status.status,
                  updated_at: new Date().toISOString()
                })
                .eq("external_message_id", status.id)
                .eq("tenant_id", tenantId);
            }
          }
        }
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error(`[meta-whatsapp-webhook][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
