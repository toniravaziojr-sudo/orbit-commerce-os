// =============================================
// FISCAL AUTO CREATE DRAFTS
// Cria rascunhos automaticamente para pedidos aprovados (paid)
// sem NF-e existente
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unbundleKitItems } from "../_shared/kit-unbundler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Determine CFOP based on origin and destination UF
function determineCfop(originUf: string, destUf: string, defaultIntra: string, defaultInter: string): string {
  if (originUf === destUf) {
    return defaultIntra || '5102';
  }
  return defaultInter || '6102';
}

/**
 * Busca código IBGE do município
 */
async function getIbgeCodigo(supabase: any, cidade: string, uf: string): Promise<string | null> {
  if (!cidade || !uf) return null;
  
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
  
  // Busca com a cidade original
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

    console.log('[fiscal-auto-create-drafts] Starting for tenant:', tenantId);

    // Get fiscal settings
    const { data: fiscalSettings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !fiscalSettings || !fiscalSettings.is_configured) {
      console.log('[fiscal-auto-create-drafts] Fiscal not configured, skipping');
      return new Response(
        JSON.stringify({ success: true, created: 0, message: 'Fiscal not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get paid orders without invoices
    const { data: paidOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total,
        subtotal,
        shipping_total,
        discount_total,
        shipping_street,
        shipping_number,
        shipping_complement,
        shipping_neighborhood,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        customer_name,
        customer:customers(id, full_name, cpf, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(50);

    if (ordersError) {
      console.error('[fiscal-auto-create-drafts] Error fetching orders:', ordersError);
      throw ordersError;
    }

    if (!paidOrders || paidOrders.length === 0) {
      console.log('[fiscal-auto-create-drafts] No paid orders found');
      return new Response(
        JSON.stringify({ success: true, created: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing invoices for these orders
    const orderIds = paidOrders.map(o => o.id);
    const { data: existingInvoices } = await supabase
      .from('fiscal_invoices')
      .select('order_id')
      .in('order_id', orderIds)
      .neq('status', 'canceled');

    const ordersWithInvoice = new Set((existingInvoices || []).map(inv => inv.order_id));
    const ordersToCreate = paidOrders.filter(order => !ordersWithInvoice.has(order.id));

    console.log(`[fiscal-auto-create-drafts] Found ${ordersToCreate.length} orders needing drafts`);

    let created = 0;
    const errors: string[] = [];

    for (const order of ordersToCreate) {
      try {
        // Get order items
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);

        if (!orderItems || orderItems.length === 0) {
          console.log(`[fiscal-auto-create-drafts] Order ${order.order_number} has no items, skipping`);
          continue;
        }

        // Determine CFOP
        const cfop = determineCfop(
          fiscalSettings.endereco_uf,
          order.shipping_state,
          fiscalSettings.cfop_intrastadual,
          fiscalSettings.cfop_interestadual
        );

        // Check if we should unbundle kits
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

        // Unbundle kits if setting is enabled
        if (fiscalSettings.desmembrar_estrutura) {
          console.log(`[fiscal-auto-create-drafts] Unbundling kits for order ${order.order_number}`);
          itemsToProcess = await unbundleKitItems(supabase, itemsToProcess);
        }

        // Get fiscal product data for all products (including unbundled)
        const productIds = itemsToProcess.map(item => item.product_id).filter(Boolean);
        const { data: fiscalProducts } = await supabase
          .from('fiscal_products')
          .select('*')
          .in('product_id', productIds);

        const fiscalProductMap = new Map(
          (fiscalProducts || []).map((fp: any) => [fp.product_id, fp])
        );

        // Build invoice items
        const invoiceItems = itemsToProcess.map((item, index) => {
          const fiscalProduct = fiscalProductMap.get(item.product_id);
          return {
            numero_item: index + 1,
            order_item_id: item.id || null,
            codigo_produto: item.sku || item.product_id?.substring(0, 8) || `PROD${index + 1}`,
            descricao: item.product_name || 'Produto',
            ncm: fiscalProduct?.ncm || '', // Can be empty, user fills in editor
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

        // Get next number
        const nextNumero = fiscalSettings.numero_nfe_atual || 1;

        // Lookup IBGE code
        const destMunicipioCodigo = await getIbgeCodigo(supabase, order.shipping_city, order.shipping_state);

        // Build draft data - customer is an array from the join, get first element
        const customerData = Array.isArray(order.customer) ? order.customer[0] : order.customer;
        const draftData = {
          tenant_id: tenantId,
          order_id: order.id,
          numero: nextNumero + created, // Increment for each draft
          serie: fiscalSettings.serie_nfe || 1,
          status: 'draft',
          natureza_operacao: 'VENDA DE MERCADORIA',
          cfop: cfop,
          valor_total: order.total,
          valor_produtos: order.subtotal,
          valor_frete: order.shipping_total || 0,
          valor_desconto: order.discount_total || 0,
          dest_nome: customerData?.full_name || order.customer_name || 'Cliente',
          dest_cpf_cnpj: customerData?.cpf || '',
          dest_inscricao_estadual: null,
          dest_endereco_logradouro: order.shipping_street,
          dest_endereco_numero: order.shipping_number || 'S/N',
          dest_endereco_complemento: order.shipping_complement,
          dest_endereco_bairro: order.shipping_neighborhood,
          dest_endereco_municipio: order.shipping_city,
          dest_endereco_municipio_codigo: destMunicipioCodigo,
          dest_endereco_uf: order.shipping_state,
          dest_endereco_cep: order.shipping_postal_code,
          dest_telefone: customerData?.phone || null,
          dest_email: customerData?.email || null,
          emitido_por: user.id,
        };

        // Create draft
        const { data: invoice, error: insertError } = await supabase
          .from('fiscal_invoices')
          .insert(draftData)
          .select()
          .single();

        if (insertError) {
          console.error(`[fiscal-auto-create-drafts] Error creating draft for order ${order.order_number}:`, insertError);
          errors.push(`Pedido ${order.order_number}: ${insertError.message}`);
          continue;
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
          console.error(`[fiscal-auto-create-drafts] Error inserting items for order ${order.order_number}:`, itemsError);
          // Delete the invoice we just created
          await supabase.from('fiscal_invoices').delete().eq('id', invoice.id);
          errors.push(`Pedido ${order.order_number}: Erro ao inserir itens`);
          continue;
        }

        // Log event
        await supabase
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoice.id,
            tenant_id: tenantId,
            event_type: 'draft_auto_created',
            event_data: { order_id: order.id, order_number: order.order_number },
            user_id: user.id,
          });

        created++;
        console.log(`[fiscal-auto-create-drafts] Created draft for order ${order.order_number}`);

      } catch (error) {
        console.error(`[fiscal-auto-create-drafts] Error processing order ${order.order_number}:`, error);
        errors.push(`Pedido ${order.order_number}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    console.log(`[fiscal-auto-create-drafts] Completed. Created ${created} drafts.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-auto-create-drafts] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
