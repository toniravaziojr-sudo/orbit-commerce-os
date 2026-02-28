// ============================================
// RECONCILE PAYMENTS - Fallback for missed webhooks
// v2.0.0: Concurrent payment verification via Promise.allSettled
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.0.0"; // Concurrent payment checks via Promise.allSettled per tenant
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ENV_PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');

const PENDING_THRESHOLD_MINUTES = 30;

// Max concurrent API calls per tenant to avoid rate limiting
const MAX_CONCURRENCY = 5;

interface ReconcileStats {
  checked: number;
  updated: number;
  unchanged: number;
  errors: number;
  skipped_no_credentials: number;
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

async function fetchPagarmeOrder(apiKey: string, orderId: string): Promise<any> {
  const authHeader = btoa(`${apiKey}:`);
  const response = await fetch(`https://api.pagar.me/core/v5/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Pagar.me API error: ${response.status}`);
  }

  return response.json();
}

interface PaymentRecord {
  id: string;
  tenant_id: string;
  provider_transaction_id: string | null;
  status: string;
  order_id: string | null;
  amount: number;
}

// Process a single payment and return result
async function processPayment(
  supabase: any,
  payment: PaymentRecord,
  apiKey: string,
): Promise<{ status: 'updated' | 'unchanged' | 'error'; id: string }> {
  try {
    if (!payment.provider_transaction_id) {
      return { status: 'unchanged', id: payment.id };
    }

    const pagarmeOrder = await fetchPagarmeOrder(apiKey, payment.provider_transaction_id);
    const charge = pagarmeOrder.charges?.[0];
    const chargeStatus = charge?.status;

    let newTransactionStatus = 'pending';
    let newPaymentStatus: string | null = null;
    let newOrderStatus: string | null = null;
    let paidAt: string | null = null;
    let paidAmount: number | null = null;
    let needsUpdate = false;

    switch (chargeStatus) {
      case 'paid':
        newTransactionStatus = 'paid';
        newPaymentStatus = 'approved';
        newOrderStatus = 'confirmed';
        paidAt = new Date().toISOString();
        paidAmount = charge?.paid_amount || charge?.amount || payment.amount;
        needsUpdate = true;
        break;
      case 'failed':
        newTransactionStatus = 'failed';
        newPaymentStatus = 'declined';
        newOrderStatus = 'cancelled';
        needsUpdate = true;
        break;
      case 'canceled':
        newTransactionStatus = 'canceled';
        newPaymentStatus = 'declined';
        newOrderStatus = 'cancelled';
        needsUpdate = true;
        break;
      case 'expired':
        newTransactionStatus = 'expired';
        newPaymentStatus = 'expired';
        needsUpdate = true;
        break;
      case 'refunded':
        newTransactionStatus = 'refunded';
        newPaymentStatus = 'refunded';
        needsUpdate = true;
        break;
      case 'chargedback':
        newTransactionStatus = 'chargedback';
        newPaymentStatus = 'chargedback';
        newOrderStatus = 'cancelled';
        needsUpdate = true;
        break;
      case 'pending':
      case 'processing':
        return { status: 'unchanged', id: payment.id };
      default:
        console.log(`[reconcile-payments] Unknown status ${chargeStatus} for payment ${payment.id}`);
        return { status: 'unchanged', id: payment.id };
    }

    if (needsUpdate) {
      const transactionUpdate: Record<string, any> = {
        status: newTransactionStatus,
        updated_at: new Date().toISOString(),
      };

      if (paidAt) {
        transactionUpdate.paid_at = paidAt;
        transactionUpdate.paid_amount = paidAmount;
      }

      await supabase
        .from('payment_transactions')
        .update(transactionUpdate)
        .eq('id', payment.id);

      if (payment.order_id && newPaymentStatus) {
        const orderUpdate: Record<string, any> = {
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString(),
        };

        if (newOrderStatus) {
          orderUpdate.status = newOrderStatus;
        }

        if (paidAt) {
          orderUpdate.paid_at = paidAt;
        }

        await supabase
          .from('orders')
          .update(orderUpdate)
          .eq('id', payment.order_id);
      }

      console.log(`[reconcile-payments] Updated payment ${payment.id}: ${payment.status} -> ${newTransactionStatus}`);
      return { status: 'updated', id: payment.id };
    }

    return { status: 'unchanged', id: payment.id };
  } catch (error: any) {
    console.error(`[reconcile-payments] Error processing payment ${payment.id}:`, error.message);
    return { status: 'error', id: payment.id };
  }
}

