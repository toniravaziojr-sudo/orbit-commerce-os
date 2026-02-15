import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 3: TikTok Shop OAuth callback
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop OAuth Callback
 * 
 * Processa callback OAuth do TikTok Shop (Seller API).
 * Troca auth_code por access_token e salva em tiktok_shop_connections.
 * 
 * Body: { auth_code, state }
 */
serve(async (req) => {
  console.log(`[tiktok-shop-oauth-callback][${VERSION}] Request received`);

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

    // Validar state (anti-CSRF) — product='shop'
    const { data: stateRecord, error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .select("*")
      .eq("state_hash", state)
      .eq("product", "shop")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error(`[tiktok-shop-oauth-callback][${VERSION}] State inválido:`, stateError);
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
    console.log(`[tiktok-shop-oauth-callback][${VERSION}] Processando tenant ${tenant_id}, packs: ${scope_packs}`);

    // Buscar credenciais do TikTok Shop
    const appKey = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_SHOP_APP_KEY");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_SHOP_APP_SECRET");

    if (!appKey || !appSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração TikTok Shop não configurada", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trocar auth_code por access_token (TikTok Shop API)
    const tokenResponse = await fetch("https://auth.tiktok-shops.com/api/v2/token/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_key: appKey,
        app_secret: appSecret,
        auth_code: auth_code,
        grant_type: "authorized_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error(`[tiktok-shop-oauth-callback][${VERSION}] Token exchange failed:`, errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter tokens de acesso", code: "TOKEN_EXCHANGE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.code !== 0) {
      console.error(`[tiktok-shop-oauth-callback][${VERSION}] API error:`, tokenData);
      return new Response(
        JSON.stringify({
          success: false,
          error: tokenData.message || "Erro ao autorizar conta TikTok Shop",
          code: "TIKTOK_API_ERROR",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenInfo = tokenData.data;
    const accessToken = tokenInfo.access_token;
    const refreshToken = tokenInfo.refresh_token;
    const expiresIn = tokenInfo.access_token_expire_in || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Descobrir shops autorizados
    let shopName = "";
    let shopId = "";
    let shopRegion = "";
    const discoveredAssets: Record<string, unknown> = {
      shops: [],
    };

    try {
      const shopsResponse = await fetch(
        `https://open-api.tiktokglobalshop.com/authorization/202309/shops?app_key=${appKey}`,
        {
          method: "GET",
          headers: {
            "x-tts-access-token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (shopsResponse.ok) {
        const shopsData = await shopsResponse.json();
        if (shopsData.code === 0 && shopsData.data?.shops?.length > 0) {
          const firstShop = shopsData.data.shops[0];
          shopId = firstShop.id || firstShop.shop_id || "";
          shopName = firstShop.shop_name || firstShop.name || "";
          shopRegion = firstShop.region || "";
          discoveredAssets.shops = shopsData.data.shops.map((s: any) => ({
            id: s.id || s.shop_id,
            name: s.shop_name || s.name,
            region: s.region,
          }));
        }
      }
    } catch (shopErr) {
      console.warn(`[tiktok-shop-oauth-callback][${VERSION}] Shop info error:`, shopErr);
    }

    // Salvar em tiktok_shop_connections
    const connectionData = {
      tenant_id,
      connected_by: user_id,
      shop_id: shopId || null,
      shop_name: shopName || null,
      shop_region: shopRegion || null,
      seller_id: tokenInfo.seller_id || null,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expires_at: expiresAt,
      scope_packs: scope_packs || ["catalog"],
      granted_scopes: tokenInfo.granted_scopes || [],
      is_active: true,
      connection_status: "connected",
      last_error: null,
      connected_at: new Date().toISOString(),
      assets: discoveredAssets,
    };

    const { error: upsertError } = await supabase
      .from("tiktok_shop_connections")
      .upsert(connectionData, { onConflict: "tenant_id" });

    if (upsertError) {
      console.error(`[tiktok-shop-oauth-callback][${VERSION}] Save failed:`, upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar a conexão", code: "SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[tiktok-shop-oauth-callback][${VERSION}] Conexão TikTok Shop salva para tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        returnPath: return_path || "/integrations",
        connection: {
          shopId,
          shopName,
          shopRegion,
          expiresAt,
          scopePacks: scope_packs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-oauth-callback][${VERSION}] Erro:`, error);
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
