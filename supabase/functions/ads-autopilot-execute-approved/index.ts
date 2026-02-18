import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.1.0"; // Accept pending_approval actions directly, mark executed

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-execute-approved][${VERSION}] Request received`);

  try {
    const { tenant_id, action_id } = await req.json();

    if (!tenant_id || !action_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing tenant_id or action_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the pending action (accept both pending_approval and approved statuses)
    const { data: action, error: fetchErr } = await supabase
      .from("ads_autopilot_actions")
      .select("*")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .in("status", ["pending_approval", "approved"])
      .maybeSingle();

    if (fetchErr || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Action not found or already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ads-autopilot-execute-approved][${VERSION}] Executing action ${action_id} type=${action.action_type}`);

    // Trigger analysis with the approved action context
    const { data: result, error: analyzeErr } = await supabase.functions.invoke("ads-autopilot-analyze", {
      body: {
        tenant_id,
        trigger_type: "approved_action",
        approved_action_id: action_id,
      },
    });

    if (analyzeErr) {
      // Mark as failed
      await supabase
        .from("ads_autopilot_actions")
        .update({ status: "failed", error_message: analyzeErr.message })
        .eq("id", action_id);

      return new Response(
        JSON.stringify({ success: false, error: analyzeErr.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as executed
    await supabase
      .from("ads_autopilot_actions")
      .update({ status: "executed", executed_at: new Date().toISOString() })
      .eq("id", action_id);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[ads-autopilot-execute-approved][${VERSION}] Error:`, err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
