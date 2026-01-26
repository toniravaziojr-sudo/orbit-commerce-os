// ============================================
// PAGBANK REFUND - Cancel/refund payment
// Supports full and partial refunds
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const PAGBANK_API_URL_SANDBOX = 'https://sandbox.api.pagseguro.com';
const PAGBANK_API_URL_PRODUCTION = 'https://api.pagseguro.com';

interface RefundRequest {
  tenant_id: string;
  transaction_id?: string;  // Internal transaction ID
  order_id?: string;        // PagBank order ID
  charge_id?: string;       // PagBank charge ID
  amount?: number;          // Amount in cents (for partial refund)
  reason?: string;
}

// Get PagBank credentials from database
async function getPagbankCredentials(supabase: any, tenantId: string): Promise<{
  token: string;
  environment: 'sandbox' | 'production';
}> {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, environment, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pagbank')
    .single();

  if (provider?.is_enabled && provider?.credentials?.token) {
    return {
      token: provider.credentials.token,
      environment: provider.environment || 'sandbox',
    };
  }

  throw new Error('PagBank não configurado');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const payload: RefundRequest = await req.json();
    console.log(`[${requestId}] PagBank refund request:`, payload);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Find transaction
    let transaction: any = null;
    
    if (payload.transaction_id) {
      const { data } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', payload.transaction_id)
        .eq('provider', 'pagbank')
        .single();
      transaction = data;
    } else if (payload.order_id) {
      const { data } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('provider_transaction_id', payload.order_id)
        .eq('provider', 'pagbank')
        .single();
      transaction = data;
    }

    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    // Get credentials
    const credentials = await getPagbankCredentials(supabase, transaction.tenant_id);
    const apiUrl = credentials.environment === 'production' 
      ? PAGBANK_API_URL_PRODUCTION 
      : PAGBANK_API_URL_SANDBOX;

    // Get charge ID from transaction payment_data or use provided one
    const chargeId = payload.charge_id || transaction.payment_data?.charge_id;
    const pagbankOrderId = transaction.provider_transaction_id;

    if (!chargeId) {
      throw new Error('Charge ID não encontrado. Estorno não disponível para este pagamento.');
    }

    // Determine refund amount
    const refundAmount = payload.amount || transaction.amount;

    console.log(`[${requestId}] Processing refund: charge=${chargeId}, amount=${refundAmount}`);

    // Call PagBank refund API
    // POST /charges/{charge_id}/cancel
    const response = await fetch(`${apiUrl}/charges/${chargeId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': `refund_${chargeId}_${Date.now()}`,
      },
      body: JSON.stringify({
        amount: {
          value: refundAmount,
        },
      }),
    });

    const pagbankResponse = await response.json();
    console.log(`[${requestId}] PagBank refund response:`, response.status);

    if (!response.ok) {
      console.error(`[${requestId}] PagBank refund error:`, pagbankResponse);
      const errorMsg = pagbankResponse.error_messages?.[0]?.description 
        || pagbankResponse.message 
        || 'Erro ao processar estorno';
      throw new Error(errorMsg);
    }

    // Update transaction status
    const isFullRefund = refundAmount >= transaction.amount;
    const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    await supabase
      .from('payment_transactions')
      .update({
        status: newStatus,
        payment_data: {
          ...transaction.payment_data,
          refund_id: pagbankResponse.id,
          refund_amount: refundAmount,
          refund_at: new Date().toISOString(),
          refund_reason: payload.reason,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Update order if linked
    if (transaction.order_id) {
      await supabase
        .from('orders')
        .update({
          payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.order_id);

      // Add to order history
      await supabase
        .from('order_history')
        .insert({
          order_id: transaction.order_id,
          action: 'refund',
          description: isFullRefund 
            ? 'Estorno total processado via PagBank'
            : `Estorno parcial de R$ ${(refundAmount / 100).toFixed(2)} processado via PagBank`,
        });
    }

    console.log(`[${requestId}] Refund processed successfully: ${newStatus}`);

    return new Response(JSON.stringify({
      success: true,
      refund_id: pagbankResponse.id,
      status: newStatus,
      refund_amount: refundAmount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${requestId}] Refund error:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro ao processar estorno'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
