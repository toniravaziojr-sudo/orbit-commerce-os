import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CheckoutRequest {
  tenantId: string;
  plan_key: string;
  cycle: 'monthly' | 'annual';
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CheckoutRequest = await req.json();
    const { tenantId, plan_key, cycle, success_url, cancel_url } = body;

    if (!tenantId || !plan_key || !cycle) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields', code: 'MISSING_FIELDS' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user has owner/admin role for this tenant
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied - owner/admin required', code: 'ACCESS_DENIED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('plan_key', plan_key)
      .eq('is_active', true)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ success: false, error: 'Plan not found or inactive', code: 'PLAN_NOT_FOUND' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name, slug')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant not found', code: 'TENANT_NOT_FOUND' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FREE plan - activate immediately without MP
    if (plan_key === 'free') {
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: upsertError } = await supabase
        .from('tenant_subscriptions')
        .upsert({
          tenant_id: tenantId,
          plan_key: 'free',
          billing_cycle: cycle,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          mp_preapproval_id: null,
          mp_customer_id: null,
          updated_at: now.toISOString(),
        }, { onConflict: 'tenant_id' });

      if (upsertError) {
        console.error('Error activating free plan:', upsertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to activate plan', code: 'DB_ERROR' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, plan_key: 'free', status: 'active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PAID plan - create Mercado Pago checkout
    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment gateway not configured', code: 'MP_NOT_CONFIGURED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priceInCents = cycle === 'annual' ? plan.price_annual_cents : plan.price_monthly_cents;
    const priceInReais = priceInCents / 100;

    // Create Mercado Pago preference (checkout)
    const preferenceBody = {
      items: [
        {
          id: `${plan_key}-${cycle}`,
          title: `${plan.name} - ${cycle === 'annual' ? 'Anual' : 'Mensal'}`,
          description: plan.description || `Plano ${plan.name} do Comando Central`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: priceInReais,
        }
      ],
      payer: {
        email: user.email,
      },
      metadata: {
        tenant_id: tenantId,
        plan_key: plan_key,
        cycle: cycle,
        user_id: user.id,
      },
      back_urls: {
        success: success_url || `${supabaseUrl.replace('.supabase.co', '')}/settings/billing?status=success`,
        failure: cancel_url || `${supabaseUrl.replace('.supabase.co', '')}/settings/billing?status=failure`,
        pending: `${supabaseUrl.replace('.supabase.co', '')}/settings/billing?status=pending`,
      },
      auto_return: 'approved',
      external_reference: `${tenantId}|${plan_key}|${cycle}`,
      notification_url: `https://app.comandocentral.com.br/integrations/billing/webhook`,
    };

    console.log('Creating MP preference:', JSON.stringify(preferenceBody, null, 2));

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
      console.error('Mercado Pago error:', mpData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create checkout', code: 'MP_ERROR', details: mpData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('MP preference created:', mpData.id);

    // Update subscription to pending status
    await supabase
      .from('tenant_subscriptions')
      .upsert({
        tenant_id: tenantId,
        plan_key: plan_key,
        billing_cycle: cycle,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: mpData.init_point,
        preference_id: mpData.id,
        plan_key: plan_key,
        cycle: cycle,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
