// ============================================
// PAGAR.ME WEBHOOK - Payment status sync
// With proper idempotency via payment_events table
// v2.1 - PCI log redaction + tenant-aware HMAC verification (log mode)
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redactPayloadForLog } from "../_shared/redact-pii.ts";
import { verifyPagarmeHmac, handleHmacResult } from "../_shared/webhook-hmac.ts";
import { errorResponse } from "../_shared/error-response.ts";
// fiscal-trigger import removed: draft creation now handled exclusively by queue+cron

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Read raw body for HMAC verification (keep for later tenant-aware verification)
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // NOTE: HMAC verification is deferred to AFTER tenant resolution (tenant-aware)

    // === PCI-SAFE LOGGING ===
    console.log(`[${requestId}] Webhook received:`, JSON.stringify(redactPayloadForLog(payload), null, 2));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Extract event data
    const eventType = payload.type || 'unknown';
    const eventId = payload.id || `${Date.now()}-${requestId}`;
    const pagarmeOrderId = payload.data?.id;
    const charge = payload.data?.charges?.[0];
    const chargeId = charge?.id;
    const chargeStatus = charge?.status || payload.data?.status;

    console.log(`[${requestId}] Event: ${eventType}, EventId: ${eventId}, Order: ${pagarmeOrderId}, Charge: ${chargeId}, ChargeStatus: ${chargeStatus}`);

    if (!pagarmeOrderId) {
      console.log(`[${requestId}] No order ID in webhook payload, ignoring`);
      return new Response(JSON.stringify({ received: true, message: 'No order ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==== IDEMPOTENCY CHECK via payment_events table ====
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, processed_at')
      .eq('provider', 'pagarme')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[${requestId}] Event ${eventId} already processed, skipping`);
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Event already processed',
        event_id: eventId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the transaction by provider_transaction_id
    const { data: existingTransaction, error: findError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('provider_transaction_id', pagarmeOrderId)
      .maybeSingle();

    if (findError) {
      console.error(`[${requestId}] Error finding transaction:`, findError);
      throw findError;
    }

    if (!existingTransaction) {
      console.log(`[${requestId}] Transaction not found for Pagar.me order: ${pagarmeOrderId}`);
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Transaction not found',
        pagarme_order_id: pagarmeOrderId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === TENANT-AWARE HMAC VERIFICATION (log mode) ===
    // Fetch tenant's webhook_secret from payment_providers.credentials
    const { data: providerConfig } = await supabase
      .from('payment_providers')
      .select('credentials')
      .eq('tenant_id', existingTransaction.tenant_id)
      .eq('provider', 'pagarme')
      .maybeSingle();

    const tenantWebhookSecret = (providerConfig?.credentials as any)?.webhook_secret;
    const hmacResult = await verifyPagarmeHmac(req, rawBody, tenantWebhookSecret, existingTransaction.tenant_id);
    const hmacBlock = handleHmacResult(hmacResult, requestId);
    if (hmacBlock) return hmacBlock; // Future enforcement

    // ==== RECORD EVENT for idempotency ====
    const { error: insertEventError } = await supabase
      .from('payment_events')
      .insert({
        tenant_id: existingTransaction.tenant_id,
        provider: 'pagarme',
        event_id: eventId,
        provider_payment_id: pagarmeOrderId,
        event_type: eventType,
        payload: payload,
        received_at: new Date().toISOString(),
      });

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        console.log(`[${requestId}] Concurrent event processing, skipping`);
        return new Response(JSON.stringify({ received: true, message: 'Concurrent processing' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.warn(`[${requestId}] Failed to record event:`, insertEventError);
    }

    // ==== MAP STATUS ====
    let newTransactionStatus = existingTransaction.status;
    let newPaymentStatus: string | null = null;
    let newOrderStatus: string | null = null;
    let paidAt: string | null = null;
    let paidAmount: number | null = null;

    switch (chargeStatus) {
      case 'paid':
        newTransactionStatus = 'paid';
        newPaymentStatus = 'approved';
        newOrderStatus = 'ready_to_invoice';
        paidAt = new Date().toISOString();
        paidAmount = charge?.paid_amount || charge?.amount || existingTransaction.amount;
        break;
      case 'pending':
      case 'processing':
        newTransactionStatus = 'pending';
        newPaymentStatus = 'pending';
        break;
      case 'failed':
        newTransactionStatus = 'failed';
        newPaymentStatus = 'declined';
        newOrderStatus = 'payment_expired';
        break;
      case 'canceled':
        newTransactionStatus = 'canceled';
        newPaymentStatus = 'declined';
        newOrderStatus = 'payment_expired';
        break;
      case 'overpaid':
        newTransactionStatus = 'paid';
        newPaymentStatus = 'approved';
        newOrderStatus = 'ready_to_invoice';
        paidAt = new Date().toISOString();
        paidAmount = charge?.paid_amount || charge?.amount;
        break;
      case 'underpaid':
        newTransactionStatus = 'pending';
        newPaymentStatus = 'pending';
        break;
      case 'refunded':
        newTransactionStatus = 'refunded';
        newPaymentStatus = 'refunded';
        break;
      case 'chargedback':
        newTransactionStatus = 'chargedback';
        newPaymentStatus = 'chargedback';
        newOrderStatus = 'payment_expired';
        break;
      case 'expired':
        newTransactionStatus = 'expired';
        newPaymentStatus = 'expired';
        break;
      default:
        console.log(`[${requestId}] Unknown charge status: ${chargeStatus}`);
    }

    console.log(`[${requestId}] Status mapping: transaction=${newTransactionStatus}, payment=${newPaymentStatus}, order=${newOrderStatus}`);

    // ==== UPDATE TRANSACTION ====
    const transactionUpdate: Record<string, any> = {
      status: newTransactionStatus,
      webhook_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (paidAt) {
      transactionUpdate.paid_at = paidAt;
      transactionUpdate.paid_amount = paidAmount;
    }

    const { error: updateTransactionError } = await supabase
      .from('payment_transactions')
      .update(transactionUpdate)
      .eq('id', existingTransaction.id);

    if (updateTransactionError) {
      console.error(`[${requestId}] Error updating transaction:`, updateTransactionError);
      throw updateTransactionError;
    }

    console.log(`[${requestId}] Transaction ${existingTransaction.id} updated to status: ${newTransactionStatus}`);

    // ==== UPDATE ORDER (if exists) ====
    if (existingTransaction.order_id) {
      const orderUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (newPaymentStatus) {
        orderUpdate.payment_status = newPaymentStatus;
      }

      if (newOrderStatus) {
        orderUpdate.status = newOrderStatus;
      }

      if (paidAt) {
        orderUpdate.paid_at = paidAt;
      }

      orderUpdate.payment_gateway = 'pagarme';
      orderUpdate.payment_gateway_id = String(pagarmeOrderId);

      // Sync payment_method from transaction to order
      if (existingTransaction.method) {
        orderUpdate.payment_method = existingTransaction.method;
      }

      const { error: updateOrderError } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', existingTransaction.order_id);

      if (updateOrderError) {
        console.error(`[${requestId}] Error updating order:`, updateOrderError);
      } else {
        console.log(`[${requestId}] Order ${existingTransaction.order_id} updated: payment=${newPaymentStatus}, status=${newOrderStatus}, gateway_id=${pagarmeOrderId}`);
      }

      // Fiscal draft creation is handled exclusively by the queue+cron pipeline
      // (SQL trigger enqueue_fiscal_draft → fiscal_draft_queue → scheduler-tick)
    }

    // ==== UPDATE CHECKOUT (if exists) ====
    if (existingTransaction.checkout_id && newTransactionStatus === 'paid') {
      const { error: updateCheckoutError } = await supabase
        .from('checkouts')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingTransaction.checkout_id);

      if (updateCheckoutError) {
        console.error(`[${requestId}] Error updating checkout:`, updateCheckoutError);
      } else {
        console.log(`[${requestId}] Checkout ${existingTransaction.checkout_id} marked as completed`);
      }
    }

    // ==== RECORD ORDER HISTORY ====
    if (existingTransaction.order_id && (newPaymentStatus || newOrderStatus)) {
      const historyEntries: Array<{order_id: string; action: string; previous_value: Record<string,unknown>; new_value: Record<string,unknown>; description: string}> = [];
      
      if (newPaymentStatus && newPaymentStatus !== existingTransaction.status) {
        historyEntries.push({
          order_id: existingTransaction.order_id,
          action: 'payment_status_changed',
          previous_value: { payment_status: existingTransaction.status },
          new_value: { payment_status: newPaymentStatus },
          description: `Pagamento: ${existingTransaction.status} → ${newPaymentStatus} (webhook Pagar.me)`,
        });
      }
      
      if (newOrderStatus) {
        historyEntries.push({
          order_id: existingTransaction.order_id,
          action: 'status_changed',
          previous_value: {},
          new_value: { status: newOrderStatus },
          description: `Status: → ${newOrderStatus} (webhook Pagar.me)`,
        });
      }
      
      if (historyEntries.length > 0) {
        const { error: historyError } = await supabase
          .from('order_history')
          .insert(historyEntries);
        
        if (historyError) {
          console.warn(`[${requestId}] Error recording order history:`, historyError);
        } else {
          console.log(`[${requestId}] Recorded ${historyEntries.length} order history entries`);
        }
      }
    }

    // ==== MARK EVENT AS PROCESSED ====
    await supabase
      .from('payment_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_result: 'success',
      })
      .eq('provider', 'pagarme')
      .eq('event_id', eventId);

    // ==== EMIT CANONICAL EVENT for notifications ====
    if (existingTransaction.order_id && newPaymentStatus) {
      const idempotencyKey = `payment_status_${existingTransaction.order_id}_${existingTransaction.status}_${newTransactionStatus}_${eventId}`;
      
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email, customer_phone, total')
        .eq('id', existingTransaction.order_id)
        .single();

      const { error: emitError } = await supabase
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
            payment_method: existingTransaction.payment_method || charge?.payment_method || 'unknown',
            payment_gateway: 'pagarme',
            pix_link: charge?.last_transaction?.qr_code_url || '',
            boleto_link: charge?.last_transaction?.pdf || '',
          },
          status: 'new',
        });

      if (emitError && !emitError.message?.includes('duplicate')) {
        console.error(`[${requestId}] Error emitting payment event:`, emitError);
      } else if (!emitError) {
        console.log(`[${requestId}] Emitted payment_status_changed event for order ${existingTransaction.order_id}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Webhook processed successfully in ${duration}ms`);

    return new Response(JSON.stringify({ 
      received: true,
      request_id: requestId,
      transaction_id: existingTransaction.id,
      order_id: existingTransaction.order_id,
      previous_status: existingTransaction.status,
      new_status: newTransactionStatus,
      payment_status: newPaymentStatus,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Webhook error after ${duration}ms:`, error);
    
    return new Response(JSON.stringify({ 
      error: "Erro interno",
      request_id: requestId,
      duration_ms: duration,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
