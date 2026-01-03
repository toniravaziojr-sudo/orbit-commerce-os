import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Focus NFe status to internal status
function mapFocusStatusToInternal(focusStatus: string): string {
  const statusMap: Record<string, string> = {
    'processando_autorizacao': 'processing',
    'autorizado': 'authorized',
    'cancelado': 'cancelled',
    'erro_autorizacao': 'rejected',
    'denegado': 'denied',
    'aguardando_correcao': 'correction_needed',
  };
  return statusMap[focusStatus] || 'processing';
}

// Build full URL for Focus NFe paths
function buildFocusUrl(path: string | undefined, ambiente: string): string | undefined {
  if (!path) return undefined;
  // Se já é uma URL completa, retorna como está
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Constrói URL com base no ambiente
  const baseUrl = ambiente === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  return `${baseUrl}${path}`;
}

serve(async (req) => {
  console.log("[fiscal-webhook] ========== WEBHOOK RECEIVED ==========");
  console.log("[fiscal-webhook] Method:", req.method);
  console.log("[fiscal-webhook] URL:", req.url);
  
  // Log headers for debugging
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = key.toLowerCase().includes('auth') ? '[REDACTED]' : value;
  });
  console.log("[fiscal-webhook] Headers:", JSON.stringify(headers));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[fiscal-webhook] Responding to OPTIONS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get raw body for logging
    const rawBody = await req.text();
    console.log("[fiscal-webhook] Raw body:", rawBody);
    
    // Parse webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[fiscal-webhook] Failed to parse JSON:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[fiscal-webhook] Parsed payload:", JSON.stringify(payload, null, 2));

    // Focus NFe sends different event types
    // Common fields: cnpj, ref, status, chave_nfe, numero, serie, etc.
    const {
      cnpj,
      ref,
      status,
      chave_nfe,
      numero,
      serie,
      mensagem_sefaz,
      status_sefaz,
      caminho_xml_nota_fiscal,
      caminho_danfe,
      motivo_cancelamento,
      protocolo_cancelamento,
    } = payload;

    if (!ref) {
      console.error("[fiscal-webhook] Missing ref in payload");
      return new Response(
        JSON.stringify({ success: false, error: "Missing ref" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fiscal-webhook] Processing ref=${ref}, status=${status}, cnpj=${cnpj}`);
    console.log(`[fiscal-webhook] chave_nfe=${chave_nfe}, numero=${numero}, serie=${serie}`);
    console.log(`[fiscal-webhook] mensagem_sefaz=${mensagem_sefaz}, status_sefaz=${status_sefaz}`);

    // Find invoice by focus_ref
    console.log(`[fiscal-webhook] Searching for invoice with focus_ref=${ref}`);
    const { data: invoice, error: invoiceError } = await supabase
      .from("fiscal_invoices")
      .select("id, tenant_id, status, order_id")
      .eq("focus_ref", ref)
      .maybeSingle();

    if (invoiceError) {
      console.error("[fiscal-webhook] Error finding invoice:", JSON.stringify(invoiceError));
      return new Response(
        JSON.stringify({ success: false, error: "Database error", details: invoiceError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fiscal-webhook] Invoice query result:`, JSON.stringify(invoice));

    if (!invoice) {
      console.warn(`[fiscal-webhook] Invoice not found for ref=${ref}. Returning 200 to avoid retries.`);
      // Return 200 to acknowledge receipt (avoid retries)
      return new Response(
        JSON.stringify({ success: true, warning: "Invoice not found", ref }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fiscal-webhook] Found invoice: id=${invoice.id}, current_status=${invoice.status}, order_id=${invoice.order_id}`);

    // Get fiscal settings to determine ambiente
    const { data: settings } = await supabase
      .from("fiscal_settings")
      .select("focus_ambiente, ambiente")
      .eq("tenant_id", invoice.tenant_id)
      .single();
    
    const ambiente = settings?.focus_ambiente || settings?.ambiente || 'homologacao';

    // Map status
    const internalStatus = mapFocusStatusToInternal(status);
    console.log(`[fiscal-webhook] Mapped status: ${status} -> ${internalStatus}`);
    const now = new Date().toISOString();

    // Prepare update data
    const updateData: Record<string, any> = {
      status: internalStatus,
      updated_at: now,
    };

    // Add status-specific fields
    if (status === 'autorizado') {
      console.log("[fiscal-webhook] Processing 'autorizado' status");
      if (chave_nfe) updateData.chave_acesso = chave_nfe;
      // Don't update numero/serie - they're already set when creating the draft
      // Build full URLs for DANFE and XML
      const fullXmlUrl = buildFocusUrl(caminho_xml_nota_fiscal, ambiente);
      const fullDanfeUrl = buildFocusUrl(caminho_danfe, ambiente);
      if (fullXmlUrl) updateData.xml_url = fullXmlUrl;
      if (fullDanfeUrl) updateData.danfe_url = fullDanfeUrl;
      updateData.authorized_at = now;
      console.log(`[fiscal-webhook] Full DANFE URL: ${fullDanfeUrl}`);
      console.log(`[fiscal-webhook] Full XML URL: ${fullXmlUrl}`);
    }

    if (status === 'cancelado') {
      console.log("[fiscal-webhook] Processing 'cancelado' status");
      updateData.cancelled_at = now;
      if (motivo_cancelamento) updateData.cancel_justificativa = motivo_cancelamento;
      if (protocolo_cancelamento) updateData.protocolo = protocolo_cancelamento;
    }

    if (status === 'erro_autorizacao' || status === 'denegado') {
      console.log(`[fiscal-webhook] Processing error status: ${status}`);
      updateData.status_motivo = mensagem_sefaz || status_sefaz;
    }

    console.log("[fiscal-webhook] Update data:", JSON.stringify(updateData, null, 2));

    // Update invoice
    const { error: updateError } = await supabase
      .from("fiscal_invoices")
      .update(updateData)
      .eq("id", invoice.id);

    if (updateError) {
      console.error("[fiscal-webhook] Error updating invoice:", JSON.stringify(updateError));
      return new Response(
        JSON.stringify({ success: false, error: "Update failed", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fiscal-webhook] Invoice updated successfully");

    // Log event
    await supabase
      .from("fiscal_invoice_events")
      .insert({
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        event_type: `webhook_${status}`,
        event_data: payload,
      });

    // If authorized and has order_id, check if order was cancelled (fiscal alert)
    if (status === 'autorizado' && invoice.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("status")
        .eq("id", invoice.order_id)
        .single();

      if (order?.status === 'cancelled') {
        // Set requires_action flag for fiscal alert
        await supabase
          .from("fiscal_invoices")
          .update({
            requires_action: true,
            action_reason: "Pedido cancelado após autorização da NF-e",
          })
          .eq("id", invoice.id);
        
        console.log(`[fiscal-webhook] Fiscal alert: order ${invoice.order_id} cancelled but NF-e authorized`);
      }
    }

    console.log(`[fiscal-webhook] Invoice ${invoice.id} updated to status ${internalStatus}`);

    return new Response(
      JSON.stringify({ success: true, invoice_id: invoice.id, status: internalStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[fiscal-webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
