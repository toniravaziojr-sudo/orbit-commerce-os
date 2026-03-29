import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify the SMS/voice code received for a WhatsApp phone number.
 * Step 2 of the registration flow.
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-verify-code][${traceId}] Request received`);

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

    const { tenant_id, code } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!code || !/^\d{6}$/.test(String(code))) {
      return new Response(JSON.stringify({ success: false, error: "Código de verificação deve ter 6 dígitos" }), {
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

    // Get WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number_id, access_token, token_expires_at")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ success: false, error: "Configuração WhatsApp não encontrada." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Token de acesso não disponível." }), {
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

    // Verify the code
    console.log(`[meta-whatsapp-verify-code][${traceId}] Verifying code for phone ${config.phone_number_id}...`);

    const verifyUrl = `https://graph.facebook.com/${graphApiVersion}/${config.phone_number_id}/verify_code`;
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({
        code: String(code),
      }),
    });
    const responseData = await response.json();

    console.log(`[meta-whatsapp-verify-code][${traceId}] Response:`, JSON.stringify(responseData));

    if (responseData.success === true) {
      // Update status to pending_registration (code verified, now needs register call)
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
        message: "Código verificado com sucesso! Agora finalize o registro do número.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = responseData.error?.message || JSON.stringify(responseData);
      console.error(`[meta-whatsapp-verify-code][${traceId}] Failed:`, errorMsg);

      return new Response(JSON.stringify({
        success: false,
        error: `Código inválido ou expirado. Tente novamente.`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error(`[meta-whatsapp-verify-code][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
