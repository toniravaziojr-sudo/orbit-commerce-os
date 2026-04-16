// ============================================
// MONITOR CHARGEBACKS - Post-sale payment monitoring (v3.0)
// Multi-gateway: Pagar.me + Mercado Pago
// Now updates BOTH payment_status AND order status
// payment_status → under_review | paid | refunded
// order status   → chargeback_detected | chargeback_lost | (restored)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MONITORING_WINDOW_DAYS = 60;
const CHARGEBACK_RESOLUTION_DAYS = 15;
const PAGE_SIZE = 30;
const MAX_PAGES = 30;
const PAGE_DELAY_MS = 500;
const CALL_DELAY_MS = 200;

// ============================================
// GATEWAY ADAPTERS
// ============================================

interface GatewayCredentials {
  gateway: 'pagarme' | 'mercadopago';
  apiKey?: string;
  accessToken?: string;
}

const credentialsCache = new Map<string, GatewayCredentials | null>();

async function getCredentialsForOrder(
  supabase: any,
  tenantId: string,
  gateway: string
): Promise<GatewayCredentials | null> {
  const cacheKey = `${tenantId}:${gateway}`;
  if (credentialsCache.has(cacheKey)) {
    return credentialsCache.get(cacheKey)!;
  }

  let result: GatewayCredentials | null = null;

  if (gateway === 'pagarme') {
    const { data: provider } = await supabase
      .from('payment_providers')
      .select('credentials, is_enabled')
      .eq('tenant_id', tenantId)
      .eq('provider', 'pagarme')
      .single();

    if (provider?.is_enabled && provider?.credentials?.api_key) {
      result = { gateway: 'pagarme', apiKey: provider.credentials.api_key };
    } else {
      const envKey = Deno.env.get('PAGARME_API_KEY');
      if (envKey) {
        result = { gateway: 'pagarme', apiKey: envKey };
      }
    }
  } else if (gateway === 'mercadopago') {
    const { data: provider } = await supabase
      .from('payment_providers')
      .select('credentials, is_enabled')
      .eq('tenant_id', tenantId)
      .eq('provider', 'mercado_pago')
      .single();

    if (provider?.is_enabled && provider?.credentials?.access_token) {
      result = { gateway: 'mercadopago', accessToken: provider.credentials.access_token };
    }
  }

  credentialsCache.set(cacheKey, result);
  return result;
}

