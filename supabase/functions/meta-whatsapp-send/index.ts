import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageParams {
  tenant_id: string;
  phone: string;
  message: string;
  template_name?: string;
  template_language?: string;
  template_components?: any[];
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-send][${traceId}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const params: SendMessageParams = await req.json();
    const { tenant_id, phone, message, template_name, template_language, template_components } = params;

    if (!tenant_id || !phone) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id e phone são obrigatórios" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message && !template_name) {
      return new Response(JSON.stringify({ success: false, error: "message ou template_name é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-send][${traceId}] Tenant: ${tenant_id}, Phone: ${phone}`);

    // Get tenant's Meta WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .eq("connection_status", "connected")
      .single();

    if (configError || !config) {
      console.error(`[meta-whatsapp-send][${traceId}] No Meta config for tenant`);
      return new Response(JSON.stringify({ success: false, error: "WhatsApp Meta não configurado ou desconectado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone_number_id, access_token, token_expires_at } = config;

    if (!phone_number_id || !access_token) {
      return new Response(JSON.stringify({ success: false, error: "Configuração incompleta do WhatsApp Meta" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if token is expired
    if (token_expires_at && new Date(token_expires_at) < new Date()) {
      console.error(`[meta-whatsapp-send][${traceId}] Token expired`);
      // Update status
      await supabase
        .from("whatsapp_configs")
        .update({ connection_status: "token_expired", last_error: "Token expirado" })
        .eq("id", config.id);
      
      return new Response(JSON.stringify({ success: false, error: "Token do WhatsApp expirado. Reconecte sua conta." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get graph API version from platform credentials
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();

    const graphApiVersion = versionCred?.credential_value || "v21.0";

    // Format phone number (remove non-digits, ensure country code)
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "55" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log(`[meta-whatsapp-send][${traceId}] Sending to: ${formattedPhone}`);

    // Build message payload
    let messagePayload: any;

    if (template_name) {
      // Template message
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: template_name,
          language: { code: template_language || "pt_BR" },
          components: template_components || [],
        },
      };
    } else {
      // Text message (only allowed within 24h service window)
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: message },
      };
    }

    // Send message via Meta Graph API
    const sendUrl = `https://graph.facebook.com/${graphApiVersion}/${phone_number_id}/messages`;
    
    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const sendResult = await sendResponse.json();

    if (sendResult.error) {
      console.error(`[meta-whatsapp-send][${traceId}] Send error:`, sendResult.error);
      
      // Log failed message (use correct column names from schema)
      await supabase.from("whatsapp_messages").insert({
        tenant_id,
        recipient_phone: formattedPhone,
        message_type: template_name ? "template" : "text",
        message_content: message || `[Template: ${template_name}]`,
        status: "failed",
        error_message: sendResult.error.message,
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: sendResult.error.message || "Erro ao enviar mensagem" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageId = sendResult.messages?.[0]?.id;
    console.log(`[meta-whatsapp-send][${traceId}] Message sent - ID: ${messageId}`);

    // Log successful message (use correct column names from schema)
    await supabase.from("whatsapp_messages").insert({
      tenant_id,
      recipient_phone: formattedPhone,
      message_type: template_name ? "template" : "text",
      message_content: message || `[Template: ${template_name}]`,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: messageId,
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        message_id: messageId,
        phone: formattedPhone,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-whatsapp-send][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
