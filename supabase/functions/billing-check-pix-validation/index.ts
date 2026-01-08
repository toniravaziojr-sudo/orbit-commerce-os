import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { validation_id, tenant_id } = await req.json();

    if (!validation_id && !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'validation_id ou tenant_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar validação
    let query = supabase.from('free_pix_validations').select('*');
    
    if (validation_id) {
      query = query.eq('id', validation_id);
    } else {
      query = query.eq('tenant_id', tenant_id).order('created_at', { ascending: false }).limit(1);
    }

    const { data: validation, error: validationError } = await query.single();

    if (validationError || !validation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Validação não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se já está pago, ativar subscription
    if (validation.status === 'paid') {
      // Atualizar subscription para active
      await supabase
        .from('tenant_subscriptions')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
          payment_method_type: 'pix',
        })
        .eq('tenant_id', validation.tenant_id);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'paid',
          activated: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se expirou
    if (validation.expires_at && new Date(validation.expires_at) < new Date()) {
      await supabase
        .from('free_pix_validations')
        .update({ status: 'expired' })
        .eq('id', validation.id);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'expired',
          message: 'Pix expirado. Gere um novo código.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar status no Pagar.me se temos provider_charge_id
    if (validation.provider_charge_id) {
      const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
      
      if (pagarmeApiKey) {
        try {
          const chargeResponse = await fetch(
            `https://api.pagar.me/core/v5/charges/${validation.provider_charge_id}`,
            {
              headers: {
                'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`,
              },
            }
          );

          if (chargeResponse.ok) {
            const charge = await chargeResponse.json();
            
            if (charge.status === 'paid') {
              // Atualizar validação
              await supabase
                .from('free_pix_validations')
                .update({
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                })
                .eq('id', validation.id);

              // Ativar subscription
              await supabase
                .from('tenant_subscriptions')
                .update({
                  status: 'active',
                  activated_at: new Date().toISOString(),
                  payment_method_type: 'pix',
                })
                .eq('tenant_id', validation.tenant_id);

              return new Response(
                JSON.stringify({
                  success: true,
                  status: 'paid',
                  activated: true,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch (e) {
          console.error('[billing-check-pix] Erro ao verificar Pagar.me:', e);
        }
      }
    }

    // Ainda pendente
    return new Response(
      JSON.stringify({
        success: true,
        status: 'pending',
        pix_code: validation.pix_code,
        pix_qr_code: validation.pix_qr_code,
        expires_at: validation.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[billing-check-pix] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
