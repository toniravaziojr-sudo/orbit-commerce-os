import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { tenant_id } = await req.json();
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

    // Get connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from("late_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "No Late connection found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Late API Key
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    
    // If we have a profile, try to disconnect accounts in Late (optional)
    if (lateApiKey && connection.late_profile_id) {
      try {
        // Delete the profile from Late (this disconnects all accounts)
        await fetch(`https://getlate.dev/api/v1/profiles/${connection.late_profile_id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${lateApiKey}`,
          },
        });
      } catch (e) {
        console.log("[late-disconnect] Error deleting Late profile (non-blocking):", e);
      }
    }

    // Update connection status
    const { error: updateError } = await supabaseAdmin
      .from("late_connections")
      .update({
        status: "disconnected",
        connected_accounts: [],
        late_profile_id: null,
        connected_at: null,
        last_error: null,
      })
      .eq("tenant_id", tenant_id);

    if (updateError) {
      console.error("[late-disconnect] Error updating connection:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to disconnect" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cancel any pending scheduled posts
    await supabaseAdmin
      .from("late_scheduled_posts")
      .update({ status: "cancelled", last_error: "Connection disconnected" })
      .eq("tenant_id", tenant_id)
      .in("status", ["pending", "scheduled"]);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[late-disconnect] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
