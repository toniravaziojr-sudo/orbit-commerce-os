// ============================================
// CREDITS PURCHASE CHECKOUT - Create MP preference for AI credits
// Uses platform MP_ACCESS_TOKEN (admin billing account)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreditCheckoutRequest {
  tenant_id: string;
  package_id: string;
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreditCheckoutRequest = await req.json();
    const { tenant_id, package_id, success_url, cancel_url } = body;

    if (!tenant_id || !package_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing tenant_id or package_id' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user has access to this tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch credit package
    const { data: pkg, error: pkgError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', package_id)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pacote não encontrado ou inativo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Gateway de pagamento não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priceInReais = pkg.price_cents / 100;
    const totalCredits = pkg.credits + (pkg.bonus_credits || 0);
    const idempotencyKey = `credits_${tenant_id}_${package_id}_${Date.now()}`;

    // Create Mercado Pago preference
    const preferenceBody = {
      items: [
        {
          id: pkg.sku || package_id,
          title: `Créditos IA - ${pkg.name}`,
          description: `${totalCredits.toLocaleString('pt-BR')} créditos de IA${pkg.bonus_credits > 0 ? ` (inclui ${pkg.bonus_credits} bônus)` : ''}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: priceInReais,
        }
      ],
      payer: {
        email: user.email,
      },
      metadata: {
        type: 'credit_purchase',
        tenant_id: tenant_id,
        package_id: package_id,
        package_sku: pkg.sku,
        credits: pkg.credits,
        bonus_credits: pkg.bonus_credits || 0,
        user_id: user.id,
        idempotency_key: idempotencyKey,
      },
      back_urls: {
        success: success_url || `https://app.comandocentral.com.br/ai-packages?status=success`,
        failure: cancel_url || `https://app.comandocentral.com.br/ai-packages?status=failure`,
        pending: `https://app.comandocentral.com.br/ai-packages?status=pending`,
      },
      auto_return: 'approved',
      external_reference: `credits|${tenant_id}|${package_id}|${idempotencyKey}`,
      notification_url: `https://app.comandocentral.com.br/integrations/billing/webhook`,
    };

    console.log('[Credits] Creating MP preference for package:', pkg.sku, 'tenant:', tenant_id);

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[Credits] MP error:', mpData);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar checkout', details: mpData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Credits] MP preference created:', mpData.id);

    // Record pending purchase in credit_ledger for tracking
    await supabase
      .from('credit_ledger')
      .insert({
        tenant_id: tenant_id,
        user_id: user.id,
        transaction_type: 'purchase',
        credits_delta: 0, // Will be updated on webhook confirmation
        idempotency_key: idempotencyKey,
        description: `Compra pendente: ${pkg.name} (${totalCredits} créditos)`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: mpData.init_point,
        preference_id: mpData.id,
        package: {
          name: pkg.name,
          credits: pkg.credits,
          bonus_credits: pkg.bonus_credits || 0,
          price_cents: pkg.price_cents,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'system', action: 'credits-purchase-checkout' });
  }
});
