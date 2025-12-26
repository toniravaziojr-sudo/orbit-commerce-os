import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Logo pública para emails
const EMAIL_LOGO_URL = "https://app.comandocentral.com.br/images/email-logo.png";

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

    // Fetch the template from system_email_templates
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

    // Common variables for all templates
    const variables: Record<string, string> = {
      app_name: 'Comando Central',
      user_name: user_name || email.split('@')[0],
      confirmation_url: confirmation_url || 'https://app.comandocentral.com.br',
      user_email: email,
      store_name: store_name || 'sua loja',
      action_url: confirmation_url || 'https://app.comandocentral.com.br',
      dashboard_url: 'https://app.comandocentral.com.br',
      reset_url: confirmation_url || 'https://app.comandocentral.com.br/auth',
      year: new Date().getFullYear().toString(),
      logo_url: EMAIL_LOGO_URL,
    };

    if (templateError || !template) {
      console.log("[send-auth-email] Template not found in database, using fallback for:", templateKey);
      
      // Fallback templates com a nova logo
      const fallbackTemplates: Record<string, { subject: string; html: string }> = {
        welcome: {
          subject: `Bem-vindo ao Comando Central, ${variables.user_name}!`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header com logo centralizada -->
          <tr>
            <td style="background-color: #0f172a; padding: 40px; text-align: center;">
              <img src="${EMAIL_LOGO_URL}" alt="Comando Central" style="height: 100px; max-width: 300px;" />
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Olá, ${variables.user_name}!</h1>
              <p style="color: #555; line-height: 1.6; margin: 0 0 15px 0;">
                Sua conta e loja <strong>${variables.store_name}</strong> foram criadas com sucesso no Comando Central.
              </p>
              <p style="color: #555; line-height: 1.6; margin: 0 0 25px 0;">
                Você já pode acessar o painel administrativo e começar a configurar sua loja virtual.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.dashboard_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Acessar Meu Painel
                </a>
              </div>
              <p style="color: #555; line-height: 1.6; margin: 25px 0 0 0;">
                Precisa de ajuda? Nossa equipe está à disposição para te auxiliar.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                © ${variables.year} Comando Central. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
        },
        auth_confirm: {
          subject: `Confirme sua conta - Comando Central`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #0f172a; padding: 40px; text-align: center;">
              <img src="${EMAIL_LOGO_URL}" alt="Comando Central" style="height: 100px; max-width: 300px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Confirme sua conta</h1>
              <p style="color: #555; line-height: 1.6; margin: 0 0 25px 0;">
                Olá, ${variables.user_name}! Clique no botão abaixo para confirmar sua conta no Comando Central.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.confirmation_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Confirmar Minha Conta
                </a>
              </div>
              <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 25px 0 0 0;">
                Se você não criou esta conta, pode ignorar este email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                © ${variables.year} Comando Central. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
        },
        password_reset: {
          subject: `Redefinir sua senha - Comando Central`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #0f172a; padding: 40px; text-align: center;">
              <img src="${EMAIL_LOGO_URL}" alt="Comando Central" style="height: 100px; max-width: 300px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Redefinir sua senha</h1>
              <p style="color: #555; line-height: 1.6; margin: 0 0 25px 0;">
                Olá, ${variables.user_name}! Recebemos uma solicitação para redefinir a senha da sua conta no Comando Central.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.reset_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Redefinir Minha Senha
                </a>
              </div>
              <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 25px 0 0 0;">
                Se você não solicitou a redefinição de senha, ignore este email. O link expira em 1 hora.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                © ${variables.year} Comando Central. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
        },
      };

      const fallback = fallbackTemplates[templateKey] || fallbackTemplates['welcome'];
      subject = fallback.subject;
      htmlBody = fallback.html;
    } else {
      // Use template from database
      htmlBody = template.body_html || '';
      subject = template.subject || 'Comando Central';

      // Replace all variables including logo_url
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
        used_fallback: templateError !== null,
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
