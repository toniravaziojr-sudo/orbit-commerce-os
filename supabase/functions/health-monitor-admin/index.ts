import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Check if a user is a platform operator by querying the platform_admins table
 */
async function isPlatformOperator(
  adminClient: any,
  email: string | undefined
): Promise<boolean> {
  if (!email) return false;
  
  const { data, error } = await adminClient
    .from("platform_admins")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  
  if (error) {
    console.error("[health-monitor-admin] Error checking platform admin:", error);
    return false;
  }
  
  return !!data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[health-monitor-admin] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT to validate auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon client
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error("[health-monitor-admin] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for admin queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is platform operator (query database)
    const isOperator = await isPlatformOperator(adminClient, user.email);
    if (!isOperator) {
      console.warn(`[health-monitor-admin] Access denied for user: ${user.email}`);
      return new Response(
        JSON.stringify({ error: "Forbidden - Access restricted to platform operators" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[health-monitor-admin] Access granted for operator: ${user.email}`);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { action = "stats", days = 7 } = body;

    const since = new Date();
    since.setDate(since.getDate() - days);

    if (action === "stats") {
      // Get aggregated stats for all tenants
      const { data: checks, error: checksError } = await adminClient
        .from("system_health_checks")
        .select("*")
        .gte("ran_at", since.toISOString())
        .order("ran_at", { ascending: false })
        .limit(500);

      if (checksError) {
        console.error("[health-monitor-admin] Error fetching checks:", checksError);
        throw checksError;
      }

      const { data: targets, error: targetsError } = await adminClient
        .from("system_health_check_targets")
        .select("*")
        .order("created_at", { ascending: false });

      if (targetsError) {
        console.error("[health-monitor-admin] Error fetching targets:", targetsError);
        throw targetsError;
      }

      // Get runtime violations
      const { data: violations, error: violationsError } = await adminClient
        .from("storefront_runtime_violations")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (violationsError) {
        console.error("[health-monitor-admin] Error fetching violations:", violationsError);
        // Non-critical, continue
      }

      return new Response(
        JSON.stringify({
          checks: checks || [],
          targets: targets || [],
          violations: violations || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "checks") {
      const { data: checks, error } = await adminClient
        .from("system_health_checks")
        .select("*")
        .gte("ran_at", since.toISOString())
        .order("ran_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      return new Response(
        JSON.stringify({ checks: checks || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "targets") {
      const { data: targets, error } = await adminClient
        .from("system_health_check_targets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ targets: targets || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "violations") {
      const { data: violations, error } = await adminClient
        .from("storefront_runtime_violations")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ violations: violations || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[health-monitor-admin] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
