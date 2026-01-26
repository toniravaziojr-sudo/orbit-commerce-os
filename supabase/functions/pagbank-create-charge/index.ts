// ============================================
// PAGBANK CREATE CHARGE - Payment processing via PagBank (PagSeguro)
// Supports PIX, Boleto, Credit Card (with installments)
// Uses API de Pedidos (Orders)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// PagBank API URLs
const PAGBANK_API_URL_SANDBOX = 'https://sandbox.api.pagseguro.com';
const PAGBANK_API_URL_PRODUCTION = 'https://api.pagseguro.com';

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
    encrypted?: string; // PagBank encrypted card
  };
  installments?: number;
}

// Get PagBank credentials from database
async function getPagbankCredentials(supabase: any, tenantId: string): Promise<{
  token: string;
  email: string;
  environment: 'sandbox' | 'production';
  source: 'database';
}> {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, environment, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pagbank')
    .single();

  if (provider?.is_enabled && provider?.credentials?.token) {
    console.log('[PagBank] Using database credentials');
    return {
      token: provider.credentials.token,
      email: provider.credentials.email || '',
      environment: provider.environment || 'sandbox',
      source: 'database',
    };
  }

  throw new Error('PagBank não configurado. Configure em Sistema → Integrações → Pagamentos.');
}

// Format phone for PagBank (DDI + DDD + number)
function formatPhone(phone: string | undefined): { country: string; area: string; number: string } | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) return undefined;
  
  return {
    country: '55',
    area: cleaned.substring(0, 2),
    number: cleaned.substring(2),
  };
}

