import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id, card_data } = await req.json();

    // Validações
    if (!tenant_id || !card_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados obrigatórios não informados' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { number, holder_name, exp_month, exp_year, cvv } = card_data;

    if (!number || !holder_name || !exp_month || !exp_year || !cvv) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados do cartão incompletos' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário tem acesso ao tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para este tenant' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detectar bandeira do cartão
    const cleanNumber = number.replace(/\D/g, '');
    let cardBrand = 'unknown';
    
    if (/^4/.test(cleanNumber)) {
      cardBrand = 'visa';
    } else if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) {
      cardBrand = 'mastercard';
    } else if (/^3[47]/.test(cleanNumber)) {
      cardBrand = 'amex';
    } else if (/^6(?:011|5)/.test(cleanNumber)) {
      cardBrand = 'discover';
    } else if (/^(?:2131|1800|35\d{3})/.test(cleanNumber)) {
      cardBrand = 'jcb';
    } else if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) {
      cardBrand = 'diners';
    } else if (/^(606282|3841)/.test(cleanNumber)) {
      cardBrand = 'hipercard';
    } else if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(cleanNumber)) {
      cardBrand = 'elo';
    }

    const cardLastFour = cleanNumber.slice(-4);

    console.log(`Processing card for tenant ${tenant_id}: ${cardBrand} ****${cardLastFour}`);

    // TODO: Aqui você integraria com o Mercado Pago para tokenizar o cartão
    // Por enquanto, apenas salvamos os dados básicos
    // Em produção, você deve:
    // 1. Chamar API do MP para criar um card token
    // 2. Criar um customer no MP se não existir
    // 3. Associar o card ao customer
    // 4. Salvar apenas o token/id, nunca os dados do cartão

    // Atualizar subscription com método de pagamento
    const { error: updateError } = await supabase
      .from('tenant_subscriptions')
      .update({
        payment_method_type: 'card',
        card_last_four: cardLastFour,
        card_brand: cardBrand,
        status: 'active', // Ativar subscription
        activated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar assinatura' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Payment method added successfully for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        card_brand: cardBrand,
        card_last_four: cardLastFour,
        message: 'Cartão cadastrado com sucesso!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
