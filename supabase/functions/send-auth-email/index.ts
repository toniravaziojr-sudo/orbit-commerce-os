import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  email: string;
  user_name?: string;
  confirmation_url?: string;
  email_type: 'signup' | 'recovery' | 'email_change' | 'welcome';
  store_name?: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-auth-email] RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, user_name, confirmation_url, email_type, store_name }: AuthEmailRequest = await req.json();

    console.log(`[send-auth-email] Processing ${email_type} email for: ${email}`);

    // Map email_type to template_key
    const templateKeyMap: Record<string, string> = {
      'signup': 'auth_confirm',
      'recovery': 'password_reset',
      'email_change': 'auth_confirm',
      'welcome': 'welcome',
    };

    const templateKey = templateKeyMap[email_type] || 'welcome';

    // Fetch system email config
    const { data: config, error: configError } = await supabase
      .from('system_email_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error("[send-auth-email] System email config not found:", configError);
      throw new Error("System email not configured");
    }

    if (config.verification_status !== 'verified') {
      console.error("[send-auth-email] Domain not verified:", config.verification_status);
      throw new Error("Email domain not verified");
    }

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('system_email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .single();

    // Prepare email content
    let htmlBody: string;
    let subject: string;

    const fromEmail = config.from_email.includes('@') 
      ? config.from_email 
      : `${config.from_email}@${config.sending_domain}`;

    if (templateError || !template) {
      console.log("[send-auth-email] Template not found, using default:", templateKey);
      
      // Use default template for welcome emails
      subject = `Bem-vindo ao Comando Central, ${user_name || email.split('@')[0]}!`;
      htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">Comando Central</h1>
            </div>
            
            <h2 style="color: #333; margin-top: 0;">Olá, ${user_name || email.split('@')[0]}!</h2>
            
            <p style="color: #555; line-height: 1.6;">
              Sua conta e loja <strong>${store_name || 'sua loja'}</strong> foram criadas com sucesso no Comando Central.
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              Você já pode acessar o painel administrativo e começar a configurar sua loja virtual.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmation_url || 'https://app.comandocentral.com.br'}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; 
                        text-decoration: none; border-radius: 6px; font-weight: 600;">
                Acessar Meu Painel
              </a>
            </div>
            
            <p style="color: #555; line-height: 1.6;">
              Precisa de ajuda? Nossa equipe está à disposição para te auxiliar.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Comando Central. Todos os direitos reservados.
            </p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Replace variables in template
      const variables: Record<string, string> = {
        app_name: 'Comando Central',
        user_name: user_name || email.split('@')[0],
        confirmation_url: confirmation_url || 'https://app.comandocentral.com.br',
        user_email: email,
        store_name: store_name || 'sua loja',
        action_url: confirmation_url || 'https://app.comandocentral.com.br',
        year: new Date().getFullYear().toString(),
      };

      htmlBody = template.body_html || '';
      subject = template.subject || 'Bem-vindo ao Comando Central!';

      // Replace all variables
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        htmlBody = htmlBody.replace(regex, value);
        subject = subject.replace(regex, value);
      }
    }

    // Send email via Resend
    const resend = new Resend(resendApiKey);

    console.log(`[send-auth-email] Sending from: ${config.from_name} <${fromEmail}>`);

    const emailResponse = await resend.emails.send({
      from: `${config.from_name} <${fromEmail}>`,
      to: [email],
      subject: subject,
      html: htmlBody,
    });

    console.log("[send-auth-email] Email sent successfully:", emailResponse);

    // Log the email
    await supabase.from('system_email_logs').insert({
      recipient: email,
      subject: subject,
      template_key: templateKey,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        email_type,
        store_name,
        resend_id: emailResponse.data?.id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message_id: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-auth-email] Error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(serve_handler);
