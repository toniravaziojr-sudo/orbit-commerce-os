import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const payload = await req.json();
    console.log(`[${requestId}] Webhook received:`, JSON.stringify(payload, null, 2));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Extract event data
    const eventType = payload.type;
    const pagarmeOrderId = payload.data?.id;
    const charge = payload.data?.charges?.[0];
    const chargeId = charge?.id;
    const chargeStatus = charge?.status;

    console.log(`[${requestId}] Event: ${eventType}, Order: ${pagarmeOrderId}, Charge: ${chargeId}, Status: ${chargeStatus}`);

    if (!pagarmeOrderId) {
      console.log(`[${requestId}] No order ID in webhook payload, ignoring`);
      return new Response(JSON.stringify({ received: true, message: 'No order ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==== IDEMPOTENCY CHECK ====
    // Find existing transaction by provider_transaction_id (Pagar.me order ID)
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

    // Check if already processed with same status (idempotency)
    const webhookHistory = existingTransaction.webhook_payload as any;
    if (webhookHistory?.charges?.[0]?.status === chargeStatus) {
      console.log(`[${requestId}] Already processed with status ${chargeStatus}, skipping`);
      return new Response(JSON.stringify({ 
        received: true, 
        message: 'Already processed',
        transaction_id: existingTransaction.id,
        status: existingTransaction.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        newOrderStatus = 'confirmed';
        paidAt = new Date().toISOString();
        paidAmount = charge?.paid_amount || charge?.amount || existingTransaction.amount;
        break;
      case 'pending':
      case 'processing':
        newTransactionStatus = 'pending';
        newPaymentStatus = 'processing';
        break;
      case 'failed':
      case 'canceled':
        newTransactionStatus = 'failed';
        newPaymentStatus = 'declined';
        newOrderStatus = 'cancelled';
        break;
      case 'overpaid':
        newTransactionStatus = 'paid';
        newPaymentStatus = 'approved';
        newOrderStatus = 'confirmed';
        paidAt = new Date().toISOString();
        paidAmount = charge?.paid_amount || charge?.amount;
        break;
      case 'underpaid':
        newTransactionStatus = 'pending';
        newPaymentStatus = 'processing';
        break;
      case 'refunded':
        newTransactionStatus = 'refunded';
        newPaymentStatus = 'approved'; // Payment was approved, just refunded
        break;
      case 'chargedback':
        newTransactionStatus = 'chargedback';
        newPaymentStatus = 'declined';
        newOrderStatus = 'cancelled';
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

      const { error: updateOrderError } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', existingTransaction.order_id);

      if (updateOrderError) {
        console.error(`[${requestId}] Error updating order:`, updateOrderError);
        // Don't throw - transaction was updated, order update is secondary
      } else {
        console.log(`[${requestId}] Order ${existingTransaction.order_id} updated: payment=${newPaymentStatus}, status=${newOrderStatus}`);
      }
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
      error: error.message || 'Unknown error',
      request_id: requestId,
      duration_ms: duration,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
