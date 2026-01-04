import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      // Use system template
      console.log("[fiscal-send-nfe-email] Using system email template");
      const { data: template, error: templateError } = await supabase
        .from("system_email_templates")
        .select("subject, body_html")
        .eq("template_key", "nfe_autorizada")
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        console.error("[fiscal-send-nfe-email] Template not found:", templateError);
        return new Response(
          JSON.stringify({ success: false, error: "Template de email não encontrado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      subject = template.subject;
      htmlBody = template.body_html;
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
