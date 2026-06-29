import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { persistAuthorizedState } from "../_shared/fiscal-persist-authorized.ts";
import { fireAuthorizedSideEffects } from "../_shared/fiscal-authorized-side-effects.ts";
import { mapFocusStatusToInternal } from "../_shared/focus-nfe-adapter.ts";
import { validateFiscalWebhookAuth } from "../_shared/fiscal-role-check.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Status terminais — não devem ser sobrescritos por novos webhooks (idempotência).
const TERMINAL_STATUSES = new Set(["authorized", "cancelled", "rejected"]);

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

Deno.serve(async (req) => {
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

  // Validate Focus NFe webhook auth (per-tenant token preferred; global secret fallback)
  const authResult = await validateFiscalWebhookAuth(req);
  if (!authResult.ok) {
    return authResult.response;
  }
  const tenantFromToken = authResult.tenantId; // null if matched by global secret

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

    // Tenant guard: when authenticated by per-tenant token, the invoice MUST belong to that tenant.
    if (tenantFromToken && tenantFromToken !== invoice.tenant_id) {
      console.error(`[fiscal-webhook] Tenant mismatch: token=${tenantFromToken} invoice.tenant=${invoice.tenant_id}`);
      return new Response(
        JSON.stringify({ success: false, error: "Tenant mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get fiscal settings to determine ambiente
    const { data: settings } = await supabase
      .from("fiscal_settings")
      .select("focus_ambiente, ambiente, webhook_status, webhook_validated_at")
      .eq("tenant_id", invoice.tenant_id)
      .single();

    const ambiente = settings?.focus_ambiente || settings?.ambiente || 'homologacao';

    // Always update last_received_at — promotes pending → validated on first successful event.
    const nowIso = new Date().toISOString();
    const webhookPatch: Record<string, unknown> = { webhook_last_received_at: nowIso };
    if (settings && settings.webhook_status !== 'validated') {
      webhookPatch.webhook_status = 'validated';
      webhookPatch.webhook_validated_at = settings.webhook_validated_at || nowIso;
      webhookPatch.webhook_last_error = null;
      webhookPatch.webhook_last_error_at = null;
    }
    await supabase.from("fiscal_settings").update(webhookPatch).eq("tenant_id", invoice.tenant_id);

    // Map status
    const internalStatus = mapFocusStatusToInternal(status);
    console.log(`[fiscal-webhook] Mapped status: ${status} -> ${internalStatus}`);
    const now = new Date().toISOString();

    // Idempotência: nota já em status terminal igual ao recebido → noop seguro.
    if (TERMINAL_STATUSES.has(invoice.status) && invoice.status === internalStatus) {
      console.log(`[fiscal-webhook] Noop: invoice ${invoice.id} already in terminal status ${invoice.status}`);
      await supabase.from("fiscal_invoice_events").insert({
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        event_type: `webhook_${status}_noop`,
        event_data: payload,
      });
      return new Response(
        JSON.stringify({ success: true, noop: true, status: invoice.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CAMINHO CANÔNICO de autorização — passa pelo helper unificado.
    if (status === 'autorizado' && chave_nfe) {
      const persistResult = await persistAuthorizedState({
        supabaseClient: supabase,
        invoiceId: invoice.id,
        tenantId: invoice.tenant_id,
        ambiente: (ambiente as 'homologacao' | 'producao'),
        callerModule: 'fiscal-webhook',
        focusStatusData: {
          status: 'autorizado',
          chave_nfe,
          numero,
          serie,
          caminho_xml_nota_fiscal,
          caminho_danfe,
          mensagem_sefaz,
          status_sefaz,
          protocolo: payload.protocolo_autorizacao || payload.protocolo,
        },
        focusRef: ref,
      });

      // Log evento (sempre, mesmo se persist saltou — para o reconciliador rastrear).
      await supabase.from('fiscal_invoice_events').insert({
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        event_type: 'authorized',
        event_data: { focus_response: payload, source: 'fiscal-webhook' },
      });

      // Cancelamento de pedido após autorização → alerta fiscal.
      if (invoice.order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('id', invoice.order_id)
          .maybeSingle();

        if (order?.status === 'cancelled') {
          await supabase
            .from('fiscal_invoices')
            .update({
              requires_action: true,
              action_reason: 'Pedido cancelado após autorização da NF-e',
            })
            .eq('id', invoice.id);
        }
      }

      if (persistResult.persisted && persistResult.invoice) {
        await fireAuthorizedSideEffects({
          supabaseClient: supabase,
          invoice: { id: invoice.id, tenant_id: invoice.tenant_id, order_id: invoice.order_id },
          chaveAcesso: chave_nfe,
          supabaseUrl,
          supabaseServiceKey,
          callerModule: 'fiscal-webhook',
        });
      }
    } else {
      // Outros estados (cancelado, rejeitado, etc.): atualiza direto.
      const updateData: Record<string, any> = {
        status: internalStatus,
        fiscal_stage: internalStatus === 'rejected' ? 'pendencia' : undefined,
        pendencia_motivos: internalStatus === 'rejected'
          ? [mensagem_sefaz || status_sefaz || 'Nota rejeitada pela SEFAZ.']
          : null,
        updated_at: now,
      };

      if (status === 'cancelado') {
        updateData.cancelled_at = now;
        if (motivo_cancelamento) updateData.cancel_justificativa = motivo_cancelamento;
        if (protocolo_cancelamento) updateData.protocolo = protocolo_cancelamento;
      }
      if (status === 'erro_autorizacao' || status === 'denegado') {
        updateData.status_motivo = mensagem_sefaz || status_sefaz;
      }

      const { error: updateError } = await supabase
        .from('fiscal_invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[fiscal-webhook] update failed:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Update failed', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await supabase.from('fiscal_invoice_events').insert({
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        event_type: `webhook_${status}`,
        event_data: payload,
      });
    }


    console.log(`[fiscal-webhook] Invoice ${invoice.id} updated to status ${internalStatus}`);

    return new Response(
      JSON.stringify({ success: true, invoice_id: invoice.id, status: internalStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'webhook' });
  }
});
