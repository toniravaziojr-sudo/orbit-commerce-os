import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hookSecret = Deno.env.get("AUTH_EMAIL_HOOK_SECRET");
    if (!hookSecret) {
      console.error("[auth-email-hook] AUTH_EMAIL_HOOK_SECRET not configured");
      throw new Error("Hook secret not configured");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[auth-email-hook] RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook signature
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    console.log("[auth-email-hook] Received hook request");
    
    const wh = new Webhook(hookSecret);
    let hookData: {
      user: { email: string; user_metadata?: { full_name?: string; name?: string } };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
      };
    };

    try {
      hookData = wh.verify(payload, headers) as typeof hookData;
    } catch (verifyError) {
      console.error("[auth-email-hook] Signature verification failed:", verifyError);
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Invalid signature" } }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { user, email_data } = hookData;
    const { token_hash, redirect_to, email_action_type, site_url } = email_data;

    console.log(`[auth-email-hook] Processing ${email_action_type} for ${user.email}`);

    // Map email_action_type to template_key
    const templateKeyMap: Record<string, string> = {
      signup: "auth_confirm",
      recovery: "password_reset",
      invite: "auth_confirm",
      magiclink: "auth_confirm",
      email_change: "auth_confirm",
    };

    const templateKey = templateKeyMap[email_action_type] || "auth_confirm";

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from("system_email_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error("[auth-email-hook] Template not found:", templateKey, templateError);
      throw new Error(`Email template '${templateKey}' not found`);
    }

    // Fetch system email config
    const { data: config, error: configError } = await supabase
      .from("system_email_config")
      .select("*")
      .single();

    if (configError || !config) {
      console.error("[auth-email-hook] System email config not found:", configError);
      throw new Error("System email not configured");
    }

    if (config.verification_status !== "verified") {
      console.error("[auth-email-hook] Domain not verified:", config.verification_status);
      throw new Error("Email domain not verified");
    }

    // Build confirmation URL
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to || site_url}`;

    // Get user name
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];

    // Logo pública para emails
    const EMAIL_LOGO_URL = "https://app.comandocentral.com.br/images/email-logo.png";

    // Replace variables in template
    const variables: Record<string, string> = {
      app_name: "Comando Central",
      user_name: userName,
      confirmation_url: confirmationUrl,
      user_email: user.email,
      reset_url: confirmationUrl,
      dashboard_url: "https://app.comandocentral.com.br",
      year: new Date().getFullYear().toString(),
      logo_url: EMAIL_LOGO_URL,
    };

    let htmlBody = template.body_html || "";
    let subject = template.subject || "Confirme sua conta";

    // Replace all variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      htmlBody = htmlBody.replace(regex, value);
      subject = subject.replace(regex, value);
    }

    // Send email via Resend
    const resend = new Resend(resendApiKey);

    const fromEmail = config.from_email.includes("@")
      ? config.from_email
      : `${config.from_email}@${config.sending_domain}`;

    console.log(`[auth-email-hook] Sending from: ${config.from_name} <${fromEmail}>`);

    const emailResponse = await resend.emails.send({
      from: `${config.from_name} <${fromEmail}>`,
      to: [user.email],
      subject: subject,
      html: htmlBody,
    });

    if (emailResponse.error) {
      console.error("[auth-email-hook] Resend error:", emailResponse.error);
      throw new Error(emailResponse.error.message);
    }

    console.log("[auth-email-hook] Email sent successfully:", emailResponse.data?.id);

    // Log the email
    await supabase.from("system_email_logs").insert({
      recipient: user.email,
      subject: subject,
      template_key: templateKey,
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: {
        email_action_type,
        resend_id: emailResponse.data?.id,
        hook: true,
      },
    });

    // Return success - this tells Supabase we handled the email
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[auth-email-hook] Error:", error);

    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: error.message,
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
