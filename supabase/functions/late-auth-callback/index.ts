import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { listAccounts, LateAccount } from "../_shared/late-api.ts";

interface LogContext {
  tenant_id: string;
  step: string;
  platform?: string;
  state_token?: string;
  error?: string;
}

function log(ctx: LogContext, message: string) {
  const parts = [
    `[late-auth-callback]`,
    `[${ctx.step}]`,
    `tenant=${ctx.tenant_id}`,
    ctx.platform ? `platform=${ctx.platform}` : null,
    ctx.state_token ? `state=${ctx.state_token.substring(0, 8)}...` : null,
    message,
  ].filter(Boolean);
  console.log(parts.join(" "));
  if (ctx.error) {
    console.error(`[late-auth-callback] [${ctx.step}] ERROR: ${ctx.error}`);
  }
}

serve(async (req) => {
  const ctx: LogContext = { tenant_id: "unknown", step: "init" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    
    // Log full URL for debugging
    ctx.step = "parse_url";
    log(ctx, `Full URL: ${req.url}`);
    log(ctx, `Pathname: ${url.pathname}`);
    
    // Extract state from PATH first (new format: /late-auth-callback/{platform}/{stateToken})
    // This is more reliable because Late/Facebook can rewrite query params
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected: ["functions", "v1", "late-auth-callback", "{platform}", "{stateToken}"]
    // or legacy: ["functions", "v1", "late-auth-callback"]
    
    let stateToken: string | null = null;
    let platformFromPath: string | null = null;
    
    // Find late-auth-callback in path and extract following segments
    const callbackIndex = pathParts.indexOf("late-auth-callback");
    if (callbackIndex !== -1) {
      // New format: /late-auth-callback/{platform}/{stateToken}
      if (pathParts[callbackIndex + 1] && pathParts[callbackIndex + 2]) {
        platformFromPath = pathParts[callbackIndex + 1];
        stateToken = pathParts[callbackIndex + 2];
        log(ctx, `Extracted from path: platform=${platformFromPath}, state=${stateToken?.substring(0, 8)}...`);
      }
      // Alternative format: /late-auth-callback/{stateToken} (no platform)
      else if (pathParts[callbackIndex + 1] && !pathParts[callbackIndex + 1].includes("-")) {
        // Likely just a state token if it looks like a UUID
        const potentialState = pathParts[callbackIndex + 1];
        if (potentialState.length === 36 && potentialState.includes("-")) {
          stateToken = potentialState;
          log(ctx, `Extracted state from path (no platform): ${stateToken?.substring(0, 8)}...`);
        }
      }
    }
    
    // Fallback: try query params (legacy support)
    if (!stateToken) {
      stateToken = url.searchParams.get("cc_state") || url.searchParams.get("state");
      if (stateToken) {
        log(ctx, `Using state from query param: ${stateToken.substring(0, 8)}...`);
      }
    }
    
    // Other query params from Late
    const connected = url.searchParams.get("connected");
    const profileId = url.searchParams.get("profileId");
    const error = url.searchParams.get("error");

    ctx.step = "parse_params";
    ctx.state_token = stateToken || undefined;
    log(ctx, `Callback params: connected=${connected}, profileId=${profileId}, error=${error}`);

    if (!stateToken) {
      log(ctx, "No state token found in path or query params");
      return redirectToFrontend({ success: false, error: "Token de estado não encontrado" });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token
    ctx.step = "validate_state";
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from("late_onboarding_states")
      .select("*")
      .eq("state_token", stateToken)
      .maybeSingle();

    if (stateError) {
      log({ ...ctx, error: stateError.message }, "Database error fetching state");
      return redirectToFrontend({ success: false, error: "Erro interno ao validar estado" });
    }

    if (!stateData) {
      log(ctx, "State not found in database");
      return redirectToFrontend({ success: false, error: "Estado de conexão não encontrado" });
    }

    // Check if expired
    if (new Date(stateData.expires_at) < new Date()) {
      log(ctx, "State token expired");
      return redirectToFrontend({ success: false, error: "Estado de conexão expirado" });
    }

    // IDEMPOTENCY: If state was already used successfully, return success again
    // This handles multiple redirects from Facebook
    if (stateData.used_at) {
      ctx.step = "idempotency_check";
      log(ctx, "State already used, checking if successful");
      
      // Check if connection was successful
      const { data: existingConnection } = await supabaseAdmin
        .from("late_connections")
        .select("status, connected_accounts")
        .eq("tenant_id", stateData.tenant_id)
        .single();
      
      if (existingConnection?.status === "connected") {
        log(ctx, "Connection already successful, returning success (idempotent)");
        const platform = platformFromPath || stateData.metadata?.platform || "facebook";
        return redirectToFrontend({ success: true, platform });
      }
      
      // State was used but connection failed - allow retry
      log(ctx, "State was used but connection not successful, allowing retry");
    }

    const tenantId = stateData.tenant_id;
    const platform = platformFromPath || stateData.metadata?.platform || connected || "facebook";
    ctx.tenant_id = tenantId;
    ctx.platform = platform;

    log(ctx, `Valid state for tenant, platform=${platform}`);

    // Handle error from Late
    if (error) {
      ctx.step = "handle_error";
      log({ ...ctx, error }, "OAuth error from Late");
      
      // Mark state as used
      await supabaseAdmin
        .from("late_onboarding_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", stateData.id);

      await supabaseAdmin
        .from("late_connections")
        .update({
          status: "error",
          last_error: error,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      return redirectToFrontend({ success: false, error, platform });
    }

    // Get connection and profile ID
    ctx.step = "get_connection";
    const { data: connection } = await supabaseAdmin
      .from("late_connections")
      .select("late_profile_id")
      .eq("tenant_id", tenantId)
      .single();

    if (!connection?.late_profile_id) {
      log(ctx, "Connection or profile not found");
      return redirectToFrontend({ success: false, error: "Conexão não encontrada", platform });
    }

    // Get Late API Key
    ctx.step = "get_api_key";
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      return redirectToFrontend({ success: false, error: "Configuração de plataforma inválida", platform });
    }

    // Fetch connected accounts from Late
    ctx.step = "fetch_accounts";
    const { accounts, error: accountsError } = await listAccounts(lateApiKey, connection.late_profile_id);

    if (accountsError) {
      log({ ...ctx, error: accountsError }, "Failed to fetch accounts");
      await supabaseAdmin
        .from("late_connections")
        .update({
          status: "error",
          last_error: "Erro ao buscar contas conectadas",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      return redirectToFrontend({ success: false, error: "Erro ao verificar conexão", platform });
    }

    log(ctx, `Found ${accounts.length} connected accounts`);

    // Transform accounts to our format
    const connectedAccounts = accounts.map((acc: LateAccount) => ({
      id: acc._id,
      platform: acc.platform,
      username: acc.username,
      name: acc.displayName,
      profile_url: acc.profileUrl,
      is_active: acc.isActive,
    }));

    // Mark state as used NOW (only after successful processing)
    await supabaseAdmin
      .from("late_onboarding_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // Update connection as successful
    ctx.step = "update_connection";
    const newStatus = connectedAccounts.length > 0 ? "connected" : "disconnected";
    
    await supabaseAdmin
      .from("late_connections")
      .update({
        status: newStatus,
        connected_accounts: connectedAccounts,
        connected_at: connectedAccounts.length > 0 ? new Date().toISOString() : null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    log(ctx, `Connection updated to ${newStatus}, redirecting to frontend`);

    return redirectToFrontend({ 
      success: connectedAccounts.length > 0, 
      platform,
      error: connectedAccounts.length === 0 ? "Nenhuma conta foi conectada" : undefined
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    log({ ...ctx, error: message }, "Unhandled exception");
    return redirectToFrontend({ success: false, error: message });
  }
});

function getBaseUrl(): string {
  return Deno.env.get("APP_BASE_URL") || "https://app.comandocentral.com.br";
}

function redirectToFrontend(params: { success: boolean; error?: string; platform?: string }): Response {
  const baseUrl = getBaseUrl();
  const { success, error, platform = "facebook" } = params;
  
  const callbackUrl = new URL(`${baseUrl}/integrations/late/callback`);
  
  if (success) {
    callbackUrl.searchParams.set("late_connected", "true");
  } else if (error) {
    callbackUrl.searchParams.set("late_error", error);
  }
  callbackUrl.searchParams.set("platform", platform);
  
  return new Response(null, {
    status: 302,
    headers: {
      Location: callbackUrl.toString(),
    },
  });
}
