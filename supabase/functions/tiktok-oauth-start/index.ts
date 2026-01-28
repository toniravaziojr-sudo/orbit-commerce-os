import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TikTok OAuth Start
 * 
 * Gera a URL de autorização para o cliente conectar sua conta TikTok for Business.
 * Usa as credenciais de integrador (TIKTOK_APP_ID e TIKTOK_APP_SECRET).
 * 
 * Contrato:
 * - Erro de negócio = HTTP 200 + { success: false, error, code? }
 * - Sucesso = HTTP 200 + { success: true, authUrl, state }
 * 
 * TikTok OAuth Docs: https://business-api.tiktok.com/portal/docs?id=1738373141733378
 */

// Escopos necessários para TikTok Marketing API
const TIKTOK_SCOPES = [
  "advertiser.data.readonly", // Ler dados de anunciantes
  "event.track.create",       // Criar eventos de conversão
  "event.track.view",         // Ver eventos de conversão
];

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
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verificar usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter parâmetros do body
    const body = await req.json();
    const { tenantId, returnPath = "/marketing" } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório", code: "MISSING_TENANT" }),
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

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso a este tenant", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do TikTok (integrador)
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_ID");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_SECRET");

    if (!appId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Integração TikTok não configurada. Configure TIKTOK_APP_ID nas credenciais da plataforma.", 
          code: "NOT_CONFIGURED" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar state único (anti-CSRF)
    const stateRaw = crypto.randomUUID();
    const stateHash = stateRaw; // Para TikTok usamos o state diretamente na URL

    // Salvar state no banco com expiração
    const { error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        state_hash: stateHash,
        return_path: returnPath,
        scope_packs: ["marketing"],
      });

    if (stateError) {
      console.error("[tiktok-oauth-start] Erro ao salvar state:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro interno ao iniciar autorização", code: "STATE_SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL base do app para redirect
    const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
    const redirectUri = `${appBaseUrl}/integrations/tiktok/callback`;

    // Construir URL de autorização TikTok
    // Docs: https://business-api.tiktok.com/portal/docs?id=1738373141733378
    const authUrl = new URL("https://business-api.tiktok.com/portal/auth");
    authUrl.searchParams.set("app_id", appId);
    authUrl.searchParams.set("state", stateHash);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("rid", crypto.randomUUID().slice(0, 8)); // Request ID opcional

    console.log(`[tiktok-oauth-start] URL gerada para tenant ${tenantId}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state: stateHash,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[tiktok-oauth-start] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
