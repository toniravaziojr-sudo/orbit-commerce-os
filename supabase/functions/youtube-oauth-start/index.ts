// ==============================================
// YOUTUBE OAUTH START - Initiate OAuth flow
// ==============================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// YouTube Data API scopes
const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",      // Upload videos
  "https://www.googleapis.com/auth/youtube",             // Manage account
  "https://www.googleapis.com/auth/youtube.force-ssl",   // Read/write comments, playlists
  "https://www.googleapis.com/auth/youtube.readonly",    // Read channel info
  "https://www.googleapis.com/auth/yt-analytics.readonly", // Read analytics
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate configuration
    if (!GOOGLE_CLIENT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[youtube-oauth-start] Missing configuration");
      return new Response(
        JSON.stringify({ success: false, error: "Configuração incompleta do servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Get request body
    const body = await req.json();
    const { tenant_id, redirect_url } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure state token
    const stateBytes = new Uint8Array(32);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Store state for validation in callback
    const { error: stateError } = await supabase
      .from("youtube_oauth_states")
      .insert({
        tenant_id,
        user_id: userId,
        state,
        redirect_url: redirect_url || null,
        scopes: YOUTUBE_SCOPES,
      });

    if (stateError) {
      console.error("[youtube-oauth-start] Failed to store state:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao iniciar autenticação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build redirect URL for callback
    const callbackUrl = `${SUPABASE_URL}/functions/v1/youtube-oauth-callback`;

    // Build Google OAuth URL
    const oauthParams = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: YOUTUBE_SCOPES.join(" "),
      state: state,
      access_type: "offline",
      prompt: "consent", // Force consent to get refresh_token
      include_granted_scopes: "true",
    });

    const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`;

    console.log(`[youtube-oauth-start] Generated auth URL for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        authorization_url: authorizationUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[youtube-oauth-start] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
