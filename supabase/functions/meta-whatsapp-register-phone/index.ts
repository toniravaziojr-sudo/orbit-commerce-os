import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Register (or re-register) a WhatsApp phone number on Meta Cloud API.
 * Step 3 of the registration flow. Requires a 6-digit PIN.
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-register-phone][${traceId}] Request received`);

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

    const { tenant_id, pin } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PIN is mandatory
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return new Response(JSON.stringify({ success: false, error: "PIN de 6 dígitos é obrigatório para registrar o número." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Register the phone number on Cloud API
    console.log(`[meta-whatsapp-register-phone][${traceId}] Registering phone ${config.phone_number_id}...`);
    
    const registerUrl = `https://graph.facebook.com/${graphApiVersion}/${config.phone_number_id}/register`;
    const registerResponse = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: String(pin),
      }),
    });
    const registerData = await registerResponse.json();

    console.log(`[meta-whatsapp-register-phone][${traceId}] Register response:`, JSON.stringify(registerData));

    if (registerData.success === true) {
      // Update status to connected
      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.log(`[meta-whatsapp-register-phone][${traceId}] Phone registered successfully!`);

      return new Response(JSON.stringify({
        success: true,
        message: "Número registrado com sucesso na Cloud API!",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = registerData.error?.message || JSON.stringify(registerData);
      const errorCode = registerData.error?.code;
      const errorSubcode = registerData.error?.error_subcode;
      
      // Build user-friendly error messages
      let friendlyError = `Registro falhou: ${errorMsg}`;
      if (errorSubcode === 2388001 || errorCode === 100) {
        friendlyError = "PIN incorreto. Verifique o PIN de 6 dígitos e tente novamente.";
      } else if (errorSubcode === 136025) {
        friendlyError = "Número já registrado em outra conta. Desregistre o número da conta atual antes de registrar aqui.";
      }
      
      // Update with error
      await supabase
        .from("whatsapp_configs")
        .update({
          connection_status: "pending_registration",
          last_error: friendlyError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.error(`[meta-whatsapp-register-phone][${traceId}] Register failed:`, errorMsg);

      return new Response(JSON.stringify({
        success: false,
        error: friendlyError,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error(`[meta-whatsapp-register-phone][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
