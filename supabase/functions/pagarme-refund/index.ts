// ============================================
// PAGAR.ME REFUND - Adapter de estorno (full/partial)
// API v5: POST /core/v5/charges/{charge_id}/operations/refund
// Aceita: (a) chamada interna do router payment-refund (header x-internal-call)
//         (b) chamada autenticada por owner/admin do tenant
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-call, x-actor-user-id, x-actor-tenant-id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ENV_PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');

const PAGARME_API_BASE = 'https://api.pagar.me/core/v5';

interface RefundRequest {
  tenant_id?: string;
  transaction_id?: string;
  order_id?: string;
  amount?: number; // centavos
  reason?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getPagarmeApiKey(supabase: any, tenantId: string): Promise<string> {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pagarme')
    .single();

  if (provider?.is_enabled && provider?.credentials?.api_key) {
    return provider.credentials.api_key as string;
  }
  if (ENV_PAGARME_API_KEY) {
    return ENV_PAGARME_API_KEY;
  }
  throw new Error('Pagar.me não configurado para este tenant');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: RefundRequest = await req.json().catch(() => ({}));

    // ===== Authorization gate (defense-in-depth) =====
    const isInternal = req.headers.get('x-internal-call') === 'payment-refund';
    let effectiveTenantId = payload.tenant_id;

    if (!isInternal) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ success: false, error: 'Não autenticado', code: 'UNAUTHENTICATED' });
      }
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData } = await supabaseAuth.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (!userId) {
        return jsonResponse({ success: false, error: 'Sessão inválida', code: 'INVALID_SESSION' });
      }
      if (!effectiveTenantId) {
        const { data: profile } = await supabase
          .from('profiles').select('current_tenant_id').eq('id', userId).single();
        effectiveTenantId = profile?.current_tenant_id;
      }
      if (!effectiveTenantId) {
        return jsonResponse({ success: false, error: 'Tenant não encontrado', code: 'NO_TENANT' });
      }
      const { data: roleRow } = await supabase
        .from('user_roles').select('role')
        .eq('user_id', userId).eq('tenant_id', effectiveTenantId).single();
      if (!roleRow || !['owner', 'admin'].includes(roleRow.role)) {
        return jsonResponse({
          success: false,
          error: 'Apenas owner/admin podem estornar pagamentos',
          code: 'FORBIDDEN',
        });
      }
    }

    // ===== Localizar transação =====
    let txQuery = supabase
      .from('payment_transactions')
      .select('id, tenant_id, order_id, provider, provider_transaction_id, amount, status, payment_data, refunded_amount')
      .eq('provider', 'pagarme');

    if (payload.transaction_id) {
      txQuery = txQuery.eq('id', payload.transaction_id);
    } else if (payload.order_id) {
      txQuery = txQuery.eq('order_id', payload.order_id)
        .in('status', ['approved', 'paid', 'partially_refunded'])
        .order('created_at', { ascending: false }).limit(1);
    } else {
      return jsonResponse({ success: false, error: 'Informe transaction_id ou order_id', code: 'INVALID_INPUT' });
    }

    const { data: txList, error: txErr } = await txQuery;
    if (txErr || !txList || (Array.isArray(txList) && txList.length === 0)) {
      return jsonResponse({ success: false, error: 'Transação Pagar.me não encontrada', code: 'TX_NOT_FOUND' });
    }
    const tx = Array.isArray(txList) ? txList[0] : txList;

    if (effectiveTenantId && tx.tenant_id !== effectiveTenantId) {
      return jsonResponse({ success: false, error: 'Acesso negado', code: 'TENANT_MISMATCH' });
    }
    if (tx.status === 'refunded') {
      return jsonResponse({ success: false, error: 'Transação já totalmente estornada', code: 'ALREADY_REFUNDED' });
    }

    const alreadyRefunded = Number(tx.refunded_amount || 0);
    const refundAmount = Number(payload.amount ?? (Number(tx.amount) - alreadyRefunded));
    if (refundAmount <= 0 || (alreadyRefunded + refundAmount) > Number(tx.amount)) {
      return jsonResponse({ success: false, error: 'Valor de estorno inválido', code: 'INVALID_AMOUNT' });
    }

    // Pagar.me v5 trabalha com charges. ID pode vir em provider_transaction_id (order_id) ou em payment_data.charge_id
    const chargeId: string | undefined =
      tx.payment_data?.charge_id || tx.payment_data?.last_transaction?.id || tx.payment_data?.charges?.[0]?.id;

    if (!chargeId) {
      return jsonResponse({
        success: false,
        error: 'charge_id da Pagar.me não localizado. Estorno indisponível para essa transação.',
        code: 'NO_CHARGE_ID',
      });
    }

    const apiKey = await getPagarmeApiKey(supabase, tx.tenant_id);
    const basicAuth = btoa(`${apiKey}:`);

    console.log(`[${requestId}] Pagar.me refund: charge=${chargeId} amount=${refundAmount}`);

    const resp = await fetch(`${PAGARME_API_BASE}/charges/${chargeId}/operations/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: refundAmount }),
    });

    const respBody = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`[${requestId}] Pagar.me API error:`, resp.status, respBody);
      const errMsg =
        respBody?.message ||
        respBody?.errors?.[0]?.message ||
        respBody?.errors?.[Object.keys(respBody?.errors || {})[0]]?.[0] ||
        'Erro ao processar estorno na Pagar.me';
      return jsonResponse({ success: false, error: errMsg, code: 'GATEWAY_ERROR' });
    }

    // ===== Atualizar payment_transactions =====
    const newRefundedTotal = alreadyRefunded + refundAmount;
    const isFull = newRefundedTotal >= Number(tx.amount);
    const newStatus = isFull ? 'refunded' : 'partially_refunded';

    await supabase
      .from('payment_transactions')
      .update({
        status: newStatus,
        refunded_amount: newRefundedTotal,
        payment_data: {
          ...(tx.payment_data || {}),
          last_refund: {
            id: respBody?.id || respBody?.last_transaction?.id,
            amount: refundAmount,
            at: new Date().toISOString(),
            reason: payload.reason || null,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id);

    // ===== Atualizar pedido =====
    if (tx.order_id) {
      await supabase
        .from('orders')
        .update({
          payment_status: isFull ? 'refunded' : 'partially_refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.order_id);

      // Histórico só quando NÃO veio do router (router já faz com prefixo OVERRIDE ADMIN)
      if (!isInternal) {
        await supabase.from('order_history').insert({
          order_id: tx.order_id,
          action: 'refund',
          description: isFull
            ? 'Estorno total processado via Pagar.me'
            : `Estorno parcial de R$ ${(refundAmount / 100).toFixed(2)} via Pagar.me`,
        });
      }
    }

    console.log(`[${requestId}] Pagar.me refund OK (${newStatus})`);
    return jsonResponse({
      success: true,
      provider: 'pagarme',
      transaction_id: tx.id,
      status: newStatus,
      refund_amount: refundAmount,
      refunded_total: newRefundedTotal,
      gateway_refund_id: respBody?.id || null,
    });
  } catch (error: any) {
    console.error(`[${requestId}] pagarme-refund error:`, error);
    return jsonResponse({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
});
