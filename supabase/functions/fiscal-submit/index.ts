import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNFe, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { buildNFePayload, generateNFeRef, mapFocusStatusToInternal } from "../_shared/focus-nfe-adapter.ts";

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

    console.log(`[fiscal-submit] Processando NF-e ${invoice_id} para tenant ${tenantId}`);

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

    // Verificar status
    if (invoice.status !== 'draft' && invoice.status !== 'rejected') {
      return new Response(
        JSON.stringify({ success: false, error: `NF-e não pode ser enviada no status: ${invoice.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar itens da NF-e
    const { data: items, error: itemsError } = await supabaseClient
      .from('fiscal_invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('numero_item');

    if (itemsError || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Itens da NF-e não encontrados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações fiscais
    const { data: settings, error: settingsError } = await supabaseClient
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se empresa está sincronizada com Focus NFe
    if (!settings.focus_empresa_id && !settings.cnpj) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Empresa não cadastrada na Focus NFe. Sincronize primeiro.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuração Focus NFe
    const focusConfig: FocusNFeConfig = {
      token: focusToken,
      ambiente: (settings.focus_ambiente || settings.ambiente || 'homologacao') as 'homologacao' | 'producao',
    };

    console.log(`[fiscal-submit] Ambiente: ${focusConfig.ambiente}`);

    // Buscar dados do pedido para destinatário
    let destinatario: any;
    
    if (invoice.order_id) {
      const { data: order } = await supabaseClient
        .from('orders')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', invoice.order_id)
        .single();

      if (order) {
        destinatario = {
          nome: order.customer?.full_name || order.shipping_name || 'CONSUMIDOR FINAL',
          cpf: order.customer?.cpf || invoice.destinatario_cpf,
          cnpj: invoice.destinatario_cnpj,
          inscricao_estadual: invoice.destinatario_ie,
          logradouro: order.shipping_street || invoice.destinatario_logradouro || '',
          numero: order.shipping_number || invoice.destinatario_numero || 'S/N',
          complemento: order.shipping_complement || invoice.destinatario_complemento,
          bairro: order.shipping_neighborhood || invoice.destinatario_bairro || '',
          cidade: order.shipping_city || invoice.destinatario_cidade || '',
          uf: order.shipping_state || invoice.destinatario_uf || '',
          cep: order.shipping_postal_code || invoice.destinatario_cep || '',
          telefone: order.customer?.phone,
          email: order.customer?.email,
        };
      }
    }

    // Fallback para dados da invoice
    if (!destinatario) {
      destinatario = {
        nome: invoice.destinatario_nome || 'CONSUMIDOR FINAL',
        cpf: invoice.destinatario_cpf,
        cnpj: invoice.destinatario_cnpj,
        inscricao_estadual: invoice.destinatario_ie,
        logradouro: invoice.destinatario_logradouro || '',
        numero: invoice.destinatario_numero || 'S/N',
        complemento: invoice.destinatario_complemento,
        bairro: invoice.destinatario_bairro || '',
        cidade: invoice.destinatario_cidade || '',
        uf: invoice.destinatario_uf || '',
        cep: invoice.destinatario_cep || '',
      };
    }

    // Converter itens para formato Focus NFe
    const focusItems = items.map((item, index) => ({
      numero_item: item.numero_item || index + 1,
      codigo_produto: item.codigo_produto || item.product_id?.substring(0, 60) || `PROD${index + 1}`,
      descricao: item.descricao || 'PRODUTO',
      cfop: item.cfop || '5102',
      ncm: item.ncm || '00000000',
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade || 1,
      valor_unitario: item.valor_unitario || 0,
      valor_total: item.valor_total || 0,
      valor_desconto: item.valor_desconto,
      origem: item.origem || '0',
      cst_icms: item.cst_icms,
      csosn: item.csosn || '102',
      cst_pis: item.cst_pis || '07',
      cst_cofins: item.cst_cofins || '07',
    }));

    // Gerar referência única
    const ref = generateNFeRef(invoice_id);

    // Montar payload
    const nfePayload = buildNFePayload(
      {
        id: invoice_id,
        natureza_operacao: invoice.natureza_operacao,
        tipo_operacao: invoice.tipo_operacao || 'saida',
        finalidade: invoice.finalidade,
        valor_produtos: invoice.valor_produtos || 0,
        valor_frete: invoice.valor_frete,
        valor_desconto: invoice.valor_desconto,
        valor_total: invoice.valor_total || 0,
        informacoes_complementares: invoice.informacoes_complementares,
      },
      destinatario,
      focusItems,
      { cnpj: settings.cnpj },
      invoice.order_id ? { forma: 'other', valor: invoice.valor_total || 0 } : undefined
    );

    console.log(`[fiscal-submit] Enviando NF-e ref=${ref} para Focus NFe`);

    // Enviar para Focus NFe
    const result = await sendNFe(focusConfig, ref, nfePayload);

    if (!result.success) {
      // Atualizar status para rejected
      await supabaseClient
        .from('fiscal_invoices')
        .update({
          status: 'rejected',
          mensagem_sefaz: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice_id);

      // Registrar log
      await supabaseClient
        .from('fiscal_invoice_events')
        .insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: 'submission_error',
          event_data: { error: result.error, response: result.data },
        });

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar resposta
    const focusStatus = result.data?.status || 'processando_autorizacao';
    const internalStatus = mapFocusStatusToInternal(focusStatus);

    // Atualizar NF-e com dados da resposta
    const updateData: any = {
      status: internalStatus,
      focus_ref: ref,
      mensagem_sefaz: result.data?.mensagem_sefaz,
      status_sefaz: result.data?.status_sefaz,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Se autorizado imediatamente
    if (focusStatus === 'autorizado' && result.data?.chave_nfe) {
      updateData.chave_acesso = result.data.chave_nfe;
      updateData.numero = result.data.numero;
      updateData.serie = result.data.serie;
      updateData.xml_url = result.data.caminho_xml_nota_fiscal;
      updateData.danfe_url = result.data.caminho_danfe;
      updateData.authorized_at = new Date().toISOString();
      
      // Atualizar status do pedido para dispatched
      if (invoice.order_id) {
        await supabaseClient
          .from('orders')
          .update({ status: 'dispatched' })
          .eq('id', invoice.order_id);
      }
    }

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
        event_type: focusStatus === 'autorizado' ? 'authorized' : 'submitted',
        event_data: result.data,
      });

    console.log(`[fiscal-submit] NF-e ${ref} enviada com status: ${focusStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        ref,
        status: internalStatus,
        focus_status: focusStatus,
        chave_acesso: result.data?.chave_nfe,
        numero: result.data?.numero,
        serie: result.data?.serie,
        mensagem_sefaz: result.data?.mensagem_sefaz,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fiscal-submit] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
