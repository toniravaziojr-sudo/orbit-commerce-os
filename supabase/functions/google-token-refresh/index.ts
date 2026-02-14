import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Google token refresh
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[google-token-refresh][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tenantId } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connection
    const { data: conn, error: connError } = await supabase
      .from("google_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão não encontrada", code: "NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conn.refresh_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Refresh token ausente. Reconecte a conta.", code: "NO_REFRESH_TOKEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token still valid (5 min buffer)
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at);
      const bufferMs = 5 * 60 * 1000;
      if (expiresAt.getTime() - Date.now() > bufferMs) {
        return new Response(
          JSON.stringify({ success: true, access_token: conn.access_token, already_valid: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get credentials
    const [clientId, clientSecret] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_SECRET"),
    ]);

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Google não configuradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error(`[google-token-refresh][${VERSION}] Parse error:`, tokenText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao processar resposta do Google" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenRes.ok || tokenData.error) {
      const errorMsg = tokenData.error_description || tokenData.error || "Falha ao renovar token";
      console.error(`[google-token-refresh][${VERSION}] Refresh failed:`, tokenData);

      // Mark connection as error
      await supabase
        .from("google_connections")
        .update({
          connection_status: "error",
          last_error: errorMsg,
        })
        .eq("id", conn.id);

      return new Response(
        JSON.stringify({ success: false, error: errorMsg, code: "REFRESH_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Update connection
    await supabase
      .from("google_connections")
      .update({
        access_token: tokenData.access_token,
        token_expires_at: newExpiresAt,
        connection_status: "connected",
        last_error: null,
      })
      .eq("id", conn.id);

    console.log(`[google-token-refresh][${VERSION}] Token refreshed for tenant ${tenantId}`);

    return new Response(
      JSON.stringify({ success: true, access_token: tokenData.access_token, expires_at: newExpiresAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[google-token-refresh][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
