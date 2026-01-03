import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getNFeStatus, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { mapFocusStatusToInternal } from "../_shared/focus-nfe-adapter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');

  if (!focusToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token Focus NFe não configurado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Obter invoice_id do body
    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fiscal-get-status] Verificando NF-e ${invoice_id}`);

    // Buscar NF-e
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se já está em status final, retornar dados atuais
    if (invoice.status === 'authorized' || invoice.status === 'cancelled') {
      return new Response(
        JSON.stringify({
          success: true,
          status: invoice.status,
          chave_acesso: invoice.chave_acesso,
          numero: invoice.numero,
          serie: invoice.serie,
          protocolo: invoice.protocolo,
          xml_url: invoice.xml_url,
          danfe_url: invoice.danfe_url,
          mensagem_sefaz: invoice.mensagem_sefaz,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se não tem referência Focus NFe, não pode consultar
    if (!invoice.focus_ref) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: invoice.status,
          message: 'NF-e não foi enviada para Focus NFe' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações fiscais
    const { data: settings } = await supabaseClient
      .from('fiscal_settings')
      .select('focus_ambiente, ambiente')
      .eq('tenant_id', tenantId)
      .single();

    // Configuração Focus NFe
    const focusConfig: FocusNFeConfig = {
      token: focusToken,
      ambiente: (settings?.focus_ambiente || settings?.ambiente || 'homologacao') as 'homologacao' | 'producao',
    };

    // Consultar status na Focus NFe
    const result = await getNFeStatus(focusConfig, invoice.focus_ref);

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: invoice.status,
          error: result.error 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mapear status
    const focusStatus = result.data?.status || 'processando_autorizacao';
    const internalStatus = mapFocusStatusToInternal(focusStatus);

    // Preparar dados de atualização
    const updateData: any = {
      status: internalStatus,
      mensagem_sefaz: result.data?.mensagem_sefaz,
      status_sefaz: result.data?.status_sefaz,
      updated_at: new Date().toISOString(),
    };

    // Se autorizado, salvar dados adicionais
    if (focusStatus === 'autorizado' && result.data?.chave_nfe) {
      updateData.chave_acesso = result.data.chave_nfe;
      // Don't update numero/serie - they're already set when creating the draft
      // Updating them can cause unique constraint violations
      updateData.xml_url = result.data.caminho_xml_nota_fiscal;
      updateData.danfe_url = result.data.caminho_danfe;
      
      if (!invoice.authorized_at) {
        updateData.authorized_at = new Date().toISOString();
      }
      
      // Atualizar status do pedido
      if (invoice.order_id) {
        await supabaseClient
          .from('orders')
          .update({ status: 'dispatched' })
          .eq('id', invoice.order_id);
      }
    }

    // Atualizar NF-e se status mudou
    if (invoice.status !== internalStatus) {
      await supabaseClient
        .from('fiscal_invoices')
        .update(updateData)
        .eq('id', invoice_id);

      // Registrar log
      await supabaseClient
        .from('fiscal_invoice_events')
        .insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: focusStatus === 'autorizado' ? 'authorized' : 'status_check',
          event_data: result.data,
        });

      console.log(`[fiscal-get-status] Status atualizado: ${invoice.status} -> ${internalStatus}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: internalStatus,
        focus_status: focusStatus,
        chave_acesso: result.data?.chave_nfe || invoice.chave_acesso,
        numero: result.data?.numero || invoice.numero,
        serie: result.data?.serie || invoice.serie,
        mensagem_sefaz: result.data?.mensagem_sefaz,
        xml_url: result.data?.caminho_xml_nota_fiscal || invoice.xml_url,
        danfe_url: result.data?.caminho_danfe || invoice.danfe_url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fiscal-get-status] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
