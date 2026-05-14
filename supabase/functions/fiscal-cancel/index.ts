import { errorResponse } from "../_shared/error-response.ts";
import { cancelNFe, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { chargeAfter } from "../_shared/credits/charge-after.ts";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
import { requireFiscalRole } from "../_shared/fiscal-role-check.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  // Token resolvido depois, junto com o ambiente do tenant.


  try {
    // RBAC: cancelamento real exige owner/admin (Lote 1.C.3)
    const auth = await requireFiscalRole(req, ['owner', 'admin']);
    if (!auth.ok) return auth.response;
    const { tenantId, serviceClient: supabaseClient } = auth;

    const body = await req.json().catch(() => ({}));
    const { invoice_id, justificativa } = body ?? {};

    if (!invoice_id) {
      return jsonResponse({ success: false, error: 'invoice_id é obrigatório', code: 'missing_invoice_id' });
    }
    if (!justificativa || justificativa.length < 15 || justificativa.length > 255) {
      return jsonResponse({ success: false, error: 'Justificativa deve ter entre 15 e 255 caracteres', code: 'invalid_justificativa' });
    }

    console.log(`[fiscal-cancel] tenant=${tenantId} invoice=${invoice_id}`);

    // Tenant guard via filtro composto
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('fiscal_invoices')
      .select('id, tenant_id, status, focus_ref, order_id, cancelled_at')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return jsonResponse({ success: false, error: 'NF-e não encontrada', code: 'invoice_not_found' });
    }

    // Idempotência: já cancelada → retornar sucesso noop, sem nova chamada Focus
    if (invoice.status === 'cancelled') {
      return jsonResponse({
        success: true,
        noop: true,
        status: 'cancelled',
        message: 'NF-e já estava cancelada',
      });
    }

    if (invoice.status !== 'authorized') {
      return jsonResponse({
        success: false,
        error: 'Apenas NF-e autorizadas podem ser canceladas',
        code: 'invalid_status',
      });
    }

    if (!invoice.focus_ref) {
      return jsonResponse({ success: false, error: 'NF-e não foi enviada para Focus NFe', code: 'no_focus_ref' });
    }

    const { data: settings } = await supabaseClient
      .from('fiscal_settings')
      .select('focus_ambiente, ambiente')
      .eq('tenant_id', tenantId)
      .single();

    const ambiente = (settings?.focus_ambiente || settings?.ambiente || 'homologacao') as 'homologacao' | 'producao';
    const creds = resolveFocusCredentials({ ambiente });
    if (!creds.ok || !creds.token) {
      return jsonResponse({ success: false, error: creds.error, code: creds.errorCode });
    }
    const focusConfig: FocusNFeConfig = {
      token: creds.token,
      ambiente,
    };

    const result = await cancelNFe(focusConfig, invoice.focus_ref, justificativa);

    if (!result.success) {
      await supabaseClient
        .from('fiscal_invoice_events')
        .insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: 'cancel_error',
          event_data: { error: result.error, justificativa },
        });
      return jsonResponse({ success: false, error: result.error, code: 'focus_error' });
    }

    await supabaseClient
      .from('fiscal_invoices')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_justificativa: justificativa,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId);

    await supabaseClient
      .from('fiscal_invoice_events')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        event_type: 'cancelled',
        event_data: { justificativa, response: result.data },
      });

    if (invoice.order_id) {
      await supabaseClient.from('order_history').insert({
        order_id: invoice.order_id,
        action: 'fiscal_invoice_cancelled',
        description: `[NF-e CANCELADA] Justificativa: ${justificativa}. ` +
          `Reveja o status do pedido e a etiqueta de envio (se houver).`,
      });

      await supabaseClient
        .from('shipments')
        .update({
          requires_action: true,
          action_reason: 'invoice_cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', invoice.order_id)
        .eq('requires_action', false)
        .is('delivered_at', null);
    }

    chargeAfter({
      tenantId,
      serviceKey: 'nfe-cancel',
      units: { count: 1 },
      jobId: `cancel-${invoice_id}`,
      feature: 'fiscal-cancel',
    }).catch(() => {});

    console.log(`[fiscal-cancel] NF-e ${invoice_id} cancelada`);

    return jsonResponse({
      success: true,
      status: 'cancelled',
      message: 'NF-e cancelada com sucesso',
    });
  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'cancel' });
  }
});