async function fetchPagarmeStatus(apiKey: string, gatewayOrderId: string): Promise<string | null> {
  const authHeader = btoa(`${apiKey}:`);
  const response = await fetch(`https://api.pagar.me/core/v5/orders/${gatewayOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pagar.me API error: ${response.status} — ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.charges?.[0]?.status || null;
}

async function fetchMercadoPagoStatus(accessToken: string, paymentId: string): Promise<string | null> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MercadoPago API error: ${response.status} — ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.status || null;
}

function normalizeChargebackStatus(gateway: string, rawStatus: string | null): 'ok' | 'chargedback' | 'refunded' | 'unknown' {
  if (!rawStatus) return 'unknown';

  if (gateway === 'pagarme') {
    switch (rawStatus) {
      case 'paid': return 'ok';
      case 'chargedback': return 'chargedback';
      case 'refunded': return 'refunded';
      case 'canceled': return 'refunded';
      default: return 'unknown';
    }
  }

  if (gateway === 'mercadopago') {
    switch (rawStatus) {
      case 'approved': return 'ok';
      case 'charged_back': return 'chargedback';
      case 'refunded': return 'refunded';
      case 'cancelled': return 'refunded';
      default: return 'unknown';
    }
  }

  return 'unknown';
}

async function fetchGatewayStatus(credentials: GatewayCredentials, gatewayId: string): Promise<string | null> {
  if (credentials.gateway === 'pagarme' && credentials.apiKey) {
    return fetchPagarmeStatus(credentials.apiKey, gatewayId);
  }
  if (credentials.gateway === 'mercadopago' && credentials.accessToken) {
    return fetchMercadoPagoStatus(credentials.accessToken, gatewayId);
  }
  return null;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    console.log(`[monitor-chargebacks] v3.0 Running at ${now.toISOString()}`);

    let chargebacksDetected = 0;
    let chargebacksResolved = 0;
    let chargebacksLost = 0;
    let refundsDetected = 0;
    let totalCheckedApproved = 0;
    let totalCheckedDisputed = 0;
    let errors = 0;
    let skippedNoCredentials = 0;
    let pagesProcessed = 0;

    // ============================================================
    // PART 1: Check approved orders within 60-day window (paginated)
    // ============================================================
    const monitoringCutoff = new Date(now.getTime() - MONITORING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let hasMoreApproved = true;
    let approvedOffset = 0;

    while (hasMoreApproved && pagesProcessed < MAX_PAGES) {
      const { data: approvedOrders, error: approvedError } = await supabase
        .from('orders')
        .select('id, tenant_id, payment_gateway, payment_gateway_id, paid_at, status')
        .eq('payment_status', 'approved')
        .not('payment_gateway_id', 'is', null)
        .not('payment_gateway', 'is', null)
        .gte('paid_at', monitoringCutoff)
        .order('paid_at', { ascending: true })
        .range(approvedOffset, approvedOffset + PAGE_SIZE - 1);

      if (approvedError) {
        console.error('[monitor-chargebacks] Error fetching approved orders:', approvedError);
        break;
      }

      if (!approvedOrders || approvedOrders.length === 0) {
        hasMoreApproved = false;
        break;
      }

      console.log(`[monitor-chargebacks] Page ${pagesProcessed + 1}: checking ${approvedOrders.length} approved orders (offset ${approvedOffset})`);

      for (const order of approvedOrders) {
        try {
          totalCheckedApproved++;

          const credentials = await getCredentialsForOrder(supabase, order.tenant_id, order.payment_gateway);
          if (!credentials) {
            skippedNoCredentials++;
            continue;
          }

          const rawStatus = await fetchGatewayStatus(credentials, order.payment_gateway_id);
          const normalized = normalizeChargebackStatus(order.payment_gateway, rawStatus);

          if (normalized === 'chargedback') {
            console.log(`[monitor-chargebacks] CHARGEBACK DETECTED: order=${order.id}, gateway=${order.payment_gateway}, previous_status=${order.status}`);

            // Update BOTH payment_status AND order status
            await supabase
              .from('orders')
              .update({
                payment_status: 'under_review',
                status: 'chargeback_detected',
                status_before_chargeback: order.status, // Save for restoration
                chargeback_detected_at: now.toISOString(),
                chargeback_deadline_at: new Date(now.getTime() + CHARGEBACK_RESOLUTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_detected',
                description: `Chargeback detectado via monitoramento pós-venda (${order.payment_gateway}). Status anterior: ${order.status}`,
                new_value: { payment_status: 'under_review', status: 'chargeback_detected' },
                previous_value: { payment_status: 'approved', status: order.status },
              });

            chargebacksDetected++;
          } else if (normalized === 'refunded') {
            console.log(`[monitor-chargebacks] REFUND DETECTED: order=${order.id}, gateway=${order.payment_gateway}`);

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
                description: `Estorno detectado via monitoramento pós-venda (${order.payment_gateway})`,
                new_value: { payment_status: 'refunded' },
                previous_value: { payment_status: 'approved' },
              });

            refundsDetected++;
          }

          await delay(CALL_DELAY_MS);

        } catch (err) {
          console.error(`[monitor-chargebacks] Error checking order ${order.id}:`, err);
          errors++;
        }
      }

      approvedOffset += PAGE_SIZE;
      pagesProcessed++;

      if (approvedOrders.length < PAGE_SIZE) {
        hasMoreApproved = false;
      } else {
        await delay(PAGE_DELAY_MS);
      }
    }

    // ============================================================
    // PART 2: Resolve existing chargeback disputes (paginated)
    // Now checks for status = 'chargeback_detected' OR legacy payment_status = 'chargeback_requested'
    // ============================================================
    let hasMoreDisputed = true;
    let disputedOffset = 0;

    while (hasMoreDisputed && pagesProcessed < MAX_PAGES) {
      // Query: chargeback_detected status OR legacy chargeback_requested payment_status
      const { data: disputedOrders, error: disputedError } = await supabase
        .from('orders')
        .select('id, tenant_id, payment_gateway, payment_gateway_id, chargeback_detected_at, chargeback_deadline_at, status, payment_status, status_before_chargeback')
        .or('status.eq.chargeback_detected,payment_status.eq.chargeback_requested,payment_status.eq.under_review')
        .not('payment_gateway_id', 'is', null)
        .not('payment_gateway', 'is', null)
        .order('chargeback_detected_at', { ascending: true })
        .range(disputedOffset, disputedOffset + PAGE_SIZE - 1);

      if (disputedError) {
        console.error('[monitor-chargebacks] Error fetching disputed orders:', disputedError);
        break;
      }

      if (!disputedOrders || disputedOrders.length === 0) {
        hasMoreDisputed = false;
        break;
      }

      console.log(`[monitor-chargebacks] Page ${pagesProcessed + 1}: checking ${disputedOrders.length} disputed orders (offset ${disputedOffset})`);

      for (const order of disputedOrders) {
        try {
          totalCheckedDisputed++;

          const credentials = await getCredentialsForOrder(supabase, order.tenant_id, order.payment_gateway);
          if (!credentials) {
            skippedNoCredentials++;
            continue;
          }

          const rawStatus = await fetchGatewayStatus(credentials, order.payment_gateway_id);
          const normalized = normalizeChargebackStatus(order.payment_gateway, rawStatus);

          // Determine the status to restore on recovery
          const restoreStatus = order.status_before_chargeback || 'ready_to_invoice';

          if (normalized === 'ok') {
            // Chargeback recovered!
            console.log(`[monitor-chargebacks] CHARGEBACK RECOVERED: order=${order.id}, previous_status=${restoreStatus}`);

            // Set status to chargeback_recovered (visible + filterable)
            // Keep status_before_chargeback for historical reference
            // Keep chargeback_detected_at for historical reference (don't clear)
            await supabase
              .from('orders')
              .update({
                payment_status: 'approved',
                status: 'chargeback_recovered',
                chargeback_deadline_at: null,
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_recovered',
                description: `Chargeback recuperado — pagamento restabelecido (${order.payment_gateway}). Status anterior ao chargeback: ${restoreStatus}`,
                new_value: { payment_status: 'approved', status: 'chargeback_recovered' },
                previous_value: { payment_status: order.payment_status, status: order.status },
              });

            chargebacksResolved++;
          } else if (normalized === 'refunded') {
            // Chargeback lost
            console.log(`[monitor-chargebacks] CHARGEBACK LOST: order=${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'refunded',
                status: 'chargeback_lost',
                status_before_chargeback: null,
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_lost',
                description: `Chargeback perdido — pedido estornado (${order.payment_gateway})`,
                new_value: { payment_status: 'refunded', status: 'chargeback_lost' },
                previous_value: { payment_status: order.payment_status, status: order.status },
              });

            chargebacksLost++;
          } else if (order.chargeback_deadline_at && new Date(order.chargeback_deadline_at) < now) {
            // Deadline exceeded without resolution
            console.log(`[monitor-chargebacks] CHARGEBACK DEADLINE EXCEEDED: order=${order.id}`);

            await supabase
              .from('orders')
              .update({
                payment_status: 'refunded',
                status: 'chargeback_lost',
                status_before_chargeback: null,
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);

            await supabase
              .from('order_history')
              .insert({
                order_id: order.id,
                action: 'chargeback_deadline_exceeded',
                description: `Prazo de resolução do chargeback excedido — estornado automaticamente (${order.payment_gateway})`,
                new_value: { payment_status: 'refunded', status: 'chargeback_lost' },
                previous_value: { payment_status: order.payment_status, status: order.status },
              });

            chargebacksLost++;
          }

          await delay(CALL_DELAY_MS);

        } catch (err) {
          console.error(`[monitor-chargebacks] Error checking disputed order ${order.id}:`, err);
          errors++;
        }
      }

      disputedOffset += PAGE_SIZE;
      pagesProcessed++;

      if (disputedOrders.length < PAGE_SIZE) {
        hasMoreDisputed = false;
      } else {
        await delay(PAGE_DELAY_MS);
      }
    }

    const summary = {
      success: true,
      version: 'v3.0',
      approved_checked: totalCheckedApproved,
      disputed_checked: totalCheckedDisputed,
      chargebacks_detected: chargebacksDetected,
      chargebacks_recovered: chargebacksResolved,
      chargebacks_lost: chargebacksLost,
      refunds_detected: refundsDetected,
      skipped_no_credentials: skippedNoCredentials,
      pages_processed: pagesProcessed,
      errors,
    };

    console.log(`[monitor-chargebacks] Summary:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
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
