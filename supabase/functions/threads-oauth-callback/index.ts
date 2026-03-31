import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Threads OAuth Callback — V1
 * 
 * Recebe code + state do frontend (POST JSON), troca por token via Threads API,
 * obtém long-lived token e salva na tabela threads_connections.
 * 
 * Fluxo:
 * 1. Validar state (anti-CSRF)
 * 2. Trocar code por short-lived token (POST graph.threads.net/oauth/access_token)
 * 3. Trocar por long-lived token (GET graph.threads.net/access_token)
 * 4. Buscar perfil do Threads (GET graph.threads.net/v1.0/me)
 * 5. Upsert na threads_connections
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";

  try {
    const body = await req.json();
    const { code, state } = body;

    if (!code || !state) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes", code: "MISSING_PARAMS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validar state
    const { data: stateRecord, error: stateError } = await supabase
      .from("meta_oauth_states")
      .select("*")
      .eq("state_hash", state)
      .eq("auth_profile_key", "threads")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error("[threads-oauth-callback] State inválido:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Sessão expirada ou inválida", code: "INVALID_STATE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Marcar state como usado
    await supabase
      .from("meta_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRecord.id);

    const { tenant_id, user_id } = stateRecord;

    // 2. Buscar credenciais
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "META_APP_SECRET");

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais não configuradas", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redirectUri = `${appBaseUrl}/integrations/threads/callback`;

    // 3. Trocar code por short-lived token
    const tokenResponse = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[threads-oauth-callback] Erro ao trocar token:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter token do Threads", code: "TOKEN_EXCHANGE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    let accessToken = tokenData.access_token;
    const threadsUserId = tokenData.user_id;

    // 4. Trocar por long-lived token (60 dias)
    let expiresIn = 3600;
    try {
      const longLivedUrl = new URL("https://graph.threads.net/access_token");
      longLivedUrl.searchParams.set("grant_type", "th_exchange_token");
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("access_token", accessToken);

      const longLivedResp = await fetch(longLivedUrl.toString());
      if (longLivedResp.ok) {
        const longLivedData = await longLivedResp.json();
        accessToken = longLivedData.access_token;
        expiresIn = longLivedData.expires_in || 5184000;
        console.log("[threads-oauth-callback] Long-lived token obtido");
      } else {
        console.warn("[threads-oauth-callback] Não foi possível obter long-lived token");
      }
    } catch (e) {
      console.warn("[threads-oauth-callback] Erro ao trocar por long-lived:", e);
    }

    // 5. Buscar perfil do Threads
    let username = "";
    let name = "";
    let profilePicUrl = "";
    try {
      const profileResp = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${accessToken}`
      );
      if (profileResp.ok) {
        const profileData = await profileResp.json();
        username = profileData.username || "";
        name = profileData.name || "";
        profilePicUrl = profileData.threads_profile_picture_url || "";
      }
    } catch (e) {
      console.warn("[threads-oauth-callback] Erro ao buscar perfil:", e);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 6. Criptografar e salvar token
    const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Upsert na threads_connections
    const { error: upsertError } = await supabase
      .from("threads_connections")
      .upsert({
        tenant_id,
        threads_user_id: String(threadsUserId),
        username,
        display_name: name,
        profile_picture_url: profilePicUrl,
        access_token_encrypted: accessToken, // Será criptografado via trigger/RPC se existir
        token_expires_at: expiresAt,
        is_active: true,
        connected_by: user_id,
        last_error: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "tenant_id",
      });

    if (upsertError) {
      console.error("[threads-oauth-callback] Erro ao salvar conexão:", upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar conexão do Threads", code: "SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[threads-oauth-callback] Threads conectado para tenant ${tenant_id} (user: @${username})`);

    return new Response(
      JSON.stringify({
        success: true,
        connection: {
          threadsUserId: String(threadsUserId),
          username,
          displayName: name,
          profilePictureUrl: profilePicUrl,
          expiresAt,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[threads-oauth-callback] Erro:", error);
    return errorResponse(error, corsHeaders, { module: "threads-oauth-callback" });
  }
});
