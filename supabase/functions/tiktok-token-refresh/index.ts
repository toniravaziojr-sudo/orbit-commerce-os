import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: refresh TikTok Ads tokens
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Token Refresh
 * 
 * Renova access_token usando refresh_token para conexões TikTok Ads.
 * Pode ser chamado por cron ou manualmente.
 * 
 * Body: { tenantId } (opcional — se vazio, renova todos os tokens expirando)
 */
serve(async (req) => {
  console.log(`[tiktok-token-refresh][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { tenantId } = body;

    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_ID");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_SECRET");

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais TikTok não configuradas", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexões que precisam de refresh
    let query = supabase
      .from("tiktok_ads_connections")
      .select("id, tenant_id, refresh_token, token_expires_at")
      .eq("connection_status", "connected")
      .eq("is_active", true)
      .not("refresh_token", "is", null);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      // Renovar tokens que expiram nas próximas 2 horas
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      query = query.lt("token_expires_at", twoHoursFromNow);
    }

    const { data: connections, error: queryError } = await query;

    if (queryError) {
      console.error(`[tiktok-token-refresh][${VERSION}] Query error:`, queryError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar conexões", code: "QUERY_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, refreshed: 0, message: "Nenhum token para renovar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let refreshed = 0;
    let failed = 0;

    for (const conn of connections) {
      try {
        const refreshResponse = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: appId,
            secret: appSecret,
            refresh_token: conn.refresh_token,
          }),
        });

        if (!refreshResponse.ok) {
          throw new Error(`HTTP ${refreshResponse.status}`);
        }

        const refreshData = await refreshResponse.json();

        if (refreshData.code !== 0) {
          throw new Error(refreshData.message || "TikTok API error");
        }

        const newAccessToken = refreshData.data.access_token;
        const newRefreshToken = refreshData.data.refresh_token;
        const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // Update tiktok_ads_connections
        await supabase
          .from("tiktok_ads_connections")
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken || conn.refresh_token,
            token_expires_at: newExpiresAt,
            last_error: null,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        // Dual-write to marketing_integrations
        await supabase
          .from("marketing_integrations")
          .update({
            tiktok_access_token: newAccessToken,
            tiktok_refresh_token: newRefreshToken || conn.refresh_token,
            tiktok_token_expires_at: newExpiresAt,
          })
          .eq("tenant_id", conn.tenant_id);

        refreshed++;
        console.log(`[tiktok-token-refresh][${VERSION}] Refreshed tenant ${conn.tenant_id}`);

      } catch (refreshErr) {
        failed++;
        const errMsg = refreshErr instanceof Error ? refreshErr.message : "Unknown error";
        console.error(`[tiktok-token-refresh][${VERSION}] Failed for tenant ${conn.tenant_id}:`, errMsg);

        await supabase
          .from("tiktok_ads_connections")
          .update({
            last_error: errMsg,
            connection_status: "error",
          })
          .eq("id", conn.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, refreshed, failed, total: connections.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[tiktok-token-refresh][${VERSION}] Erro:`, error);
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
