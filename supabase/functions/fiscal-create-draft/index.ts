// =============================================
// FISCAL CREATE DRAFT - Cria rascunho de NF-e
// Monta payload completo para preview antes de emitir
// =============================================
import { errorResponse } from "../_shared/error-response.ts";
import { resolveAddressByCep } from "../_shared/cep-lookup.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// kit-unbundler removido daqui: desmembramento acontece em fiscal-prepare-invoice (PV → NF).
import { getNextFiscalNumber, insertFiscalInvoiceWithRetry, syncFiscalNumberCursor } from "../_shared/fiscal-numbering.ts";
import { buildFiscalOrderInheritance } from "../_shared/fiscal-order-mapping.ts";
import { calculateItemTaxes, type FiscalSettingsTax } from "../_shared/fiscal-tax-calculator.ts";
import { resolveOperationNature, pickCfopForUf } from "../_shared/fiscal-nature-resolver.ts";

const VERSION = 'v8.8.0';
// v8.8.0 — CFOP via Natureza de Operação vinculada (Fase 2). Aceita natureza_operacao_id
//          no payload; fallback: nome → natureza padrão do tenant → "Venda de Mercadoria".
// v8.7.0 — versão anterior.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

/**
 * Busca código IBGE do município
 */
async function getIbgeCodigo(supabase: any, cidade: string, uf: string): Promise<string | null> {
  if (!cidade || !uf) return null;
  
  // Normalizar cidade (uppercase, remover acentos básicos)
  const cidadeNorm = cidade
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  // Busca exata
  const { data: exact } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .eq('nome', cidadeNorm)
    .maybeSingle();
  
  if (exact?.codigo) return exact.codigo;
  
  // Busca com a cidade original em uppercase
  const { data: original } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .eq('nome', cidade.toUpperCase().trim())
    .maybeSingle();
  
  if (original?.codigo) return original.codigo;
  
  // Busca por prefixo
  const { data: prefix } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .ilike('nome', cidadeNorm + '%')
    .limit(1)
    .maybeSingle();
  
  if (prefix?.codigo) return prefix.codigo;
  
  // Busca por conteúdo
  const { data: contains } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .ilike('nome', '%' + cidadeNorm + '%')
    .limit(1)
    .maybeSingle();
  
  return contains?.codigo || null;
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
        JSON.stringify({ success: false, error: 'No tenant selected', code: 'NO_TENANT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;
    const { order_id, natureza_operacao, natureza_operacao_id, observacoes } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_id is required', code: 'MISSING_ORDER_ID' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fiscal-create-draft][${VERSION}] Creating draft for order:`, order_id);

    // Get fiscal settings
    const { data: fiscalSettings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !fiscalSettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas.', code: 'NO_FISCAL_SETTINGS' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order with customer
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', order_id)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido não encontrado.', code: 'ORDER_NOT_FOUND' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id);

    if (!orderItems || orderItems.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido sem itens.', code: 'NO_ORDER_ITEMS' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar itens para processamento
    let itemsToProcess: Array<{
      id?: string;
      product_id: string;
      product_name: string;
      sku: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }> = orderItems.map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name || 'Produto',
      sku: item.sku || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    // IMPORTANTE: Pedido de Venda SEMPRE preserva os itens como vieram do pedido
    // (kit continua kit). O desmembramento de kit em componentes acontece somente
    // na transição PV → NF, dentro de fiscal-prepare-invoice, no momento em que
    // o usuário clica em "Criar Nota Fiscal". Isso garante:
    //   1) PV é espelho fiel do pedido original.
    //   2) Mudança da configuração reflete em todas as NFs novas, inclusive
    //      geradas a partir de PVs antigos.
    //   3) Não consumimos processamento desmembrando pedidos que talvez nunca
    //      virem nota fiscal.


    // Get fiscal product data (incluindo componentes desmembrados)
    const productIds = itemsToProcess.map(item => item.product_id).filter(Boolean);
    const { data: fiscalProducts } = await supabase
      .from('fiscal_products')
      .select('*')
      .in('product_id', productIds);

    const fiscalProductMap = new Map(
      (fiscalProducts || []).map(fp => [fp.product_id, fp])
    );

    // Buscar dados fiscais do cadastro (fallback) + GTIN/EAN + peso
    const { data: productsData } = await supabase
      .from('products')
      .select('id, gtin, barcode, ncm, cest, origin_code, weight')
      .in('id', productIds);
    const productMap = new Map(
      (productsData || []).map((p: any) => [p.id, p])
    );

    const sanitizeGtin = (v: any): string => {
      const s = String(v ?? '').trim().toUpperCase();
      if (!s) return 'SEM GTIN';
      if (s === 'SEM GTIN') return 'SEM GTIN';
      const digits = s.replace(/\D/g, '');
      if ([8, 12, 13, 14].includes(digits.length)) return digits;
      return 'SEM GTIN';
    };

    // CFOP/finalidade/tipo vêm da Natureza de Operação resolvida (Fase 2)
    const nature = await resolveOperationNature(supabase, tenantId, {
      natureId: natureza_operacao_id || null,
      natureNome: natureza_operacao || null,
      defaultNatureId: fiscalSettings.default_sales_nature_id || null,
    });
    const cfop = pickCfopForUf(nature, fiscalSettings.endereco_uf, order.shipping_state);

    // Settings de tributação (regime + alíquotas padrão)
    const taxSettings: FiscalSettingsTax = {
      regime_tributario: fiscalSettings.regime_tributario || 'simples_nacional',
      pis_aliquota_padrao: Number(fiscalSettings.pis_aliquota_padrao || 0),
      cofins_aliquota_padrao: Number(fiscalSettings.cofins_aliquota_padrao || 0),
      icms_aliquota_padrao: Number(fiscalSettings.icms_aliquota_padrao || 0),
      pis_cst_padrao: fiscalSettings.pis_cst_padrao || '49',
      cofins_cst_padrao: fiscalSettings.cofins_cst_padrao || '49',
      cst_padrao: fiscalSettings.cst_padrao,
      csosn_padrao: fiscalSettings.csosn_padrao,
    };

    // Build invoice items - usa os itens processados (desmembrados ou não)
    const invoiceItems = itemsToProcess.map((item, index) => {
      const fiscalProduct = fiscalProductMap.get(item.product_id);
      const productCatalog: any = productMap.get(item.product_id) || {};
      const gtin = sanitizeGtin(productCatalog.gtin || productCatalog.barcode);
      const taxes = calculateItemTaxes(Number(item.total_price || 0), taxSettings, fiscalProduct as any);
      return {
        numero_item: index + 1,
        order_item_id: item.id || null,
        product_id: item.product_id || null,
        codigo_produto: item.sku || item.product_id?.substring(0, 8) || `PROD${index + 1}`,
        descricao: item.product_name || 'Produto',
        ncm: fiscalProduct?.ncm || productCatalog.ncm || '',
        cfop: fiscalProduct?.cfop_override || cfop,
        unidade: fiscalProduct?.unidade_comercial || 'UN',
        quantidade: item.quantity,
        valor_unitario: item.unit_price,
        valor_total: item.total_price,
        origem: (() => {
          const raw = fiscalProduct?.origem ?? productCatalog.origin_code ?? 0;
          const n = Number(raw);
          return Number.isFinite(n) ? Math.trunc(n) : 0;
        })(),
        csosn: taxes.csosn,
        cst: taxes.cst,
        icms_base: taxes.icms_base,
        icms_aliquota: taxes.icms_aliquota,
        icms_valor: taxes.icms_valor,
        pis_cst: taxes.pis_cst,
        pis_base: taxes.pis_base,
        pis_aliquota: taxes.pis_aliquota,
        pis_valor: taxes.pis_valor,
        cofins_cst: taxes.cofins_cst,
        cofins_base: taxes.cofins_base,
        cofins_aliquota: taxes.cofins_aliquota,
        cofins_valor: taxes.cofins_valor,
        gtin,
        gtin_tributavel: gtin,
        cest: fiscalProduct?.cest ? String(fiscalProduct.cest).replace(/\D/g, '').substring(0, 7) || null : (productCatalog.cest ? String(productCatalog.cest).replace(/\D/g, '').substring(0, 7) || null : null),
        _weight_grams: Number(productCatalog.weight || 0),
      };
    });

    // Peso bruto do pedido (kg) = soma item.peso * quantidade
    const pesoBrutoKg = invoiceItems.reduce(
      (acc, it: any) => acc + (Number(it._weight_grams || 0) * Number(it.quantidade || 0)) / 1000,
      0,
    );
    // Limpa campo auxiliar
    invoiceItems.forEach((it: any) => { delete it._weight_grams; });

    // Check for missing NCM
    const missingNcm = invoiceItems.filter(item => !item.ncm);
    if (missingNcm.length > 0) {
      console.error('[fiscal-create-draft] Products missing NCM:', missingNcm.map(i => i.descricao));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Produtos sem NCM cadastrado: ${missingNcm.map(i => i.descricao).join(', ')}. Configure o NCM em Configurações Fiscais > Produtos.`,
          code: 'MISSING_NCM'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serieNfe = fiscalSettings.serie_nfe || 1;

    // Resolução de IBGE: CEP é fonte primária; fallback por nome.
    console.log('[fiscal-create-draft] Resolving IBGE for CEP:', order.shipping_postal_code);
    let destMunicipioCodigo: string | null = null;
    const cepResolved = await resolveAddressByCep(supabase, order.shipping_postal_code);
    if (cepResolved?.ibge) {
      destMunicipioCodigo = cepResolved.ibge;
      console.log('[fiscal-create-draft] IBGE resolved via CEP (' + cepResolved.fonte + '):', destMunicipioCodigo);
    } else {
      destMunicipioCodigo = await getIbgeCodigo(supabase, order.shipping_city, order.shipping_state);
      if (destMunicipioCodigo) {
        console.log('[fiscal-create-draft] IBGE resolved via name fallback:', destMunicipioCodigo);
      } else {
        console.warn('[fiscal-create-draft] IBGE not resolved for:', order.shipping_postal_code, order.shipping_city, order.shipping_state);
      }
    }

    // Build draft base
    const customer = order.customer;
    const draftDataBase = {
      tenant_id: tenantId,
      order_id: order_id,
      serie: serieNfe,
      status: 'draft',
      tipo_documento: 1,
      fiscal_stage: 'pedido_venda',
      natureza_operacao: natureza_operacao || 'VENDA DE MERCADORIA',
      cfop: cfop,
      valor_total: order.total,
      valor_produtos: order.subtotal,
      valor_frete: order.shipping_total || 0,
      valor_desconto: order.discount_total || 0,
      dest_nome: customer?.full_name || order.customer_name || 'Cliente',
      dest_cpf_cnpj: customer?.cpf || order.customer_cpf || order.customer_cnpj || '',
      dest_inscricao_estadual: null,
      dest_endereco_logradouro: order.shipping_street,
      dest_endereco_numero: order.shipping_number || 'S/N',
      dest_endereco_complemento: order.shipping_complement,
      dest_endereco_bairro: order.shipping_neighborhood,
      // Nome oficial do município vem do CEP (evita typo do cliente derrubar xMun na SEFAZ)
      dest_endereco_municipio: cepResolved?.cidade || order.shipping_city,
      dest_endereco_municipio_codigo: destMunicipioCodigo,
      dest_endereco_uf: cepResolved?.uf || order.shipping_state,
      dest_endereco_cep: order.shipping_postal_code,
      peso_bruto: pesoBrutoKg > 0 ? Number(pesoBrutoKg.toFixed(3)) : null,
      peso_liquido: pesoBrutoKg > 0 ? Number(pesoBrutoKg.toFixed(3)) : null,
      quantidade_volumes: invoiceItems.length > 0 ? 1 : null,
      observacoes: observacoes || null,
      emitido_por: user.id,
      // Auto-herda transporte (modalidade SEFAZ + transportadora) e pagamento (tPag SEFAZ + indicador + valor)
      ...buildFiscalOrderInheritance(order),
    };

    // Check if draft already exists
    const { data: existingDraft } = await supabase
      .from('fiscal_invoices')
      .select('id, numero')
      .eq('order_id', order_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .maybeSingle();

    let invoice;
    if (existingDraft) {
      // Update existing draft (preserve existing number)
      const { data, error } = await supabase
        .from('fiscal_invoices')
        .update({ ...draftDataBase, numero: existingDraft.numero })
        .eq('id', existingDraft.id)
        .select()
        .single();
      
      if (error) throw error;
      invoice = data;

      // Delete old items and insert new
      await supabase
        .from('fiscal_invoice_items')
        .delete()
        .eq('invoice_id', existingDraft.id);
    } else {
      const nextNumero = await getNextFiscalNumber({
        supabase,
        tenantId,
        serie: serieNfe,
        fallbackNumeroAtual: fiscalSettings.numero_pedido_atual,
        docClass: 'pedido_venda',
      });

      // Create new draft with duplicate-safe retry
      const result = await insertFiscalInvoiceWithRetry({
        supabase,
        tenantId,
        serie: serieNfe,
        initialNumber: nextNumero,
        logPrefix: 'fiscal-create-draft',
        docClass: 'pedido_venda',
        buildDraftData: (numeroFiscal) => ({
          ...draftDataBase,
          numero: numeroFiscal,
        }),
      });

      invoice = result.invoice;

      await syncFiscalNumberCursor({
        supabase,
        tenantId,
        serie: serieNfe,
        currentCursor: result.numero + 1,
        logPrefix: 'fiscal-create-draft',
        docClass: 'pedido_venda',
      });
    }

    // Insert items
    const itemsToInsert = invoiceItems.map(item => ({
      ...item,
      invoice_id: invoice.id,
    }));

    const { error: itemsError } = await supabase
      .from('fiscal_invoice_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('[fiscal-create-draft] Error inserting items:', itemsError);
      throw itemsError;
    }

    // Log event
    await supabase
      .from('fiscal_invoice_events')
      .insert({
        invoice_id: invoice.id,
        tenant_id: tenantId,
        event_type: existingDraft ? 'draft_updated' : 'draft_created',
        event_data: { 
          order_id, 
          items_count: invoiceItems.length, 
          ibge_code: destMunicipioCodigo,
          kits_unbundled: false, // desmembramento acontece só em PV→NF (fiscal-prepare-invoice)
        },
        user_id: user.id,
      });

    console.log('[fiscal-create-draft] Draft created/updated:', invoice.id);

    // Return draft with items
    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice: {
          ...invoice,
          items: invoiceItems,
        },
        emitente: {
          razao_social: fiscalSettings.razao_social,
          cnpj: fiscalSettings.cnpj,
          endereco_uf: fiscalSettings.endereco_uf,
        },
        warnings: !destMunicipioCodigo ? ['Código IBGE do município de destino não encontrado. Verifique o nome da cidade.'] : [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'create-draft' });
  }
});
