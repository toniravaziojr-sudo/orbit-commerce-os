import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta OAuth Start — V4
 * 
 * Gera a URL de autorização para o cliente conectar sua conta Meta.
 * O perfil de auth (meta_auth_full ou meta_auth_external) é escolhido
 * automaticamente com base no tipo do tenant (especial/admin vs padrão).
 * 
 * V4: Não usa mais scope packs selecionados pelo frontend.
 * Os escopos são controlados pelo config_id do perfil no painel Meta.
 * 
 * Contrato:
 * - Erro de negócio = HTTP 200 + { success: false, error, code? }
 * - Sucesso = HTTP 200 + { success: true, authUrl, state }
 */

// Normaliza email para comparação segura
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

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
    const { tenantId, returnPath = "/integrations" } = body;

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

    if (roleError || !userRole || !["owner", "admin"].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este tenant", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================================
    // V4: DETERMINAR PERFIL DE AUTH AUTOMATICAMENTE
    // Tenant especial ou platform admin → meta_auth_full
    // Demais tenants → meta_auth_external
    // ================================================================
    
    // Verificar se tenant é especial
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("is_special")
      .eq("id", tenantId)
      .single();

    // Verificar se usuário é platform admin
    const userEmail = normalizeEmail(user.email);
    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("email", userEmail)
      .eq("is_active", true)
      .maybeSingle();

    const isSpecialOrAdmin = !!(tenantData?.is_special) || !!platformAdmin;
    const authProfileKey = isSpecialOrAdmin ? "meta_auth_full" : "meta_auth_external";

    console.log(`[meta-oauth-start] Tenant ${tenantId}: is_special=${tenantData?.is_special}, isPlatformAdmin=${!!platformAdmin} → profile=${authProfileKey}`);

    // Buscar config_id do perfil na tabela meta_auth_profiles
    const { data: authProfile, error: profileError } = await supabase
      .from("meta_auth_profiles")
      .select("config_id, effective_scopes")
      .eq("profile_key", authProfileKey)
      .eq("is_active", true)
      .single();

    if (profileError || !authProfile) {
      console.error("[meta-oauth-start] Perfil de auth não encontrado:", authProfileKey, profileError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Configuração de autenticação não encontrada. Contate o administrador.",
          code: "AUTH_PROFILE_NOT_FOUND"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do app Meta
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID");
    const apiVersion = await getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION");
    
    if (!appId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Integração Meta não configurada. Contate o administrador da plataforma.",
          code: "META_NOT_CONFIGURED"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const graphVersion = apiVersion || "v21.0";

    // Gerar state seguro com hash
    const stateNonce = crypto.randomUUID();
    const stateHash = await generateStateHash(stateNonce, tenantId);

    // Salvar state no banco para validação posterior (anti-CSRF)
    // V4: inclui auth_profile_key para o callback saber qual perfil usar
    const { error: stateError } = await supabase
      .from("meta_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        state_hash: stateHash,
        scope_packs: [], // V4: escopos vêm do perfil, não de packs
        auth_profile_key: authProfileKey,
        return_path: returnPath,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      });

    if (stateError) {
      console.error("[meta-oauth-start] Erro ao salvar state:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao preparar autorização", code: "STATE_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir redirect URI
    const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
    const redirectUri = `${appBaseUrl}/integrations/meta/callback`;

    // URL de autorização do Facebook/Meta
    const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", stateHash);
    authUrl.searchParams.set("response_type", "code");

    // V4: config_id vem do perfil no banco (meta_auth_profiles.config_id)
    // Se o perfil tem config_id → usar (Facebook Login for Business)
    // Senão → fallback para escopos diretos (modo desenvolvimento)
    if (authProfile.config_id) {
      authUrl.searchParams.set("config_id", authProfile.config_id);
      console.log(`[meta-oauth-start] Usando config_id do perfil ${authProfileKey}`);
    } else {
      // Fallback: enviar escopos do perfil diretamente
      const scopeString = (authProfile.effective_scopes || []).join(",");
      authUrl.searchParams.set("scope", scopeString);
      console.warn(`[meta-oauth-start] Perfil ${authProfileKey} sem config_id — usando scope direto: ${scopeString}`);
    }

    console.log(`[meta-oauth-start] URL gerada para tenant ${tenantId}, profile=${authProfileKey}, config_id=${authProfile.config_id ? "sim" : "NÃO"}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state: stateHash,
        authProfile: authProfileKey,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meta-oauth-start] Erro:", error);
    return errorResponse(error, corsHeaders, { module: 'meta-oauth-start' });
  }
});

// Gerar hash do state para segurança
async function generateStateHash(nonce: string, tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${nonce}:${tenantId}:${Date.now()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}