// Process payments in batches with concurrency limit
async function processBatch(
  supabase: any,
  payments: PaymentRecord[],
  apiKey: string,
  concurrency: number,
): Promise<{ updated: number; unchanged: number; errors: number }> {
  const results = { updated: 0, unchanged: 0, errors: 0 };
  
  // Process in chunks of `concurrency`
  for (let i = 0; i < payments.length; i += concurrency) {
    const chunk = payments.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(payment => processPayment(supabase, payment, apiKey))
    );

    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results[result.value.status === 'updated' ? 'updated' : result.value.status === 'error' ? 'errors' : 'unchanged']++;
      } else {
        results.errors++;
      }
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[reconcile-payments][${VERSION}] Starting reconciliation`);

  const stats: ReconcileStats = {
    checked: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    skipped_no_credentials: 0,
  };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: { limit?: number; threshold_minutes?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults
    }

    const limit = body.limit ?? 50;
    const thresholdMinutes = body.threshold_minutes ?? PENDING_THRESHOLD_MINUTES;
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

    console.log(`[reconcile-payments] Looking for pending payments older than ${thresholdMinutes} minutes (before ${thresholdTime})`);

    const { data: pendingPayments, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('id, tenant_id, provider_transaction_id, status, order_id, amount')
      .eq('provider', 'pagarme')
      .eq('status', 'pending')
      .lt('created_at', thresholdTime)
      .limit(limit);

    if (fetchError) {
      console.error('[reconcile-payments] Error fetching pending payments:', fetchError);
      throw fetchError;
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log('[reconcile-payments] No pending payments to reconcile');
      return new Response(JSON.stringify({ 
        message: 'No pending payments to reconcile',
        stats,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[reconcile-payments] Found ${pendingPayments.length} pending payments to check`);
    stats.checked = pendingPayments.length;

    // Group payments by tenant for credential efficiency
    const paymentsByTenant = new Map<string, PaymentRecord[]>();
    for (const payment of pendingPayments) {
      if (!paymentsByTenant.has(payment.tenant_id)) {
        paymentsByTenant.set(payment.tenant_id, []);
      }
      paymentsByTenant.get(payment.tenant_id)!.push(payment as PaymentRecord);
    }

    // Process ALL tenants concurrently (each tenant's payments are batched)
    const tenantResults = await Promise.allSettled(
      Array.from(paymentsByTenant.entries()).map(async ([tenantId, tenantPayments]) => {
        const apiKey = await getPagarmeCredentials(supabase, tenantId);
        
        if (!apiKey) {
          console.log(`[reconcile-payments] No credentials for tenant ${tenantId}, skipping ${tenantPayments.length} payments`);
          return { skipped: tenantPayments.length, updated: 0, unchanged: 0, errors: 0 };
        }

        const result = await processBatch(supabase, tenantPayments, apiKey, MAX_CONCURRENCY);
        return { skipped: 0, ...result };
      })
    );

    // Aggregate results
    for (const result of tenantResults) {
      if (result.status === 'fulfilled') {
        stats.updated += result.value.updated;
        stats.unchanged += result.value.unchanged;
        stats.errors += result.value.errors;
        stats.skipped_no_credentials += result.value.skipped;
      } else {
        stats.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[reconcile-payments] Completed in ${duration}ms:`, stats);

    return new Response(JSON.stringify({
      message: 'Reconciliation completed',
      stats,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[reconcile-payments] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stats,
      duration_ms: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
