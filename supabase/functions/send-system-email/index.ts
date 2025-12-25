import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Verify user is platform operator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is platform operator
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1);

    if (!roles || roles.length === 0) {
      throw new Error("Apenas operadores da plataforma podem enviar emails do sistema");
    }

    const { to, subject, html, email_type = "test" } = await req.json();

    if (!to || !subject || !html) {
      throw new Error("to, subject e html são obrigatórios");
    }

    // Get system email config
    const { data: config, error: configError } = await supabaseAdmin
      .from("system_email_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !config) {
      throw new Error("Configuração de email do sistema não encontrada");
    }

    // Validate domain is verified
    if (config.verification_status !== "verified") {
      // Log the attempt
      await supabaseAdmin.from("system_email_logs").insert({
        recipient: to,
        subject,
        email_type,
        status: "failed",
        error_message: "Domínio de envio não verificado",
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "O domínio de envio ainda não foi verificado. Configure os registros DNS e verifique o domínio primeiro." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate from_email belongs to verified domain
    const emailDomain = config.from_email.split("@")[1]?.toLowerCase();
    if (config.sending_domain && emailDomain !== config.sending_domain.toLowerCase()) {
      await supabaseAdmin.from("system_email_logs").insert({
        recipient: to,
        subject,
        email_type,
        status: "failed",
        error_message: `Email do remetente não pertence ao domínio verificado`,
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `O email do remetente (${config.from_email}) deve pertencer ao domínio verificado (${config.sending_domain}).` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resend = new Resend(resendApiKey);

    console.log(`Sending system email to ${to} from ${config.from_email}`);

    const emailResult = await resend.emails.send({
      from: `${config.from_name} <${config.from_email}>`,
      to: [to],
      subject,
      html,
      reply_to: config.reply_to || undefined,
    });

    console.log("Email result:", emailResult);

    if (emailResult.error) {
      // Log failure
      await supabaseAdmin.from("system_email_logs").insert({
        recipient: to,
        subject,
        email_type,
        status: "failed",
        error_message: emailResult.error.message,
        metadata: { error: emailResult.error },
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: emailResult.error.message 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log success
    await supabaseAdmin.from("system_email_logs").insert({
      recipient: to,
      subject,
      email_type,
      status: "sent",
      provider_message_id: emailResult.data?.id,
      sent_at: new Date().toISOString(),
    });

    // Update last test info if it's a test email
    if (email_type === "test") {
      await supabaseAdmin
        .from("system_email_config")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_result: { success: true, message_id: emailResult.data?.id },
        })
        .eq("id", config.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email enviado com sucesso!",
        message_id: emailResult.data?.id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-system-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
