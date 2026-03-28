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
// NOTA: Escopos avançados (instagram_manage_messages, etc.) requerem App Review da Meta.
// Para modo desenvolvimento, usamos apenas escopos que funcionam sem aprovação.
const SCOPE_PACKS: Record<string, string[]> = {
  // Atendimento (Messenger + Instagram DM + Comentários)
  atendimento: [
    "pages_messaging",
    "instagram_manage_messages",
    "pages_manage_engagement",
    "pages_read_user_content",
    "pages_read_engagement",
  ],
  // Publicação/Agendamento (Facebook + Instagram)
  publicacao: [
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ],
  // Ads/Insights (campanhas e métricas)
  ads: [
    "ads_management",
    "ads_read",
    "pages_manage_ads",
    "leads_retrieval",
  ],
  // Leads (Lead Ads)
  leads: [
    "leads_retrieval",
    "pages_manage_ads",
  ],
  // Catálogo/Commerce Manager
  catalogo: [
    "catalog_management",
  ],
  // WhatsApp (WABA/Cloud API)
  whatsapp: [
    "whatsapp_business_management",
    "whatsapp_business_messaging",
  ],
  // Threads — usa OAuth separado via threads.net, NÃO incluir no fluxo Facebook
  // threads: [ ... ] — desabilitado aqui, será tratado em endpoint dedicado
  // Live Video (transmissões ao vivo)
  live_video: [
    "publish_video",
    "pages_manage_posts",
  ],
  // Pixel + CAPI (precisa de ads_read para listar pixels das ad accounts)
  pixel: [
    "ads_read",
  ],
  // Insights (métricas de páginas e perfis)
  insights: [
    "pages_read_engagement",
    "read_insights",
  ],
};

// ============================================================================
// PACK AVAILABILITY — Espelho da configuração central do frontend
// Arquivo fonte: src/config/metaPackAvailability.ts
// IMPORTANTE: Manter SEMPRE sincronizado com o frontend.
// Para liberar um novo pack: mudar de "internal" para "public" aqui E no frontend.
// ============================================================================
type PackAvailability = "public" | "internal" | "unavailable";

const PACK_AVAILABILITY: Record<string, PackAvailability> = {
  whatsapp: "public",
  publicacao: "public",
  atendimento: "internal",
  ads: "internal",
  leads: "internal",
  catalogo: "internal",
  threads: "internal",
  live_video: "internal",
  pixel: "public",
  insights: "internal",
};

// Normaliza email para comparação segura (espelha src/lib/normalizeEmail.ts)
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

// Escopos base sempre incluídos (public_profile é sempre disponível)
// NOTA: "email" requer que o usuário tenha email confirmado e pode falhar em dev mode
const BASE_SCOPES = [
  "public_profile",
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

    // Validar scope packs (sintaxe válida)
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

    // ================================================================
    // VALIDAÇÃO DE DISPONIBILIDADE DOS PACKS
    // Verifica se o usuário é platform admin (camada secundária)
    // e se cada pack solicitado está disponível para este contexto.
    // NÃO filtra silenciosamente — REJEITA com erro explícito.
    // ================================================================
    const userEmail = normalizeEmail(user.email);
    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("email", userEmail)
      .eq("is_active", true)
      .maybeSingle();

    const isPlatformAdmin = !!platformAdmin;

    // Verificar cada pack contra a disponibilidade
    const blockedPacks: string[] = [];
    for (const pack of validPacks) {
      const availability = PACK_AVAILABILITY[pack] || "unavailable";
      if (availability === "public") continue;
      if (availability === "internal" && isPlatformAdmin) continue;
      // Pack não permitido para este contexto
      blockedPacks.push(pack);
    }

    if (blockedPacks.length > 0) {
      console.log(`[meta-oauth-start] Packs bloqueados para ${userEmail}: ${blockedPacks.join(", ")}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Algumas funcionalidades ainda não estão disponíveis para sua conta.",
          code: "META_PACK_NOT_AVAILABLE",
          blockedPacks,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do app Meta (da tabela platform_credentials)
    const [appId, apiVersion] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION"),
    ]);
    
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

    // Construir escopos combinados (sem duplicatas)
    const allScopes = new Set([...BASE_SCOPES]);
    for (const pack of validPacks) {
      for (const scope of SCOPE_PACKS[pack]) {
        allScopes.add(scope);
      }
    }
    const scopeString = Array.from(allScopes).join(",");

    console.log(`[meta-oauth-start] Escopos solicitados: ${scopeString}`);

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

    // Construir redirect URI (callback vai para rota do APP - melhor prática para SaaS)
    const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
    const redirectUri = `${appBaseUrl}/integrations/meta/callback`;

    // URL de autorização do Facebook/Meta
    // Docs: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
    const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
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
