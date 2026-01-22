import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Edge Function para envio de mensagem de teste via WhatsApp Cloud API.
 * 
 * IMPORTANTE:
 * - O token temporário NÃO é salvo no banco de dados
 * - O token NÃO é logado (segurança)
 * - Apenas platform admins podem usar esta função
 * - Usado para validar a integração antes da aprovação do app Meta
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-test-send][${traceId}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: "Não autorizado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: "Usuário não autenticado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if platform admin
  const { data: isPlatformAdmin } = await supabaseAuth.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    return new Response(
      JSON.stringify({ success: false, error: "Acesso negado. Apenas operadores da plataforma." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const {
      phone_number_id,
      access_token,
      to_phone,
      message,
      template_name,
      template_language,
    } = body;

    // Validations - NEVER log access_token
    console.log(`[meta-whatsapp-test-send][${traceId}] Test send request - phone_number_id: ${phone_number_id}, to: ${to_phone}`);

    if (!phone_number_id) {
      return new Response(
        JSON.stringify({ success: false, error: "phone_number_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "access_token é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!to_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone destinatário é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message && !template_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Mensagem ou template é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number
    let formattedPhone = to_phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "55" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
      formattedPhone = "55" + formattedPhone;
    }

    // Get Graph API version from platform credentials
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: versionCred } = await supabaseAdmin
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();

    const graphApiVersion = versionCred?.credential_value || "v21.0";
    const apiUrl = `https://graph.facebook.com/${graphApiVersion}/${phone_number_id}/messages`;

    console.log(`[meta-whatsapp-test-send][${traceId}] Sending to ${formattedPhone} via ${graphApiVersion}`);

    // Build message payload
    let messagePayload: any;

    if (template_name) {
      // Template message (allowed without 24h window)
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: template_name,
          language: { code: template_language || "pt_BR" },
        },
      };
    } else {
      // Text message (requires 24h service window or user-initiated conversation)
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      };
    }

    // Send via Graph API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();
    console.log(`[meta-whatsapp-test-send][${traceId}] Meta API response status: ${response.status}`);

    if (!response.ok) {
      const errorMessage = responseData.error?.message || "Erro desconhecido da API Meta";
      const errorCode = responseData.error?.code;
      console.error(`[meta-whatsapp-test-send][${traceId}] Meta API error: ${errorCode} - ${errorMessage}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          error_code: errorCode,
          details: responseData.error?.error_data || null
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = responseData.messages?.[0]?.id;
    console.log(`[meta-whatsapp-test-send][${traceId}] Message sent successfully - message_id: ${messageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        phone: formattedPhone,
        note: "Mensagem de teste enviada. O token NÃO foi salvo.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[meta-whatsapp-test-send][${traceId}] Error:`, error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
