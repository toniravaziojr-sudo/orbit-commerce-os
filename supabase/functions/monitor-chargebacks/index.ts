// ============================================
// MONITOR CHARGEBACKS - Post-sale payment monitoring
// Checks approved orders daily for 60 days to detect chargebacks
// Also monitors chargeback_requested orders for 15 days for resolution
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

// Monitor approved orders for 60 days
const MONITORING_WINDOW_DAYS = 60;
// Monitor chargeback disputes for 15 days
const CHARGEBACK_RESOLUTION_DAYS = 15;
// Max orders per run
const BATCH_SIZE = 50;

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

async function fetchPagarmeChargeStatus(apiKey: string, gatewayOrderId: string): Promise<string | null> {
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
  return data.charges?.[0]?.status || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    console.log(`[monitor-chargebacks] Running at ${now.toISOString()}`);

    let chargebacksDetected = 0;
    let chargebacksResolved = 0;
    let chargebacksLost = 0;
    let checkedApproved = 0;
    let checkedDisputed = 0;
    let errors = 0;

    // ============================================================
    // PART 1: Check approved orders within 60-day window
    // ============================================================
    const monitoringCutoff = new Date(now.getTime() - MONITORING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: approvedOrders, error: approvedError } = await supabase
      .from('orders')
      .select('id, tenant_id, payment_gateway_id, paid_at')
      .eq('payment_status', 'approved')
      .not('payment_gateway_id', 'is', null)
      .gte('paid_at', monitoringCutoff)
      .order('paid_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (approvedError) {
      console.error('[monitor-chargebacks] Error fetching approved orders:', approvedError);
    }

    const tenantCredentials = new Map<string, string | null>();

    if (approvedOrders && approvedOrders.length > 0) {
      console.log(`[monitor-chargebacks] Checking ${approvedOrders.length} approved orders`);

      for (const order of approvedOrders) {
        try {
          checkedApproved++;

          if (!tenantCredentials.has(order.tenant_id)) {
            const creds = await getPagarmeCredentials(supabase, order.tenant_id);
            tenantCredentials.set(order.tenant_id, creds);
          }
          const apiKey = tenantCredentials.get(order.tenant_id);

          if (!apiKey) continue;

          const chargeStatus = await fetchPagarmeChargeStatus(apiKey, order.payment_gateway_id);

          if (chargeStatus === 'chargedback') {
            console.log(`[monitor-chargebacks] CHARGEBACK DETECTED for order ${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'chargeback_requested',
                chargeback_detected_at: now.toISOString(),
                chargeback_deadline_at: new Date(now.getTime() + CHARGEBACK_RESOLUTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            // Record in order_history
            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_detected',
                description: 'Chargeback detectado via monitoramento pós-venda',
                new_value: { payment_status: 'chargeback_requested' },
                previous_value: { payment_status: 'approved' },
              });

            chargebacksDetected++;
          } else if (chargeStatus === 'refunded') {
            console.log(`[monitor-chargebacks] REFUND DETECTED for order ${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'refunded',
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'refund_detected',
                description: 'Estorno detectado via monitoramento pós-venda',
                new_value: { payment_status: 'refunded' },
                previous_value: { payment_status: 'approved' },
              });
          }
        } catch (err) {
          console.error(`[monitor-chargebacks] Error checking order ${order.id}:`, err);
          errors++;
        }
      }
    }

    // ============================================================
    // PART 2: Resolve existing chargeback disputes
    // ============================================================
    const { data: disputedOrders, error: disputedError } = await supabase
      .from('orders')
      .select('id, tenant_id, payment_gateway_id, chargeback_detected_at, chargeback_deadline_at')
      .eq('payment_status', 'chargeback_requested')
      .not('payment_gateway_id', 'is', null)
      .order('chargeback_detected_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (disputedError) {
      console.error('[monitor-chargebacks] Error fetching disputed orders:', disputedError);
    }

    if (disputedOrders && disputedOrders.length > 0) {
      console.log(`[monitor-chargebacks] Checking ${disputedOrders.length} disputed orders`);

      for (const order of disputedOrders) {
        try {
          checkedDisputed++;

          if (!tenantCredentials.has(order.tenant_id)) {
            const creds = await getPagarmeCredentials(supabase, order.tenant_id);
            tenantCredentials.set(order.tenant_id, creds);
          }
          const apiKey = tenantCredentials.get(order.tenant_id);

          if (!apiKey) continue;

          const chargeStatus = await fetchPagarmeChargeStatus(apiKey, order.payment_gateway_id);

          if (chargeStatus === 'paid') {
            // Chargeback recovered!
            console.log(`[monitor-chargebacks] Chargeback RECOVERED for order ${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'approved',
                chargeback_detected_at: null,
                chargeback_deadline_at: null,
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_recovered',
                description: 'Chargeback recuperado — pagamento restabelecido',
                new_value: { payment_status: 'approved' },
                previous_value: { payment_status: 'chargeback_requested' },
              });

            chargebacksResolved++;
          } else if (chargeStatus === 'refunded' || chargeStatus === 'canceled') {
            // Chargeback lost
            console.log(`[monitor-chargebacks] Chargeback LOST for order ${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'refunded',
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_lost',
                description: 'Chargeback perdido — pedido estornado',
                new_value: { payment_status: 'refunded' },
                previous_value: { payment_status: 'chargeback_requested' },
              });

            chargebacksLost++;
          } else if (order.chargeback_deadline_at && new Date(order.chargeback_deadline_at) < now) {
            // Deadline exceeded without resolution — mark as lost
            console.log(`[monitor-chargebacks] Chargeback DEADLINE EXCEEDED for order ${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'refunded',
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_deadline_exceeded',
                description: 'Prazo de resolução do chargeback excedido — estornado automaticamente',
                new_value: { payment_status: 'refunded' },
                previous_value: { payment_status: 'chargeback_requested' },
              });

            chargebacksLost++;
          }
        } catch (err) {
          console.error(`[monitor-chargebacks] Error checking disputed order ${order.id}:`, err);
          errors++;
        }
      }
    }

    console.log(`[monitor-chargebacks] Summary: approved_checked=${checkedApproved}, disputed_checked=${checkedDisputed}, chargebacks_detected=${chargebacksDetected}, recovered=${chargebacksResolved}, lost=${chargebacksLost}, errors=${errors}`);

    return new Response(JSON.stringify({
      success: true,
      approved_checked: checkedApproved,
      disputed_checked: checkedDisputed,
      chargebacks_detected: chargebacksDetected,
      chargebacks_recovered: chargebacksResolved,
      chargebacks_lost: chargebacksLost,
      errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[monitor-chargebacks] Fatal error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
