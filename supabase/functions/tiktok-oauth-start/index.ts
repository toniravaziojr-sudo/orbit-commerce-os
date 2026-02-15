import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.0.0"; // Hub TikTok: scope packs + product type
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok OAuth Start (Hub v2)
 * 
 * Gera URL de autorização para conectar conta TikTok Ads (Marketing API).
 * Suporta scope packs incrementais.
 * 
 * Body: { tenantId, scopePacks?: string[], returnPath? }
 * Resposta: { success: true, authUrl, state }
 */

// Scope Pack Registry (Ads only for Phase 1)
const TIKTOK_ADS_SCOPE_PACKS: Record<string, string[]> = {
  pixel: ["event.track.create", "event.track.view"],
  ads_read: ["advertiser.data.readonly"],
  ads_manage: ["advertiser.data.manage", "campaign.manage", "creative.manage"],
  reporting: ["report.read"],
  audience: ["audience.manage"],
};

serve(async (req) => {
  console.log(`[tiktok-oauth-start][${VERSION}] Request received`);

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
      scopePacks = ["pixel", "ads_read"], 
      returnPath = "/integrations" 
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

    // Buscar credenciais do TikTok
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_ID");

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

    // Resolver escopos a partir dos packs
    const resolvedScopes = new Set<string>();
    const validPacks: string[] = [];
    
    for (const pack of scopePacks) {
      const scopes = TIKTOK_ADS_SCOPE_PACKS[pack];
      if (scopes) {
        scopes.forEach(s => resolvedScopes.add(s));
        validPacks.push(pack);
      } else {
        console.warn(`[tiktok-oauth-start] Pack desconhecido: ${pack}`);
      }
    }

    // Gerar state único (anti-CSRF)
    const stateHash = crypto.randomUUID();

    // Salvar state no banco
    const { error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        state_hash: stateHash,
        return_path: returnPath,
        scope_packs: validPacks,
        product: "ads",
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
    const authUrl = new URL("https://business-api.tiktok.com/portal/auth");
    authUrl.searchParams.set("app_id", appId);
    authUrl.searchParams.set("state", stateHash);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("rid", crypto.randomUUID().slice(0, 8));

    console.log(`[tiktok-oauth-start][${VERSION}] URL gerada para tenant ${tenantId}, packs: ${validPacks.join(",")}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state: stateHash,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[tiktok-oauth-start][${VERSION}] Erro:`, error);
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
