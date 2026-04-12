// ============================================
// MERCADO PAGO CREATE CHARGE - Payment processing for storefront
// Uses tenant payment_providers credentials
// Mirrors pagarme-create-charge architecture
// v2.0 — Canonical price validation (Security Plan v3.1 Phase 2B)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { redactPayloadForLog } from "../_shared/redact-pii.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface ChargeRequest {
  order_id?: string;
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

// Get Mercado Pago credentials from payment_providers table
async function getMercadoPagoCredentials(supabase: any, tenantId: string): Promise<{
  accessToken: string;
  publicKey: string;
}> {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, environment, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'mercado_pago')
    .single();

  if (provider?.is_enabled && provider?.credentials?.access_token) {
    console.log('[MercadoPago] Using tenant credentials from database');
    return {
      accessToken: provider.credentials.access_token,
      publicKey: provider.credentials.public_key || '',
    };
  }

  throw new Error('Mercado Pago não configurado. Configure em Sistema → Integrações → Pagamentos.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ChargeRequest = await req.json();
    console.log('[MercadoPago] Creating charge:', {
      method: payload.method,
      amount: payload.amount,
      order_id: payload.order_id,
      tenant_id: payload.tenant_id,
    });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get credentials
    const credentials = await getMercadoPagoCredentials(supabase, payload.tenant_id);

    // === CANONICAL PRICE AUDIT (Security Plan v3.1 Phase 2B - SIMULATION ONLY) ===
    // Log drift between submitted amount and canonical_total for audit.
    // DO NOT override charge amount — simulation mode only, no enforcement.
    const chargeAmountCents = payload.amount;
    if (payload.order_id) {
      try {
        const { data: orderRecord } = await supabase
          .from('orders')
          .select('canonical_total, total')
          .eq('id', payload.order_id)
          .single();

        if (orderRecord?.canonical_total) {
          const canonicalCents = Math.round(Number(orderRecord.canonical_total) * 100);
          if (canonicalCents !== payload.amount) {
            console.warn(`[MercadoPago][PRICE_AUDIT] ⚠️ DRIFT: submitted=${payload.amount}, canonical=${canonicalCents}, order_total=${Math.round(Number(orderRecord.total) * 100)}`);
          } else {
            console.log(`[MercadoPago][PRICE_AUDIT] ✅ Prices match: ${payload.amount} cents`);
          }
        } else {
          console.log(`[MercadoPago][PRICE_AUDIT] No canonical_total on order — using submitted amount`);
        }
      } catch (auditErr) {
        console.warn('[MercadoPago][PRICE_AUDIT] Non-blocking audit error:', auditErr);
      }
    }

    const referenceId = payload.order_id || `temp-${Date.now()}`;

    // Build Mercado Pago payment request
    const mpPayload: any = {
      transaction_amount: chargeAmountCents / 100, // MP uses decimal (e.g., 10.50)
      description: `Pedido ${referenceId}`,
      external_reference: referenceId,
      payer: {
        email: payload.customer.email,
        first_name: payload.customer.name.split(' ')[0],
        last_name: payload.customer.name.split(' ').slice(1).join(' ') || payload.customer.name.split(' ')[0],
        identification: {
          type: 'CPF',
          number: payload.customer.document.replace(/\D/g, ''),
        },
      },
      metadata: {
        order_id: payload.order_id,
        tenant_id: payload.tenant_id,
      },
    };

    // Fetch tenant payment config for this method
    let pixExpirationMinutes = 60;
    let boletoExpirationDays = 3;
    try {
      const { data: methodConfig } = await supabase
        .from('payment_method_discounts')
        .select('pix_expiration_minutes, boleto_expiration_days')
        .eq('tenant_id', payload.tenant_id)
        .eq('provider', 'mercadopago')
        .eq('payment_method', payload.method)
        .maybeSingle();
      if (methodConfig) {
        if (methodConfig.pix_expiration_minutes) pixExpirationMinutes = methodConfig.pix_expiration_minutes;
        if (methodConfig.boleto_expiration_days) boletoExpirationDays = methodConfig.boleto_expiration_days;
      }
    } catch (cfgErr) {
      console.warn('[MercadoPago] Non-blocking config fetch error, using defaults:', cfgErr);
    }

    // Build payment method specific fields
    if (payload.method === 'pix') {
      mpPayload.payment_method_id = 'pix';
      mpPayload.date_of_expiration = new Date(Date.now() + pixExpirationMinutes * 60 * 1000).toISOString();
    } else if (payload.method === 'boleto') {
      mpPayload.payment_method_id = 'bolbradesco';
      mpPayload.date_of_expiration = new Date(Date.now() + boletoExpirationDays * 24 * 60 * 60 * 1000).toISOString();
    } else if (payload.method === 'credit_card') {
      if (!payload.card) {
        throw new Error('Dados do cartão são obrigatórios para pagamento com cartão');
      }
      // For credit card, we need to create a card token first
      // Using direct card data via /v1/payments
      mpPayload.payment_method_id = 'master'; // Will be auto-detected
      mpPayload.installments = payload.installments || 1;
      mpPayload.token = null; // Will be handled via card tokenization

      // For server-side card processing, use card hash approach
      // Build card data for direct processing
      mpPayload.card = {
        card_number: payload.card.number.replace(/\D/g, ''),
        cardholder: {
          name: payload.card.holder_name,
          identification: {
            type: 'CPF',
            number: payload.customer.document.replace(/\D/g, ''),
          },
        },
        expiration_month: payload.card.exp_month,
        expiration_year: payload.card.exp_year,
        security_code: payload.card.cvv,
      };
      // Remove payment_method_id - let MP auto-detect from card number
      delete mpPayload.payment_method_id;
    }

    // Add address if provided
    if (payload.billing_address) {
      mpPayload.payer.address = {
        zip_code: payload.billing_address.postal_code.replace(/\D/g, ''),
        street_name: payload.billing_address.street,
        street_number: payload.billing_address.number,
        neighborhood: payload.billing_address.neighborhood,
        city: payload.billing_address.city,
        federal_unit: payload.billing_address.state,
      };
    }

    // Call Mercado Pago API
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${payload.tenant_id}_${referenceId}_${Date.now()}`,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpResponse = await response.json();
    console.log('[MercadoPago] Response status:', response.status);
    // PCI-safe: redact card/token data before logging
    console.log('[MercadoPago] Response (redacted):', JSON.stringify(redactPayloadForLog(mpResponse), null, 2));

    if (!response.ok) {
      console.error('[MercadoPago] API error:', JSON.stringify(mpResponse));
      const errorMessage = mpResponse.message || mpResponse.cause?.[0]?.description || 'Erro ao processar pagamento';
      throw new Error(errorMessage);
    }

    // Map MP status to internal status
    let internalStatus = 'pending';
    if (mpResponse.status === 'approved') {
      internalStatus = 'paid';
    } else if (mpResponse.status === 'rejected') {
      internalStatus = 'failed';
    } else if (mpResponse.status === 'cancelled') {
      internalStatus = 'canceled';
    } else if (mpResponse.status === 'in_process' || mpResponse.status === 'pending') {
      internalStatus = 'pending';
    }

    // Extract payment-specific data
    const paymentData: Record<string, any> = {
      mp_payment_id: mpResponse.id,
      mp_status: mpResponse.status,
      mp_status_detail: mpResponse.status_detail,
    };

    if (payload.method === 'pix') {
      const pixData = mpResponse.point_of_interaction?.transaction_data;
      paymentData.qr_code = pixData?.qr_code;
      paymentData.qr_code_url = pixData?.qr_code_base64;
      paymentData.ticket_url = pixData?.ticket_url;
      paymentData.expires_at = mpResponse.date_of_expiration;
    } else if (payload.method === 'boleto') {
      paymentData.boleto_url = mpResponse.transaction_details?.external_resource_url;
      paymentData.boleto_barcode = mpResponse.barcode?.content;
      paymentData.boleto_due_date = mpResponse.date_of_expiration;
    }

    // Build error_message for failed payments
    let errorMessage: string | null = null;
    if (internalStatus === 'failed') {
      const statusDetail = mpResponse.status_detail || '';
      const failureReasonMap: Record<string, string> = {
        'cc_rejected_bad_filled_card_number': 'Número do cartão inválido',
        'cc_rejected_bad_filled_date': 'Data de validade inválida',
        'cc_rejected_bad_filled_other': 'Dados do cartão incorretos',
        'cc_rejected_bad_filled_security_code': 'Código de segurança inválido',
        'cc_rejected_blacklist': 'Cartão não aceito',
        'cc_rejected_call_for_authorize': 'Ligue para a operadora do cartão para autorizar',
        'cc_rejected_card_disabled': 'Cartão desabilitado',
        'cc_rejected_duplicated_payment': 'Pagamento duplicado',
        'cc_rejected_high_risk': 'Pagamento recusado por segurança',
        'cc_rejected_insufficient_amount': 'Saldo insuficiente',
        'cc_rejected_max_attempts': 'Limite de tentativas excedido',
        'cc_rejected_other_reason': 'Pagamento recusado pela operadora',
      };
      errorMessage = failureReasonMap[statusDetail] || statusDetail || 'Pagamento recusado';
    }

    // Save transaction to database
    const transactionData = {
      tenant_id: payload.tenant_id,
      order_id: payload.order_id || null,
      checkout_id: null,
      provider: 'mercadopago',
      provider_transaction_id: String(mpResponse.id),
      method: payload.method,
      status: internalStatus,
      amount: chargeAmountCents,
      currency: 'BRL',
      error_message: errorMessage,
      payment_data: paymentData,
    };

    console.log('[MercadoPago] Saving transaction with order_id:', payload.order_id);

    const { data: transaction, error: dbError } = await supabase
      .from('payment_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (dbError) {
      console.error('[MercadoPago] Database error:', dbError);
    }

    // ==== SYNC ORDER STATUS for synchronous payments ====
    if (payload.order_id && internalStatus) {
      const orderUpdate: Record<string, any> = { updated_at: new Date().toISOString() };

      if (internalStatus === 'paid') {
        orderUpdate.payment_status = 'approved';
        orderUpdate.status = 'paid';
        orderUpdate.paid_at = new Date().toISOString();
        orderUpdate.payment_gateway = 'mercadopago';
        orderUpdate.payment_gateway_id = String(mpResponse.id);
        console.log(`[MercadoPago] Syncing order ${payload.order_id} → paid`);
      } else if (internalStatus === 'failed') {
        orderUpdate.payment_status = 'declined';
        orderUpdate.payment_gateway = 'mercadopago';
        orderUpdate.payment_gateway_id = String(mpResponse.id);
        console.log(`[MercadoPago] Syncing order ${payload.order_id} → declined`);
      } else if (internalStatus === 'pending') {
        orderUpdate.payment_status = 'pending';
        orderUpdate.status = 'awaiting_payment';
        orderUpdate.payment_gateway = 'mercadopago';
        orderUpdate.payment_gateway_id = String(mpResponse.id);
        console.log(`[MercadoPago] Syncing order ${payload.order_id} → awaiting_payment`);
      }

      if (Object.keys(orderUpdate).length > 1) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update(orderUpdate)
          .eq('id', payload.order_id);

        if (orderUpdateError) {
          console.error('[MercadoPago] Error syncing order status:', orderUpdateError);
        }
      }
    }

    // ==== EMIT CANONICAL EVENT for notifications ====
    if (payload.order_id && (payload.method === 'pix' || payload.method === 'boleto')) {
      const eventNewStatus = payload.method === 'pix' ? 'pix_generated' : 'boleto_generated';
      const idempotencyKey = `payment_${eventNewStatus}_${payload.order_id}_${mpResponse.id}`;

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
            payment_gateway: 'mercadopago',
            pix_link: paymentData.ticket_url || paymentData.qr_code_url || '',
            boleto_link: paymentData.boleto_url || '',
          },
          status: 'new',
        });

      if (emitError && !emitError.message?.includes('duplicate')) {
        console.error('[MercadoPago] Error emitting payment event:', emitError);
      }
    }

    // If charge failed, return error
    if (internalStatus === 'failed') {
      const statusDetail = mpResponse.status_detail || 'Pagamento recusado';
      const failureReasons: Record<string, string> = {
        'cc_rejected_bad_filled_card_number': 'Número do cartão inválido',
        'cc_rejected_bad_filled_date': 'Data de validade inválida',
        'cc_rejected_bad_filled_other': 'Dados do cartão incorretos',
        'cc_rejected_bad_filled_security_code': 'Código de segurança inválido',
        'cc_rejected_blacklist': 'Cartão não aceito. Use outro cartão.',
        'cc_rejected_call_for_authorize': 'Ligue para a operadora do cartão para autorizar',
        'cc_rejected_card_disabled': 'Cartão desabilitado. Ligue para a operadora.',
        'cc_rejected_duplicated_payment': 'Pagamento duplicado. Tente novamente em alguns minutos.',
        'cc_rejected_high_risk': 'Pagamento recusado por segurança. Use outro cartão.',
        'cc_rejected_insufficient_amount': 'Saldo insuficiente',
        'cc_rejected_max_attempts': 'Limite de tentativas excedido. Use outro cartão.',
        'cc_rejected_other_reason': 'Pagamento recusado pela operadora',
      };

      return new Response(JSON.stringify({
        success: false,
        error: failureReasons[statusDetail] || statusDetail,
        status: 'failed',
        transaction_id: transaction?.id,
        provider_id: mpResponse.id,
        payment_data: paymentData,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transaction_id: transaction?.id,
      provider_id: mpResponse.id,
      status: internalStatus,
      payment_data: paymentData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[MercadoPago] Error creating charge:', error);
    return new Response(JSON.stringify({
      success: false,
      error: "Erro interno" || 'Erro desconhecido',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
