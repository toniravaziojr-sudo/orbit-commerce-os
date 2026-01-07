// ============================================
// PAGAR.ME CREATE CHARGE - Payment processing
// Uses database config first, falls back to Secrets
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Fallback to environment secrets
const ENV_PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY');
const ENV_PAGARME_ACCOUNT_ID = Deno.env.get('PAGARME_ACCOUNT_ID');

interface ChargeRequest {
  checkout_id?: string;
  order_id?: string; // NEW: order_id for linking payment to order
  tenant_id: string;
  method: 'pix' | 'boleto' | 'credit_card';
  amount: number; // in cents
  customer: {
    name: string;
    email: string;
    document: string; // CPF
    phone?: string;
  };
  billing_address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  card?: {
    number: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    cvv: string;
  };
  installments?: number;
}

// Get Pagar.me credentials from database or fallback to Secrets
async function getPagarmeCredentials(supabase: any, tenantId: string): Promise<{
  apiKey: string;
  accountId: string;
  environment: string;
  source: 'database' | 'fallback';
}> {
  // Try database first
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, environment, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pagarme')
    .single();

  if (provider?.is_enabled && provider?.credentials?.api_key) {
    console.log('[Pagar.me] Using database credentials');
    return {
      apiKey: provider.credentials.api_key,
      accountId: provider.credentials.account_id || '',
      environment: provider.environment || 'sandbox',
      source: 'database',
    };
  }

  // Fallback to environment secrets
  if (ENV_PAGARME_API_KEY) {
    console.log('[Pagar.me] Using fallback (Secrets)');
    return {
      apiKey: ENV_PAGARME_API_KEY,
      accountId: ENV_PAGARME_ACCOUNT_ID || '',
      environment: 'sandbox', // Assume sandbox for fallback
      source: 'fallback',
    };
  }

  throw new Error('Pagar.me não configurado. Configure em Sistema → Integrações.');
}

