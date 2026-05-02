// ============================================
// PAYMENT REFUND - Router multi-gateway
// Identifica o gateway via payment_transactions e roteia
// para o adapter correspondente. Enforce role-check (owner/admin).
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface RefundRequest {
  order_id?: string;
  transaction_id?: string;
  amount?: number; // centavos; se ausente => total
  reason?: string;
}

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

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // ===== Autenticação =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Não autenticado', code: 'UNAUTHENTICATED' });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonResponse({ success: false, error: 'Sessão inválida', code: 'INVALID_SESSION' });
    }
    const userId = claimsData.claims.sub;

    // ===== Service-role client (bypass RLS para auditoria) =====
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Tenant atual via profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', userId)
      .single();
    const tenantId = profile?.current_tenant_id;
    if (!tenantId) {
      return jsonResponse({ success: false, error: 'Tenant não encontrado', code: 'NO_TENANT' });
    }

    // Role-check: APENAS owner/admin podem estornar
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();
    if (!roleRow || !['owner', 'admin'].includes(roleRow.role)) {
      return jsonResponse({
        success: false,
        error: 'Apenas owner/admin podem estornar pagamentos',
        code: 'FORBIDDEN',
      });
    }

    // ===== Payload =====
    const payload: RefundRequest = await req.json().catch(() => ({}));
    if (!payload.order_id && !payload.transaction_id) {
      return jsonResponse({
        success: false,
        error: 'Informe order_id ou transaction_id',
        code: 'INVALID_INPUT',
      });
    }

    // ===== Localizar transação aprovada =====
    let txQuery = supabase
      .from('payment_transactions')
      .select('id, tenant_id, order_id, provider, provider_transaction_id, amount, status, payment_data')
      .eq('tenant_id', tenantId);

    if (payload.transaction_id) {
      txQuery = txQuery.eq('id', payload.transaction_id);
    } else {
      // Pegar a transação aprovada mais recente do pedido
      txQuery = txQuery
        .eq('order_id', payload.order_id!)
        .in('status', ['approved', 'paid', 'partially_refunded'])
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: txList, error: txErr } = await txQuery;
    if (txErr || !txList || txList.length === 0) {
      return jsonResponse({
        success: false,
        error: 'Transação aprovada não encontrada para este pedido',
        code: 'TX_NOT_FOUND',
      });
    }
    const tx = Array.isArray(txList) ? txList[0] : txList;

    // Valida tenant da transação (defense-in-depth)
    if (tx.tenant_id !== tenantId) {
      return jsonResponse({ success: false, error: 'Acesso negado', code: 'TENANT_MISMATCH' });
    }

    if (tx.status === 'refunded') {
      return jsonResponse({
        success: false,
        error: 'Esta transação já foi totalmente estornada',
        code: 'ALREADY_REFUNDED',
      });
    }

    const refundAmount = payload.amount ?? tx.amount;
    if (refundAmount <= 0 || refundAmount > tx.amount) {
      return jsonResponse({
        success: false,
        error: 'Valor de estorno inválido',
        code: 'INVALID_AMOUNT',
      });
    }

    console.log(`[${requestId}] Refund routing: provider=${tx.provider} tx=${tx.id} amount=${refundAmount}`);

    // ===== Roteamento por gateway =====
    let adapterFn: string | null = null;
    switch (tx.provider) {
      case 'pagbank':
        adapterFn = 'pagbank-refund';
        break;
      case 'pagarme':
        adapterFn = 'pagarme-refund';
        break;
      case 'mercadopago':
        adapterFn = 'mercadopago-refund';
        break;
      default:
        return jsonResponse({
          success: false,
          error: `Gateway "${tx.provider}" não suporta estorno automatizado`,
          code: 'GATEWAY_UNSUPPORTED',
        });
    }

    // ===== Chamada interna ao adapter =====
    const adapterUrl = `${SUPABASE_URL}/functions/v1/${adapterFn}`;
    const adapterResp = await fetch(adapterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-internal-call': 'payment-refund',
        'x-actor-user-id': userId,
        'x-actor-tenant-id': tenantId,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        transaction_id: tx.id,
        amount: refundAmount,
        reason: payload.reason ?? null,
      }),
    });

    const adapterJson = await adapterResp.json().catch(() => ({}));

    if (!adapterResp.ok || adapterJson?.success === false) {
      console.error(`[${requestId}] Adapter error:`, adapterJson);
      return jsonResponse({
        success: false,
        error: adapterJson?.error || 'Falha no estorno via gateway',
        code: 'ADAPTER_ERROR',
      });
    }

    // ===== Auditoria adicional no order_history (prefixo OVERRIDE ADMIN) =====
    if (tx.order_id) {
      const isFull = refundAmount >= tx.amount;
      await supabase.from('order_history').insert({
        order_id: tx.order_id,
        action: 'payment_refund',
        description: `[OVERRIDE ADMIN] ${isFull ? 'Estorno total' : `Estorno parcial de R$ ${(refundAmount / 100).toFixed(2)}`} via ${tx.provider}${payload.reason ? ` — Motivo: ${payload.reason}` : ''}`,
      });
    }

    console.log(`[${requestId}] Refund OK via ${tx.provider}`);

    return jsonResponse({
      success: true,
      provider: tx.provider,
      transaction_id: tx.id,
      refund_amount: refundAmount,
      ...adapterJson,
    });
  } catch (error: any) {
    console.error(`[${requestId}] payment-refund error:`, error);
    return jsonResponse({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
});
