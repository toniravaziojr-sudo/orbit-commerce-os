// ==============================================
// YOUTUBE OAUTH CALLBACK - Exchange code for tokens
// ==============================================

import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Get app URL from environment or construct from SUPABASE_URL
function getAppUrl(): string {
  // Try common environment variables first
  const appUrl = Deno.env.get("APP_URL") || Deno.env.get("VITE_APP_URL");
  if (appUrl) return appUrl;
  
  // Construct from project ref (extract from SUPABASE_URL)
  if (SUPABASE_URL) {
    // SUPABASE_URL is like https://xxx.supabase.co
    const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
    // Default to preview URL pattern
    return `https://id-preview--${projectRef}.lovable.app`;
  }
  
  return "https://app.comandocentral.com.br";
}

Deno.serve(async (req) => {
  try {
    // Validate configuration
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[youtube-oauth-callback] Missing configuration");
      return redirectWithError("Configuração incompleta do servidor");
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth error
    if (error) {
      console.error("[youtube-oauth-callback] OAuth error:", error);
      return redirectWithError(`Erro do Google: ${error}`);
    }

    if (!code || !state) {
      return redirectWithError("Parâmetros de callback inválidos");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate state and get tenant info
    const { data: stateData, error: stateError } = await supabase
      .from("youtube_oauth_states")
      .select("*")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error("[youtube-oauth-callback] Invalid or expired state:", stateError);
      return redirectWithError("Sessão expirada. Tente novamente.");
    }

    const { tenant_id, user_id, redirect_url } = stateData;

    // Exchange code for tokens
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const callbackUrl = `${SUPABASE_URL}/functions/v1/youtube-oauth-callback`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error("[youtube-oauth-callback] Token exchange failed:", tokenData);
      return redirectWithError(tokenData.error_description || "Erro ao obter tokens");
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      console.error("[youtube-oauth-callback] Missing tokens in response");
      return redirectWithError("Tokens não recebidos. Tente novamente.");
    }

    // Get channel info using YouTube Data API
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const channelData = await channelResponse.json();

    if (!channelResponse.ok || !channelData.items?.length) {
      console.error("[youtube-oauth-callback] Failed to get channel info:", channelData);
      return redirectWithError("Não foi possível obter informações do canal");
    }

    const channel = channelData.items[0];
    const channelInfo = {
      channel_id: channel.id,
      channel_title: channel.snippet?.title,
      channel_thumbnail_url: channel.snippet?.thumbnails?.default?.url,
      channel_custom_url: channel.snippet?.customUrl,
      subscriber_count: parseInt(channel.statistics?.subscriberCount || "0"),
      video_count: parseInt(channel.statistics?.videoCount || "0"),
    };

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert connection
    const { error: upsertError } = await supabase
      .from("youtube_connections")
      .upsert({
        tenant_id,
        ...channelInfo,
        access_token,
        refresh_token,
        token_type: "Bearer",
        token_expires_at: tokenExpiresAt,
        scopes: stateData.scopes,
        is_active: true,
        connection_status: "connected",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        connected_by: user_id,
        profile_data: {
          description: channel.snippet?.description,
          country: channel.snippet?.country,
          publishedAt: channel.snippet?.publishedAt,
        },
      }, {
        onConflict: "tenant_id",
      });

    if (upsertError) {
      console.error("[youtube-oauth-callback] Failed to save connection:", upsertError);
      return redirectWithError("Erro ao salvar conexão");
    }

    // Clean up used state
    await supabase
      .from("youtube_oauth_states")
      .delete()
      .eq("state", state);

    console.log(`[youtube-oauth-callback] Successfully connected YouTube for tenant ${tenant_id}`);

    // Redirect back to app
    const appUrl = redirect_url || getAppUrl();
    const successUrl = `${appUrl}/integrations/youtube/callback?youtube_connected=true&channel=${encodeURIComponent(channelInfo.channel_title || "")}`;

    return new Response(null, {
      status: 302,
      headers: { Location: successUrl },
    });

  } catch (error) {
    console.error("[youtube-oauth-callback] Error:", error);
    return redirectWithError(error instanceof Error ? error.message : "Erro interno");
  }
});

function redirectWithError(message: string): Response {
  const appUrl = getAppUrl();
  const errorUrl = `${appUrl}/integrations/youtube/callback?youtube_error=${encodeURIComponent(message)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: errorUrl },
  });
}
