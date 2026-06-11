import { errorResponse } from "../_shared/error-response.ts";
import { cancelNFe, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";
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
      .select('id, tenant_id, status, focus_ref, order_id, cancelled_at, source_order_invoice_id')
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

    // ===================================================================
    // TRAVA POR ESTADO DO OBJETO LOGÍSTICO (plano 2026-06-08)
    // Cancelar NF só é permitido se NÃO houver objeto OU se o objeto
    // estiver em 'draft' (etiqueta em preparo), 'label_created'
    // (etiqueta gerada, ainda não despachada) ou 'cancelled'.
    // Qualquer estado em movimento bloqueia com mensagem PT-BR.
    // ===================================================================
    const ALLOWED_SHIPMENT_STATES = new Set(['draft', 'label_created', 'canceled']);
    const { data: linkedShipments } = await supabaseClient
      .from('shipments')
      .select('id, tracking_code, delivery_status, delivered_at, source_pedido_venda_id')
      .or(
        [
          `invoice_id.eq.${invoice_id}`,
          invoice.source_order_invoice_id ? `source_pedido_venda_id.eq.${invoice.source_order_invoice_id}` : '',
        ].filter(Boolean).join(',')
      )
      .eq('tenant_id', tenantId);

    const blocking = (linkedShipments ?? []).find(s => !ALLOWED_SHIPMENT_STATES.has(String(s.delivery_status ?? '')));
    if (blocking) {
      const tracking = blocking.tracking_code ? ` (rastreio: ${blocking.tracking_code})` : '';
      let msg = '';
      const st = String(blocking.delivery_status ?? '');
      if (st === 'delivered') {
        const dt = blocking.delivered_at ? new Date(blocking.delivered_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
        msg = `Não é possível cancelar esta NF: o pedido já foi entregue ao cliente${tracking}${dt ? `, entregue em ${dt}` : ''}. Notas de pedidos entregues não podem ser canceladas — utilize uma NF de devolução se for o caso.`;
      } else if (st === 'returned' || st === 'returning') {
        msg = `Não é possível cancelar esta NF: o pedido foi devolvido${tracking}. Registre uma NF de devolução em vez de cancelar a original.`;
      } else {
        msg = `Não é possível cancelar esta NF: o pedido já foi despachado e está em rota de entrega${tracking}. Para cancelar a NF, primeiro cancele o objeto de postagem no módulo de Logística.`;
      }
      return jsonResponse({
        success: false,
        error: msg,
        code: 'shipment_blocks_cancel',
        blocking_shipment: {
          tracking_code: blocking.tracking_code,
          delivery_status: blocking.delivery_status,
          delivered_at: blocking.delivered_at,
        },
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
    const tenantTok = await loadFocusTenantToken(supabaseClient, tenantId, ambiente);
    const creds = resolveFocusCredentials({
      ambiente,
      operationKind: 'nfe_op',
      tenantTokenForAmbiente: tenantTok.token,
    });
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
        status_motivo: `Cancelada a pedido do emitente: ${justificativa}`,
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

    // ===================================================================
    // PÓS-CANCELAMENTO (plano 2026-06-08)
    // 1) Shipments vinculados (já validados como 'draft'/'label_created'/'cancelled')
    //    → marca como 'cancelled' + action_reason='invoice_cancelled' + desvincula
    //    invoice_id para liberar exclusão futura da NF.
    // 2) PV pai (source_order_invoice_id) → limpa pendencia_motivos e recalcula
    //    pedido_status (volta para "em aberto" sem observação extra).
    // ===================================================================
    const shipmentFilters = [
      `invoice_id.eq.${invoice_id}`,
      invoice.source_order_invoice_id ? `source_pedido_venda_id.eq.${invoice.source_order_invoice_id}` : '',
    ].filter(Boolean).join(',');

    await supabaseClient
      .from('shipments')
      .update({
        delivery_status: 'canceled',
        action_reason: 'invoice_cancelled',
        requires_action: false,
        invoice_id: null,
        updated_at: new Date().toISOString(),
      })
      .or(shipmentFilters)
      .eq('tenant_id', tenantId)
      .neq('delivery_status', 'canceled');

    if (invoice.source_order_invoice_id) {
      await supabaseClient
        .from('fiscal_invoices')
        .update({ pendencia_motivos: null, updated_at: new Date().toISOString() })
        .eq('id', invoice.source_order_invoice_id)
        .eq('tenant_id', tenantId);
      await supabaseClient.rpc('recompute_pv_pedido_status', { p_pv_id: invoice.source_order_invoice_id });

      // Fecha o ciclo de reset: enfileira novo rascunho logístico vinculado
      // ao PV (idempotente, respeita roteamento gateway/marketplace e
      // status terminal). Ver mem://constraints/nf-cancel-requeues-shipping-draft.
      try {
        const { data: requeueRes, error: requeueErr } = await supabaseClient.rpc(
          'requeue_shipping_draft_for_pv',
          { p_pv_id: invoice.source_order_invoice_id }
        );

        const shouldDispatchShippingDraft = !requeueErr && (
          requeueRes?.success === true ||
          requeueRes?.reason === 'already_queued'
        );

        if (shouldDispatchShippingDraft) {
          try {
            const projectUrl = Deno.env.get('SUPABASE_URL');
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

            if (projectUrl && serviceRoleKey) {
              fetch(`${projectUrl}/functions/v1/shipping-draft-process`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'apikey': serviceRoleKey,
                },
                body: JSON.stringify({
                  limit: 1,
                  source_pedido_venda_id: invoice.source_order_invoice_id,
                }),
              }).catch((dispatchErr) => {
                console.warn('[fiscal-cancel] shipping-draft-process dispatch failed:', dispatchErr);
              });
            }
          } catch (dispatchErr) {
            console.warn('[fiscal-cancel] shipping-draft-process dispatch error:', dispatchErr);
          }
        }

        await supabaseClient.from('fiscal_invoice_events').insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: 'shipping_requeue_after_cancel',
          event_data: {
            pv_id: invoice.source_order_invoice_id,
            result: requeueRes,
            error: requeueErr?.message ?? null,
            dispatch_requested: shouldDispatchShippingDraft,
          },
        });
      } catch (e) {
        // Não falhar o cancelamento por erro no requeue — apenas registrar
        await supabaseClient.from('fiscal_invoice_events').insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: 'shipping_requeue_after_cancel_error',
          event_data: { pv_id: invoice.source_order_invoice_id, error: String(e) },
        });
      }
    }

    if (invoice.order_id) {
      await supabaseClient.from('order_history').insert({
        order_id: invoice.order_id,
        action: 'fiscal_invoice_cancelled',
        description: `[NF-e CANCELADA] Justificativa: ${justificativa}.`,
      });
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
