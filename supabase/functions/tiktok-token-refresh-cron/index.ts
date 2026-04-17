import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ConnectionToRefresh {
  id: string;
  tenant_id: string;
  refresh_token: string;
  token_expires_at: string;
  source: "ads" | "shop" | "content";
}

/**
 * TikTok Token Refresh Cron
 * 
 * Renova access_tokens de TODAS as conexões TikTok (Ads, Shop, Content)
 * que expiram nas próximas 6 horas.
 * 
 * Chamado via pg_cron a cada 6 horas.
 */
Deno.serve(async (req) => {
  console.log(`[tiktok-token-refresh-cron][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Buscar credenciais TikTok (Ads e Shop podem usar apps diferentes)
    const [adsAppId, adsAppSecret, shopAppKey, shopAppSecret] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_SECRET"),
      getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_SHOP_APP_KEY"),
      getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_SHOP_APP_SECRET"),
    ]);

    const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const connections: ConnectionToRefresh[] = [];

    // 1. Buscar conexões Ads que precisam de refresh
    if (adsAppId && adsAppSecret) {
      const { data: adsConns } = await supabase
        .from("tiktok_ads_connections")
        .select("id, tenant_id, refresh_token, token_expires_at")
        .eq("connection_status", "connected")
        .eq("is_active", true)
        .not("refresh_token", "is", null)
        .lt("token_expires_at", sixHoursFromNow);

      if (adsConns) {
        for (const c of adsConns) {
          connections.push({ ...c, source: "ads" });
        }
      }
    }

    // 2. Buscar conexões Shop que precisam de refresh
    if (shopAppKey && shopAppSecret) {
      const { data: shopConns } = await supabase
        .from("tiktok_shop_connections")
        .select("id, tenant_id, refresh_token, token_expires_at")
        .eq("connection_status", "connected")
        .eq("is_active", true)
        .not("refresh_token", "is", null)
        .lt("token_expires_at", sixHoursFromNow);

      if (shopConns) {
        for (const c of shopConns) {
          connections.push({ ...c, source: "shop" });
        }
      }
    }

    // 3. Buscar conexões Content que precisam de refresh
    // Content usa o mesmo app que Ads (Login Kit compartilha credenciais)
    if (adsAppId && adsAppSecret) {
      const { data: contentConns } = await supabase
        .from("tiktok_content_connections")
        .select("id, tenant_id, refresh_token, token_expires_at")
        .eq("connection_status", "connected")
        .eq("is_active", true)
        .not("refresh_token", "is", null)
        .lt("token_expires_at", sixHoursFromNow);

      if (contentConns) {
        for (const c of contentConns) {
          connections.push({ ...c, source: "content" });
        }
      }
    }

    if (connections.length === 0) {
      console.log(`[tiktok-token-refresh-cron][${VERSION}] Nenhum token para renovar`);
      return new Response(
        JSON.stringify({ success: true, refreshed: 0, failed: 0, total: 0, message: "Nenhum token para renovar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[tiktok-token-refresh-cron][${VERSION}] ${connections.length} tokens para renovar`);

    let refreshed = 0;
    let failed = 0;

    for (const conn of connections) {
      try {
        // Determinar credenciais e endpoint baseado no source
        let appId: string;
        let appSecret: string;
        let refreshUrl: string;
        let tableName: string;

        if (conn.source === "shop") {
          appId = shopAppKey!;
          appSecret = shopAppSecret!;
          refreshUrl = "https://auth.tiktok-shops.com/api/v2/token/refresh";
          tableName = "tiktok_shop_connections";
        } else {
          // Ads e Content usam o mesmo endpoint
          appId = adsAppId!;
          appSecret = adsAppSecret!;
          refreshUrl = "https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/";
          tableName = conn.source === "ads" ? "tiktok_ads_connections" : "tiktok_content_connections";
        }

        let newAccessToken: string;
        let newRefreshToken: string | null = null;
        let newExpiresAt: string;

        if (conn.source === "shop") {
          // Commerce API refresh - different payload format
          const params = new URLSearchParams({
            app_key: appId,
            app_secret: appSecret,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
          });

          const resp = await fetch(`${refreshUrl}?${params.toString()}`, { method: "GET" });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

          const result = await resp.json();
          if (result.code !== 0) throw new Error(result.message || "Shop API error");

          newAccessToken = result.data.access_token;
          newRefreshToken = result.data.refresh_token;
          newExpiresAt = new Date(Date.now() + (result.data.access_token_expire_in || 86400) * 1000).toISOString();
        } else {
          // Marketing API / Login Kit refresh
          const resp = await fetch(refreshUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_id: appId,
              secret: appSecret,
              refresh_token: conn.refresh_token,
            }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

          const result = await resp.json();
          if (result.code !== 0) throw new Error(result.message || "Marketing API error");

          newAccessToken = result.data.access_token;
          newRefreshToken = result.data.refresh_token;
          newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }

        // Update the connection
        await supabase
          .from(tableName as any)
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken || conn.refresh_token,
            token_expires_at: newExpiresAt,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        refreshed++;
        console.log(`[tiktok-token-refresh-cron][${VERSION}] ✅ ${conn.source} tenant=${conn.tenant_id}`);
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[tiktok-token-refresh-cron][${VERSION}] ❌ ${conn.source} tenant=${conn.tenant_id}: ${errMsg}`);

        const tableName = conn.source === "shop" 
          ? "tiktok_shop_connections" 
          : conn.source === "ads" 
            ? "tiktok_ads_connections" 
            : "tiktok_content_connections";

        await supabase
          .from(tableName as any)
          .update({ last_error: errMsg, connection_status: "error" })
          .eq("id", conn.id);
      }
    }

    const summary = { success: true, refreshed, failed, total: connections.length };
    console.log(`[tiktok-token-refresh-cron][${VERSION}] Done:`, summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-token-refresh-cron][${VERSION}] Fatal:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
