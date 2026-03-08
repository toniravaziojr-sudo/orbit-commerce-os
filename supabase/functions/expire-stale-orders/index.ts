// ============================================
// EXPIRE STALE ORDERS - Auto-expire old pending PIX/Boleto orders
// Runs via cron every 15 minutes
// Also cleans up declined orders left with status=pending
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        status: 'cancelled',
        cancellation_reason: 'PIX expirado (automático)',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('payment_method', 'pix')
      .eq('payment_status', 'pending')
      .in('status', ['pending', 'awaiting_payment'])
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
        status: 'cancelled',
        cancellation_reason: 'Boleto vencido (automático)',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('payment_method', 'boleto')
      .eq('payment_status', 'pending')
      .in('status', ['pending', 'awaiting_payment'])
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
        status: 'cancelled',
        cancellation_reason: 'Pagamento recusado (sync automático)',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('payment_status', 'declined')
      .eq('status', 'pending')
      .select('id, order_number, tenant_id');

    if (declinedError) {
      console.error('[expire-stale-orders] Declined sync error:', declinedError);
    } else {
      console.log(`[expire-stale-orders] Fixed ${fixedDeclined?.length || 0} declined-but-pending orders`);
    }

    // 4. Cancel orphan orders (no payment transaction created)
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('payment_status', 'pending')
      .in('status', ['pending', 'awaiting_payment'])
      .lt('created_at', orphanCutoff);

    let orphanCount = 0;
    if (pendingOrders && pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        const { data: txData } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', order.id);

        if (!txData || txData.length === 0) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'cancelled',
              status: 'cancelled',
              cancellation_reason: 'Pedido sem pagamento (automático)',
              cancelled_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', order.id);

          orphanCount++;
          console.log(`[expire-stale-orders] Cancelled orphan order: ${order.order_number}`);
        }
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
        tenant_id: o.tenant_id,
        field_changed: 'status',
        old_value: 'pending',
        new_value: 'cancelled',
        changed_by: 'cron:expire-stale-orders',
        notes: o.reason,
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
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
