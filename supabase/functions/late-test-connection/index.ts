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

    // Check if platform admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isPlatformAdmin } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Only platform admins can test Late connection" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Late API Key
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Late API Key not configured",
          configured: false 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test the API key by fetching profiles list
    const testRes = await fetch("https://api.getlate.dev/v1/profiles", {
      headers: {
        "Authorization": `Bearer ${lateApiKey}`,
      },
    });

    if (!testRes.ok) {
      const errorData = await testRes.text();
      console.error("[late-test-connection] API test failed:", testRes.status, errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `API returned ${testRes.status}: Invalid or expired API key`,
          configured: true,
          valid: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profilesData = await testRes.json();
    const profileCount = profilesData.data?.length || profilesData.length || 0;

    return new Response(
      JSON.stringify({ 
        success: true, 
        configured: true,
        valid: true,
        profiles_count: profileCount,
        message: `Late API connected successfully. ${profileCount} profile(s) found.`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-test-connection] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
