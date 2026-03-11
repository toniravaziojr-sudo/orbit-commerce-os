// ============================================
// MERCADO PAGO STOREFRONT WEBHOOK - Payment status sync
// For tenant storefront payments (not billing)
// Mirrors pagarme-webhook architecture
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Mercado Pago sends webhooks as query params + JSON body
    const url = new URL(req.url);
    const queryType = url.searchParams.get('type') || url.searchParams.get('topic');
    const queryId = url.searchParams.get('data.id') || url.searchParams.get('id');

    const body = await req.json().catch(() => ({}));
    const eventType = body.type || body.action || queryType || 'unknown';
    const eventId = body.id || `${Date.now()}-${requestId}`;
    const paymentId = body.data?.id || queryId;

    console.log(`[${requestId}] MP Storefront Webhook: type=${eventType}, id=${eventId}, paymentId=${paymentId}`);

    if (!paymentId) {
      return new Response(JSON.stringify({ received: true, message: 'No payment ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only process payment events
    if (eventType !== 'payment' && !eventType.includes('payment')) {
      console.log(`[${requestId}] Ignoring non-payment event: ${eventType}`);
      return new Response(JSON.stringify({ received: true, message: 'Not a payment event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ==== IDEMPOTENCY CHECK ====
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, processed_at')
      .eq('provider', 'mercadopago')
      .eq('event_id', String(eventId))
      .maybeSingle();

    if (existingEvent) {
      console.log(`[${requestId}] Event ${eventId} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the transaction by provider_transaction_id
    const { data: existingTransaction, error: findError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('provider', 'mercadopago')
      .eq('provider_transaction_id', String(paymentId))
      .maybeSingle();

    if (findError) {
      console.error(`[${requestId}] Error finding transaction:`, findError);
      throw findError;
    }

    if (!existingTransaction) {
      console.log(`[${requestId}] Transaction not found for MP payment: ${paymentId}`);
      return new Response(JSON.stringify({ received: true, message: 'Transaction not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch payment details from MP API to get current status
    // We need the tenant's access_token
    const { data: provider } = await supabase
      .from('payment_providers')
      .select('credentials')
      .eq('tenant_id', existingTransaction.tenant_id)
      .eq('provider', 'mercado_pago')
      .single();

    if (!provider?.credentials?.access_token) {
      console.error(`[${requestId}] No MP credentials found for tenant ${existingTransaction.tenant_id}`);
      return new Response(JSON.stringify({ received: true, message: 'No credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${provider.credentials.access_token}` },
    });

    if (!mpResponse.ok) {
      console.error(`[${requestId}] Failed to fetch MP payment: ${mpResponse.status}`);
      throw new Error(`MP API error: ${mpResponse.status}`);
    }

    const payment = await mpResponse.json();
    console.log(`[${requestId}] MP Payment status: ${payment.status}, detail: ${payment.status_detail}`);

    // ==== RECORD EVENT ====
    const { error: insertEventError } = await supabase
      .from('payment_events')
      .insert({
        tenant_id: existingTransaction.tenant_id,
        provider: 'mercadopago',
        event_id: String(eventId),
        provider_payment_id: String(paymentId),
        event_type: eventType,
        payload: { webhook: body, payment_status: payment.status },
        received_at: new Date().toISOString(),
      });

    if (insertEventError?.code === '23505') {
      console.log(`[${requestId}] Concurrent event processing, skipping`);
      return new Response(JSON.stringify({ received: true, message: 'Concurrent processing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==== MAP STATUS ====
    let newTransactionStatus = existingTransaction.status;
    let newPaymentStatus: string | null = null;
    let newOrderStatus: string | null = null;
    let paidAt: string | null = null;

    switch (payment.status) {
      case 'approved':
        newTransactionStatus = 'paid';
        newPaymentStatus = 'approved';
        newOrderStatus = 'ready_to_invoice';
        paidAt = new Date().toISOString();
        break;
      case 'pending':
      case 'in_process':
      case 'authorized':
        newTransactionStatus = 'pending';
        newPaymentStatus = 'pending';
        break;
      case 'rejected':
        newTransactionStatus = 'failed';
        newPaymentStatus = 'declined';
        newOrderStatus = 'payment_expired';
        break;
      case 'cancelled':
        newTransactionStatus = 'canceled';
        newPaymentStatus = 'declined';
        newOrderStatus = 'payment_expired';
        break;
      case 'refunded':
        newTransactionStatus = 'refunded';
        newPaymentStatus = 'refunded';
        break;
      case 'charged_back':
        newTransactionStatus = 'chargedback';
        newPaymentStatus = 'chargedback';
        newOrderStatus = 'payment_expired';
        break;
      default:
        console.log(`[${requestId}] Unknown MP status: ${payment.status}`);
    }

    console.log(`[${requestId}] Status mapping: transaction=${newTransactionStatus}, payment=${newPaymentStatus}, order=${newOrderStatus}`);

    // ==== UPDATE TRANSACTION ====
    const transactionUpdate: Record<string, any> = {
      status: newTransactionStatus,
      webhook_payload: { webhook: body, payment },
      updated_at: new Date().toISOString(),
    };

    if (paidAt) {
      transactionUpdate.paid_at = paidAt;
      transactionUpdate.paid_amount = Math.round(payment.transaction_amount * 100);
    }

    await supabase
      .from('payment_transactions')
      .update(transactionUpdate)
      .eq('id', existingTransaction.id);

    // ==== UPDATE ORDER ====
    if (existingTransaction.order_id) {
      const orderUpdate: Record<string, any> = { updated_at: new Date().toISOString() };

      if (newPaymentStatus) orderUpdate.payment_status = newPaymentStatus;
      if (newOrderStatus) orderUpdate.status = newOrderStatus;
      if (paidAt) orderUpdate.paid_at = paidAt;

      if (Object.keys(orderUpdate).length > 1) {
        await supabase
          .from('orders')
          .update(orderUpdate)
          .eq('id', existingTransaction.order_id);

        console.log(`[${requestId}] Order ${existingTransaction.order_id} updated: payment=${newPaymentStatus}, status=${newOrderStatus}`);
      }
    }

    // ==== RECORD ORDER HISTORY ====
    if (existingTransaction.order_id && (newPaymentStatus || newOrderStatus)) {
      const historyEntries: any[] = [];

      if (newPaymentStatus && newPaymentStatus !== existingTransaction.status) {
        historyEntries.push({
          order_id: existingTransaction.order_id,
          action: 'payment_status_changed',
          previous_value: { payment_status: existingTransaction.status },
          new_value: { payment_status: newPaymentStatus },
          description: `Pagamento: ${existingTransaction.status} → ${newPaymentStatus} (webhook Mercado Pago)`,
        });
      }

      if (newOrderStatus) {
        historyEntries.push({
          order_id: existingTransaction.order_id,
          action: 'status_changed',
          previous_value: {},
          new_value: { status: newOrderStatus },
          description: `Status: → ${newOrderStatus} (webhook Mercado Pago)`,
        });
      }

      if (historyEntries.length > 0) {
        await supabase.from('order_history').insert(historyEntries);
      }
    }

    // ==== MARK EVENT AS PROCESSED ====
    await supabase
      .from('payment_events')
      .update({ processed_at: new Date().toISOString(), processing_result: 'success' })
      .eq('provider', 'mercadopago')
      .eq('event_id', String(eventId));

    // ==== EMIT CANONICAL EVENT ====
    if (existingTransaction.order_id && newPaymentStatus) {
      const idempotencyKey = `payment_status_${existingTransaction.order_id}_${existingTransaction.status}_${newTransactionStatus}_${eventId}`;

      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email, customer_phone, total')
        .eq('id', existingTransaction.order_id)
        .single();

      await supabase
        .from('events_inbox')
        .insert({
          tenant_id: existingTransaction.tenant_id,
          provider: 'internal',
          event_type: 'payment_status_changed',
          idempotency_key: idempotencyKey,
          occurred_at: new Date().toISOString(),
          payload_normalized: {
            order_id: existingTransaction.order_id,
            order_number: orderData?.order_number || '',
            customer_name: orderData?.customer_name || '',
            customer_email: orderData?.customer_email || '',
            customer_phone: orderData?.customer_phone || '',
            order_total: orderData?.total || 0,
            old_status: existingTransaction.status,
            new_status: newPaymentStatus,
            payment_method: existingTransaction.method || 'unknown',
            payment_gateway: 'mercadopago',
          },
          status: 'pending',
        })
        .then(({ error }) => {
          if (error && !error.message?.includes('duplicate')) {
            console.error(`[${requestId}] Error emitting event:`, error);
          }
        });
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Webhook processed in ${duration}ms`);

    return new Response(JSON.stringify({
      received: true,
      request_id: requestId,
      transaction_id: existingTransaction.id,
      new_status: newTransactionStatus,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Webhook error after ${duration}ms:`, error);

    return new Response(JSON.stringify({
      error: error.message || 'Unknown error',
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
