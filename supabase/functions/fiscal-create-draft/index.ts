// =============================================
// FISCAL CREATE DRAFT - Cria rascunho de NF-e
// Monta payload completo para preview antes de emitir
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Determine CFOP based on origin and destination UF
function determineCfop(originUf: string, destUf: string, defaultIntra: string, defaultInter: string): string {
  if (originUf === destUf) {
    return defaultIntra || '5102'; // Intraestadual
  }
  return defaultInter || '6102'; // Interestadual
}

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
    const { order_id, natureza_operacao, observacoes } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-create-draft] Creating draft for order:', order_id);

    // Get fiscal settings
    const { data: fiscalSettings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !fiscalSettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, error: 'Pedido não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id);

    if (!orderItems || orderItems.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido sem itens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get fiscal product data
    const productIds = orderItems.map(item => item.product_id).filter(Boolean);
    const { data: fiscalProducts } = await supabase
      .from('fiscal_products')
      .select('*')
      .in('product_id', productIds);

    const fiscalProductMap = new Map(
      (fiscalProducts || []).map(fp => [fp.product_id, fp])
    );

    // Determine CFOP
    const cfop = determineCfop(
      fiscalSettings.endereco_uf,
      order.shipping_state,
      fiscalSettings.cfop_intrastadual,
      fiscalSettings.cfop_interestadual
    );

    // Build invoice items
    const invoiceItems = orderItems.map((item, index) => {
      const fiscalProduct = fiscalProductMap.get(item.product_id);
      return {
        numero_item: index + 1,
        order_item_id: item.id,
        codigo_produto: item.sku || item.product_id?.substring(0, 8) || `PROD${index + 1}`,
        descricao: item.product_name || 'Produto',
        ncm: fiscalProduct?.ncm || '',
        cfop: fiscalProduct?.cfop_override || cfop,
        unidade: fiscalProduct?.unidade_comercial || 'UN',
        quantidade: item.quantity,
        valor_unitario: item.unit_price,
        valor_total: item.total_price,
        origem: fiscalProduct?.origem || 0,
        csosn: fiscalProduct?.csosn_override || fiscalSettings.csosn_padrao,
        cst: fiscalProduct?.cst_override || fiscalSettings.cst_padrao,
      };
    });

    // Check for missing NCM
    const missingNcm = invoiceItems.filter(item => !item.ncm);
    if (missingNcm.length > 0) {
      console.error('[fiscal-create-draft] Products missing NCM:', missingNcm.map(i => i.descricao));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Produtos sem NCM cadastrado: ${missingNcm.map(i => i.descricao).join(', ')}. Configure o NCM em Configurações Fiscais > Produtos.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get next number
    const nextNumero = fiscalSettings.numero_nfe_atual || 1;

    // Buscar código IBGE do município de destino
    console.log('[fiscal-create-draft] Looking up IBGE code for:', order.shipping_city, order.shipping_state);
    const destMunicipioCodigo = await getIbgeCodigo(supabase, order.shipping_city, order.shipping_state);
    
    if (!destMunicipioCodigo) {
      console.warn('[fiscal-create-draft] IBGE code not found for:', order.shipping_city, order.shipping_state);
    } else {
      console.log('[fiscal-create-draft] IBGE code found:', destMunicipioCodigo);
    }

    // Build draft
    const customer = order.customer;
    const draftData = {
      tenant_id: tenantId,
      order_id: order_id,
      numero: nextNumero,
      serie: fiscalSettings.serie_nfe || 1,
      status: 'draft',
      natureza_operacao: natureza_operacao || 'VENDA DE MERCADORIA',
      cfop: cfop,
      valor_total: order.total,
      valor_produtos: order.subtotal,
      valor_frete: order.shipping_total || 0,
      valor_desconto: order.discount_total || 0,
      dest_nome: customer?.full_name || order.customer_name || 'Cliente',
      dest_cpf_cnpj: customer?.cpf || '',
      dest_inscricao_estadual: null,
      dest_endereco_logradouro: order.shipping_street,
      dest_endereco_numero: order.shipping_number || 'S/N',
      dest_endereco_complemento: order.shipping_complement,
      dest_endereco_bairro: order.shipping_neighborhood,
      dest_endereco_municipio: order.shipping_city,
      dest_endereco_municipio_codigo: destMunicipioCodigo, // Código IBGE lookup
      dest_endereco_uf: order.shipping_state,
      dest_endereco_cep: order.shipping_postal_code,
      observacoes: observacoes || null,
      emitido_por: user.id,
    };

    // Check if draft already exists
    const { data: existingDraft } = await supabase
      .from('fiscal_invoices')
      .select('id')
      .eq('order_id', order_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .maybeSingle();

    let invoice;
    if (existingDraft) {
      // Update existing draft
      const { data, error } = await supabase
        .from('fiscal_invoices')
        .update(draftData)
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
      // Create new draft
      const { data, error } = await supabase
        .from('fiscal_invoices')
        .insert(draftData)
        .select()
        .single();
      
      if (error) throw error;
      invoice = data;
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
        event_data: { order_id, items_count: invoiceItems.length, ibge_code: destMunicipioCodigo },
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-create-draft] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
