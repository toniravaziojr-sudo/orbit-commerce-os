import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActivationRequest {
  tenant_id: string;
  plan_key: string;
  payment_method_type: 'card' | 'pix_validation';
  card_data?: {
    number: string;
    holder_name: string;
    exp_month: string;
    exp_year: string;
    cvv: string;
  };
  addons?: Array<{
    addon_key: string;
    name: string;
    price_cents: number;
  }>;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar usuário autenticado
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ActivationRequest = await req.json();
    const { tenant_id, plan_key, payment_method_type, card_data, addons, utm } = body;

    console.log(`[billing-activate] Ativando plano ${plan_key} para tenant ${tenant_id}`);

    // Verificar se o plano existe
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('plan_key', plan_key)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ success: false, error: 'Plano não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Plano custom não pode ser ativado automaticamente
    if (plan.is_custom) {
      return new Response(
        JSON.stringify({ success: false, error: 'Plano custom requer contato comercial' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário pertence ao tenant
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para ativar plano neste tenant' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let subscriptionStatus: 'pending_payment_method' | 'active' = 'pending_payment_method';
    let cardLastFour: string | null = null;
    let cardBrand: string | null = null;
    let providerCustomerId: string | null = null;
    let pixValidationId: string | null = null;

    // Processar método de pagamento
    if (payment_method_type === 'card' && card_data) {
      // Integrar com Pagar.me para validar cartão
      const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
      
      if (pagarmeApiKey) {
        try {
          // Criar customer no Pagar.me
          const customerResponse = await fetch('https://api.pagar.me/core/v5/customers', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: card_data.holder_name,
              email: user.email,
              type: 'individual',
            }),
          });

          if (customerResponse.ok) {
            const customer = await customerResponse.json();
            providerCustomerId = customer.id;
            
            // Criar card no Pagar.me
            const cardResponse = await fetch(`https://api.pagar.me/core/v5/customers/${customer.id}/cards`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: card_data.number.replace(/\s/g, ''),
                holder_name: card_data.holder_name,
                exp_month: parseInt(card_data.exp_month),
                exp_year: parseInt(card_data.exp_year),
                cvv: card_data.cvv,
              }),
            });

            if (cardResponse.ok) {
              const card = await cardResponse.json();
              cardLastFour = card.last_four_digits;
              cardBrand = card.brand;
              subscriptionStatus = 'active';
              console.log(`[billing-activate] Cartão validado: ${cardBrand} ****${cardLastFour}`);
            } else {
              const cardError = await cardResponse.text();
              console.error('[billing-activate] Erro ao criar cartão:', cardError);
              return new Response(
                JSON.stringify({ success: false, error: 'Erro ao validar cartão. Verifique os dados.' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            const customerError = await customerResponse.text();
            console.error('[billing-activate] Erro ao criar customer:', customerError);
          }
        } catch (e) {
          console.error('[billing-activate] Erro na integração Pagar.me:', e);
          // Continuar sem integração (dev mode)
          subscriptionStatus = 'active';
          cardLastFour = card_data.number.slice(-4);
        }
      } else {
        // Dev mode: simular ativação
        console.log('[billing-activate] PAGARME_API_KEY não configurada, modo dev');
        subscriptionStatus = 'active';
        cardLastFour = card_data.number.replace(/\s/g, '').slice(-4);
      }
    } else if (payment_method_type === 'pix_validation' && plan_key === 'free') {
      // Gerar Pix de validação para plano Free
      const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
      
      if (pagarmeApiKey) {
        try {
          const pixResponse = await fetch('https://api.pagar.me/core/v5/orders', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customer: {
                name: user.user_metadata?.full_name || 'Cliente',
                email: user.email,
                type: 'individual',
              },
              items: [{
                amount: 10000, // R$100 em centavos
                description: 'Validação de ativação - Comando Central',
                quantity: 1,
              }],
              payments: [{
                payment_method: 'pix',
                pix: {
                  expires_in: 3600, // 1 hora
                },
              }],
            }),
          });

          if (pixResponse.ok) {
            const pixOrder = await pixResponse.json();
            const pixCharge = pixOrder.charges?.[0];
            const pixTransaction = pixCharge?.last_transaction;

            // Salvar validação Pix
            const { data: pixValidation, error: pixError } = await supabase
              .from('free_pix_validations')
              .insert({
                tenant_id,
                amount_cents: 10000,
                status: 'pending',
                pix_code: pixTransaction?.qr_code,
                pix_qr_code: pixTransaction?.qr_code_url,
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                refundable_until: new Date(Date.now() + 86400000).toISOString(), // 24h
                payment_provider: 'pagarme',
                provider_charge_id: pixCharge?.id,
              })
              .select()
              .single();

            if (pixError) {
              console.error('[billing-activate] Erro ao salvar Pix validation:', pixError);
            } else {
              pixValidationId = pixValidation.id;
            }

            // Retornar dados do Pix para exibição
            return new Response(
              JSON.stringify({
                success: true,
                status: 'pending_pix',
                pix_code: pixTransaction?.qr_code,
                pix_qr_code: pixTransaction?.qr_code_url,
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                validation_id: pixValidationId,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            const pixError = await pixResponse.text();
            console.error('[billing-activate] Erro ao gerar Pix:', pixError);
          }
        } catch (e) {
          console.error('[billing-activate] Erro na geração de Pix:', e);
        }
      }
      
      // Dev mode ou fallback: simular Pix pendente
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending_pix',
          pix_code: 'DEV_PIX_CODE_' + Date.now(),
          pix_qr_code: null,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          validation_id: null,
          dev_mode: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar ou atualizar assinatura
    const { data: subscription, error: subError } = await supabase
      .from('tenant_subscriptions')
      .upsert({
        tenant_id,
        plan_key,
        status: subscriptionStatus,
        activated_at: subscriptionStatus === 'active' ? new Date().toISOString() : null,
        payment_method_type: payment_method_type === 'card' ? 'card' : 'pix',
        payment_provider: 'pagarme',
        provider_customer_id: providerCustomerId,
        card_last_four: cardLastFour,
        card_brand: cardBrand,
        utm_source: utm?.source,
        utm_medium: utm?.medium,
        utm_campaign: utm?.campaign,
        utm_content: utm?.content,
        utm_term: utm?.term,
      }, {
        onConflict: 'tenant_id',
      })
      .select()
      .single();

    if (subError) {
      console.error('[billing-activate] Erro ao criar subscription:', subError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao ativar assinatura' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Salvar addons se houver
    if (addons && addons.length > 0) {
      const addonsToInsert = addons.map(addon => ({
        tenant_id,
        addon_key: addon.addon_key,
        name: addon.name,
        price_cents: addon.price_cents,
        status: 'pending',
      }));

      const { error: addonsError } = await supabase
        .from('tenant_addons')
        .insert(addonsToInsert);

      if (addonsError) {
        console.error('[billing-activate] Erro ao salvar addons:', addonsError);
      }
    }

    console.log(`[billing-activate] Assinatura ${subscriptionStatus} para tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        status: subscriptionStatus,
        plan_key,
        card_last_four: cardLastFour,
        card_brand: cardBrand,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[billing-activate] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
