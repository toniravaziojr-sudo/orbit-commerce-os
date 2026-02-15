import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v3.0.0"; // Fase 2: removido dual-write legado
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log(`[tiktok-oauth-callback][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { auth_code, state } = body;

    if (!auth_code || !state) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes", code: "MISSING_PARAMS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar state (anti-CSRF)
    const { data: stateRecord, error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .select("*")
      .eq("state_hash", state)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error(`[tiktok-oauth-callback][${VERSION}] State inválido:`, stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Sessão de autorização expirada ou inválida", code: "INVALID_STATE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Marcar state como usado
    await supabase
      .from("tiktok_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRecord.id);

    const { tenant_id, user_id, return_path, scope_packs } = stateRecord;
    console.log(`[tiktok-oauth-callback][${VERSION}] Processando tenant ${tenant_id}, packs: ${scope_packs}`);

    // Buscar credenciais
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_ID");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_SECRET");

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração TikTok não configurada", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trocar auth_code por access_token
    const tokenResponse = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: auth_code,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error(`[tiktok-oauth-callback][${VERSION}] Token exchange failed:`, errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter tokens de acesso", code: "TOKEN_EXCHANGE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.code !== 0) {
      console.error(`[tiktok-oauth-callback][${VERSION}] API error:`, tokenData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: tokenData.message || "Erro ao autorizar conta TikTok", 
          code: "TIKTOK_API_ERROR" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.data.access_token;
    const advertiserIds = tokenData.data.advertiser_ids || [];
    const grantedScopes = tokenData.data.scope || [];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Asset discovery: buscar detalhes dos advertisers
    let advertiserName = "";
    let advertiserId = "";
    const discoveredAssets: Record<string, unknown> = {
      advertiser_ids: advertiserIds,
      pixels: [],
    };
    
    if (advertiserIds.length > 0) {
      advertiserId = advertiserIds[0];
      
      try {
        const advertiserResponse = await fetch(
          `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=["${advertiserId}"]`,
          {
            method: "GET",
            headers: { "Access-Token": accessToken },
          }
        );
        
        if (advertiserResponse.ok) {
          const advertiserData = await advertiserResponse.json();
          if (advertiserData.code === 0 && advertiserData.data?.list?.length > 0) {
            advertiserName = advertiserData.data.list[0].advertiser_name || advertiserData.data.list[0].name || "";
          }
        }
      } catch (advError) {
        console.warn(`[tiktok-oauth-callback][${VERSION}] Advertiser info error:`, advError);
      }
    }

    // ========== FONTE DE VERDADE: tiktok_ads_connections ==========
    const connectionData = {
      tenant_id,
      connected_by: user_id,
      tiktok_user_id: tokenData.data.creator_id || null,
      advertiser_id: advertiserId || null,
      advertiser_name: advertiserName || null,
      access_token: accessToken,
      refresh_token: tokenData.data.refresh_token || null,
      token_expires_at: expiresAt,
      scope_packs: scope_packs || ["pixel"],
      granted_scopes: grantedScopes,
      is_active: true,
      connection_status: "connected",
      last_error: null,
      connected_at: new Date().toISOString(),
      assets: discoveredAssets,
    };

    const { error: upsertError } = await supabase
      .from("tiktok_ads_connections")
      .upsert(connectionData, { onConflict: "tenant_id" });

    if (upsertError) {
      console.error(`[tiktok-oauth-callback][${VERSION}] Save to tiktok_ads_connections failed:`, upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar a conexão", code: "SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[tiktok-oauth-callback][${VERSION}] Conexão TikTok Ads salva para tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        returnPath: return_path || "/integrations",
        connection: {
          advertiserId,
          advertiserName,
          expiresAt,
          scopes: grantedScopes,
          advertiserCount: advertiserIds.length,
          scopePacks: scope_packs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[tiktok-oauth-callback][${VERSION}] Erro:`, error);
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
