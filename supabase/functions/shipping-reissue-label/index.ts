/**
 * shipping-reissue-label
 *
 * Reemite a etiqueta Correios (pré-postagem CWS) de um Objeto de Postagem
 * cuja etiqueta original foi cancelada pelos Correios (evento
 * "Etiqueta cancelada pelo sistema de captação" ou similares).
 *
 * Regras invioláveis (mem://constraints/shipment-reissue-after-correios-cancel):
 * - NÃO reaproveita numero: cria um novo registro em `shipments` com numero
 *   próprio alocado pelo trigger `trg_shipments_set_numero`.
 * - Vínculo canônico é com o PV (source_pedido_venda_id) — Pedido, NF,
 *   Cliente, Remessa vêm derivados do PV.
 * - Gate por estado: só reemite se `delivery_status='canceled'` e não houver
 *   evento pós-despacho legítimo (posted/in_transit/out_for_delivery/delivered/
 *   returned).
 * - Após emitir com sucesso, NÃO reenvia para o WMS Pratika: a Pratika bloqueia
 *   troca de rastreio quando a NF já teve "saída real" registrada. O usuário
 *   imprime a nova etiqueta e envia manualmente para a logística.
 * - Enfileira reenvio ao marketplace quando aplicável (ML).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POST_DISPATCH_STATUSES = new Set([
  'posted', 'in_transit', 'out_for_delivery', 'delivered', 'returned',
]);

interface ReissueBody {
  shipment_id: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ===== Auth =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, error: 'Não autorizado' }, 401);
    }
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Usuário não autenticado' }, 401);
    }
    const { data: profile } = await supabase
      .from('profiles').select('current_tenant_id').eq('id', user.id).single();
    if (!profile?.current_tenant_id) {
      return json({ success: false, error: 'Tenant não identificado' });
    }
    const tenantId = profile.current_tenant_id as string;

    // ===== Body =====
    const body = await req.json() as ReissueBody;
    if (!body?.shipment_id) {
      return json({ success: false, error: 'shipment_id é obrigatório' });
    }
    const reason = String(body.reason || 'Etiqueta cancelada pelos Correios — reemitindo').slice(0, 500);

    // ===== Carrega objeto antigo =====
    const { data: oldShip, error: oldErr } = await supabase
      .from('shipments')
      .select('id, tenant_id, numero, order_id, invoice_id, source_pedido_venda_id, remessa_id, carrier, service_code, service_name, tracking_code, delivery_status, nfe_key, metadata')
      .eq('id', body.shipment_id)
      .maybeSingle();
    if (oldErr || !oldShip) {
      return json({ success: false, error: 'Objeto de postagem não encontrado' });
    }
    if (oldShip.tenant_id !== tenantId) {
      return json({ success: false, error: 'Objeto não pertence a este tenant' });
    }

    // ===== Gate 1: precisa estar cancelado =====
    if (oldShip.delivery_status !== 'canceled') {
      return json({
        success: false,
        code: 'not_canceled',
        error: 'Só é possível reemitir etiquetas com status "Cancelado". Este objeto está em outro estado — verifique se ele realmente foi cancelado pelos Correios antes de reemitir.',
      });
    }

    // ===== Gate 2: sem eventos pós-despacho legítimos =====
    const { data: postEvents } = await supabase
      .from('shipment_events')
      .select('status, description, occurred_at')
      .eq('shipment_id', oldShip.id)
      .in('status', Array.from(POST_DISPATCH_STATUSES))
      .limit(1);
    if (postEvents && postEvents.length > 0) {
      const ev = postEvents[0];
      return json({
        success: false,
        code: 'shipment_dispatched',
        error: `Não é possível reemitir: o objeto já teve movimentação real dos Correios (${ev.status}). Se ainda assim precisa de nova etiqueta, é necessário abrir chamado nos Correios.`,
      });
    }

    // ===== Só fluxo Correios (local) =====
    const carrier = (oldShip.carrier || '').toLowerCase();
    if (carrier && !['correios', 'correios-cws'].includes(carrier)) {
      return json({
        success: false,
        code: 'unsupported_carrier',
        error: `Reemissão automática só está disponível para etiquetas Correios. Transportadora atual: ${oldShip.carrier}.`,
      });
    }

    // ===== Idempotência: se já reemitido com sucesso, retorna o novo objeto =====
    // (Não usamos advisory lock — a checagem de metadata.reissued_to_shipment_id
    //  cobre o cenário de duplo clique quando o primeiro pedido já concluiu.)
    const existingReissue = (oldShip.metadata as any)?.reissued_to_shipment_id;
    if (existingReissue) {
      const { data: existing } = await supabase
        .from('shipments')
        .select('id, numero, tracking_code, delivery_status, label_url')
        .eq('id', existingReissue)
        .maybeSingle();
      if (existing && existing.tracking_code) {
        return json({
          success: true,
          already_reissued: true,
          new_shipment_id: existing.id,
          new_numero: existing.numero,
          new_tracking: existing.tracking_code,
          label_url: existing.label_url,
          message: `Este objeto já foi reemitido no #${existing.numero} (${existing.tracking_code}).`,
        });
      }
    }

    // ===== Cria novo rascunho (numero alocado pelo trigger) =====
    const inheritedMetadata = { ...(oldShip.metadata as Record<string, unknown> || {}) };
    // Não copiamos campos de auditoria de emissão antiga.
    delete (inheritedMetadata as any).reissued_from_shipment_id;
    delete (inheritedMetadata as any).reissued_to_shipment_id;
    delete (inheritedMetadata as any).error_message;

    const draftInsert = {
      tenant_id: tenantId,
      order_id: oldShip.order_id,
      invoice_id: oldShip.invoice_id,
      source_pedido_venda_id: oldShip.source_pedido_venda_id,
      remessa_id: oldShip.remessa_id,
      carrier: oldShip.carrier,
      service_code: oldShip.service_code,
      service_name: oldShip.service_name,
      nfe_key: oldShip.nfe_key,
      delivery_status: 'draft',
      source: 'reissue',
      metadata: {
        ...inheritedMetadata,
        reissued_from_shipment_id: oldShip.id,
        reissued_from_numero: oldShip.numero,
        reissued_from_tracking: oldShip.tracking_code,
        reissue_reason: reason,
        reissued_at: new Date().toISOString(),
        reissued_by: user.id,
      },
    };

    const { data: newDraft, error: draftErr } = await supabase
      .from('shipments')
      .insert(draftInsert)
      .select('id, numero')
      .single();
    if (draftErr || !newDraft) {
      console.error('[shipping-reissue-label] Falha ao criar rascunho:', draftErr);
      return json({ success: false, error: 'Falha ao criar novo rascunho de objeto: ' + (draftErr?.message || 'erro desconhecido') });
    }
    console.log(`[shipping-reissue-label] Novo rascunho ${newDraft.id} (#${newDraft.numero}) criado a partir de ${oldShip.id} (#${oldShip.numero})`);

    // ===== Despacha via shipping-create-shipment (chamada interna service_role) =====
    const dispatchResp = await fetch(`${supabaseUrl}/functions/v1/shipping-create-shipment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shipment_id: newDraft.id,
        tenant_id: tenantId,
      }),
    });
    const dispatchJson = await dispatchResp.json().catch(() => ({}));

    if (!dispatchJson?.success || !dispatchJson?.tracking_code) {
      // Rollback: remove o rascunho recém-criado para não poluir a aba.
      await supabase.from('shipments').delete().eq('id', newDraft.id);
      const errMsg = dispatchJson?.error || 'Falha desconhecida ao emitir nova pré-postagem nos Correios';
      console.error('[shipping-reissue-label] Dispatch falhou:', errMsg);
      return json({ success: false, code: 'dispatch_failed', error: errMsg });
    }

    const newTracking = dispatchJson.tracking_code as string;

    // ===== Marca objeto antigo com referência cruzada =====
    const oldMetaPatched = {
      ...(oldShip.metadata as Record<string, unknown> || {}),
      reissued_to_shipment_id: newDraft.id,
      reissued_to_numero: newDraft.numero,
      reissued_to_tracking: newTracking,
      reissued_at: new Date().toISOString(),
      reissue_reason: reason,
    };
    await supabase.from('shipments').update({
      delivery_status: 'canceled',
      requires_action: false,
      action_reason: null,
      metadata: oldMetaPatched,
    }).eq('id', oldShip.id);

    // ===== Log auditoria (best-effort) =====
    try {
      await supabase.from('core_audit_log').insert({
        tenant_id: tenantId,
        actor_user_id: user.id,
        action: 'shipment.reissue_label',
        entity_type: 'shipment',
        entity_id: newDraft.id,
        metadata: {
          old_shipment_id: oldShip.id,
          old_numero: oldShip.numero,
          old_tracking: oldShip.tracking_code,
          new_numero: newDraft.numero,
          new_tracking: newTracking,
          reason,
        },
      });
    } catch (e: any) {
      console.warn('[shipping-reissue-label] audit log warn:', e?.message);
    }

    // ===== Pratika: NÃO reenviar =====
    // A Pratika bloqueia troca de rastreio quando a NF já teve "saída real"
    // registrada ("Nota com saida real gerada, e não pode ser alterada").
    // Fluxo definido com o usuário: ele imprime a nova etiqueta e envia
    // manualmente para a logística/Pratika. Retornamos marcador informativo.
    const pratikaResult = {
      skipped: true,
      reason: 'manual_handoff',
      message: 'Nova etiqueta deve ser impressa e enviada manualmente para a logística (Pratika não aceita troca de rastreio após saída real da NF).',
    };


    // ===== Reenvio marketplace (ML) — defensivo =====
    let marketplaceResult: any = { skipped: true };
    if (oldShip.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('marketplace_source, marketplace_order_id')
        .eq('id', oldShip.order_id)
        .maybeSingle();
      const mkt = String(order?.marketplace_source || '').toLowerCase();
      if (mkt === 'mercado_livre' || mkt === 'meli') {
        try {
          await supabase.from('meli_invoice_send_queue').insert({
            tenant_id: tenantId,
            order_id: oldShip.order_id,
            invoice_id: oldShip.invoice_id,
            status: 'pending',
            attempts: 0,
            next_attempt_at: new Date().toISOString(),
          });
          marketplaceResult = { queued: 'meli' };
        } catch (e: any) {
          console.warn('[shipping-reissue-label] meli queue warn:', e?.message);
          marketplaceResult = { success: false, error: e?.message };
        }
      }
    }

    return json({
      success: true,
      old_shipment_id: oldShip.id,
      old_numero: oldShip.numero,
      old_tracking: oldShip.tracking_code,
      new_shipment_id: newDraft.id,
      new_numero: newDraft.numero,
      new_tracking: newTracking,
      label_url: dispatchJson.label_url || null,
      pratika: pratikaResult,
      marketplace: marketplaceResult,
    });

  } catch (error: any) {
    console.error('[shipping-reissue-label] Fatal:', error);
    return errorResponse(error, corsHeaders, { module: 'shipping', action: 'reissue' });
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
