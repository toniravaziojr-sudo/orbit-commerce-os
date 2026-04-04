// ============================================
// VERIFY PAYMENT STATUS - Progressive polling of payment gateways
// Checks pending orders against gateway APIs with progressive intervals
// Schedule: 0-60min every 1min, 1h-48h every 1h, 48h-5d every 12h, 5d+ every 24h
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENV_PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');

// Max orders to process per invocation
const BATCH_SIZE = 20;

// Default payment expiry fallbacks (in hours)
const PAYMENT_EXPIRY_DEFAULTS: Record<string, number> = {
  pix: 1,          // 1 hour
  boleto: 72,      // 3 days
  credit_card: 0.5, // 30 minutes (instant, but allow for processing)
};

interface OrderToCheck {
  id: string;
  tenant_id: string;
  payment_method: string;
  payment_status: string;
  payment_gateway_id: string | null;
  payment_check_count: number;
  payment_max_expiry_at: string | null;
  created_at: string;
}

function calculateNextCheckAt(orderCreatedAt: string, currentCheckCount: number): string {
  const createdAt = new Date(orderCreatedAt).getTime();
  const now = Date.now();
  const ageMinutes = (now - createdAt) / (1000 * 60);

  let intervalMinutes: number;

  if (ageMinutes <= 60) {
    // 0-60 min: every 1 minute
    intervalMinutes = 1;
  } else if (ageMinutes <= 48 * 60) {
    // 1h-48h: every 1 hour
    intervalMinutes = 60;
  } else if (ageMinutes <= 5 * 24 * 60) {
    // 48h-5 days: every 12 hours
    intervalMinutes = 12 * 60;
  } else {
    // 5 days+: every 24 hours
    intervalMinutes = 24 * 60;
  }

  return new Date(now + intervalMinutes * 60 * 1000).toISOString();
}

async function getPagarmeCredentials(supabase: any, tenantId: string): Promise<string | null> {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pagarme')
    .single();

  if (provider?.is_enabled && provider?.credentials?.api_key) {
    return provider.credentials.api_key;
  }

  return ENV_PAGARME_API_KEY || null;
}

async function fetchPagarmeOrderStatus(apiKey: string, gatewayOrderId: string): Promise<{
  status: string;
  chargeStatus: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  expiresAt: string | null;
}> {
  const authHeader = btoa(`${apiKey}:`);
  const response = await fetch(`https://api.pagar.me/core/v5/orders/${gatewayOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Pagar.me API error: ${response.status}`);
  }

  const data = await response.json();
  const charge = data.charges?.[0];

  return {
    status: data.status,
    chargeStatus: charge?.status || null,
    paidAt: charge?.paid_at || null,
    paidAmount: charge?.paid_amount || charge?.amount || null,
    expiresAt: charge?.due_at || null,
  };
}

