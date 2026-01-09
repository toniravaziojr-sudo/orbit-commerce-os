import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let sessionId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      sessionId = url.searchParams.get('session_id');
    } else if (req.method === 'POST') {
      const body = await req.json();
      sessionId = body.session_id;
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'session_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: session, error } = await supabase
      .from('billing_checkout_sessions')
      .select('id, status, plan_key, billing_cycle, email, store_name, tenant_id, created_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let message = '';
    let next_step = '';

    switch (session.status) {
      case 'pending_payment':
        message = 'Aguardando confirmação do pagamento...';
        next_step = 'wait';
        break;
      case 'paid':
        message = 'Pagamento confirmado! Verifique seu e-mail para criar sua conta.';
        next_step = 'check_email';
        break;
      case 'completed':
        message = 'Conta criada com sucesso!';
        next_step = 'login';
        break;
      case 'failed':
        message = 'Falha no pagamento. Tente novamente.';
        next_step = 'retry';
        break;
      case 'expired':
        message = 'Sessão expirada. Inicie um novo checkout.';
        next_step = 'restart';
        break;
      default:
        message = 'Status desconhecido.';
        next_step = 'wait';
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          plan_key: session.plan_key,
          billing_cycle: session.billing_cycle,
          email: session.email,
          store_name: session.store_name,
          has_tenant: !!session.tenant_id,
        },
        message,
        next_step,
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
