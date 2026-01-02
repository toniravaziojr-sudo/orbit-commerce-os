// =============================================
// FISCAL SUBMIT - Envia NF-e para SEFAZ via provedor
// Usa Focus NFe como provedor principal
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format CNPJ/CPF (remove non-numeric)
function formatDocument(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

// Format CEP
function formatCep(cep: string): string {
  return (cep || '').replace(/\D/g, '');
}

// Build Focus NFe payload
function buildFocusNfePayload(invoice: any, items: any[], settings: any) {
  const isCpf = formatDocument(invoice.dest_cpf_cnpj).length <= 11;
  
  const payload: any = {
    // Natureza da operação
    natureza_operacao: invoice.natureza_operacao || 'VENDA DE MERCADORIA',
    
    // Forma de pagamento (0=À vista, 1=A prazo, 2=Outros)
    forma_pagamento: '0',
    
    // Tipo de documento (0=Entrada, 1=Saída)
    tipo_documento: '1',
    
    // Finalidade (1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução)
    finalidade_emissao: '1',
    
    // Consumidor final (0=Normal, 1=Consumidor Final)
    consumidor_final: '1',
    
    // Presença do comprador (1=Presencial, 2=Internet, 9=Outros)
    presenca_comprador: '2', // Internet
    
    // Dados do destinatário
    nome_destinatario: invoice.dest_nome,
    cpf_destinatario: isCpf ? formatDocument(invoice.dest_cpf_cnpj) : undefined,
    cnpj_destinatario: !isCpf ? formatDocument(invoice.dest_cpf_cnpj) : undefined,
    
    // Endereço do destinatário
    logradouro_destinatario: invoice.dest_endereco_logradouro,
    numero_destinatario: invoice.dest_endereco_numero || 'S/N',
    complemento_destinatario: invoice.dest_endereco_complemento || '',
    bairro_destinatario: invoice.dest_endereco_bairro,
    municipio_destinatario: invoice.dest_endereco_municipio,
    uf_destinatario: invoice.dest_endereco_uf,
    cep_destinatario: formatCep(invoice.dest_endereco_cep),
    
    // Indicador de IE (1=Contribuinte, 2=Isento, 9=Não contribuinte)
    indicador_inscricao_estadual_destinatario: '9',
    
    // Itens
    items: items.map((item, idx) => ({
      numero_item: idx + 1,
      codigo_produto: item.codigo_produto,
      descricao: item.descricao,
      cfop: item.cfop,
      ncm: item.ncm,
      unidade_comercial: item.unidade || 'UN',
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: item.valor_unitario,
      valor_bruto: item.valor_total,
      unidade_tributavel: item.unidade || 'UN',
      quantidade_tributavel: item.quantidade,
      valor_unitario_tributavel: item.valor_unitario,
      origem: String(item.origem || 0),
      // Simples Nacional
      icms_situacao_tributaria: settings.crt === 1 ? item.csosn || '102' : item.cst || '00',
    })),
    
    // Totais
    valor_produtos: invoice.valor_produtos,
    valor_desconto: invoice.valor_desconto || 0,
    valor_frete: invoice.valor_frete || 0,
    valor_total: invoice.valor_total,
    
    // Informações adicionais
    informacoes_adicionais_contribuinte: invoice.observacoes || '',
  };

  // Se tiver frete, adicionar modalidade
  if (invoice.valor_frete > 0) {
    payload.modalidade_frete = '0'; // Por conta do emitente
  } else {
    payload.modalidade_frete = '9'; // Sem frete
  }

  return payload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No tenant selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-submit] Submitting invoice:', invoice_id);

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check status
    if (invoice.status !== 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: `NF-e não pode ser emitida. Status atual: ${invoice.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get invoice items
    const { data: items } = await supabase
      .from('fiscal_invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('numero_item');

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e sem itens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get fiscal settings (with token)
    const { data: settings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings || !settings.provider_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais ou token não encontrados.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to pending
    await supabase
      .from('fiscal_invoices')
      .update({ status: 'pending' })
      .eq('id', invoice_id);

    // Build payload for Focus NFe
    const focusPayload = buildFocusNfePayload(invoice, items, settings);
    
    // Determine API URL based on environment
    const baseUrl = settings.ambiente === 'producao' 
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Generate reference ID (unique per request)
    const refId = `${tenantId.substring(0, 8)}-${invoice.serie}-${invoice.numero}`;

    console.log('[fiscal-submit] Sending to Focus NFe:', baseUrl, 'ref:', refId);

    // Log request payload (sanitized)
    await supabase
      .from('fiscal_invoice_events')
      .insert({
        invoice_id: invoice_id,
        tenant_id: tenantId,
        event_type: 'submitted',
        event_data: { ref_id: refId, ambiente: settings.ambiente },
        request_payload: { ...focusPayload, items_count: items.length },
        user_id: user.id,
      });

    try {
      // Send to Focus NFe
      const response = await fetch(`${baseUrl}/v2/nfe?ref=${refId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(settings.provider_token + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(focusPayload),
      });

      const responseData = await response.json();
      console.log('[fiscal-submit] Focus NFe response:', response.status, responseData);

      // Log response
      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice_id,
          tenant_id: tenantId,
          event_type: response.ok ? 'provider_response_success' : 'provider_response_error',
          response_payload: responseData,
          user_id: user.id,
        });

      if (response.ok && responseData.status === 'autorizado') {
        // Authorized!
        const updateData = {
          status: 'authorized',
          chave_acesso: responseData.chave_nfe,
          protocolo: responseData.protocolo,
          xml_autorizado: responseData.caminho_xml_nota_fiscal,
          danfe_url: responseData.caminho_danfe,
        };

        await supabase
          .from('fiscal_invoices')
          .update(updateData)
          .eq('id', invoice_id);

        // Increment numero_nfe_atual
        await supabase
          .from('fiscal_settings')
          .update({ numero_nfe_atual: settings.numero_nfe_atual + 1 })
          .eq('id', settings.id);

        // Log success
        await supabase
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoice_id,
            tenant_id: tenantId,
            event_type: 'authorized',
            event_data: { 
              chave_acesso: responseData.chave_nfe,
              protocolo: responseData.protocolo 
            },
            user_id: user.id,
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'authorized',
            chave_acesso: responseData.chave_nfe,
            protocolo: responseData.protocolo,
            danfe_url: responseData.caminho_danfe,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (responseData.status === 'processando_autorizacao') {
        // Still processing
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'pending',
            message: 'NF-e em processamento. Consulte o status em alguns segundos.',
            ref_id: refId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Rejected or error
        const errorMessage = responseData.mensagem_sefaz || responseData.mensagem || responseData.erros?.[0]?.mensagem || 'Erro desconhecido';
        
        await supabase
          .from('fiscal_invoices')
          .update({ 
            status: 'rejected',
            status_motivo: errorMessage,
          })
          .eq('id', invoice_id);

        await supabase
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoice_id,
            tenant_id: tenantId,
            event_type: 'rejected',
            event_data: { motivo: errorMessage },
            user_id: user.id,
          });

        return new Response(
          JSON.stringify({ 
            success: false, 
            status: 'rejected',
            error: errorMessage,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (providerError: any) {
      console.error('[fiscal-submit] Provider error:', providerError);
      
      // Revert to draft on network error
      await supabase
        .from('fiscal_invoices')
        .update({ status: 'draft' })
        .eq('id', invoice_id);

      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice_id,
          tenant_id: tenantId,
          event_type: 'provider_error',
          event_data: { error: providerError.message },
          user_id: user.id,
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro de conexão com o provedor fiscal: ${providerError.message}` 
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-submit] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
