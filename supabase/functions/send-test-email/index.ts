import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-test-email] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "RESEND_API_KEY não configurada. Configure a API key do Resend nas variáveis de ambiente." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, to_email } = await req.json();

    if (!tenant_id || !to_email) {
      return new Response(
        JSON.stringify({ success: false, message: "tenant_id e to_email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-test-email] Testing email for tenant ${tenant_id} to ${to_email}`);

    // Fetch email config for tenant
    const { data: config, error: configError } = await supabase
      .from("email_provider_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (configError || !config) {
      console.error("[send-test-email] No email config found:", configError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Configuração de email não encontrada. Salve as configurações primeiro." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate config
    if (!config.from_email || !config.from_name) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Configure o nome e email do remetente antes de testar." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send test email via Resend
    const resend = new Resend(resendApiKey);
    
    const fromAddress = `${config.from_name} <${config.from_email}>`;
    
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromAddress,
      to: [to_email],
      reply_to: config.reply_to || undefined,
      subject: "✅ Teste de Email - Comando Central",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Email Configurado com Sucesso!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Parabéns! Seu sistema de email está funcionando corretamente.
            </p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Configurações Ativas</h3>
              <p style="color: #6b7280; margin: 5px 0; font-size: 14px;"><strong>Remetente:</strong> ${config.from_name}</p>
              <p style="color: #6b7280; margin: 5px 0; font-size: 14px;"><strong>Email:</strong> ${config.from_email}</p>
              ${config.reply_to ? `<p style="color: #6b7280; margin: 5px 0; font-size: 14px;"><strong>Responder para:</strong> ${config.reply_to}</p>` : ''}
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Agora você pode usar o sistema de notificações para enviar emails automáticos para seus clientes.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Este é um email de teste enviado pelo Comando Central.
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("[send-test-email] Resend error:", emailError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Erro ao enviar: ${emailError.message || JSON.stringify(emailError)}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-test-email] Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email de teste enviado para ${to_email}. Verifique sua caixa de entrada.`,
        message_id: emailResult?.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-test-email] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "Erro inesperado ao enviar email" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
