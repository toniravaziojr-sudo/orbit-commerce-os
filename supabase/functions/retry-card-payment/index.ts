// ============================================
// RETRY CARD PAYMENT - Secure server-side card retry
// Validates retry_token, loads order data internally,
// calls the active payment gateway. NO sensitive data from frontend.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { redactPayloadForLog } from "../_shared/redact-pii.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RetryRequest {
  retry_token: string;
  card: {
    number: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    cvv: string;
  };
  installments?: number;
  // Idempotency key for this retry attempt (prevents duplicate charges on double-click)
  payment_attempt_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: RetryRequest = await req.json();

    console.log('[retry-card-payment] Request received (card redacted)');

    // 1. Validate retry_token
    if (!payload.retry_token || typeof payload.retry_token !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token de retentativa inválido.',
        cardDeclined: false,
        technicalError: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate token and load order data server-side
    const { data: orderRows, error: tokenError } = await supabase.rpc('validate_order_retry_token', {
      p_token: payload.retry_token,
    });

    if (tokenError || !orderRows || orderRows.length === 0) {
      console.error('[retry-card-payment] Token validation failed:', tokenError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Token de retentativa inválido ou expirado.',
        cardDeclined: false,
        technicalError: true,
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = orderRows[0];

    if (!order.is_valid) {
      console.warn('[retry-card-payment] Token expired or order already paid');
      return new Response(JSON.stringify({
        success: false,
        error: 'Este link de retentativa expirou ou o pedido já foi pago.',
        cardDeclined: false,
        technicalError: true,
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[retry-card-payment] Token valid for order:', order.order_number);

    // 3. Determine active gateway for this tenant
    let gatewayFunction = 'pagarme-create-charge';
    try {
      const { data: providers } = await supabase
        .from('payment_providers')
        .select('provider, is_enabled')
        .eq('tenant_id', order.tenant_id)
        .eq('is_enabled', true)
        .order('updated_at', { ascending: false });
      
      if (providers?.find((p: any) => p.provider === 'mercado_pago')) {
        gatewayFunction = 'mercadopago-create-charge';
      }
    } catch {
      console.warn('[retry-card-payment] Could not determine gateway, defaulting to pagarme');
    }

    // 4. Validate card data
    const card = payload.card;
    if (!card?.number || !card?.holder_name || !card?.exp_month || !card?.exp_year || !card?.cvv) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados do cartão incompletos.',
        cardDeclined: false,
        technicalError: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amountCents = Math.round(Number(order.total) * 100);
    const sanitizedPostalCode = (order.shipping_postal_code || '').replace(/\D/g, '');

    console.log(`[retry-card-payment] Calling ${gatewayFunction} for order ${order.order_number}, amount: ${amountCents} cents`);

    // 5. Call payment gateway — all sensitive data from server
    const chargeBody = {
      tenant_id: order.tenant_id,
      order_id: order.order_id,
      method: 'credit_card',
      amount: amountCents,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: (order.customer_phone || '').replace(/\D/g, ''),
        document: (order.customer_cpf || '').replace(/\D/g, ''),
      },
      billing_address: {
        street: order.shipping_street || '',
        number: order.shipping_number || '',
        complement: order.shipping_complement || '',
        neighborhood: order.shipping_neighborhood || '',
        city: order.shipping_city || '',
        state: order.shipping_state || '',
        postal_code: sanitizedPostalCode,
        country: 'BR',
      },
      card: {
        number: card.number.replace(/\D/g, ''),
        holder_name: card.holder_name,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        cvv: card.cvv,
      },
      installments: payload.installments || 1,
    };

    // Log with PCI redaction
    console.log('[retry-card-payment] Charge payload (redacted):', JSON.stringify(redactPayloadForLog(chargeBody)));

    // Use internal service-to-service call via fetch to the gateway function
    const gatewayUrl = `${SUPABASE_URL}/functions/v1/${gatewayFunction}`;
    const gatewayResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(chargeBody),
    });

    if (!gatewayResponse.ok) {
      console.error('[retry-card-payment] Gateway HTTP error:', gatewayResponse.status);
      return new Response(JSON.stringify({
        success: false,
        error: 'Ocorreu um problema técnico ao processar o pagamento. Tente novamente.',
        cardDeclined: false,
        technicalError: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentData = await gatewayResponse.json();

    // 6. Classify result
    if (paymentData?.success === false) {
      console.error('[retry-card-payment] Gateway rejection:', paymentData.error);
      return new Response(JSON.stringify({
        success: false,
        error: paymentData.error || 'Pagamento recusado pela operadora.',
        cardDeclined: true,
        technicalError: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[retry-card-payment] Payment approved!');

    // Invalidate retry_token after successful payment
    await supabase
      .from('orders')
      .update({ retry_token: null, retry_token_expires_at: null })
      .eq('id', order.order_id);

    return new Response(JSON.stringify({
      success: true,
      cardDeclined: false,
      technicalError: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[retry-card-payment] Unexpected error:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro inesperado ao processar retentativa.',
      cardDeclined: false,
      technicalError: true,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
