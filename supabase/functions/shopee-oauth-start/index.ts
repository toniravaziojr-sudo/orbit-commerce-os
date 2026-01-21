import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopee OAuth Start
 * 
 * Gera a URL de autorização para o vendedor conectar sua loja Shopee.
 * O state contém o tenant_id criptografado para rastreabilidade.
 * 
 * Docs: https://open.shopee.com/documents/v2/v2.shop.auth_partner
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

    // Obter tenant_id e region do body
    const body = await req.json();
    const { tenantId, region = "BR" } = body;

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

    // Buscar credenciais do app Shopee (da tabela platform_credentials)
    const partnerId = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_ID");
    const partnerKey = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_KEY");
    
    if (!partnerId || !partnerKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Integração Shopee não configurada. Contate o administrador da plataforma.",
          code: "SHOPEE_NOT_CONFIGURED"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir redirect URI (via Cloudflare proxy - domínio público)
    const redirectUri = `https://app.comandocentral.com.br/integrations/shopee/callback`;

    // Criar state com tenant_id
    const stateData = {
      tenant_id: tenantId,
      user_id: user.id,
      region: region,
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(stateData));

    // Gerar timestamp em segundos (Shopee usa timestamp em segundos)
    const timestamp = Math.floor(Date.now() / 1000);

    // Path da API de autorização
    const path = "/api/v2/shop/auth_partner";

    // Gerar assinatura HMAC-SHA256
    // Base string: partner_id + path + timestamp
    const baseString = `${partnerId}${path}${timestamp}`;
    const hmac = createHmac("sha256", partnerKey);
    hmac.update(baseString);
    const sign = hmac.digest("hex");

    // Determinar host baseado no ambiente (produção por padrão)
    // Para sandbox: https://partner.test-stable.shopeemobile.com
    const shopeeHost = "https://partner.shopeemobile.com";

    // URL de autorização da Shopee
    const authUrl = new URL(`${shopeeHost}${path}`);
    authUrl.searchParams.set("partner_id", partnerId);
    authUrl.searchParams.set("timestamp", timestamp.toString());
    authUrl.searchParams.set("sign", sign);
    authUrl.searchParams.set("redirect", redirectUri);

    console.log(`[shopee-oauth-start] Gerando URL para tenant ${tenantId}, region ${region}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[shopee-oauth-start] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