// Check if payment method is enabled for tenant
async function isMethodEnabled(supabase: any, tenantId: string, method: string): Promise<boolean> {
  const { data: paymentMethod } = await supabase
    .from('payment_methods')
    .select('is_enabled')
    .eq('tenant_id', tenantId)
    .eq('method', method)
    .single();

  // If not configured in DB, allow by default (backward compatibility)
  if (!paymentMethod) {
    return true;
  }

  return paymentMethod.is_enabled;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ChargeRequest = await req.json();
    console.log('Creating charge:', { 
      method: payload.method, 
      amount: payload.amount, 
      checkout_id: payload.checkout_id, 
      order_id: payload.order_id,
      tenant_id: payload.tenant_id 
    });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get credentials from database or fallback
    const credentials = await getPagarmeCredentials(supabase, payload.tenant_id);
    console.log(`[Pagar.me] Using ${credentials.source} credentials, environment: ${credentials.environment}`);

    // Check if method is enabled
    const methodEnabled = await isMethodEnabled(supabase, payload.tenant_id, payload.method);
    if (!methodEnabled) {
      throw new Error(`Método de pagamento ${payload.method} não está habilitado`);
    }

    // Use order_id or checkout_id for reference
    const referenceId = payload.order_id || payload.checkout_id || `temp-${Date.now()}`;

    // Build Pagar.me order request
    const orderPayload: any = {
      customer: {
        name: payload.customer.name,
        email: payload.customer.email,
        document: payload.customer.document.replace(/\D/g, ''),
        type: 'individual',
        phones: payload.customer.phone ? {
          mobile_phone: {
            country_code: '55',
            area_code: payload.customer.phone.substring(0, 2),
            number: payload.customer.phone.substring(2).replace(/\D/g, ''),
          }
        } : undefined,
      },
      items: [{
        amount: payload.amount,
        description: 'Pedido',
        quantity: 1,
        code: referenceId,
      }],
      payments: [],
      metadata: {
        checkout_id: payload.checkout_id,
        order_id: payload.order_id,
        tenant_id: payload.tenant_id,
        credential_source: credentials.source,
      },
    };

    // Build payment based on method
    if (payload.method === 'pix') {
      orderPayload.payments.push({
        payment_method: 'pix',
        pix: {
          expires_in: 3600, // 1 hour
        },
      });
    } else if (payload.method === 'boleto') {
      orderPayload.payments.push({
        payment_method: 'boleto',
        boleto: {
          instructions: 'Não receber após o vencimento',
          due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
          document_number: referenceId.substring(0, 16),
          type: 'DM',
        },
      });
    } else if (payload.method === 'credit_card') {
      if (!payload.card) {
        throw new Error('Card data required for credit card payment');
      }
      orderPayload.payments.push({
        payment_method: 'credit_card',
        credit_card: {
          installments: payload.installments || 1,
          card: {
            number: payload.card.number.replace(/\D/g, ''),
            holder_name: payload.card.holder_name,
            exp_month: payload.card.exp_month,
            exp_year: payload.card.exp_year,
            cvv: payload.card.cvv,
            billing_address: payload.billing_address ? {
              line_1: `${payload.billing_address.number}, ${payload.billing_address.street}`,
              line_2: payload.billing_address.complement || '',
              zip_code: payload.billing_address.postal_code.replace(/\D/g, ''),
              city: payload.billing_address.city,
              state: payload.billing_address.state,
              country: payload.billing_address.country || 'BR',
            } : undefined,
          },
        },
      });
    }

    // Call Pagar.me API
    const authHeader = btoa(`${credentials.apiKey}:`);
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const pagarmeResponse = await response.json();
    console.log('Pagar.me response status:', response.status);

    if (!response.ok) {
      console.error('Pagar.me error:', pagarmeResponse);
      throw new Error(pagarmeResponse.message || 'Failed to create charge');
    }

    // Save transaction to database with order_id only
    // Note: checkout_id is NOT used here because it has FK to checkouts table
    // and we're now linking via order_id (FK to orders table)
    const charge = pagarmeResponse.charges?.[0];
    const transactionData = {
      tenant_id: payload.tenant_id,
      order_id: payload.order_id || null, // Link to order for get-order lookup
      checkout_id: null, // Explicitly null - don't use checkout_id as it may cause FK errors
      provider: 'pagarme',
      provider_transaction_id: pagarmeResponse.id,
      method: payload.method,
      status: charge?.status || 'pending',
      amount: payload.amount,
      currency: 'BRL',
      payment_data: {
        order_id: pagarmeResponse.id,
        charge_id: charge?.id,
        credential_source: credentials.source,
        environment: credentials.environment,
        // PIX data
        qr_code: charge?.last_transaction?.qr_code,
        qr_code_url: charge?.last_transaction?.qr_code_url,
        // Boleto data
        boleto_url: charge?.last_transaction?.pdf,
        boleto_barcode: charge?.last_transaction?.line,
        boleto_due_date: charge?.last_transaction?.due_at,
      },
    };
    
    console.log('[Pagar.me] Saving transaction with order_id:', payload.order_id, 'PIX qr_code:', !!charge?.last_transaction?.qr_code);

    const { data: transaction, error: dbError } = await supabase
      .from('payment_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // ==== EMIT CANONICAL EVENT for notifications (pix_generated / boleto_generated) ====
    if (payload.order_id && (payload.method === 'pix' || payload.method === 'boleto')) {
      const eventNewStatus = payload.method === 'pix' ? 'pix_generated' : 'boleto_generated';
      const idempotencyKey = `payment_${eventNewStatus}_${payload.order_id}_${pagarmeResponse.id}`;
      
      // Fetch order details for notification payload
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email, customer_phone, total')
        .eq('id', payload.order_id)
        .single();

      const { error: emitError } = await supabase
        .from('events_inbox')
        .insert({
          tenant_id: payload.tenant_id,
          provider: 'internal',
          event_type: 'payment_status_changed',
          idempotency_key: idempotencyKey,
          occurred_at: new Date().toISOString(),
          payload_normalized: {
            order_id: payload.order_id,
            order_number: orderData?.order_number || '',
            customer_name: orderData?.customer_name || '',
            customer_email: orderData?.customer_email || '',
            customer_phone: orderData?.customer_phone || '',
            order_total: orderData?.total || 0,
            old_status: null,
            new_status: eventNewStatus,
            payment_method: payload.method,
            payment_gateway: 'pagarme',
            pix_link: charge?.last_transaction?.qr_code_url || '',
            boleto_link: charge?.last_transaction?.pdf || '',
          },
          status: 'new',
        });

      if (emitError && !emitError.message?.includes('duplicate')) {
        console.error('[Pagar.me] Error emitting payment event:', emitError);
      } else if (!emitError) {
        console.log(`[Pagar.me] Emitted payment_status_changed event (${eventNewStatus}) for order ${payload.order_id}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transaction_id: transaction?.id,
      provider_id: pagarmeResponse.id,
      status: charge?.status,
      payment_data: transactionData.payment_data,
      credential_source: credentials.source,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error creating charge:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
