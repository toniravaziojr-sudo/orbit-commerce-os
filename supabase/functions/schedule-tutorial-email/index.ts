import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * This function is called when a new user is created to schedule the tutorial email.
 * It reads the delay configuration from system_email_templates and creates
 * a scheduled notification to be sent after the configured delay.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { user_id, email, full_name } = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-tutorial-email] Scheduling tutorial email for user ${user_id} (${email})`);

    // Get the tutorial template config
    const { data: template, error: templateError } = await supabaseAdmin
      .from("system_email_templates")
      .select("*")
      .eq("template_key", "tutorials")
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.log("[schedule-tutorial-email] Tutorial template not found or inactive");
      return new Response(
        JSON.stringify({ success: true, message: "Tutorial template not active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if auto_send is enabled
    if (!template.auto_send) {
      console.log("[schedule-tutorial-email] Auto send is disabled for tutorials");
      return new Response(
        JSON.stringify({ success: true, message: "Auto send disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get system email config
    const { data: emailConfig, error: configError } = await supabaseAdmin
      .from("system_email_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !emailConfig) {
      console.log("[schedule-tutorial-email] System email config not found");
      return new Response(
        JSON.stringify({ success: false, error: "System email not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if domain is verified
    if (emailConfig.verification_status !== "verified") {
      console.log("[schedule-tutorial-email] Email domain not verified, skipping");
      return new Response(
        JSON.stringify({ success: false, error: "Email domain not verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate scheduled time based on delay
    const delayMinutes = template.send_delay_minutes || 60; // Default 60 minutes
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

    // Create a scheduled system email entry
    const { error: insertError } = await supabaseAdmin
      .from("scheduled_system_emails")
      .insert({
        user_id,
        email,
        user_name: full_name || email.split("@")[0],
        template_key: "tutorials",
        scheduled_for: scheduledFor,
        status: "scheduled",
      });

    if (insertError) {
      // Check if it's a duplicate
      if (insertError.code === "23505") {
        console.log("[schedule-tutorial-email] Tutorial email already scheduled for this user");
        return new Response(
          JSON.stringify({ success: true, message: "Already scheduled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertError;
    }

    console.log(`[schedule-tutorial-email] Scheduled tutorial email for ${email} at ${scheduledFor} (delay: ${delayMinutes} min)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled_for: scheduledFor,
        delay_minutes: delayMinutes
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[schedule-tutorial-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
