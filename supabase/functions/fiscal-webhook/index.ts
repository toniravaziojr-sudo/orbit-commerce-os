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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse webhook payload
    const payload = await req.json();
    
    console.log("[fiscal-webhook] Received webhook:", JSON.stringify(payload));

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

    console.log(`[fiscal-webhook] Processing ref=${ref}, status=${status}`);

    // Find invoice by focus_ref
    const { data: invoice, error: invoiceError } = await supabase
      .from("fiscal_invoices")
      .select("id, tenant_id, status, order_id")
      .eq("focus_ref", ref)
      .maybeSingle();

    if (invoiceError) {
      console.error("[fiscal-webhook] Error finding invoice:", invoiceError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice) {
      console.warn(`[fiscal-webhook] Invoice not found for ref=${ref}`);
      // Return 200 to acknowledge receipt (avoid retries)
      return new Response(
        JSON.stringify({ success: true, warning: "Invoice not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map status
    const internalStatus = mapFocusStatusToInternal(status);
    const now = new Date().toISOString();

    // Prepare update data
    const updateData: Record<string, any> = {
      status: internalStatus,
      updated_at: now,
    };

    // Add status-specific fields
    if (status === 'autorizado') {
      if (chave_nfe) updateData.chave_acesso = chave_nfe;
      if (numero) updateData.numero = numero;
      if (serie) updateData.serie = serie;
      if (caminho_xml_nota_fiscal) updateData.xml_url = caminho_xml_nota_fiscal;
      if (caminho_danfe) updateData.danfe_url = caminho_danfe;
      updateData.authorized_at = now;
    }

    if (status === 'cancelado') {
      updateData.cancelled_at = now;
      if (motivo_cancelamento) updateData.cancel_justificativa = motivo_cancelamento;
      if (protocolo_cancelamento) updateData.protocolo = protocolo_cancelamento;
    }

    if (status === 'erro_autorizacao' || status === 'denegado') {
      updateData.status_motivo = mensagem_sefaz || status_sefaz;
    }

    // Update invoice
    const { error: updateError } = await supabase
      .from("fiscal_invoices")
      .update(updateData)
      .eq("id", invoice.id);

    if (updateError) {
      console.error("[fiscal-webhook] Error updating invoice:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Update failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
