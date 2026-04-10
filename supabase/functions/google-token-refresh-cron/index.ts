import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Google Token Refresh Cron
 * 
 * Renova access_tokens de TODAS as conexões Google ativas
 * que expiram nos próximos 10 minutos.
 * 
 * Chamado via schedule a cada 5 minutos.
 */
Deno.serve(async (req) => {
  console.log(`[google-token-refresh-cron][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const [clientId, clientSecret] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_SECRET"),
    ]);

    if (!clientId || !clientSecret) {
      console.log("[google-token-refresh-cron] Google credentials not configured, skipping");
      return new Response(
        JSON.stringify({ success: true, refreshed: 0, skipped: true, reason: "no_credentials" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find all active connections with tokens expiring in the next 10 minutes
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: connections, error: fetchError } = await supabase
      .from("google_connections")
      .select("id, tenant_id, refresh_token, token_expires_at, access_token")
      .eq("is_active", true)
      .not("refresh_token", "is", null)
      .lt("token_expires_at", tenMinutesFromNow);

    if (fetchError) {
      console.error("[google-token-refresh-cron] Failed to fetch connections:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connections || connections.length === 0) {
      console.log("[google-token-refresh-cron] No connections need refresh");
      return new Response(
        JSON.stringify({ success: true, refreshed: 0, total_checked: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[google-token-refresh-cron] Found ${connections.length} connections to refresh`);

    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        // Call Google token endpoint
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text();
          throw new Error(`Token refresh failed (${tokenResponse.status}): ${errorBody}`);
        }

        const tokenData = await tokenResponse.json();
        const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

        // Update connection with new token
        const { error: updateError } = await supabase
          .from("google_connections")
          .update({
            access_token: tokenData.access_token,
            token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }

        refreshed++;
        console.log(`[google-token-refresh-cron] Refreshed token for tenant ${conn.tenant_id}`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`tenant=${conn.tenant_id}: ${msg}`);
        console.error(`[google-token-refresh-cron] Failed for tenant ${conn.tenant_id}:`, msg);

        // If refresh token is invalid, mark connection
        if (msg.includes("invalid_grant") || msg.includes("Token has been revoked")) {
          await supabase
            .from("google_connections")
            .update({
              connection_status: "expired",
              last_error: "Refresh token inválido. Reconexão necessária.",
              updated_at: new Date().toISOString(),
            })
            .eq("id", conn.id);
          console.warn(`[google-token-refresh-cron] Marked connection ${conn.id} as expired (invalid_grant)`);
        }
      }
    }

    const result = {
      success: true,
      refreshed,
      failed,
      total: connections.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`[google-token-refresh-cron] Completed: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[google-token-refresh-cron] Fatal error:`, msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
