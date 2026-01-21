import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-onboarding-start][${traceId}] Request received`);

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

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-onboarding-start][${traceId}] User: ${user.id}, Tenant: ${tenant_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user belongs to tenant
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

    // Get Meta app credentials from platform_credentials
    const { data: credentials } = await supabase
      .from("platform_credentials")
      .select("credential_key, credential_value")
      .in("credential_key", ["META_APP_ID", "META_GRAPH_API_VERSION"])
      .eq("is_active", true);

    const credMap: Record<string, string> = {};
    credentials?.forEach((c) => {
      credMap[c.credential_key] = c.credential_value;
    });

    const metaAppId = credMap["META_APP_ID"];
    const graphApiVersion = credMap["META_GRAPH_API_VERSION"] || "v21.0";

    if (!metaAppId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Credenciais do Meta App não configuradas. Entre em contato com o administrador da plataforma." 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate state token for CSRF protection
    const stateToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save state token
    const { error: stateError } = await supabase
      .from("meta_whatsapp_onboarding_states")
      .insert({
        tenant_id,
        user_id: user.id,
        state_token: stateToken,
        expires_at: expiresAt.toISOString(),
      });

    if (stateError) {
      console.error(`[meta-whatsapp-onboarding-start][${traceId}] Failed to save state:`, stateError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao iniciar onboarding" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the redirect URI (callback URL via Cloudflare proxy - public domain)
    const redirectUri = `https://app.comandocentral.com.br/integrations/meta/whatsapp-callback`;

    // Build the Embedded Signup URL
    // https://developers.facebook.com/docs/whatsapp/embedded-signup
    const embeddedSignupUrl = new URL(`https://www.facebook.com/${graphApiVersion}/dialog/oauth`);
    embeddedSignupUrl.searchParams.set("client_id", metaAppId);
    embeddedSignupUrl.searchParams.set("redirect_uri", redirectUri);
    embeddedSignupUrl.searchParams.set("state", stateToken);
    embeddedSignupUrl.searchParams.set("scope", "whatsapp_business_management,whatsapp_business_messaging");
    embeddedSignupUrl.searchParams.set("response_type", "code");
    // For Embedded Signup, these are important
    embeddedSignupUrl.searchParams.set("extras", JSON.stringify({
      feature: "whatsapp_embedded_signup",
      sessionInfoVersion: 2
    }));

    console.log(`[meta-whatsapp-onboarding-start][${traceId}] Generated state: ${stateToken.substring(0, 8)}...`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        state: stateToken,
        app_id: metaAppId,
        redirect_uri: redirectUri,
        embedded_signup_url: embeddedSignupUrl.toString(),
        config_id: "", // Will be set when we have WABA config
        graph_api_version: graphApiVersion,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-whatsapp-onboarding-start][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
