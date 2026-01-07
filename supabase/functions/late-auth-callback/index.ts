import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const success = url.searchParams.get("success");
    const error = url.searchParams.get("error");

    if (!state) {
      return redirectWithError("Missing state parameter");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate state token
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from("late_onboarding_states")
      .select("*")
      .eq("state_token", state)
      .gt("expires_at", new Date().toISOString())
      .is("used_at", null)
      .maybeSingle();

    if (stateError || !stateData) {
      console.error("[late-auth-callback] Invalid or expired state:", stateError);
      return redirectWithError("Invalid or expired connection state");
    }

    const tenantId = stateData.tenant_id;
    const redirectUrl = stateData.redirect_url || "/integrations";

    // Mark state as used
    await supabaseAdmin
      .from("late_onboarding_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // Check if connection was successful
    if (error || success === "false") {
      await supabaseAdmin
        .from("late_connections")
        .update({
          status: "error",
          last_error: error || "Connection failed",
        })
        .eq("tenant_id", tenantId);

      return redirectWithError(error || "Connection failed", redirectUrl);
    }

    // Get Late API Key
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      return redirectWithError("Platform configuration error", redirectUrl);
    }

    // Get connection details
    const { data: connection } = await supabaseAdmin
      .from("late_connections")
      .select("late_profile_id")
      .eq("tenant_id", tenantId)
      .single();

    if (!connection?.late_profile_id) {
      return redirectWithError("Connection not found", redirectUrl);
    }

    // Fetch connected accounts from Late
    const accountsRes = await fetch(
      `https://api.getlate.dev/v1/profiles/${connection.late_profile_id}/social-accounts`,
      {
        headers: {
          "Authorization": `Bearer ${lateApiKey}`,
        },
      }
    );

    if (!accountsRes.ok) {
      console.error("[late-auth-callback] Error fetching accounts:", await accountsRes.text());
      await supabaseAdmin
        .from("late_connections")
        .update({
          status: "error",
          last_error: "Failed to fetch connected accounts",
        })
        .eq("tenant_id", tenantId);

      return redirectWithError("Failed to verify connection", redirectUrl);
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.data || accountsData.accounts || accountsData || [];

    // Update connection with accounts
    await supabaseAdmin
      .from("late_connections")
      .update({
        status: "connected",
        connected_accounts: accounts,
        connected_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("tenant_id", tenantId);

    // Redirect to success page
    const baseUrl = getBaseUrl();
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}${redirectUrl}?late_connected=true`,
      },
    });
  } catch (error) {
    console.error("[late-auth-callback] Error:", error);
    return redirectWithError(error.message || "Internal error");
  }
});

function getBaseUrl(): string {
  // Priority: APP_BASE_URL env var > production URL > preview URL
  if (Deno.env.get("APP_BASE_URL")) {
    return Deno.env.get("APP_BASE_URL")!;
  }
  // Default to production domain
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
