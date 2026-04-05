// =============================================
// FISCAL CREATE MANUAL - Criar NF-e manualmente
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getNextFiscalNumber, insertFiscalInvoiceWithRetry, syncFiscalNumberCursor } from "../_shared/fiscal-numbering.ts";

const VERSION = 'v8.6.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper to find IBGE code
async function getIbgeCodigo(supabase: any, cidade: string, uf: string): Promise<string | null> {
  if (!cidade || !uf) return null;
  
  const normalizedCidade = cidade.trim().toUpperCase();
  const normalizedUf = uf.trim().toUpperCase();
  
  // Try exact match first
  const { data: exact } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .ilike('nome', normalizedCidade)
    .eq('uf', normalizedUf)
    .maybeSingle();
  
  if (exact?.codigo) return exact.codigo;
  
  // Try partial match
  const { data: partial } = await supabase
    .from('ibge_municipios')
    .select('codigo, nome')
    .eq('uf', normalizedUf)
    .ilike('nome', `%${normalizedCidade}%`)
    .limit(1)
    .maybeSingle();
  
  return partial?.codigo || null;
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
        JSON.stringify({ success: false, error: 'Missing authorization' }),
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
        JSON.stringify({ success: false, error: 'No tenant selected', code: 'NO_TENANT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;
    const body = await req.json();
    
    const {
      order_id,
      natureza_operacao,
      observacoes,
      destinatario,
      itens,
      indicador_presenca,
      indicador_ie_dest,
      pagamento_indicador,
      pagamento_meio,
    } = body;

    console.log(`[fiscal-create-manual][${VERSION}] Creating manual invoice for tenant:`, tenantId);

    // Get fiscal settings
    const { data: settings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error('Configuração fiscal não encontrada');
    }

    if (!settings.certificado_pfx) {
      throw new Error('Certificado digital não configurado');
    }

    const serieNfe = settings.serie_nfe || 1;

    // Calculate totals
    const valorProdutos = itens.reduce((sum: number, item: any) => 
      sum + (item.quantidade * item.valor_unitario), 0
    );

    // Get IBGE code for destination
    const destMunicipioCodigo = await getIbgeCodigo(
      supabase, 
      destinatario.endereco.municipio, 
      destinatario.endereco.uf
    );

    const nextNumero = await getNextFiscalNumber({
      supabase,
      tenantId,
      serie: serieNfe,
      fallbackNumeroAtual: settings.numero_nfe_atual,
    });

    // Create invoice draft
    const invoiceBaseData = {
      tenant_id: tenantId,
      order_id: order_id || null,
      serie: serieNfe,
      status: 'draft',
      natureza_operacao: natureza_operacao || 'VENDA DE MERCADORIA',
      cfop: itens[0]?.cfop || settings.cfop_intrastadual || '5102',
      valor_total: valorProdutos,
      valor_produtos: valorProdutos,
      valor_frete: 0,
      valor_desconto: 0,
      dest_nome: destinatario.nome,
      dest_cpf_cnpj: destinatario.cpf_cnpj,
      dest_email: destinatario.email || null,
      dest_telefone: destinatario.telefone || null,
      dest_endereco_logradouro: destinatario.endereco.logradouro,
      dest_endereco_numero: destinatario.endereco.numero,
      dest_endereco_complemento: destinatario.endereco.complemento || null,
      dest_endereco_bairro: destinatario.endereco.bairro,
      dest_endereco_municipio: destinatario.endereco.municipio,
      dest_endereco_municipio_codigo: destMunicipioCodigo,
      dest_endereco_uf: destinatario.endereco.uf,
      dest_endereco_cep: destinatario.endereco.cep,
      observacoes: observacoes || null,
      ambiente: settings.ambiente,
      // Campos SEFAZ
      indicador_presenca: indicador_presenca ?? 2,
      indicador_ie_dest: indicador_ie_dest ?? 9,
      pagamento_indicador: pagamento_indicador ?? 0,
      pagamento_meio: pagamento_meio || '99',
      pagamento_valor: valorProdutos,
    };

    const { invoice, numero } = await insertFiscalInvoiceWithRetry({
      supabase,
      tenantId,
      serie: serieNfe,
      initialNumber: nextNumero,
      logPrefix: 'fiscal-create-manual',
      buildDraftData: (numeroFiscal) => ({
        ...invoiceBaseData,
        numero: numeroFiscal,
      }),
    });

    // Insert invoice items
    const invoiceItems = itens.map((item: any) => ({
      invoice_id: invoice.id,
      numero_item: item.numero_item,
      codigo_produto: item.codigo || `ITEM${item.numero_item}`,
      descricao: item.descricao,
      ncm: (item.ncm || '').replace(/\D/g, '').padStart(8, '0'),
      cfop: (item.cfop || '5102').replace(/\D/g, ''),
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.quantidade * item.valor_unitario,
      origem: parseInt(item.origem || '0', 10),
      csosn: item.csosn || '102',
    }));

    const { error: itemsError } = await supabase
      .from('fiscal_invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      console.error('[fiscal-create-manual] Error inserting items:', itemsError);
    }

    await syncFiscalNumberCursor({
      supabase,
      tenantId,
      serie: serieNfe,
      currentCursor: numero + 1,
      logPrefix: 'fiscal-create-manual',
    });

    // Log event
    await supabase
      .from('fiscal_invoice_events')
      .insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        event_type: 'created',
        description: 'NF-e criada manualmente',
        created_by: user.id,
      });

    console.log('[fiscal-create-manual] Manual invoice created:', invoice.id);

    return new Response(
      JSON.stringify({
        success: true,
        invoice,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'create-manual' });
  }
});
