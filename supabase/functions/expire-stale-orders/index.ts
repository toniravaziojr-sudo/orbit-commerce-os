// ============================================
// EXPIRE STALE ORDERS - Auto-expire old pending PIX/Boleto orders
// Runs via cron every 15 minutes
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

    // 1. Expire old PIX orders
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

    // 3. Cancel orphan orders (no payment transaction created)
    // These are orders where the payment step failed before reaching the gateway
    const { data: orphanOrders, error: orphanError } = await supabase.rpc('cancel_orphan_orders', {
      p_cutoff: orphanCutoff,
    });

    // If RPC doesn't exist, use direct query approach
    if (orphanError?.message?.includes('function') || orphanError?.code === '42883') {
      // Fallback: find orders without transactions
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('payment_status', 'pending')
        .in('status', ['pending', 'awaiting_payment'])
        .lt('created_at', orphanCutoff);

      if (pendingOrders && pendingOrders.length > 0) {
        // Check which ones have no transactions
        for (const order of pendingOrders) {
          const { data: txCount } = await supabase
            .from('payment_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('order_id', order.id);

          if (!txCount || txCount.length === 0) {
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

            console.log(`[expire-stale-orders] Cancelled orphan order: ${order.order_number}`);
          }
        }
      }
    } else if (!orphanError) {
      console.log(`[expire-stale-orders] Cancelled orphan orders:`, orphanOrders);
    }

    // Also expire corresponding payment_transactions
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
    console.log(`[expire-stale-orders] Total expired: ${totalExpired}`);

    return new Response(JSON.stringify({
      success: true,
      expired_pix: expiredPix?.length || 0,
      expired_boleto: expiredBoleto?.length || 0,
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
