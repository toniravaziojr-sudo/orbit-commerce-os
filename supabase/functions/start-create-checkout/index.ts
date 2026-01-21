import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateCheckoutRequest {
  plan_key: string;
  cycle: 'monthly' | 'annual';
  email: string;
  owner_name: string;
  store_name: string;
  phone?: string;
  slug?: string;
  utm?: Record<string, string>;
  test_token?: string; // Required for test10 plan
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateCheckoutRequest = await req.json();
    const { plan_key, cycle, email, owner_name, store_name, phone, utm, test_token } = body;
    const billingTestToken = Deno.env.get('BILLING_TEST_TOKEN');

    // Validações
    if (!plan_key || !cycle || !email || !owner_name || !store_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: plan_key, cycle, email, owner_name, store_name' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // Verificar se plano existe e está ativo
    const { data: plan, error: planError } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('plan_key', plan_key)
      .eq('is_active', true)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ success: false, error: 'Plano não encontrado ou inativo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: test10 plan requires valid test_token and monthly cycle only
    if (plan_key === 'test10') {
      if (!billingTestToken || test_token !== billingTestToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'Plano de teste indisponível. Token inválido.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (cycle !== 'monthly') {
        return new Response(
          JSON.stringify({ success: false, error: 'Plano de teste só está disponível no ciclo mensal.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Block non-public plans without test_token (except test10 which is handled above)
    if (!plan.is_public && plan_key !== 'test10') {
      return new Response(
        JSON.stringify({ success: false, error: 'Plano indisponível' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já existe checkout pendente para este email COM O MESMO PLANO E CICLO
    const { data: existingSession } = await supabase
      .from('billing_checkout_sessions')
      .select('id, status, mp_init_point, plan_key, billing_cycle')
      .eq('email', normalizedEmail)
      .eq('plan_key', plan_key)
      .eq('billing_cycle', cycle)
      .in('status', ['pending_payment'])
      .maybeSingle();

    if (existingSession?.mp_init_point) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          session_id: existingSession.id,
          init_point: existingSession.mp_init_point,
          message: 'Checkout existente recuperado'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar slug único
    let slug = body.slug || generateSlug(store_name);
    const { data: existingSlug } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Gerar external_reference único (MUST start with bcs_ for webhook to recognize)
    const externalReference: string = `bcs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Criar session no banco
    const { data: session, error: sessionError } = await supabase
      .from('billing_checkout_sessions')
      .insert({
        plan_key,
        billing_cycle: cycle,
        email: normalizedEmail,
        owner_name,
        store_name,
        phone: phone || null,
        slug,
        utm: utm || {},
        mp_external_reference: externalReference,
        status: 'pending_payment',
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar sessão de checkout' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular preço
    const price = cycle === 'annual' ? plan.price_annual_cents : plan.price_monthly_cents;
    const priceInReais = price / 100;

    // Criar preferência no Mercado Pago
    const appUrl = Deno.env.get('APP_URL') || 'https://app.comandocentral.com.br';
    
    const preferencePayload = {
      items: [{
        id: plan_key,
        title: `${plan.name} - ${cycle === 'annual' ? 'Anual' : 'Mensal'}`,
        description: plan.description || `Assinatura ${plan.name}`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: priceInReais,
      }],
      payer: {
        email: normalizedEmail,
        name: owner_name,
      },
      external_reference: externalReference,
      metadata: {
        session_id: session.id,
        plan_key,
        cycle,
        email: normalizedEmail,
        store_name,
      },
      back_urls: {
        success: `${appUrl}/start/pending?session=${session.id}`,
        failure: `${appUrl}/start/info?error=payment_failed`,
        pending: `${appUrl}/start/pending?session=${session.id}`,
      },
      auto_return: 'approved',
      notification_url: `https://app.comandocentral.com.br/integrations/billing/webhook`,
      statement_descriptor: 'COMANDOCENTRAL',
    };

    console.log('Creating MP preference:', JSON.stringify(preferencePayload, null, 2));

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text();
      console.error('MP error:', mpError);
      
      await supabase
        .from('billing_checkout_sessions')
        .update({ status: 'failed', error_message: mpError })
        .eq('id', session.id);

      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar checkout no gateway de pagamento' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpPreference = await mpResponse.json();
    console.log('MP preference created:', mpPreference.id);

    // Atualizar session com init_point
    await supabase
      .from('billing_checkout_sessions')
      .update({ mp_init_point: mpPreference.init_point })
      .eq('id', session.id);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        init_point: mpPreference.init_point,
        sandbox_init_point: mpPreference.sandbox_init_point,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
