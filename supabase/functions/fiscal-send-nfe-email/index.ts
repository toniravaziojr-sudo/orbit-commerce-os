import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNFeEmailRequest {
  invoice_id: string;
  tenant_id: string;
}

async function sendEmailViaSendGrid(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/html", value: htmlContent }],
      }),
    });

    if (response.ok || response.status === 202) {
      const messageId = response.headers.get("X-Message-Id") || `sg_${Date.now()}`;
      return { success: true, messageId };
    }

    const errorText = await response.text();
    console.error("[fiscal-send-nfe-email] SendGrid error:", response.status, errorText);
    return { success: false, error: `SendGrid error: ${response.status}` };
  } catch (error) {
    console.error("[fiscal-send-nfe-email] SendGrid exception:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return new Date().toLocaleDateString("pt-BR");
  try {
    return new Date(dateString).toLocaleDateString("pt-BR");
  } catch {
    return dateString;
  }
}

serve(async (req) => {
  console.log("[fiscal-send-nfe-email] Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");

  if (!sendgridApiKey) {
    console.error("[fiscal-send-nfe-email] SENDGRID_API_KEY not configured");
    return new Response(
      JSON.stringify({ success: false, error: "SendGrid API key não configurada" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: SendNFeEmailRequest = await req.json();
    const { invoice_id, tenant_id } = body;

    if (!invoice_id || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "invoice_id e tenant_id são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fiscal-send-nfe-email] Processing invoice ${invoice_id} for tenant ${tenant_id}`);

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("fiscal_invoices")
      .select(`
        *,
        order:orders(
          id,
          order_number,
          customer:customers(full_name, email)
        )
      `)
      .eq("id", invoice_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("[fiscal-send-nfe-email] Invoice not found:", invoiceError);
      return new Response(
        JSON.stringify({ success: false, error: "NF-e não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer email
    const customerEmail = invoice.dest_email || invoice.order?.customer?.email;
    const customerName = invoice.dest_nome || invoice.order?.customer?.full_name || "Cliente";

    if (!customerEmail) {
      console.log("[fiscal-send-nfe-email] No customer email available, skipping");
      return new Response(
        JSON.stringify({ success: false, error: "Email do cliente não disponível" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant info for store name
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenant_id)
      .single();

    // Fetch fiscal settings to check for custom email template
    const { data: fiscalSettings } = await supabase
      .from("fiscal_settings")
      .select("email_nfe_subject, email_nfe_body")
      .eq("tenant_id", tenant_id)
      .single();

    // Fetch system email config for sender details
    const { data: emailConfig } = await supabase
      .from("system_email_config")
      .select("from_email, from_name")
      .single();

    const fromEmail = emailConfig?.from_email || "noreply@comandocentral.com.br";
    const fromName = emailConfig?.from_name || tenant?.name || "Comando Central";

    // Prepare template variables
    const variables: Record<string, string> = {
      customer_name: customerName,
      order_number: invoice.order?.order_number || `#${invoice.order_id?.substring(0, 8) || "N/A"}`,
      nfe_number: String(invoice.numero || "N/A"),
      nfe_serie: String(invoice.serie || "1"),
      data_emissao: formatDate(invoice.authorized_at || invoice.submitted_at),
      valor_total: formatCurrency(invoice.valor_total || 0),
      chave_acesso: invoice.chave_acesso || "N/A",
      danfe_url: invoice.danfe_url || "#",
      xml_url: invoice.xml_url || "#",
      store_name: tenant?.name || "Nossa Loja",
    };

    let subject: string;
    let htmlBody: string;

    // Check if tenant has custom email template configured
    if (fiscalSettings?.email_nfe_subject && fiscalSettings?.email_nfe_body) {
      console.log("[fiscal-send-nfe-email] Using custom email template from fiscal_settings");
      subject = fiscalSettings.email_nfe_subject;
      
      // Convert plain text body to HTML (preserve line breaks)
      const bodyText = fiscalSettings.email_nfe_body
        .replace(/\n/g, "<br>")
        .replace(/  /g, "&nbsp;&nbsp;");
      
      htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            a { color: #0066cc; }
          </style>
        </head>
        <body>
          <div class="container">
            ${bodyText}
          </div>
        </body>
        </html>
      `;
    } else {
      // Use default fallback template (no longer depends on system_email_templates)
      console.log("[fiscal-send-nfe-email] Using default fallback email template");
      subject = `Sua Nota Fiscal - Pedido {{order_number}} - {{store_name}}`;
      htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #0f172a; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{{store_name}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Sua Nota Fiscal foi emitida!</h2>
              <p style="color: #555; line-height: 1.6; margin: 0 0 15px 0;">
                Olá <strong>{{customer_name}}</strong>,
              </p>
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px 0;">
                A nota fiscal do seu pedido <strong>{{order_number}}</strong> foi autorizada pela SEFAZ.
              </p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Número da NF-e:</strong></td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">{{nfe_number}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Série:</strong></td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">{{nfe_serie}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Data de Emissão:</strong></td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">{{data_emissao}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Valor Total:</strong></td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: bold;">R$ {{valor_total}}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #888; font-size: 12px; word-break: break-all; margin: 15px 0;">
                <strong>Chave de Acesso:</strong><br>{{chave_acesso}}
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{danfe_url}}" style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 600;">
                  📄 Baixar DANFE (PDF)
                </a>
                <a href="{{xml_url}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 5px; font-weight: 600;">
                  📥 Baixar XML
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} {{store_name}}. Todos os direitos reservados.
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

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      htmlBody = htmlBody.replace(regex, value);
    }

    console.log(`[fiscal-send-nfe-email] Sending email to ${customerEmail}`);

    // Send email via SendGrid
    const result = await sendEmailViaSendGrid(
      sendgridApiKey,
      fromEmail,
      fromName,
      customerEmail,
      subject,
      htmlBody
    );

    // Log the email attempt
    await supabase.from("system_email_logs").insert({
      template_key: "nfe_autorizada",
      to_email: customerEmail,
      subject,
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      metadata: {
        invoice_id,
        tenant_id,
        message_id: result.messageId,
        nfe_numero: invoice.numero,
      },
    });

    // Log event in fiscal_invoice_events
    await supabase.from("fiscal_invoice_events").insert({
      invoice_id,
      tenant_id,
      event_type: result.success ? "email_sent" : "email_failed",
      event_data: {
        to: customerEmail,
        message_id: result.messageId,
        error: result.error,
      },
    });

    console.log(`[fiscal-send-nfe-email] Email ${result.success ? "sent" : "failed"}: ${result.messageId || result.error}`);

    return new Response(
      JSON.stringify({
        success: result.success,
        message_id: result.messageId,
        error: result.error,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fiscal-send-nfe-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
