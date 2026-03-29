// ============================================
// EXPIRE STALE ORDERS - Auto-expire old pending PIX/Boleto orders
// Runs via cron every 15 minutes
// Also cleans up declined orders left with status=pending
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    console.log('[expire-stale-orders] Running at:', now.toISOString());

    // PIX: expire after 1 hour (standard PIX QR code expiration)
    const pixCutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    
    // Boleto: expire after 4 days (3 days due + 1 day grace)
    const boletoCutoff = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

    // Orders without any transaction: expire after 30 minutes (orphan orders)
    const orphanCutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // 1. Expire old PIX orders (payment_status = 'pending' in DB enum)
    const { data: expiredPix, error: pixError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'cancelled', 
        status: 'payment_expired',
        cancellation_reason: 'PIX expirado (automático)',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('payment_method', 'pix')
      .eq('payment_status', 'pending')
      .in('status', ['pending', 'awaiting_payment', 'awaiting_confirmation'])
      .lt('created_at', pixCutoff)
      .select('id, order_number, tenant_id');

    if (pixError) {
      console.error('[expire-stale-orders] PIX error:', pixError);
    } else {
      console.log(`[expire-stale-orders] Expired ${expiredPix?.length || 0} PIX orders`);
    }

    // 2. Expire old Boleto orders
    const { data: expiredBoleto, error: boletoError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'cancelled', 
        status: 'payment_expired',
        cancellation_reason: 'Boleto vencido (automático)',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('payment_method', 'boleto')
      .eq('payment_status', 'pending')
      .in('status', ['pending', 'awaiting_payment', 'awaiting_confirmation'])
      .lt('created_at', boletoCutoff)
      .select('id, order_number, tenant_id');

    if (boletoError) {
      console.error('[expire-stale-orders] Boleto error:', boletoError);
    } else {
      console.log(`[expire-stale-orders] Expired ${expiredBoleto?.length || 0} Boleto orders`);
    }

    // 3. Fix inconsistent orders: payment_status=declined but status still pending
    // These should be cancelled to keep the admin clean
    const { data: fixedDeclined, error: declinedError } = await supabase
      .from('orders')
      .update({
        status: 'payment_expired',
        cancellation_reason: 'Pagamento recusado (sync automático)',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('payment_status', 'declined')
      .in('status', ['pending', 'awaiting_confirmation'])
      .select('id, order_number, tenant_id');

    if (declinedError) {
      console.error('[expire-stale-orders] Declined sync error:', declinedError);
    } else {
      console.log(`[expire-stale-orders] Fixed ${fixedDeclined?.length || 0} declined-but-pending orders`);
    }

    // 4. Cancel orphan orders (no payment transaction created)
    // These are ghost orders — checkout started but payment was never created at the gateway.
    // They must be marked as cancelled AND their checkout_session must be set to 'abandoned'.
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id, order_number, tenant_id, customer_email, customer_name, total')
      .eq('payment_status', 'pending')
      .is('payment_gateway_id', null)
      .in('status', ['pending', 'awaiting_payment'])
      .lt('created_at', orphanCutoff);

    let orphanCount = 0;
    if (pendingOrders && pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        // Cancel the ghost order
        await supabase
          .from('orders')
          .update({
            payment_status: 'cancelled',
            status: 'cancelled',
            cancellation_reason: 'Pedido sem pagamento na operadora (automático)',
            cancelled_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', order.id);

        // REGRA: com pedido = fluxo operacional, NÃO abandono de checkout
        // Emitir evento order.ghost_cancelled em vez de marcar checkout_session como abandoned
        try {
          const emitResponse = await fetch(`${supabaseUrl}/functions/v1/emit-internal-event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              tenant_id: order.tenant_id,
              event_type: 'order.ghost_cancelled',
              occurred_at: now.toISOString(),
              subject: {
                type: 'order',
                id: order.id,
              },
              payload_normalized: {
                order_id: order.id,
                order_number: order.order_number,
                customer_email: order.customer_email || null,
                customer_name: order.customer_name || null,
                total: order.total || 0,
                reason: 'ghost_order_no_gateway',
              },
              idempotency_key: `ghost_cancelled_${order.id}`,
            }),
          });
          
          if (!emitResponse.ok) {
            console.warn(`[expire-stale-orders] Failed to emit ghost_cancelled for ${order.order_number}:`, await emitResponse.text());
          }
        } catch (emitErr) {
          console.warn(`[expire-stale-orders] Error emitting ghost_cancelled for ${order.order_number}:`, emitErr);
        }

        orphanCount++;
        console.log(`[expire-stale-orders] Ghost order cancelled (no checkout contamination): ${order.order_number}`);
      }
    }

    // 5. Record order_history for all expired/cancelled orders
    const allExpired = [
      ...(expiredPix || []).map(o => ({ ...o, reason: 'PIX expirado (automático)' })),
      ...(expiredBoleto || []).map(o => ({ ...o, reason: 'Boleto vencido (automático)' })),
      ...(fixedDeclined || []).map(o => ({ ...o, reason: 'Pagamento recusado (sync automático)' })),
    ];
    
    if (allExpired.length > 0) {
      const historyEntries = allExpired.map(o => ({
        order_id: o.id,
        action: 'status_changed',
        previous_value: { status: 'pending' },
        new_value: { status: 'cancelled' },
        description: o.reason,
      }));
      
      const { error: historyError } = await supabase
        .from('order_history')
        .insert(historyEntries);
      
      if (historyError) {
        console.warn('[expire-stale-orders] Error recording history:', historyError);
      } else {
        console.log(`[expire-stale-orders] Recorded ${historyEntries.length} history entries`);
      }
    }

    // 6. Expire corresponding payment_transactions for PIX
    const { error: txExpireError } = await supabase
      .from('payment_transactions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('status', 'pending')
      .eq('method', 'pix')
      .lt('created_at', pixCutoff);

    if (txExpireError) {
      console.error('[expire-stale-orders] TX expire error:', txExpireError);
    }

    const totalExpired = (expiredPix?.length || 0) + (expiredBoleto?.length || 0);
    console.log(`[expire-stale-orders] Summary: expired=${totalExpired}, declined_fixed=${fixedDeclined?.length || 0}, orphans=${orphanCount}`);

    return new Response(JSON.stringify({
      success: true,
      expired_pix: expiredPix?.length || 0,
      expired_boleto: expiredBoleto?.length || 0,
      declined_fixed: fixedDeclined?.length || 0,
      orphans_cancelled: orphanCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[expire-stale-orders] Error:', error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
