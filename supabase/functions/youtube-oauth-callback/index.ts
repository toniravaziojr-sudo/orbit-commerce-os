// ==============================================
// YOUTUBE OAUTH CALLBACK - Exchange code for tokens
// PHASE 2: Dual-write to google_connections + youtube_connections
// Production-ready with proper error handling
// ==============================================

import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v2.0.0"; // Phase 2: dual-write to google_connections
// ===================

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Error code mapping for better UX
const OAUTH_ERROR_MESSAGES: Record<string, { code: string; message: string }> = {
  access_denied: {
    code: 'access_denied',
    message: 'Você cancelou a autorização do YouTube.',
  },
  consent_required: {
    code: 'consent_required',
    message: 'É necessário consentir todas as permissões solicitadas.',
  },
  unauthorized_client: {
    code: 'testing_mode_restriction',
    message: 'Seu email não está cadastrado como usuário de teste. Contate o administrador.',
  },
  org_internal: {
    code: 'unverified_app_cap',
    message: 'Limite de usuários atingido. O app precisa de verificação pelo Google.',
  },
};

function getAppUrl(): string {
  const appUrl = Deno.env.get("APP_URL") || Deno.env.get("VITE_APP_URL");
  if (appUrl) return appUrl;
  
  if (SUPABASE_URL) {
    const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
    return `https://id-preview--${projectRef}.lovable.app`;
  }
  
  return "https://app.comandocentral.com.br";
}

function parseGoogleError(error: string, errorDescription?: string): { code: string; message: string } {
  const knownError = OAUTH_ERROR_MESSAGES[error];
  if (knownError) return knownError;

  if (errorDescription) {
    const desc = errorDescription.toLowerCase();
    if (desc.includes('not authorized') || desc.includes('test user')) {
      return { code: 'testing_mode_restriction', message: 'OAuth em modo Testing: apenas usuários de teste cadastrados podem autorizar.' };
    }
    if (desc.includes('user_limit') || desc.includes('limit')) {
      return { code: 'unverified_app_cap', message: 'Limite de usuários atingido.' };
    }
    if (desc.includes('invalid_grant')) {
      return { code: 'token_expired', message: 'Código de autorização expirado. Tente novamente.' };
    }
  }

  return { code: error || 'unknown_error', message: errorDescription || `Erro do Google: ${error}` };
}

