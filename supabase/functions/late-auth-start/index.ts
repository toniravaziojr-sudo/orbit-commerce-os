import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authenticated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { tenant_id, redirect_url } = await req.json();
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to tenant with admin role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authorized for this tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Late API Key from platform credentials
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Late API Key not configured. Contact platform admin." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate state token for CSRF protection
    const stateToken = crypto.randomUUID();

    // Save state token
    const { error: stateError } = await supabaseAdmin
      .from("late_onboarding_states")
      .insert({
        tenant_id,
        state_token: stateToken,
        redirect_url: redirect_url || "/integrations",
      });

    if (stateError) {
      console.error("[late-auth-start] Error saving state:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to initialize connection" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create Late profile for this tenant
    const { data: existingConnection } = await supabaseAdmin
      .from("late_connections")
      .select("late_profile_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    let lateProfileId = existingConnection?.late_profile_id;

    // If no profile exists, create one
    if (!lateProfileId) {
      // Get tenant name for profile
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name, slug")
        .eq("id", tenant_id)
        .single();

      const profileName = tenant?.name || `Tenant ${tenant_id.substring(0, 8)}`;

      // Create profile in Late
      const createProfileRes = await fetch("https://getlate.dev/api/v1/profiles", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lateApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: profileName }),
      });

      if (!createProfileRes.ok) {
        const errorData = await createProfileRes.text();
        console.error("[late-auth-start] Error creating Late profile:", errorData);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create Late profile" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const profileData = await createProfileRes.json();
      lateProfileId = profileData.id;

      // Upsert connection record
      await supabaseAdmin
        .from("late_connections")
        .upsert({
          tenant_id,
          late_profile_id: lateProfileId,
          late_profile_name: profileName,
          status: "connecting",
        }, { onConflict: "tenant_id" });
    } else {
      // Update status to connecting
      await supabaseAdmin
        .from("late_connections")
        .update({ status: "connecting" })
        .eq("tenant_id", tenant_id);
    }

    // Generate OAuth URL for Late
    // Late uses profile-based OAuth - we need to get the connect URL
    const callbackUrl = `${supabaseUrl}/functions/v1/late-auth-callback`;
    
    const oauthRes = await fetch(`https://getlate.dev/api/v1/profiles/${lateProfileId}/social-accounts/connect`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platforms: ["facebook", "instagram"],
        callback_url: callbackUrl,
        state: stateToken,
      }),
    });

    if (!oauthRes.ok) {
      const errorData = await oauthRes.text();
      console.error("[late-auth-start] Error getting OAuth URL:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to get connection URL from Late" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oauthData = await oauthRes.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        oauth_url: oauthData.connect_url || oauthData.url,
        state: stateToken,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[late-auth-start] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
