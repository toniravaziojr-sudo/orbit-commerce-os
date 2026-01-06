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
          const { data: config, error: configError } = await supabase
            .from("whatsapp_configs")
            .select("tenant_id")
            .eq("phone_number_id", phoneNumberId)
            .eq("provider", "meta")
            .single();

          if (configError || !config) {
            console.error(`[meta-whatsapp-webhook][${traceId}] No tenant found for phone_number_id: ${phoneNumberId}`);
            continue;
          }

          const tenantId = config.tenant_id;
          console.log(`[meta-whatsapp-webhook][${traceId}] Routed to tenant: ${tenantId}`);

          // Process messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const contact = value.contacts?.[0];
              
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

              // Save inbound message
              const { error: insertError } = await supabase
                .from("whatsapp_inbound_messages")
                .insert({
                  tenant_id: tenantId,
                  provider: "meta",
                  external_message_id: message.id,
                  from_phone: message.from,
                  to_phone: value.metadata.display_phone_number,
                  message_type: messageType,
                  message_content: messageContent,
                  media_url: mediaUrl,
                  timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                  raw_payload: message,
                });

              if (insertError) {
                console.error(`[meta-whatsapp-webhook][${traceId}] Failed to save message:`, insertError);
              } else {
                console.log(`[meta-whatsapp-webhook][${traceId}] Message saved - from: ${message.from}, type: ${messageType}`);
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