function mapGatewayStatus(chargeStatus: string | null): {
  paymentStatus: string | null;
  orderStatus: string | null;
  isFinal: boolean;
} {
  switch (chargeStatus) {
    case 'paid':
      return { paymentStatus: 'approved', orderStatus: 'ready_to_invoice', isFinal: true };
    case 'failed':
      return { paymentStatus: 'declined', orderStatus: 'payment_expired', isFinal: true };
    case 'canceled':
    case 'expired':
      return { paymentStatus: 'cancelled', orderStatus: 'payment_expired', isFinal: true };
    case 'refunded':
      return { paymentStatus: 'refunded', orderStatus: null, isFinal: true };
    case 'chargedback':
      return { paymentStatus: 'chargeback_requested', orderStatus: null, isFinal: false };
    case 'pending':
    case 'processing':
      return { paymentStatus: null, orderStatus: null, isFinal: false };
    default:
      return { paymentStatus: null, orderStatus: null, isFinal: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    
    console.log(`[verify-payment-status] Running at ${now.toISOString()}`);

    // Fetch orders that need payment verification
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, tenant_id, payment_method, payment_status, payment_gateway_id, payment_check_count, payment_max_expiry_at, created_at')
      .in('payment_status', ['pending', 'processing'])
      .not('payment_gateway_id', 'is', null)
      .lte('next_payment_check_at', now.toISOString())
      .order('next_payment_check_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[verify-payment-status] Error fetching orders:', fetchError);
      throw fetchError;
    }

    if (!orders || orders.length === 0) {
      console.log('[verify-payment-status] No orders to check');
      return new Response(JSON.stringify({ success: true, checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[verify-payment-status] Found ${orders.length} orders to check`);

    let checked = 0;
    let updated = 0;
    let expired = 0;
    let errors = 0;

    // Group by tenant for credential reuse
    const tenantCredentials = new Map<string, string | null>();

    for (const order of orders as OrderToCheck[]) {
      try {
        checked++;

        // Check if order has exceeded max expiry
        if (order.payment_max_expiry_at && new Date(order.payment_max_expiry_at) < now) {
          console.log(`[verify-payment-status] Order ${order.id} exceeded max expiry, marking as cancelled`);
          await supabase
            .from('orders')
            .update({
              payment_status: 'cancelled',
              status: 'payment_expired',
              cancellation_reason: 'Prazo máximo de pagamento excedido (automático)',
              cancelled_at: now.toISOString(),
              next_payment_check_at: null,
              updated_at: now.toISOString(),
            })
            .eq('id', order.id);
          expired++;
          updated++;
          continue;
        }

        // Check if order age exceeds default payment expiry (fallback if no max_expiry set)
        if (!order.payment_max_expiry_at) {
          const defaultExpiryHours = PAYMENT_EXPIRY_DEFAULTS[order.payment_method] || 72;
          const orderAge = (now.getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
          if (orderAge > defaultExpiryHours * 2) {
            // Double the default as safety margin before auto-expiring without gateway check
            console.log(`[verify-payment-status] Order ${order.id} aged ${Math.round(orderAge)}h (default expiry ${defaultExpiryHours}h), marking as cancelled`);
            await supabase
              .from('orders')
              .update({
                payment_status: 'cancelled',
                status: 'payment_expired',
                cancellation_reason: `Pagamento ${order.payment_method} expirado (automático)`,
                cancelled_at: now.toISOString(),
                next_payment_check_at: null,
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);
            expired++;
            updated++;
            continue;
          }
        }

        // Get gateway credentials
        if (!tenantCredentials.has(order.tenant_id)) {
          const creds = await getPagarmeCredentials(supabase, order.tenant_id);
          tenantCredentials.set(order.tenant_id, creds);
        }
        const apiKey = tenantCredentials.get(order.tenant_id);

        if (!apiKey) {
          console.warn(`[verify-payment-status] No gateway credentials for tenant ${order.tenant_id}, scheduling next check`);
          await supabase
            .from('orders')
            .update({
              next_payment_check_at: calculateNextCheckAt(order.created_at, order.payment_check_count),
              payment_check_count: (order.payment_check_count || 0) + 1,
            })
            .eq('id', order.id);
          continue;
        }

        // Query gateway
        const gatewayResult = await fetchPagarmeOrderStatus(apiKey, order.payment_gateway_id!);
        const mapped = mapGatewayStatus(gatewayResult.chargeStatus);

        if (mapped.isFinal && mapped.paymentStatus) {
          // Final status — update order and stop polling
          const orderUpdate: Record<string, any> = {
            payment_status: mapped.paymentStatus,
            next_payment_check_at: null,
            payment_check_count: (order.payment_check_count || 0) + 1,
            updated_at: now.toISOString(),
          };

          if (mapped.orderStatus) {
            orderUpdate.status = mapped.orderStatus;
          }

          if (mapped.paymentStatus === 'approved' && gatewayResult.paidAt) {
            orderUpdate.paid_at = gatewayResult.paidAt;
          }

          if (mapped.paymentStatus === 'cancelled') {
            orderUpdate.cancelled_at = now.toISOString();
            orderUpdate.cancellation_reason = `Pagamento ${gatewayResult.chargeStatus} no gateway (verificação automática)`;
          }

          await supabase
            .from('orders')
            .update(orderUpdate)
            .eq('id', order.id);

          console.log(`[verify-payment-status] Order ${order.id}: ${order.payment_status} → ${mapped.paymentStatus}`);
          updated++;
        } else if (mapped.paymentStatus === 'chargeback_requested') {
          // Chargeback detected during initial verification
          await supabase
            .from('orders')
            .update({
              payment_status: 'chargeback_requested',
              chargeback_detected_at: now.toISOString(),
              chargeback_deadline_at: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
              next_payment_check_at: null,
              payment_check_count: (order.payment_check_count || 0) + 1,
              updated_at: now.toISOString(),
            })
            .eq('id', order.id);
          
          console.log(`[verify-payment-status] Order ${order.id}: CHARGEBACK DETECTED`);
          updated++;
        } else {
          // Still pending — schedule next check
          const nextCheck = calculateNextCheckAt(order.created_at, order.payment_check_count);

          // Set max expiry from gateway if available
          const updateData: Record<string, any> = {
            next_payment_check_at: nextCheck,
            payment_check_count: (order.payment_check_count || 0) + 1,
          };

          if (gatewayResult.expiresAt && !order.payment_max_expiry_at) {
            updateData.payment_max_expiry_at = gatewayResult.expiresAt;
          }

          await supabase
            .from('orders')
            .update(updateData)
            .eq('id', order.id);

          console.log(`[verify-payment-status] Order ${order.id}: still ${gatewayResult.chargeStatus}, next check at ${nextCheck}`);
        }
      } catch (orderError) {
        console.error(`[verify-payment-status] Error processing order ${order.id}:`, orderError);
        
        // Schedule next check even on error
        await supabase
          .from('orders')
          .update({
            next_payment_check_at: calculateNextCheckAt(order.created_at, order.payment_check_count || 0),
            payment_check_count: (order.payment_check_count || 0) + 1,
          })
          .eq('id', order.id);
        
        errors++;
      }
    }

    console.log(`[verify-payment-status] Summary: checked=${checked}, updated=${updated}, expired=${expired}, errors=${errors}`);

    return new Response(JSON.stringify({
      success: true,
      checked,
      updated,
      expired,
      errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[verify-payment-status] Fatal error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
