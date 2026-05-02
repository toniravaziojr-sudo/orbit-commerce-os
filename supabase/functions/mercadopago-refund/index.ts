// ============================================
// MERCADO PAGO REFUND - Adapter de estorno (full/partial)
// API: POST https://api.mercadopago.com/v1/payments/{payment_id}/refunds
// Aceita: (a) chamada interna do router payment-refund (header x-internal-call)
//         (b) chamada autenticada por owner/admin do tenant
// Credenciais via payment_providers (provider='mercado_pago').
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-call, x-actor-user-id, x-actor-tenant-id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MP_API_BASE = 'https://api.mercadopago.com';

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

async function getMpAccessToken(supabase: any, tenantId: string): Promise<string> {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'mercado_pago')
    .single();

  if (provider?.is_enabled && provider?.credentials?.access_token) {
    return provider.credentials.access_token as string;
  }
  throw new Error('Mercado Pago não configurado para este tenant');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: RefundRequest = await req.json().catch(() => ({}));

    // ===== Authorization gate =====
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
      .eq('provider', 'mercadopago');

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
      return jsonResponse({ success: false, error: 'Transação Mercado Pago não encontrada', code: 'TX_NOT_FOUND' });
    }
    const tx = Array.isArray(txList) ? txList[0] : txList;

    if (effectiveTenantId && tx.tenant_id !== effectiveTenantId) {
      return jsonResponse({ success: false, error: 'Acesso negado', code: 'TENANT_MISMATCH' });
    }
    if (tx.status === 'refunded') {
      return jsonResponse({ success: false, error: 'Transação já totalmente estornada', code: 'ALREADY_REFUNDED' });
    }

    const mpPaymentId = tx.provider_transaction_id || tx.payment_data?.payment_id || tx.payment_data?.id;
    if (!mpPaymentId) {
      return jsonResponse({
        success: false,
        error: 'ID do pagamento no Mercado Pago não localizado.',
        code: 'NO_GATEWAY_ID',
      });
    }

    const alreadyRefunded = Number(tx.refunded_amount || 0);
    const refundAmount = Number(payload.amount ?? (Number(tx.amount) - alreadyRefunded));
    if (refundAmount <= 0 || (alreadyRefunded + refundAmount) > Number(tx.amount)) {
      return jsonResponse({ success: false, error: 'Valor de estorno inválido', code: 'INVALID_AMOUNT' });
    }

    const accessToken = await getMpAccessToken(supabase, tx.tenant_id);

    // MP usa valor em REAIS (decimal), não centavos.
    const refundAmountReais = Math.round(refundAmount) / 100;
    const isFull = (alreadyRefunded + refundAmount) >= Number(tx.amount);

    console.log(`[${requestId}] MP refund: payment=${mpPaymentId} amount=${refundAmountReais} full=${isFull}`);

    // Idempotency-Key recomendada pela MP
    const idempotencyKey = `refund_${tx.id}_${Date.now()}`;

    const resp = await fetch(`${MP_API_BASE}/v1/payments/${mpPaymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      // Body vazio = estorno total. Com amount = parcial.
      body: isFull ? '{}' : JSON.stringify({ amount: refundAmountReais }),
    });

    const respBody = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`[${requestId}] MP API error:`, resp.status, respBody);
      const errMsg = respBody?.message || respBody?.error || 'Erro ao processar estorno no Mercado Pago';
      return jsonResponse({ success: false, error: errMsg, code: 'GATEWAY_ERROR' });
    }

    // ===== Atualizar payment_transactions =====
    const newRefundedTotal = alreadyRefunded + refundAmount;
    const newStatus = isFull ? 'refunded' : 'partially_refunded';

    await supabase
      .from('payment_transactions')
      .update({
        status: newStatus,
        refunded_amount: newRefundedTotal,
        payment_data: {
          ...(tx.payment_data || {}),
          last_refund: {
            id: respBody?.id,
            amount: refundAmount,
            at: new Date().toISOString(),
            reason: payload.reason || null,
            idempotency_key: idempotencyKey,
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

      if (!isInternal) {
        await supabase.from('order_history').insert({
          order_id: tx.order_id,
          action: 'refund',
          description: isFull
            ? 'Estorno total processado via Mercado Pago'
            : `Estorno parcial de R$ ${(refundAmount / 100).toFixed(2)} via Mercado Pago`,
        });
      }
    }

    console.log(`[${requestId}] MP refund OK (${newStatus})`);
    return jsonResponse({
      success: true,
      provider: 'mercadopago',
      transaction_id: tx.id,
      status: newStatus,
      refund_amount: refundAmount,
      refunded_total: newRefundedTotal,
      gateway_refund_id: respBody?.id || null,
    });
  } catch (error: any) {
    console.error(`[${requestId}] mercadopago-refund error:`, error);
    return jsonResponse({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
});
