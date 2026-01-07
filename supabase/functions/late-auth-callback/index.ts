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
    log(ctx, `Callback received: state=${state}, connected=${connected}, error=${error}`);

    if (!state) {
      return redirectWithError("Missing state parameter");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token
    ctx.step = "validate_state";
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from("late_onboarding_states")
      .select("*")
      .eq("state_token", state)
      .gt("expires_at", new Date().toISOString())
      .is("used_at", null)
      .maybeSingle();

    if (stateError || !stateData) {
      log({ ...ctx, error: stateError?.message || "State not found" }, "Invalid state");
      return redirectWithError("Estado de conexão inválido ou expirado");
    }

    const tenantId = stateData.tenant_id;
    const redirectUrl = stateData.redirect_url || "/integrations";
    ctx.tenant_id = tenantId;

    // Mark state as used
    await supabaseAdmin
      .from("late_onboarding_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // Handle error from Late
    if (error) {
      ctx.step = "handle_error";
      log({ ...ctx, error }, "OAuth error from Late");
      
      await supabaseAdmin
        .from("late_connections")
        .update({
          status: "error",
          last_error: error,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      return redirectWithError(error, redirectUrl);
    }

    // Get connection and profile ID
    ctx.step = "get_connection";
    const { data: connection } = await supabaseAdmin
      .from("late_connections")
      .select("late_profile_id")
      .eq("tenant_id", tenantId)
      .single();

    if (!connection?.late_profile_id) {
      log(ctx, "Connection not found");
      return redirectWithError("Conexão não encontrada", redirectUrl);
    }

    // Get Late API Key
    ctx.step = "get_api_key";
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      return redirectWithError("Configuração de plataforma inválida", redirectUrl);
    }

    // Fetch connected accounts from Late using correct endpoint
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

      return redirectWithError("Erro ao verificar conexão", redirectUrl);
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

    // Update connection as successful
    ctx.step = "update_connection";
    await supabaseAdmin
      .from("late_connections")
      .update({
        status: "connected",
        connected_accounts: connectedAccounts,
        connected_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    log(ctx, "Connection successful, redirecting to app");

    // Redirect to success page
    const baseUrl = getBaseUrl();
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}${redirectUrl}?late_connected=true`,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    log({ ...ctx, error: message }, "Unhandled exception");
    return redirectWithError(message);
  }
});

function getBaseUrl(): string {
  if (Deno.env.get("APP_BASE_URL")) {
    return Deno.env.get("APP_BASE_URL")!;
  }
  return "https://app.comandocentral.com.br";
}

function redirectWithError(errorMessage: string, redirectPath = "/integrations"): Response {
  const baseUrl = getBaseUrl();
  const encodedError = encodeURIComponent(errorMessage);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${baseUrl}${redirectPath}?late_error=${encodedError}`,
    },
  });
}
