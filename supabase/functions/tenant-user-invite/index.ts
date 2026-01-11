import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  user_type: 'manager' | 'editor' | 'attendant' | 'assistant' | 'viewer';
  permissions: Record<string, boolean | Record<string, boolean>>;
  tenant_id: string;
}

const USER_TYPE_LABELS: Record<string, string> = {
  manager: 'Gerente',
  editor: 'Editor',
  attendant: 'Atendente',
  assistant: 'Auxiliar',
  viewer: 'Visualizador',
};

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Render template with variables
function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// Fallback HTML if template not found
function getFallbackHtml(
  inviterName: string,
  tenantName: string,
  userType: string,
  acceptUrl: string
): string {
  const userTypeLabel = USER_TYPE_LABELS[userType] || userType;
  return `
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
              <img src="https://app.comandocentral.com.br/images/email-logo.png" alt="Comando Central" style="height: 80px; max-width: 250px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Você foi convidado!</h1>
              <p style="color: #555; line-height: 1.6; margin: 0 0 15px 0;">
                <strong>${inviterName}</strong> convidou você para fazer parte da equipe de <strong>${tenantName}</strong> no Comando Central.
              </p>
              <p style="color: #555; line-height: 1.6; margin: 0 0 25px 0;">
                Seu perfil de acesso será: <strong>${userTypeLabel}</strong>
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${acceptUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Aceitar Convite
                </a>
              </div>
              <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 25px 0 0 0;">
                Este convite expira em 7 dias. Se você não esperava este email, pode ignorá-lo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Comando Central. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// SendGrid email helper
async function sendInviteEmail(
  apiKey: string,
  from: { email: string; name: string },
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from.email, name: from.name },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[tenant-user-invite] SendGrid error:", response.status, errorText);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[tenant-user-invite] SendGrid exception:", error);
    return { success: false, error: error.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, user_type, permissions, tenant_id }: InviteRequest = await req.json();

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    console.log(`[tenant-user-invite] User ${user.id} inviting ${normalizedEmail} to tenant ${tenant_id}`);

    // Verify user is owner of the tenant
    const { data: ownerRole, error: ownerError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .eq('role', 'owner')
      .maybeSingle();

    if (ownerError || !ownerRole) {
      console.error("[tenant-user-invite] User is not owner:", ownerError);
      return new Response(
        JSON.stringify({ success: false, error: "Somente o proprietário pode convidar usuários" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already has access to this tenant
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id, user_id')
      .eq('tenant_id', tenant_id)
      .eq('user_id', (
        await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()
      ).data?.id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (existingRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Este usuário já faz parte da equipe" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from('tenant_user_invitations')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ success: false, error: "Já existe um convite pendente para este email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get tenant name
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenant_id)
      .single();

    // Get inviter profile
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Generate token and expiration
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invitation
    const { error: insertError } = await supabaseAdmin
      .from('tenant_user_invitations')
      .insert({
        tenant_id,
        email: normalizedEmail,
        user_type,
        permissions,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("[tenant-user-invite] Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar convite" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Canonical APP_BASE_URL - always use the published app domain
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://app.comandocentral.com.br";
    const acceptUrl = `${APP_BASE_URL}/accept-invite?token=${token}`;

    console.log(`[tenant-user-invite] Generated accept URL: ${acceptUrl}`);

    // Send email if SendGrid is configured
    if (sendgridApiKey) {
      // Get system email config
      const { data: emailConfig } = await supabaseAdmin
        .from('system_email_config')
        .select('from_email, from_name, sending_domain, verification_status')
        .single();

      if (emailConfig?.verification_status === 'verified') {
        const fromEmail = emailConfig.from_email.includes('@')
          ? emailConfig.from_email
          : `${emailConfig.from_email}@${emailConfig.sending_domain}`;

        // Fetch email template from database
        const { data: emailTemplate, error: templateError } = await supabaseAdmin
          .from('system_email_templates')
          .select('subject, body_html, is_active')
          .eq('template_key', 'tenant_user_invite')
          .eq('is_active', true)
          .maybeSingle();

        const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Um administrador';
        const tenantName = tenant?.name || 'sua loja';
        const userTypeLabel = USER_TYPE_LABELS[user_type] || user_type;
        const expiresAtFormatted = expiresAt.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        let subject: string;
        let html: string;

        if (emailTemplate && !templateError) {
          // Use template from database
          const templateVars = {
            tenant_name: tenantName,
            inviter_name: inviterName,
            user_type_label: userTypeLabel,
            accept_url: acceptUrl,
            expires_at: expiresAtFormatted,
            invited_email: normalizedEmail,
          };

          subject = renderTemplate(emailTemplate.subject, templateVars);
          html = renderTemplate(emailTemplate.body_html, templateVars);
          console.log("[tenant-user-invite] Using template from database");
        } else {
          // Fallback to hardcoded template
          subject = `Convite para ${tenantName} - Comando Central`;
          html = getFallbackHtml(inviterName, tenantName, user_type, acceptUrl);
          console.log("[tenant-user-invite] Using fallback template (template not found or inactive)");
        }

        const emailResult = await sendInviteEmail(
          sendgridApiKey,
          { email: fromEmail, name: emailConfig.from_name },
          normalizedEmail,
          subject,
          html
        );

        if (!emailResult.success) {
          console.error("[tenant-user-invite] Email failed:", emailResult.error);
          // Don't fail the whole operation, just log it
        }
      } else {
        console.log("[tenant-user-invite] Email not sent - domain not verified");
      }
    } else {
      console.log("[tenant-user-invite] Email not sent - SendGrid not configured");
    }

    console.log(`[tenant-user-invite] Invitation created successfully for ${normalizedEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Convite enviado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[tenant-user-invite] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
