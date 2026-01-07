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

    // If no profile exists, find or create one
    if (!lateProfileId) {
      // Get tenant name for profile
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name, slug")
        .eq("id", tenant_id)
        .single();

      // Use slug + short tenant_id to ensure uniqueness
      const profileName = tenant?.slug 
        ? `${tenant.slug}-${tenant_id.substring(0, 8)}`
        : `tenant-${tenant_id.substring(0, 8)}`;

      // First, try to find existing profile by listing profiles
      let foundExistingProfile = false;
      try {
        const listProfilesRes = await fetch("https://getlate.dev/api/v1/profiles", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${lateApiKey}`,
          },
        });

        if (listProfilesRes.ok) {
          const profilesData = await listProfilesRes.json();
          console.log("[late-auth-start] Profiles response:", JSON.stringify(profilesData));
          
          // API returns array directly or wrapped in object
          let profiles: any[] = [];
          if (Array.isArray(profilesData)) {
            profiles = profilesData;
          } else if (profilesData.profiles && Array.isArray(profilesData.profiles)) {
            profiles = profilesData.profiles;
          } else if (profilesData.data && Array.isArray(profilesData.data)) {
            profiles = profilesData.data;
          }
          
          console.log("[late-auth-start] Parsed profiles:", profiles.length);
          
          if (profiles.length > 0) {
            // Late API uses _id as the identifier
            const existingProfile = profiles.find((p: any) => 
              p.name === profileName || 
              p.name?.includes(tenant_id.substring(0, 8)) ||
              (tenant?.slug && p.name?.toLowerCase().includes(tenant.slug.toLowerCase()))
            );
            
            if (existingProfile) {
              // Late uses _id, not id
              lateProfileId = existingProfile._id || existingProfile.id;
              foundExistingProfile = true;
              console.log("[late-auth-start] Found matching Late profile:", lateProfileId);
            } else {
              // Use first available profile if limit is reached (Free plan = 2 profiles)
              const firstProfile = profiles[0];
              lateProfileId = firstProfile._id || firstProfile.id;
              foundExistingProfile = true;
              console.log("[late-auth-start] Using first available Late profile:", lateProfileId, firstProfile.name);
            }
          }
        } else {
          const errorText = await listProfilesRes.text();
          console.warn("[late-auth-start] Error listing profiles:", errorText);
        }
      } catch (listError) {
        console.warn("[late-auth-start] Could not list profiles:", listError);
      }

      // Create profile in Late only if not found
      if (!foundExistingProfile) {
        console.log("[late-auth-start] Creating new profile:", profileName);
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
          
          // If profile limit or exists error, provide better message
          if (errorData.toLowerCase().includes("limit")) {
            return new Response(
              JSON.stringify({ success: false, error: "Limite de perfis atingido no Late. Entre em contato com o suporte." }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (errorData.toLowerCase().includes("exist")) {
            return new Response(
              JSON.stringify({ success: false, error: "Perfil já existe. Tente novamente." }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create Late profile" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const profileData = await createProfileRes.json();
        // Late uses _id, not id
        lateProfileId = profileData._id || profileData.id;
        console.log("[late-auth-start] Created new profile:", lateProfileId);
      }

      if (!lateProfileId) {
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível obter um perfil do Late" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

    // Generate OAuth URL for Late using correct endpoint
    // Late uses GET /api/v1/connect/{platform}?profileId=xxx
    // For Facebook/Instagram, we need to connect to Instagram (which includes Facebook Page access)
    const connectUrl = `https://getlate.dev/api/v1/connect/instagram?profileId=${lateProfileId}`;
    
    console.log("[late-auth-start] Getting connect URL for profile:", lateProfileId);
    
    const oauthRes = await fetch(connectUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${lateApiKey}`,
      },
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
    console.log("[late-auth-start] OAuth response:", JSON.stringify(oauthData));
    
    // Late returns { url: "..." }
    const oauthUrl = oauthData.url || oauthData.connect_url || oauthData.oauth_url;
    
    if (!oauthUrl) {
      console.error("[late-auth-start] No URL in response:", oauthData);
      return new Response(
        JSON.stringify({ success: false, error: "URL de autorização não recebida do Late" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        oauth_url: oauthUrl,
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
