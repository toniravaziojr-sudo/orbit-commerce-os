import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta OAuth Start
 * 
 * Gera a URL de autorização para o cliente conectar sua conta Meta.
 * Suporta pacotes de escopos por feature (Atendimento, Publicação, Ads, etc.)
 * 
 * Contrato:
 * - Erro de negócio = HTTP 200 + { success: false, error, code? }
 * - Sucesso = HTTP 200 + { success: true, authUrl, state }
 */

// Pacotes de escopos por feature
const SCOPE_PACKS: Record<string, string[]> = {
  // Atendimento (Messenger + Instagram)
  atendimento: [
    "pages_messaging",
    "pages_manage_metadata",
    "pages_read_engagement",
    "instagram_manage_messages",
    "instagram_manage_comments",
  ],
  // Publicação/Agendamento (Facebook + Instagram)
  publicacao: [
    "pages_manage_posts",
    "instagram_content_publish",
    "pages_read_engagement",
  ],
  // Ads/Insights (campanhas e métricas)
  ads: [
    "ads_management",
    "ads_read",
    "read_insights",
  ],
  // Leads (Lead Ads)
  leads: [
    "leads_retrieval",
    "pages_manage_ads",
  ],
  // Catálogo/Pixels/Ativos de negócio
  catalogo: [
    "catalog_management",
    "business_management",
  ],
  // WhatsApp (WABA/Cloud API)
  whatsapp: [
    "whatsapp_business_management",
    "whatsapp_business_messaging",
  ],
};

// Escopos base sempre incluídos
const BASE_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
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
    const { tenantId, scopePacks = ["atendimento"], returnPath = "/integrations" } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar scope packs
    const validPacks = scopePacks.filter((pack: string) => SCOPE_PACKS[pack]);
    if (validPacks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nenhum pacote de escopos válido", 
          code: "INVALID_SCOPES",
          availablePacks: Object.keys(SCOPE_PACKS)
        }),
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

    // Buscar credenciais do app Meta (da tabela platform_credentials)
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID");
    
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

    // Construir escopos combinados (sem duplicatas)
    const allScopes = new Set([...BASE_SCOPES]);
    for (const pack of validPacks) {
      for (const scope of SCOPE_PACKS[pack]) {
        allScopes.add(scope);
      }
    }
    const scopeString = Array.from(allScopes).join(",");

    // Gerar state seguro com hash
    const stateNonce = crypto.randomUUID();
    const stateHash = await generateStateHash(stateNonce, tenantId);

    // Salvar state no banco para validação posterior (anti-CSRF)
    const { error: stateError } = await supabase
      .from("meta_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        state_hash: stateHash,
        scope_packs: validPacks,
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

    // Construir redirect URI (callback vai para edge function)
    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

    // URL de autorização do Facebook/Meta
    // Docs: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
    const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", stateHash);
    authUrl.searchParams.set("scope", scopeString);
    authUrl.searchParams.set("response_type", "code");

    console.log(`[meta-oauth-start] Gerando URL para tenant ${tenantId}, scopes: ${validPacks.join(", ")}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state: stateHash,
        requestedScopes: Array.from(allScopes),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meta-oauth-start] Erro:", error);
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

// Gerar hash do state para segurança
async function generateStateHash(nonce: string, tenantId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${nonce}:${tenantId}:${Date.now()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}
