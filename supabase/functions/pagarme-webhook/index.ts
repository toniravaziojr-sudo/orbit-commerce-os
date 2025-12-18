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

  try {
    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Extract event type and data
    const eventType = payload.type;
    const orderId = payload.data?.id;
    const charge = payload.data?.charges?.[0];

    if (!orderId) {
      console.log('No order ID in webhook payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing webhook:', { eventType, orderId, chargeStatus: charge?.status });

    // Find existing transaction by provider_transaction_id
    const { data: existingTransaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('provider_transaction_id', orderId)
      .single();

    if (!existingTransaction) {
      console.log('Transaction not found for order:', orderId);
      return new Response(JSON.stringify({ received: true, message: 'Transaction not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Pagar.me status to our status
    let newStatus = existingTransaction.status;
    let paidAt = null;

    switch (charge?.status) {
      case 'paid':
        newStatus = 'paid';
        paidAt = new Date().toISOString();
        break;
      case 'pending':
      case 'processing':
        newStatus = 'pending';
        break;
      case 'failed':
      case 'canceled':
        newStatus = 'failed';
        break;
      case 'refunded':
        newStatus = 'refunded';
        break;
      case 'chargedback':
        newStatus = 'chargedback';
        break;
    }

    // Update transaction
    const updateData: any = {
      status: newStatus,
      webhook_payload: payload,
    };

    if (paidAt) {
      updateData.paid_at = paidAt;
      updateData.paid_amount = charge?.amount || existingTransaction.amount;
    }

    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('id', existingTransaction.id);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
    }

    // If payment is confirmed, update order status
    if (newStatus === 'paid' && existingTransaction.checkout_id) {
      // Get checkout to find/create order
      const { data: checkout } = await supabase
        .from('checkouts')
        .select('*')
        .eq('id', existingTransaction.checkout_id)
        .single();

      if (checkout) {
        // Update checkout status
        await supabase
          .from('checkouts')
          .update({ 
            status: 'paid',
            completed_at: new Date().toISOString(),
          })
          .eq('id', checkout.id);

        // If there's an associated order, update its payment status
        if (existingTransaction.order_id) {
          await supabase
            .from('orders')
            .update({ 
              payment_status: 'approved',
              paid_at: new Date().toISOString(),
            })
            .eq('id', existingTransaction.order_id);
        }
      }
    }

    console.log('Webhook processed successfully:', { transactionId: existingTransaction.id, newStatus });

    return new Response(JSON.stringify({ 
      received: true,
      transaction_id: existingTransaction.id,
      status: newStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
