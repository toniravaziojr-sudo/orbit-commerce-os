// ============================================
// MERCADO PAGO CREATE PREFERENCE - Redirect checkout flow
// Creates an MP checkout preference and returns the redirect URL
// Order is NOT created here - it will be created by the webhook
// after MP confirms payment
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function getMercadoPagoCredentials(supabase: any, tenantId: string) {
  const { data: provider } = await supabase
    .from('payment_providers')
    .select('credentials, environment, is_enabled')
    .eq('tenant_id', tenantId)
    .or("provider.eq.mercado_pago,provider.eq.mercadopago")
    .eq('is_enabled', true)
    .single();

  if (!provider) throw new Error('Mercado Pago não configurado para este tenant');

  const creds = provider.credentials || {};
  const accessToken = provider.environment === 'production'
    ? creds.production_access_token || creds.access_token
    : creds.sandbox_access_token || creds.access_token;

  if (!accessToken) throw new Error('Access token do Mercado Pago não encontrado');

  return { accessToken };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      tenant_id,
      checkout_session_id,
      customer,
      shipping,
      items,
      subtotal,
      shipping_total,
      discount_total,
      payment_method_discount,
      total,
      discount,
      attribution,
      affiliate,
      shipping_quote_id,
      checkout_attempt_id,
    } = body;

    if (!tenant_id || !items || !customer) {
      return errorResponse('Dados obrigatórios não fornecidos', 400, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { accessToken } = await getMercadoPagoCredentials(supabase, tenant_id);

    // Get tenant info for back_urls
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug, name')
      .eq('id', tenant_id)
      .single();

    // Get custom domain if exists
    const { data: domainData } = await supabase
      .from('tenant_domains')
      .select('domain, status')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .limit(1)
      .single();

    const slug = tenant?.slug || '';
    const baseUrl = domainData?.domain 
      ? `https://${domainData.domain}`
      : `https://${slug}.comandocentral.com.br`;

    // Store pending checkout data so webhook can create the order
    const pendingId = crypto.randomUUID();
    await supabase.from('mp_pending_checkouts' as any).insert({
      id: pendingId,
      tenant_id,
      checkout_session_id,
      customer_data: customer,
      shipping_data: shipping,
      items_data: items,
      subtotal,
      shipping_total,
      discount_total,
      payment_method_discount: payment_method_discount || 0,
      total,
      discount_data: discount || null,
      attribution_data: attribution || null,
      affiliate_data: affiliate || null,
      shipping_quote_id: shipping_quote_id || null,
      checkout_attempt_id: checkout_attempt_id || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    } as any);

    // Build MP preference
    const mpItems = items.map((item: any) => ({
      id: item.product_id,
      title: item.product_name || 'Produto',
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      currency_id: 'BRL',
    }));

    // Add shipping as an item if > 0
    if (shipping_total > 0) {
      mpItems.push({
        id: 'shipping',
        title: 'Frete',
        quantity: 1,
        unit_price: Number(shipping_total),
        currency_id: 'BRL',
      });
    }

    // If there's a discount, add as negative item or adjust
    const totalDiscount = (discount_total || 0) + (payment_method_discount || 0);
    if (totalDiscount > 0) {
      mpItems.push({
        id: 'discount',
        title: 'Desconto',
        quantity: 1,
        unit_price: -Number(totalDiscount),
        currency_id: 'BRL',
      });
    }

    const preference = {
      items: mpItems,
      payer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone ? {
          number: customer.phone.replace(/\D/g, ''),
        } : undefined,
        identification: customer.cpf ? {
          type: 'CPF',
          number: customer.cpf.replace(/\D/g, ''),
        } : undefined,
      },
      back_urls: {
        success: `${baseUrl}/obrigado?mp_checkout=${pendingId}&status=approved`,
        failure: `${baseUrl}/checkout?mp_status=failure`,
        pending: `${baseUrl}/obrigado?mp_checkout=${pendingId}&status=pending`,
      },
      auto_return: 'approved',
      external_reference: pendingId,
      statement_descriptor: (tenant?.name || 'Loja').substring(0, 22),
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-storefront-webhook`,
    };

    console.log('[MP Preference] Creating preference for tenant:', tenant_id, 'pendingId:', pendingId);

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      const errBody = await mpResponse.text();
      console.error('[MP Preference] Error:', mpResponse.status, errBody);
      return errorResponse('Erro ao criar checkout do Mercado Pago', 500, corsHeaders);
    }

    const mpData = await mpResponse.json();
    console.log('[MP Preference] Created:', mpData.id, 'init_point:', mpData.init_point?.substring(0, 60));

    // Update pending checkout with MP preference ID
    await supabase.from('mp_pending_checkouts' as any)
      .update({ mp_preference_id: mpData.id } as any)
      .eq('id', pendingId);

    return new Response(JSON.stringify({
      success: true,
      init_point: mpData.init_point,
      redirect_url: mpData.init_point,
      pending_checkout_id: pendingId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MP Preference] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno',
      500,
      corsHeaders,
    );
  }
});
