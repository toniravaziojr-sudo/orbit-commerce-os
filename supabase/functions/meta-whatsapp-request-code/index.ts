import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Request a verification code (SMS or voice) for a WhatsApp phone number.
 * Step 1 of the registration flow.
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-request-code][${traceId}] Request received`);

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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, code_method } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const method = code_method === "VOICE" ? "VOICE" : "SMS";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user belongs to tenant with admin/owner role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!userRole || !["owner", "admin"].includes(userRole.role)) {
      return new Response(JSON.stringify({ success: false, error: "Permissão negada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp config for this tenant
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number_id, waba_id, access_token, token_expires_at")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ success: false, error: "Configuração WhatsApp não encontrada. Conecte primeiro." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Token de acesso não disponível. Reconecte sua conta." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "Token expirado. Reconecte sua conta Meta." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Graph API version
    const { data: credentials } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .maybeSingle();

    const graphApiVersion = credentials?.credential_value || "v21.0";

    // Request verification code via SMS or Voice
    console.log(`[meta-whatsapp-request-code][${traceId}] Requesting ${method} code for phone ${config.phone_number_id}...`);

    const requestCodeUrl = `https://graph.facebook.com/${graphApiVersion}/${config.phone_number_id}/request_code`;
    const response = await fetch(requestCodeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({
        code_method: method,
        language: "pt_BR",
      }),
    });
    const responseData = await response.json();

    console.log(`[meta-whatsapp-request-code][${traceId}] Response:`, JSON.stringify(responseData));

    if (responseData.success === true) {
      // Update status
      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "awaiting_verification",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      return new Response(JSON.stringify({
        success: true,
        message: `Código de verificação enviado por ${method === "SMS" ? "SMS" : "chamada de voz"}. Verifique seu telefone.`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = responseData.error?.message || JSON.stringify(responseData);
      const errorSubcode = responseData.error?.error_subcode;
      const errorUserMsg = responseData.error?.error_user_msg;
      console.error(`[meta-whatsapp-request-code][${traceId}] Failed:`, errorMsg, `subcode: ${errorSubcode}`);

      // Phone already verified — skip to registration step
      if (errorSubcode === 2388366) {
        console.log(`[meta-whatsapp-request-code][${traceId}] Phone already verified, skipping to registration`);
        
        await supabase
          .from("whatsapp_configs")
          .update({
            connection_status: "pending_registration",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

        return new Response(JSON.stringify({
          success: true,
          already_verified: true,
          message: "Número já verificado! Prossiga com o PIN para finalizar o registro.",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: errorUserMsg || `Falha ao solicitar código: ${errorMsg}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error(`[meta-whatsapp-request-code][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
