// ============================================
// PAGBANK WEBHOOK - Payment status sync
// Handles notifications from PagBank (PagSeguro)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature',
};

// PagBank status mapping to internal status
const STATUS_MAP: Record<string, string> = {
  'AUTHORIZED': 'pending',
  'PAID': 'paid',
  'IN_ANALYSIS': 'pending',
  'DECLINED': 'failed',
  'CANCELED': 'cancelled',
  'WAITING': 'pending',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const payload = await req.json();
    console.log(`[${requestId}] PagBank webhook received:`, JSON.stringify(payload, null, 2));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // PagBank webhook structure
    // { id, reference_id, charges: [{ id, status, ... }], qr_codes: [...] }
    const orderId = payload.id;
    const referenceId = payload.reference_id;
    const charges = payload.charges || [];
    const qrCodes = payload.qr_codes || [];

    if (!orderId) {
      console.log(`[${requestId}] No order ID in webhook payload, ignoring`);
      return new Response(JSON.stringify({ received: true, message: 'No order ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine the event type and new status
    let newStatus = 'pending';
    let chargeId = null;
    let paymentData: any = {};

    // Check charges (for boleto and credit card)
    if (charges.length > 0) {
      const charge = charges[0];
      chargeId = charge.id;
      newStatus = STATUS_MAP[charge.status] || 'pending';
      
      // Extract additional payment data
      if (charge.payment_method?.boleto) {
        paymentData.boleto_barcode = charge.payment_method.boleto.barcode;
        paymentData.boleto_due_date = charge.payment_method.boleto.due_date;
      }
      if (charge.payment_response) {
        paymentData.authorization_code = charge.payment_response.authorization_code;
        paymentData.nsu = charge.payment_response.nsu;
      }
    }

    // Check QR Codes (for PIX)
    if (qrCodes.length > 0) {
      const qrCode = qrCodes[0];
      // PIX status: ACTIVE, PAID, EXPIRED
      if (qrCode.status === 'PAID') {
        newStatus = 'paid';
      } else if (qrCode.status === 'EXPIRED') {
        newStatus = 'expired';
      }
      paymentData.pix_text = qrCode.text;
      paymentData.pix_status = qrCode.status;
    }

    // Create event ID for idempotency
    const eventId = `${orderId}_${chargeId || 'pix'}_${Date.now()}`;

    // Check for duplicate event
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, processed_at')
      .eq('provider', 'pagbank')
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
      .eq('provider_transaction_id', orderId)
      .maybeSingle();

    if (findError) {
      console.error(`[${requestId}] Error finding transaction:`, findError);
      throw findError;
    }

    if (!existingTransaction) {
      console.log(`[${requestId}] Transaction not found for PagBank order: ${orderId}`);
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Transaction not found',
        pagbank_order_id: orderId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oldStatus = existingTransaction.status;
    const tenantId = existingTransaction.tenant_id;
    const internalOrderId = existingTransaction.order_id;

    console.log(`[${requestId}] Processing: ${orderId}, old_status: ${oldStatus}, new_status: ${newStatus}`);

    // Skip if status hasn't changed
    if (oldStatus === newStatus) {
      console.log(`[${requestId}] Status unchanged (${oldStatus}), skipping`);
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Status unchanged',
        status: oldStatus,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({ 
        status: newStatus,
        payment_data: {
          ...existingTransaction.payment_data,
          ...paymentData,
          last_webhook_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTransaction.id);

    if (updateError) {
      console.error(`[${requestId}] Error updating transaction:`, updateError);
      throw updateError;
    }

    // Update order payment status if we have an order_id
    if (internalOrderId) {
      const orderPaymentStatus = newStatus === 'paid' ? 'paid' 
        : newStatus === 'failed' ? 'failed'
        : newStatus === 'cancelled' ? 'refunded'
        : 'pending';

      await supabase
        .from('orders')
        .update({ 
          payment_status: orderPaymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', internalOrderId);

      // Emit canonical event for notifications
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email, customer_phone, total')
        .eq('id', internalOrderId)
        .single();

      const idempotencyKey = `payment_status_${internalOrderId}_${orderId}_${newStatus}`;
      
      await supabase
        .from('events_inbox')
        .insert({
          tenant_id: tenantId,
          provider: 'pagbank',
          event_type: 'payment_status_changed',
          idempotency_key: idempotencyKey,
          occurred_at: new Date().toISOString(),
          payload_normalized: {
            order_id: internalOrderId,
            order_number: orderData?.order_number || '',
            customer_name: orderData?.customer_name || '',
            customer_email: orderData?.customer_email || '',
            customer_phone: orderData?.customer_phone || '',
            order_total: orderData?.total || 0,
            old_status: oldStatus,
            new_status: newStatus,
            payment_method: existingTransaction.method,
            payment_gateway: 'pagbank',
          },
          status: 'new',
        });

      console.log(`[${requestId}] Emitted payment_status_changed event for order ${internalOrderId}`);
    }

    // Record the event for idempotency
    await supabase
      .from('payment_events')
      .insert({
        tenant_id: tenantId,
        provider: 'pagbank',
        event_id: eventId,
        event_type: 'order.updated',
        payload: payload,
        processed_at: new Date().toISOString(),
      });

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Webhook processed in ${duration}ms: ${oldStatus} -> ${newStatus}`);

    return new Response(JSON.stringify({ 
      received: true, 
      event_id: eventId,
      old_status: oldStatus,
      new_status: newStatus,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${requestId}] Webhook error:`, error);
    return new Response(JSON.stringify({ 
      received: true, 
      error: error.message,
    }), {
      status: 200, // Return 200 to prevent retries for unprocessable webhooks
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
