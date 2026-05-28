// =============================================
// FISCAL CREATE MANUAL - Criar NF-e manualmente
// =============================================
import { errorResponse } from "../_shared/error-response.ts";
import { resolveAddressByCep } from "../_shared/cep-lookup.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getNextFiscalNumber, insertFiscalInvoiceWithRetry, syncFiscalNumberCursor } from "../_shared/fiscal-numbering.ts";
import { resolveOperationNature, pickCfopForUf, pickTaxCodesForCrt } from "../_shared/fiscal-nature-resolver.ts";

const VERSION = 'v8.8.0';

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

Deno.serve(async (req) => {
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
      natureza_operacao_id,
      observacoes,
      destinatario: bodyDestinatario,
      itens: bodyItens,
      indicador_presenca,
      indicador_ie_dest,
      pagamento_indicador,
      pagamento_meio,
      // Totais e ajustes financeiros (opcionais; default 0 / preservar contrato)
      valor_desconto: bodyValorDesconto,
      valor_frete: bodyValorFrete,
      valor_seguro: bodyValorSeguro,
      valor_outras_despesas: bodyValorOutras,
      modalidade_frete: bodyModalidadeFrete,
      transportadora_nome: bodyTranspNome,
      transportadora_servico: bodyTranspServico,
      transportadora_cnpj: bodyTranspCnpj,
      peso_bruto: bodyPesoBruto,
      peso_liquido: bodyPesoLiquido,
      quantidade_volumes: bodyQtdVolumes,
      informacoes_fisco: bodyInfoFisco,
      // Chave da NF-e referenciada (devolução, retorno de remessa etc.)
      nfe_referenciada: bodyNfeReferenciada,
      // v8.7.0 — distinção explícita entre criação manual de NF (aba Notas Fiscais)
      // e criação de Pedido de Venda (aba Pedidos de Venda).
      // - 'nfe_manual': abre rascunho LIMPO de NF (sem item mockado, sem destinatário
      //   pré-preenchido). Não passa pelo estágio 'pedido_venda'.
      // - 'pedido_venda' (default): mantém comportamento legado para chamadas vindas
      //   do fluxo de Pedido de Venda (com destinatário/itens completos).
      mode: bodyMode,
    } = body;

    const creationMode: 'nfe_manual' | 'pedido_venda' =
      bodyMode === 'nfe_manual' ? 'nfe_manual' : 'pedido_venda';

    // Em modo NF manual, destinatário e itens são opcionais (rascunho em branco).
    // Em modo pedido de venda, contrato legado: ambos obrigatórios.
    const destinatario = bodyDestinatario || {
      nome: '',
      cpf_cnpj: '',
      endereco: { logradouro: '', numero: '', bairro: '', municipio: '', uf: '', cep: '' },
    };
    const itens: any[] = Array.isArray(bodyItens) ? bodyItens : [];

    if (creationMode === 'pedido_venda') {
      if (!bodyDestinatario || !itens.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'Destinatário e itens são obrigatórios para Pedido de Venda' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    const toNum = (v: any) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const valorDesconto = Math.max(0, toNum(bodyValorDesconto));
    const valorFrete = Math.max(0, toNum(bodyValorFrete));
    const valorSeguro = Math.max(0, toNum(bodyValorSeguro));
    const valorOutras = Math.max(0, toNum(bodyValorOutras));

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

    // Resolução de IBGE: CEP primeiro; fallback por nome.
    // Em modo NF manual em branco pode não haver CEP — evita lookup desnecessário.
    let destMunicipioCodigo: string | null = null;
    let cepResolvedManual: any = null;
    if (destinatario.endereco.cep) {
      cepResolvedManual = await resolveAddressByCep(supabase, destinatario.endereco.cep);
    }
    if (cepResolvedManual?.ibge) {
      destMunicipioCodigo = cepResolvedManual.ibge;
    } else if (destinatario.endereco.municipio && destinatario.endereco.uf) {
      destMunicipioCodigo = await getIbgeCodigo(
        supabase,
        destinatario.endereco.municipio,
        destinatario.endereco.uf,
      );
    }

    const nextNumero = await getNextFiscalNumber({
      supabase,
      tenantId,
      serie: serieNfe,
      fallbackNumeroAtual: settings.numero_nfe_atual,
    });

    // Regra oficial: total = soma(itens) - desconto + frete + seguro + outras despesas (nunca negativo)
    const valorTotal = Math.max(0, valorProdutos - valorDesconto + valorFrete + valorSeguro + valorOutras);

    // v8.7.0 — Estágio inicial depende do modo de criação:
    // - Pedido de Venda: estágio 'pedido_venda' (editor abre em modo PV com validações de venda).
    // - NF Manual em branco: estágio 'pendencia' (editor abre em modo NF Fiscal, sem
    //   validações de PV; pendências reais aparecem apenas ao salvar/emitir).
    const initialStage = creationMode === 'nfe_manual' ? 'pendencia' : 'pedido_venda';

    // CFOP/finalidade/tipo vêm da Natureza de Operação resolvida (+ CRT do emitente)
    const nature = await resolveOperationNature(supabase, tenantId, {
      natureId: natureza_operacao_id || null,
      natureNome: natureza_operacao || null,
      defaultNatureId: settings.default_sales_nature_id || null,
    });
    const emitterCrtManual = Number(settings.crt || 1);
    const cfopHeader = pickCfopForUf(
      nature,
      settings.endereco_uf,
      cepResolvedManual?.uf || destinatario.endereco.uf,
      emitterCrtManual,
    );
    const natureTaxManual = pickTaxCodesForCrt(nature, emitterCrtManual);

    // Create invoice draft
    // Create invoice draft
    // Manual/duplicated PV sem order_id: nasce em 'em_aberto' para acionar o gatilho
    // de espelho (sync_shipment_with_pv_status) e criar a remessa-rascunho automaticamente.
    // Ver mem://constraints/shipment-mirrors-pedido-venda-em-aberto e docs/especificacoes/erp/logistica.md
    const initialPedidoStatus =
      creationMode === 'pedido_venda' && !order_id ? 'em_aberto' : null;

    const invoiceBaseData: any = {
      tenant_id: tenantId,
      order_id: order_id || null,
      serie: serieNfe,
      status: 'draft',
      fiscal_stage: initialStage,
      pedido_status: initialPedidoStatus,
      tipo_documento: nature?.tipo_documento ?? 1,

      finalidade_emissao: nature?.finalidade ?? 1,
      natureza_operacao_id: nature?.id ?? null,
      natureza_operacao: (nature?.nome || natureza_operacao || 'VENDA DE MERCADORIA').toUpperCase(),
      cfop: itens[0]?.cfop || cfopHeader,
      valor_total: valorTotal,
      valor_produtos: valorProdutos,
      valor_frete: valorFrete,
      valor_desconto: valorDesconto,
      valor_seguro: valorSeguro,
      valor_outras_despesas: valorOutras,
      modalidade_frete: bodyModalidadeFrete ?? '9',
      transportadora_nome: bodyTranspNome ?? null,
      transportadora_servico: bodyTranspServico ?? null,
      transportadora_cnpj: bodyTranspCnpj ?? null,
      peso_bruto: bodyPesoBruto != null ? toNum(bodyPesoBruto) : null,
      peso_liquido: bodyPesoLiquido != null ? toNum(bodyPesoLiquido) : null,
      quantidade_volumes: bodyQtdVolumes != null ? parseInt(String(bodyQtdVolumes), 10) || null : null,
      informacoes_fisco: bodyInfoFisco || null,
      nfe_referenciada: bodyNfeReferenciada ? String(bodyNfeReferenciada).replace(/\D/g, '').substring(0, 44) || null : null,
      dest_nome: destinatario.nome,
      dest_cpf_cnpj: destinatario.cpf_cnpj,
      dest_email: destinatario.email || null,
      dest_telefone: destinatario.telefone || null,
      dest_endereco_logradouro: destinatario.endereco.logradouro,
      dest_endereco_numero: destinatario.endereco.numero,
      dest_endereco_complemento: destinatario.endereco.complemento || null,
      dest_endereco_bairro: destinatario.endereco.bairro,
      // Nome oficial do município vem do CEP (evita typo derrubar xMun na SEFAZ)
      dest_endereco_municipio: cepResolvedManual?.cidade || destinatario.endereco.municipio,
      dest_endereco_municipio_codigo: destMunicipioCodigo,
      dest_endereco_uf: cepResolvedManual?.uf || destinatario.endereco.uf,
      dest_endereco_cep: destinatario.endereco.cep,
      observacoes: observacoes || null,
      ambiente: settings.ambiente,
      // Campos SEFAZ
      indicador_presenca: indicador_presenca ?? 2,
      indicador_ie_dest: indicador_ie_dest ?? 9,
      pagamento_indicador: pagamento_indicador ?? 0,
      pagamento_meio: pagamento_meio || '99',
      pagamento_valor: valorTotal,
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

    // Insert invoice items (snapshot do pedido — não recalcula preço do catálogo)
    const sanitizeGtin = (v: any): string | null => {
      const s = String(v ?? '').trim().toUpperCase();
      if (!s) return null;
      if (s === 'SEM GTIN') return 'SEM GTIN';
      // GTIN deve conter apenas dígitos (8, 12, 13 ou 14)
      const digits = s.replace(/\D/g, '');
      if ([8, 12, 13, 14].includes(digits.length)) return digits;
      return s.substring(0, 14);
    };
    const invoiceItems = itens.map((item: any) => ({
      invoice_id: invoice.id,
      numero_item: item.numero_item,
      product_id: item.product_id || null,
      codigo_produto: item.codigo || `ITEM${item.numero_item}`,
      descricao: item.descricao,
      ncm: (item.ncm || '').replace(/\D/g, '').padStart(8, '0'),
      cfop: (item.cfop || cfopHeader).replace(/\D/g, '') || cfopHeader,
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.quantidade * item.valor_unitario,
      valor_desconto: Math.max(0, toNum(item.valor_desconto)),
      valor_frete: Math.max(0, toNum(item.valor_frete)),
      origem: parseInt(item.origem || '0', 10),
      csosn: item.csosn || natureTaxManual.csosn || '102',
      cst: item.cst || natureTaxManual.cst_icms || null,
      gtin: sanitizeGtin(item.gtin),
      gtin_tributavel: sanitizeGtin(item.gtin_tributavel || item.gtin),
      cest: item.cest ? String(item.cest).replace(/\D/g, '').substring(0, 7) || null : null,
    }));

    // v8.7.0 — Em NF manual em branco não há itens; pula insert (rascunho sem itens).
    const { error: itemsError } = invoiceItems.length
      ? await supabase.from('fiscal_invoice_items').insert(invoiceItems)
      : { error: null as any };

    if (itemsError) {
      console.error('[fiscal-create-manual] Error inserting items:', itemsError);

      const { error: rollbackItemsError } = await supabase
        .from('fiscal_invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);

      if (rollbackItemsError) {
        console.error('[fiscal-create-manual] Error rolling back manual invoice items:', rollbackItemsError);
      }

      const { error: rollbackInvoiceError } = await supabase
        .from('fiscal_invoices')
        .delete()
        .eq('id', invoice.id)
        .eq('tenant_id', tenantId);

      if (rollbackInvoiceError) {
        console.error('[fiscal-create-manual] Error rolling back manual invoice:', rollbackInvoiceError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível salvar a nota manual por completo. A operação foi cancelada.',
          code: 'MANUAL_INVOICE_ITEMS_PERSISTENCE_FAILED',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
