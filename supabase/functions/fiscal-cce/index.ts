import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');

    if (!focusToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token Focus NFe não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Parse request body
    const { invoice_id, correcao } = await req.json();

    if (!invoice_id || !correcao) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id e correcao são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate correction length
    if (correcao.length < 15 || correcao.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Correção deve ter entre 15 e 1000 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (invoice.status !== 'authorized') {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas NF-e autorizadas podem receber carta de correção' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get existing CC-es count
    const { count: existingCount } = await supabaseClient
      .from('fiscal_invoice_cces')
      .select('*', { count: 'exact', head: true })
      .eq('invoice_id', invoice_id);

    if ((existingCount || 0) >= 20) {
      return new Response(
        JSON.stringify({ success: false, error: 'Limite de 20 cartas de correção atingido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const numeroSequencia = (existingCount || 0) + 1;

    // Get fiscal settings for environment
    const { data: settings } = await supabaseClient
      .from('fiscal_settings')
      .select('ambiente')
      .eq('tenant_id', tenantId)
      .single();

    const ambiente = settings?.ambiente === 'producao' ? 'producao' : 'homologacao';
    const focusBaseUrl = ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Get reference from invoice
    const ref = invoice.focus_ref || `nfe_${invoice.id.replace(/-/g, '').substring(0, 20)}`;

    console.log(`[fiscal-cce] Sending CC-e #${numeroSequencia} for invoice ${invoice.numero}`);

    // Send CC-e to Focus NFe
    const response = await fetch(`${focusBaseUrl}/v2/nfe/${ref}/carta_correcao`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${focusToken}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ correcao }),
    });

    const responseData = await response.json();
    console.log('[fiscal-cce] Focus response:', responseData);

    // Save CC-e record
    const cceRecord = {
      invoice_id,
      tenant_id: tenantId,
      numero_sequencia: numeroSequencia,
      correcao,
      status: response.ok ? 'authorized' : 'rejected',
      protocolo: responseData.protocolo || null,
      response_data: responseData,
    };

    const { data: savedCce, error: saveError } = await supabaseClient
      .from('fiscal_invoice_cces')
      .insert(cceRecord)
      .select()
      .single();

    if (saveError) {
      console.error('[fiscal-cce] Error saving CC-e:', saveError);
    }

    // Log event
    await supabaseClient
      .from('fiscal_invoice_events')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        event_type: response.ok ? 'cce_authorized' : 'cce_rejected',
        description: response.ok 
          ? `Carta de correção #${numeroSequencia} autorizada`
          : `Carta de correção #${numeroSequencia} rejeitada: ${responseData.mensagem || 'erro desconhecido'}`,
        metadata: responseData,
      });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.mensagem || 'Erro ao enviar carta de correção',
          details: responseData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cce: savedCce,
        protocolo: responseData.protocolo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fiscal-cce] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
