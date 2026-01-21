import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre OAuth Start
 * 
 * Gera a URL de autorização para o vendedor conectar sua conta do ML.
 * O state contém o tenant_id criptografado para rastreabilidade.
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
    if (!authHeader) {
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
    const { tenantId } = body;

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

    // Buscar credenciais do app ML (da tabela platform_credentials)
    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_APP_ID");
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Integração Mercado Livre não configurada. Contate o administrador da plataforma.",
          code: "MELI_NOT_CONFIGURED"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir redirect URI (via Cloudflare proxy - domínio público)
    const redirectUri = `https://app.comandocentral.com.br/integrations/meli/callback`;

    // Criar state com tenant_id (base64 encoded para segurança básica)
    // Em produção, considere criptografar com uma chave
    const stateData = {
      tenant_id: tenantId,
      user_id: user.id,
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(stateData));

    // Escopos necessários para pedidos, mensagens e anúncios
    // Documentação: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
    const scopes = [
      "read",           // Leitura básica
      "write",          // Escrita básica
      "offline_access", // Refresh token
      // Escopos específicos são implícitos com read/write para o seller
    ].join(" ");

    // URL de autorização do ML Brasil
    const authUrl = new URL("https://auth.mercadolivre.com.br/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    // ML não usa scope explícito na URL, mas sim na app registration

    console.log(`[meli-oauth-start] Gerando URL para tenant ${tenantId}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meli-oauth-start] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
