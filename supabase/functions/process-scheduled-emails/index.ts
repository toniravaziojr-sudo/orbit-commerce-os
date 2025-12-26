import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * This function processes scheduled system emails (like tutorials).
 * It runs periodically via scheduler-tick and sends emails that are due.
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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const stats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    console.log("[process-scheduled-emails] Starting...");

    // Get system email config
    const { data: emailConfig, error: configError } = await supabaseAdmin
      .from("system_email_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !emailConfig) {
      console.log("[process-scheduled-emails] System email config not found");
      return new Response(
        JSON.stringify({ success: true, stats, message: "No email config" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (emailConfig.verification_status !== "verified") {
      console.log("[process-scheduled-emails] Email domain not verified, skipping all");
      return new Response(
        JSON.stringify({ success: true, stats, message: "Email domain not verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch scheduled emails that are due
    const { data: scheduledEmails, error: fetchError } = await supabaseAdmin
      .from("scheduled_system_emails")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log("[process-scheduled-emails] No emails due");
      return new Response(
        JSON.stringify({ success: true, stats, message: "No emails due" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-scheduled-emails] Found ${scheduledEmails.length} emails to process`);

    // Get all templates we might need
    const templateKeys = [...new Set(scheduledEmails.map(e => e.template_key))];
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("system_email_templates")
      .select("*")
      .in("template_key", templateKeys);

    if (templatesError) {
      throw templatesError;
    }

    const templatesMap = new Map(templates?.map(t => [t.template_key, t]) || []);

    for (const scheduled of scheduledEmails) {
      stats.processed++;

      // Mark as processing
      await supabaseAdmin
        .from("scheduled_system_emails")
        .update({ status: "processing" })
        .eq("id", scheduled.id);

      const template = templatesMap.get(scheduled.template_key);
      if (!template || !template.is_active) {
        console.log(`[process-scheduled-emails] Template ${scheduled.template_key} not found or inactive`);
        await supabaseAdmin
          .from("scheduled_system_emails")
          .update({ status: "skipped", error_message: "Template not found or inactive" })
          .eq("id", scheduled.id);
        stats.skipped++;
        continue;
      }

      try {
        // Replace variables in template
        const dashboardUrl = "https://app.comandocentral.com.br";
        let subject = template.subject || "";
        let html = template.body_html || "";

        const variables: Record<string, string> = {
          app_name: "Comando Central",
          user_name: scheduled.user_name || scheduled.email.split("@")[0],
          dashboard_url: dashboardUrl,
        };

        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{${key}}}`, "g");
          subject = subject.replace(regex, value);
          html = html.replace(regex, value);
        }

        // Send email
        const emailResult = await resend.emails.send({
          from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
          to: [scheduled.email],
          subject,
          html,
          reply_to: emailConfig.reply_to || undefined,
        });

        if (emailResult.error) {
          throw new Error(emailResult.error.message);
        }

        // Update as sent
        await supabaseAdmin
          .from("scheduled_system_emails")
          .update({ 
            status: "sent", 
            sent_at: new Date().toISOString(),
            provider_message_id: emailResult.data?.id 
          })
          .eq("id", scheduled.id);

        // Log in system_email_logs
        await supabaseAdmin.from("system_email_logs").insert({
          recipient: scheduled.email,
          subject,
          email_type: scheduled.template_key,
          status: "sent",
          provider_message_id: emailResult.data?.id,
          sent_at: new Date().toISOString(),
        });

        stats.sent++;
        console.log(`[process-scheduled-emails] Sent ${scheduled.template_key} to ${scheduled.email}`);
      } catch (sendError: any) {
        console.error(`[process-scheduled-emails] Failed to send to ${scheduled.email}:`, sendError);
        
        await supabaseAdmin
          .from("scheduled_system_emails")
          .update({ 
            status: "failed", 
            error_message: sendError.message,
            attempts: (scheduled.attempts || 0) + 1 
          })
          .eq("id", scheduled.id);

        await supabaseAdmin.from("system_email_logs").insert({
          recipient: scheduled.email,
          subject: template.subject,
          email_type: scheduled.template_key,
          status: "failed",
          error_message: sendError.message,
        });

        stats.failed++;
      }
    }

    console.log(`[process-scheduled-emails] Done. Stats:`, stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[process-scheduled-emails] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