// Format CPF for PagBank
function formatCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ChargeRequest = await req.json();
    console.log('[PagBank] Creating charge:', { 
      method: payload.method, 
      amount: payload.amount, 
      order_id: payload.order_id,
      tenant_id: payload.tenant_id 
    });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get credentials from database
    const credentials = await getPagbankCredentials(supabase, payload.tenant_id);
    const apiUrl = credentials.environment === 'production' 
      ? PAGBANK_API_URL_PRODUCTION 
      : PAGBANK_API_URL_SANDBOX;

    console.log(`[PagBank] Environment: ${credentials.environment}, API: ${apiUrl}`);

    // Generate unique reference for idempotency
    const referenceId = payload.order_id || `order-${Date.now()}`;
    const notificationUrl = `${SUPABASE_URL}/functions/v1/pagbank-webhook`;

    // Build PagBank order payload
    const orderPayload: any = {
      reference_id: referenceId,
      customer: {
        name: payload.customer.name,
        email: payload.customer.email,
        tax_id: formatCpf(payload.customer.document),
        phones: payload.customer.phone ? [
          {
            country: '55',
            area: payload.customer.phone.replace(/\D/g, '').substring(0, 2),
            number: payload.customer.phone.replace(/\D/g, '').substring(2),
            type: 'MOBILE',
          }
        ] : undefined,
      },
      items: [
        {
          reference_id: referenceId,
          name: 'Pedido',
          quantity: 1,
          unit_amount: payload.amount,
        }
      ],
      notification_urls: [notificationUrl],
    };

    // Add QR Code (PIX) configuration
    if (payload.method === 'pix') {
      orderPayload.qr_codes = [
        {
          amount: {
            value: payload.amount,
          },
          expiration_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        }
      ];
    }

    // Add Boleto configuration
    if (payload.method === 'boleto') {
      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      orderPayload.charges = [
        {
          reference_id: referenceId,
          description: 'Pagamento do pedido',
          amount: {
            value: payload.amount,
            currency: 'BRL',
          },
          payment_method: {
            type: 'BOLETO',
            boleto: {
              due_date: dueDate.toISOString().split('T')[0],
              instruction_lines: {
                line_1: 'Não receber após o vencimento',
                line_2: 'Pagamento referente ao pedido ' + referenceId,
              },
              holder: {
                name: payload.customer.name,
                tax_id: formatCpf(payload.customer.document),
                email: payload.customer.email,
                address: payload.billing_address ? {
                  street: payload.billing_address.street,
                  number: payload.billing_address.number,
                  complement: payload.billing_address.complement || '',
                  locality: payload.billing_address.neighborhood,
                  city: payload.billing_address.city,
                  region_code: payload.billing_address.state,
                  country: 'BRA',
                  postal_code: payload.billing_address.postal_code.replace(/\D/g, ''),
                } : undefined,
              },
            },
          },
        }
      ];
    }

    // Add Credit Card configuration
    if (payload.method === 'credit_card') {
      if (!payload.card) {
        throw new Error('Dados do cartão são obrigatórios');
      }

      orderPayload.charges = [
        {
          reference_id: referenceId,
          description: 'Pagamento do pedido',
          amount: {
            value: payload.amount,
            currency: 'BRL',
          },
          payment_method: {
            type: 'CREDIT_CARD',
            installments: payload.installments || 1,
            capture: true,
            card: payload.card?.encrypted ? {
              encrypted: payload.card.encrypted,
            } : {
              number: payload.card!.number.replace(/\D/g, ''),
              exp_month: String(payload.card!.exp_month).padStart(2, '0'),
              exp_year: String(payload.card!.exp_year),
              security_code: payload.card!.cvv,
              holder: {
                name: payload.card!.holder_name,
              },
            },
          },
        }
      ];
    }

    // Call PagBank Orders API
    console.log('[PagBank] Calling API:', `${apiUrl}/orders`);
    const response = await fetch(`${apiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': referenceId,
      },
      body: JSON.stringify(orderPayload),
    });

    const pagbankResponse = await response.json();
    console.log('[PagBank] Response status:', response.status);

    if (!response.ok) {
      console.error('[PagBank] Error:', JSON.stringify(pagbankResponse, null, 2));
      const errorMsg = pagbankResponse.error_messages?.[0]?.description 
        || pagbankResponse.message 
        || 'Erro ao processar pagamento';
      throw new Error(errorMsg);
    }

    console.log('[PagBank] Order created:', pagbankResponse.id);

    // Extract payment data based on method
    let paymentData: any = {
      order_id: pagbankResponse.id,
      reference_id: referenceId,
      credential_source: credentials.source,
      environment: credentials.environment,
    };

    // PIX data
    if (payload.method === 'pix' && pagbankResponse.qr_codes?.length > 0) {
      const qrCode = pagbankResponse.qr_codes[0];
      paymentData.qr_code = qrCode.text;
      paymentData.qr_code_url = qrCode.links?.find((l: any) => l.media === 'image/png')?.href;
      paymentData.expires_at = qrCode.expiration_date;
    }

    // Boleto data
    if (payload.method === 'boleto' && pagbankResponse.charges?.length > 0) {
      const charge = pagbankResponse.charges[0];
      const boleto = charge.payment_method?.boleto;
      paymentData.charge_id = charge.id;
      paymentData.boleto_barcode = boleto?.barcode;
      paymentData.boleto_url = charge.links?.find((l: any) => l.rel === 'SELF')?.href;
      paymentData.boleto_due_date = boleto?.due_date;
    }

    // Credit Card data
    if (payload.method === 'credit_card' && pagbankResponse.charges?.length > 0) {
      const charge = pagbankResponse.charges[0];
      paymentData.charge_id = charge.id;
      paymentData.card_status = charge.status;
      paymentData.installments = charge.payment_method?.installments;
    }

    // Determine status
    let status = 'pending';
    if (pagbankResponse.charges?.length > 0) {
      const chargeStatus = pagbankResponse.charges[0].status;
      if (chargeStatus === 'PAID') status = 'paid';
      else if (chargeStatus === 'DECLINED') status = 'failed';
      else if (chargeStatus === 'CANCELED') status = 'cancelled';
    }

    // Save transaction to database
    const transactionData = {
      tenant_id: payload.tenant_id,
      order_id: payload.order_id || null,
      checkout_id: null,
      provider: 'pagbank',
      provider_transaction_id: pagbankResponse.id,
      method: payload.method,
      status: status,
      amount: payload.amount,
      currency: 'BRL',
      payment_data: paymentData,
    };

    const { data: transaction, error: dbError } = await supabase
      .from('payment_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (dbError) {
      console.error('[PagBank] Database error:', dbError);
    }

    // Emit event for notifications (pix_generated / boleto_generated)
    if (payload.order_id && (payload.method === 'pix' || payload.method === 'boleto')) {
      const eventNewStatus = payload.method === 'pix' ? 'pix_generated' : 'boleto_generated';
      const idempotencyKey = `payment_${eventNewStatus}_${payload.order_id}_${pagbankResponse.id}`;
      
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email, customer_phone, total')
        .eq('id', payload.order_id)
        .single();

      await supabase
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
            payment_gateway: 'pagbank',
            pix_link: paymentData.qr_code_url || '',
            boleto_link: paymentData.boleto_url || '',
          },
          status: 'new',
        });

      console.log(`[PagBank] Emitted payment_status_changed event (${eventNewStatus})`);
    }

    return new Response(JSON.stringify({
      success: true,
      transaction_id: transaction?.id,
      provider_id: pagbankResponse.id,
      status: status,
      payment_data: paymentData,
      credential_source: credentials.source,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[PagBank] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro desconhecido'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
