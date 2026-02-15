import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 4: TikTok Content OAuth start
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Content OAuth Start
 * 
 * Gera URL de autorização para TikTok Content (Login Kit).
 * Usa credenciais separadas: TIKTOK_CONTENT_CLIENT_KEY e TIKTOK_CONTENT_CLIENT_SECRET.
 * 
 * Body: { tenantId, scopePacks?: string[], returnPath? }
 */

// Scope Pack Registry (TikTok Content / Login Kit)
const TIKTOK_CONTENT_SCOPE_PACKS: Record<string, string[]> = {
  content: ["user.info.basic", "video.list", "video.upload", "video.publish"],
  analytics: ["user.info.stats"],
};

serve(async (req) => {
  console.log(`[tiktok-content-oauth-start][${VERSION}] Request received`);

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
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      tenantId,
      scopePacks = ["content"],
      returnPath = "/integrations",
    } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso ao tenant
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

    // Buscar credenciais do TikTok Content (Login Kit)
    const clientKey = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_CONTENT_CLIENT_KEY");

    if (!clientKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Integração TikTok Content não configurada. Configure TIKTOK_CONTENT_CLIENT_KEY nas credenciais da plataforma.",
          code: "NOT_CONFIGURED",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolver escopos a partir dos packs
    const resolvedScopes = new Set<string>();
    const validPacks: string[] = [];

    for (const pack of scopePacks) {
      const scopes = TIKTOK_CONTENT_SCOPE_PACKS[pack];
      if (scopes) {
        scopes.forEach((s) => resolvedScopes.add(s));
        validPacks.push(pack);
      } else {
        console.warn(`[tiktok-content-oauth-start] Pack desconhecido: ${pack}`);
      }
    }

    // Gerar state único (anti-CSRF)
    const stateHash = crypto.randomUUID();

    // Salvar state no banco (reutiliza tiktok_oauth_states com product='content')
    const { error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        state_hash: stateHash,
        return_path: returnPath,
        scope_packs: validPacks,
        product: "content",
      });

    if (stateError) {
      console.error("[tiktok-content-oauth-start] Erro ao salvar state:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro interno ao iniciar autorização", code: "STATE_SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL base do app para redirect
    const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
    const redirectUri = `${appBaseUrl}/integrations/tiktok/callback`;

    // Construir URL de autorização TikTok Content (Login Kit v2)
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("scope", Array.from(resolvedScopes).join(","));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", stateHash);

    console.log(`[tiktok-content-oauth-start][${VERSION}] URL gerada para tenant ${tenantId}, packs: ${validPacks.join(",")}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state: stateHash,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-content-oauth-start][${VERSION}] Erro:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