Deno.serve(async (req) => {
  try {
    console.log(`[youtube-oauth-callback][${VERSION}] Request received`);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[youtube-oauth-callback][${VERSION}] Missing configuration`);
      return redirectWithError("Configuração incompleta do servidor", "config_missing");
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      console.error(`[youtube-oauth-callback][${VERSION}] OAuth error:`, error, errorDescription);
      const parsedError = parseGoogleError(error, errorDescription || undefined);
      return redirectWithError(parsedError.message, parsedError.code);
    }

    if (!code || !state) {
      return redirectWithError("Parâmetros de callback inválidos", "invalid_params");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate state
    const { data: stateData, error: stateError } = await supabase
      .from("youtube_oauth_states")
      .select("*")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error(`[youtube-oauth-callback][${VERSION}] Invalid or expired state:`, stateError);
      return redirectWithError("Sessão expirada. Tente novamente.", "state_expired");
    }

    const { tenant_id, user_id, redirect_url } = stateData;

    // Exchange code for tokens
    const callbackUrl = `${SUPABASE_URL}/functions/v1/youtube-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
      console.error(`[youtube-oauth-callback][${VERSION}] Token exchange failed:`, tokenData);
      const parsedError = parseGoogleError(tokenData.error || 'token_exchange_failed', tokenData.error_description);
      
      await supabase
        .from("youtube_connections")
        .upsert({
          tenant_id,
          channel_id: 'error_' + Date.now(),
          access_token: '',
          refresh_token: '',
          token_expires_at: new Date().toISOString(),
          is_active: false,
          connection_status: 'error',
          oauth_error_code: parsedError.code,
          oauth_error_details: tokenData,
          last_error: parsedError.message,
        }, { onConflict: "tenant_id" });

      return redirectWithError(parsedError.message, parsedError.code);
    }

    const { access_token, refresh_token, expires_in, scope: grantedScopeStr } = tokenData;

    if (!access_token) {
      return redirectWithError("Token de acesso não recebido. Tente novamente.", "missing_token");
    }

    if (!refresh_token) {
      console.warn(`[youtube-oauth-callback][${VERSION}] No refresh_token - user may have already authorized`);
    }

    // Get channel info
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      if (channelData.error?.errors?.[0]?.reason === 'quotaExceeded') {
        return redirectWithError("Quota da API do YouTube excedida. Tente novamente amanhã.", "quota_exceeded");
      }
      return redirectWithError("Não foi possível obter informações do canal", "channel_fetch_failed");
    }

    if (!channelData.items?.length) {
      return redirectWithError("Nenhum canal encontrado. Você precisa ter um canal do YouTube.", "no_channel");
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

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    const grantedScopes = grantedScopeStr ? grantedScopeStr.split(" ") : [];

    // === DUAL WRITE: youtube_connections (legacy) ===
    const { error: upsertError } = await supabase
      .from("youtube_connections")
      .upsert({
        tenant_id,
        ...channelInfo,
        access_token,
        refresh_token: refresh_token || '',
        token_type: "Bearer",
        token_expires_at: tokenExpiresAt,
        scopes: stateData.scopes,
        is_active: true,
        connection_status: "connected",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        oauth_error_code: null,
        oauth_error_details: null,
        connected_by: user_id,
        profile_data: {
          description: channel.snippet?.description,
          country: channel.snippet?.country,
          publishedAt: channel.snippet?.publishedAt,
        },
      }, { onConflict: "tenant_id" });

    if (upsertError) {
      console.error(`[youtube-oauth-callback][${VERSION}] Legacy upsert error:`, upsertError);
    }

    // === DUAL WRITE: google_connections (Hub Google) ===
    try {
      // Get user info for Google Hub
      let googleUserInfo: any = {};
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        googleUserInfo = await userInfoRes.json();
      } catch (e) {
        console.warn(`[youtube-oauth-callback][${VERSION}] UserInfo fetch failed:`, e);
      }

      const youtubeAssets = {
        youtube_channels: [{
          id: channelInfo.channel_id,
          title: channelInfo.channel_title,
          thumbnail_url: channelInfo.channel_thumbnail_url,
          subscriber_count: channelInfo.subscriber_count,
        }],
      };

      // Check if google_connections already exists for this tenant
      const { data: existingGC } = await supabase
        .from("google_connections")
        .select("id, scope_packs, refresh_token, assets, granted_scopes")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (existingGC) {
        // Merge: add youtube pack and assets
        const mergedPacks = [...new Set([...(existingGC.scope_packs || []), "youtube"])];
        const mergedScopes = [...new Set([...(existingGC.granted_scopes || []), ...grantedScopes])];
        const mergedAssets = { ...(existingGC.assets || {}), ...youtubeAssets };

        await supabase
          .from("google_connections")
          .update({
            access_token,
            refresh_token: refresh_token || existingGC.refresh_token,
            token_expires_at: tokenExpiresAt,
            scope_packs: mergedPacks,
            granted_scopes: mergedScopes,
            assets: mergedAssets,
            is_active: true,
            connection_status: "connected",
            last_sync_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", existingGC.id);
      } else {
        // Insert new google_connections
        await supabase
          .from("google_connections")
          .insert({
            tenant_id,
            connected_by: user_id,
            google_user_id: googleUserInfo.id || null,
            google_email: googleUserInfo.email || null,
            display_name: googleUserInfo.name || channelInfo.channel_title,
            avatar_url: googleUserInfo.picture || channelInfo.channel_thumbnail_url,
            access_token,
            refresh_token: refresh_token || null,
            token_expires_at: tokenExpiresAt,
            scope_packs: ["youtube"],
            granted_scopes: grantedScopes,
            is_active: true,
            connection_status: "connected",
            last_error: null,
            last_sync_at: new Date().toISOString(),
            assets: youtubeAssets,
            metadata: { migrated_from: "youtube_oauth_callback" },
          });
      }

      console.log(`[youtube-oauth-callback][${VERSION}] Dual-write to google_connections successful`);
    } catch (gcError) {
      // Non-fatal: legacy still works
      console.error(`[youtube-oauth-callback][${VERSION}] google_connections write failed (non-fatal):`, gcError);
    }

    // Clean up used state
    await supabase.from("youtube_oauth_states").delete().eq("state", state);

    console.log(`[youtube-oauth-callback][${VERSION}] Successfully connected YouTube for tenant ${tenant_id}`);

    // Redirect back to app
    const appUrl = redirect_url || getAppUrl();
    const successUrl = `${appUrl}/integrations/youtube/callback?youtube_connected=true&channel=${encodeURIComponent(channelInfo.channel_title || "")}`;

    return new Response(null, {
      status: 302,
      headers: { Location: successUrl },
    });

  } catch (error) {
    console.error(`[youtube-oauth-callback][${VERSION}] Error:`, error);
    return redirectWithError(
      error instanceof Error ? error.message : "Erro interno",
      "internal_error"
    );
  }
});

function redirectWithError(message: string, errorCode?: string): Response {
  const appUrl = getAppUrl();
  const params = new URLSearchParams({ youtube_error: message });
  if (errorCode) params.set('error_code', errorCode);
  const errorUrl = `${appUrl}/integrations/youtube/callback?${params.toString()}`;
  return new Response(null, { status: 302, headers: { Location: errorUrl } });
}
