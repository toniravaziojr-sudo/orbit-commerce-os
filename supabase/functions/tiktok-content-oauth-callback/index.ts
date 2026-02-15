import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 4: TikTok Content OAuth callback
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Content OAuth Callback
 * 
 * Processa callback OAuth do TikTok Content (Login Kit v2).
 * Troca code por access_token e salva em tiktok_content_connections.
 * 
 * Body: { code, state }
 */
serve(async (req) => {
  console.log(`[tiktok-content-oauth-callback][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    // Login Kit uses "code" (not "auth_code")
    const code = body.code || body.auth_code;
    const { state } = body;

    if (!code || !state) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes", code: "MISSING_PARAMS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar state (anti-CSRF) — product='content'
    const { data: stateRecord, error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .select("*")
      .eq("state_hash", state)
      .eq("product", "content")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error(`[tiktok-content-oauth-callback][${VERSION}] State inválido:`, stateError);
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
    console.log(`[tiktok-content-oauth-callback][${VERSION}] Processando tenant ${tenant_id}, packs: ${scope_packs}`);

    // Buscar credenciais do TikTok Content
    const clientKey = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_CONTENT_CLIENT_KEY");
    const clientSecret = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_CONTENT_CLIENT_SECRET");

    if (!clientKey || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração TikTok Content não configurada", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
    const redirectUri = `${appBaseUrl}/integrations/tiktok/callback`;

    // Trocar code por access_token (Login Kit v2)
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenText = await tokenResponse.text();
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error(`[tiktok-content-oauth-callback][${VERSION}] Token response not JSON:`, tokenText);
      return new Response(
        JSON.stringify({ success: false, error: "Resposta inesperada do TikTok", code: "TOKEN_PARSE_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.error || !tokenData.access_token) {
      console.error(`[tiktok-content-oauth-callback][${VERSION}] Token error:`, tokenData);
      return new Response(
        JSON.stringify({
          success: false,
          error: tokenData.error_description || tokenData.error || "Erro ao autorizar conta TikTok",
          code: "TIKTOK_API_ERROR",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 86400;
    const refreshExpiresIn = tokenData.refresh_expires_in || 86400 * 365;
    const openId = tokenData.open_id || "";
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000).toISOString();

    // Fetch user info
    let displayName = "";
    let avatarUrl = "";

    try {
      const userInfoResp = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (userInfoResp.ok) {
        const userInfoText = await userInfoResp.text();
        const userInfo = JSON.parse(userInfoText);
        if (userInfo.data?.user) {
          displayName = userInfo.data.user.display_name || "";
          avatarUrl = userInfo.data.user.avatar_url || "";
        }
      }
    } catch (err) {
      console.warn(`[tiktok-content-oauth-callback][${VERSION}] User info error:`, err);
    }

    // Salvar em tiktok_content_connections
    const connectionData = {
      tenant_id,
      connected_by: user_id,
      open_id: openId || null,
      union_id: tokenData.union_id || null,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      scope_packs: scope_packs || ["content"],
      granted_scopes: tokenData.scope ? tokenData.scope.split(",") : [],
      is_active: true,
      connection_status: "connected",
      last_error: null,
      connected_at: new Date().toISOString(),
      assets: {},
    };

    const { error: upsertError } = await supabase
      .from("tiktok_content_connections")
      .upsert(connectionData, { onConflict: "tenant_id" });

    if (upsertError) {
      console.error(`[tiktok-content-oauth-callback][${VERSION}] Save failed:`, upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar a conexão", code: "SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[tiktok-content-oauth-callback][${VERSION}] Conexão TikTok Content salva para tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        returnPath: return_path || "/integrations",
        connection: {
          openId,
          displayName,
          expiresAt,
          scopePacks: scope_packs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-content-oauth-callback][${VERSION}] Erro:`, error);
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
