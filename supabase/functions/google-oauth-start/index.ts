import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Initial Google Hub OAuth start
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Google OAuth Scope Packs
const SCOPE_PACKS: Record<string, string[]> = {
  youtube: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ],
  ads: [
    "https://www.googleapis.com/auth/adwords",
  ],
  merchant: [
    "https://www.googleapis.com/auth/content",
  ],
  analytics: [
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
  search_console: [
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
  business: [
    "https://www.googleapis.com/auth/business.manage",
  ],
  tag_manager: [
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.readonly",
  ],
};

// Base scopes always included
const BASE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[google-oauth-start][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { tenantId, scopePacks = ["youtube"], returnPath = "/integrations" } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate packs
    const validPacks = scopePacks.filter((p: string) => SCOPE_PACKS[p]);
    if (validPacks.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum pack válido", code: "INVALID_PACKS", availablePacks: Object.keys(SCOPE_PACKS) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check tenant access (owner/admin only)
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole || !["owner", "admin"].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Client ID (from platform_credentials or env)
    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_ID");
    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: "Google não configurado. Contate o administrador.", code: "GOOGLE_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build scopes (deduplicated)
    const allScopes = new Set([...BASE_SCOPES]);
    for (const pack of validPacks) {
      for (const scope of SCOPE_PACKS[pack]) {
        allScopes.add(scope);
      }
    }

    // Generate state
    const stateBytes = new Uint8Array(32);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Save state
    const { error: stateError } = await supabase
      .from("google_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        state,
        scope_packs: validPacks,
        return_path: returnPath,
      });

    if (stateError) {
      console.error(`[google-oauth-start][${VERSION}] State save error:`, stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao preparar autorização", code: "STATE_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build callback URL
    const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    // Build Google OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", Array.from(allScopes).join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent"); // Always get refresh_token
    authUrl.searchParams.set("include_granted_scopes", "true"); // Incremental consent

    console.log(`[google-oauth-start][${VERSION}] Auth URL generated for tenant ${tenantId}, packs: ${validPacks.join(", ")}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state,
        requestedScopes: Array.from(allScopes),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[google-oauth-start][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
