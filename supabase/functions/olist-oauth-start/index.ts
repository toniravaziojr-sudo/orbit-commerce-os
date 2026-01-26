import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Olist OAuth Start - Partners API
 * 
 * Gera a URL de autorização OAuth2 para o seller conectar sua conta Olist.
 * Usa o fluxo Authorization Code da Partners API.
 * 
 * Documentação: https://developers.olist.com/docs/authentication
 * 
 * Ambientes:
 * - Sandbox Auth: https://auth-engine.olist.com/realms/3rd-party-sandbox
 * - Sandbox API: https://partners-sandbox-api.olist.com/v1
 * - Production Auth: https://id.olist.com/
 * - Production API: https://partners-api.olist.com/v1
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verificar usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter tenant_id do body
    const body = await req.json();
    const { tenantId, environment = "production" } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se usuário tem acesso ao tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole || !["owner", "admin"].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do app Olist (da tabela platform_credentials ou env)
    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "OLIST_CLIENT_ID");
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Integração Olist não configurada. Contate o administrador da plataforma.",
          code: "OLIST_NOT_CONFIGURED"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Definir URLs baseado no ambiente
    const isSandbox = environment === "sandbox";
    const authBaseUrl = isSandbox 
      ? "https://auth-engine.olist.com/realms/3rd-party-sandbox/protocol/openid-connect"
      : "https://id.olist.com/protocol/openid-connect";

    // Construir redirect URI (via domínio público)
    const redirectUri = `https://app.comandocentral.com.br/integrations/olist/callback`;

    // Criar state com tenant_id (base64 encoded)
    const stateData = {
      tenant_id: tenantId,
      user_id: user.id,
      environment,
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(stateData));

    // Escopos necessários para a Partners API
    // openid e profile são obrigatórios para obter id_token
    const scopes = [
      "openid",
      "profile",
      "email",
    ].join(" ");

    // URL de autorização OAuth2
    const authUrl = new URL(`${authBaseUrl}/auth`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes);

    console.log(`[olist-oauth-start] Gerando URL para tenant ${tenantId} (env: ${environment})`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state,
        environment,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[olist-oauth-start] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
