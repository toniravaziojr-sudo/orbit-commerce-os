import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { listAccounts, LateAccount } from "../_shared/late-api.ts";

interface LogContext {
  tenant_id: string;
  step: string;
  error?: string;
}

function log(ctx: LogContext, message: string) {
  console.log(`[late-auth-callback] [${ctx.step}] tenant=${ctx.tenant_id}: ${message}`);
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
    
    // Late OAuth callback params
    const state = url.searchParams.get("state");
    const connected = url.searchParams.get("connected"); // Platform that was connected (e.g., "facebook")
    const profileId = url.searchParams.get("profileId");
    const username = url.searchParams.get("username");
    const error = url.searchParams.get("error");

    ctx.step = "parse_params";
    log(ctx, `Callback received: state=${state?.substring(0, 8)}..., connected=${connected}, error=${error}`);

    if (!state) {
      return redirectToFrontend({ success: false, error: "Missing state parameter" });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token - check expiration but allow reuse within session
    ctx.step = "validate_state";
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from("late_onboarding_states")
      .select("*")
      .eq("state_token", state)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (stateError) {
      log({ ...ctx, error: stateError.message }, "Database error fetching state");
      return redirectToFrontend({ success: false, error: "Erro interno ao validar estado" });
    }

    if (!stateData) {
      log(ctx, "State not found or expired");
      return redirectToFrontend({ success: false, error: "Estado de conexão inválido ou expirado" });
    }

    // Check if already used
    if (stateData.used_at) {
      log(ctx, "State already used");
      return redirectToFrontend({ success: false, error: "Esta conexão já foi processada" });
    }

    const tenantId = stateData.tenant_id;
    const platform = stateData.metadata?.platform || connected || "facebook";
    ctx.tenant_id = tenantId;

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
